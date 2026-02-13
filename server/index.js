import 'dotenv/config';
// Allow self-signed certs for managed Postgres in local dev.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set. API will not be able to query the database.');
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      // DigitalOcean managed Postgres uses a self-signed cert chain by default.
      // Disable verification to avoid SELF_SIGNED_CERT_IN_CHAIN errors.
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    })
  : null;

const AUCTION_MIN_INCREMENT = 100;
const AUCTION_BID_EXTENSION_SECONDS = 10;
const AUCTION_START_DELAY_SECONDS = 60;
const MAX_SAVED_AUCTION_LOTS = 3;
const AUCTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS live_auctions (
    id uuid PRIMARY KEY,
    lot_number text NOT NULL,
    seller_user_id uuid,
    status text NOT NULL DEFAULT 'live' CHECK (status IN ('queued', 'scheduled', 'live', 'closed', 'cancelled')),
    queue_group_id uuid,
    queue_position integer,
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL DEFAULT (now() + interval '10 seconds'),
    starting_bid numeric(12,2) NOT NULL CHECK (starting_bid >= 0),
    current_bid numeric(12,2) NOT NULL CHECK (current_bid >= starting_bid),
    min_increment numeric(12,2) NOT NULL DEFAULT 100 CHECK (min_increment = 100),
    current_bidder_name text,
    current_bidder_user_id uuid,
    current_bid_at timestamptz,
    total_bids integer NOT NULL DEFAULT 0 CHECK (total_bids >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE live_auctions
    ADD COLUMN IF NOT EXISTS queue_group_id uuid;

  ALTER TABLE live_auctions
    ADD COLUMN IF NOT EXISTS queue_position integer;

  ALTER TABLE live_auctions
    DROP CONSTRAINT IF EXISTS live_auctions_status_check;

  ALTER TABLE live_auctions
    ADD CONSTRAINT live_auctions_status_check
    CHECK (status IN ('queued', 'scheduled', 'live', 'closed', 'cancelled')) NOT VALID;

  ALTER TABLE live_auctions
    VALIDATE CONSTRAINT live_auctions_status_check;

  CREATE TABLE IF NOT EXISTS auction_bids (
    id bigserial PRIMARY KEY,
    auction_id uuid NOT NULL REFERENCES live_auctions(id) ON DELETE CASCADE,
    bidder_name text NOT NULL CHECK (char_length(trim(bidder_name)) > 0),
    bidder_user_id uuid,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_live_auctions_status_ends_at
    ON live_auctions(status, ends_at DESC);

  CREATE INDEX IF NOT EXISTS idx_live_auctions_status_starts_at
    ON live_auctions(status, starts_at ASC);

  CREATE INDEX IF NOT EXISTS idx_live_auctions_lot
    ON live_auctions(lot_number);

  CREATE INDEX IF NOT EXISTS idx_live_auctions_queue
    ON live_auctions(queue_group_id, queue_position);

  CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_created_at
    ON auction_bids(auction_id, created_at DESC);

  DROP INDEX IF EXISTS idx_live_auctions_single_open_lot;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_live_auctions_single_open_lot
    ON live_auctions(lot_number)
    WHERE status IN ('queued', 'scheduled', 'live');

  CREATE OR REPLACE FUNCTION set_live_auctions_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS trg_live_auctions_updated_at ON live_auctions;
  CREATE TRIGGER trg_live_auctions_updated_at
  BEFORE UPDATE ON live_auctions
  FOR EACH ROW
  EXECUTE FUNCTION set_live_auctions_updated_at();
`;

let auctionSchemaInitPromise = null;
let lastAuctionPruneAtMs = 0;

async function ensureAuctionSchema() {
  if (!pool) throw new Error('DATABASE_URL not configured');
  if (!auctionSchemaInitPromise) {
    auctionSchemaInitPromise = (async () => {
      await pool.query(AUCTION_SCHEMA_SQL);
      return true;
    })().catch((error) => {
      auctionSchemaInitPromise = null;
      throw error;
    });
  }
  await auctionSchemaInitPromise;
}

async function activateNextQueuedAuction(db, closedAuctionRow) {
  const queueGroupId = closedAuctionRow?.queue_group_id ?? null;
  const queuePosition = Number(closedAuctionRow?.queue_position);

  if (!queueGroupId || !Number.isFinite(queuePosition)) {
    return null;
  }

  const nextQueuePosition = queuePosition + 1;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const nextResult = await client.query(
      `
        SELECT id
        FROM live_auctions
        WHERE queue_group_id = $1
          AND queue_position = $2
          AND status = 'queued'
        FOR UPDATE
      `,
      [queueGroupId, nextQueuePosition]
    );

    if (nextResult.rows.length === 0) {
      await client.query('COMMIT');
      return null;
    }

    const nextAuctionId = nextResult.rows[0].id;
    const updateResult = await client.query(
      `
        UPDATE live_auctions
        SET
          status = 'live',
          starts_at = now(),
          ends_at = now() + ($2::int * interval '1 second')
        WHERE id = $1
          AND status = 'queued'
        RETURNING *
      `,
      [nextAuctionId, AUCTION_BID_EXTENSION_SECONDS]
    );

    await client.query('COMMIT');
    return updateResult.rows[0] ?? null;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function pruneAuctionsToLastThreeLots(db, options = {}) {
  const force = options.force === true;
  const now = Date.now();
  if (!force && now - lastAuctionPruneAtMs < 15000) {
    return 0;
  }
  lastAuctionPruneAtMs = now;

  const lotCountResult = await db.query('SELECT COUNT(DISTINCT lot_number) AS lot_count FROM live_auctions');
  const lotCount = Number(lotCountResult.rows?.[0]?.lot_count ?? 0);
  if (!Number.isFinite(lotCount) || lotCount <= MAX_SAVED_AUCTION_LOTS) {
    return 0;
  }

  const deleteResult = await db.query(`
    WITH keep_lots AS (
      SELECT lot_number
      FROM live_auctions
      GROUP BY lot_number
      ORDER BY MAX(created_at) DESC
      LIMIT $1
    )
    DELETE FROM live_auctions
    WHERE lot_number NOT IN (SELECT lot_number FROM keep_lots)
    RETURNING id
  `, [MAX_SAVED_AUCTION_LOTS]);

  return deleteResult.rowCount ?? 0;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function asMoney(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

function asBidderName(value) {
  if (typeof value !== 'string') return 'Guest';
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : 'Guest';
}

function parseAuctionRow(row) {
  return {
    ...row,
    starting_bid: Number(row.starting_bid),
    current_bid: Number(row.current_bid),
    min_increment: Number(row.min_increment),
    total_bids: Number(row.total_bids),
    queue_position:
      row.queue_position === null || row.queue_position === undefined
        ? null
        : Number(row.queue_position),
  };
}

function parseAuctionBidRow(row) {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

function buildFilters(query, values) {
  const filters = [];

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const tokens = search.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const token of tokens) {
      values.push(`%${token}%`);
      const idx = values.length;
      filters.push(
        `(make ILIKE $${idx} OR model ILIKE $${idx} OR full_title ILIKE $${idx} OR lot ILIKE $${idx})`
      );
    }
  }

  const yearFrom = clampInt(query.year_from, 0, 2100, NaN);
  const yearTo = clampInt(query.year_to, 0, 2100, NaN);
  if (Number.isFinite(yearFrom)) {
    values.push(yearFrom);
    filters.push(`year >= $${values.length}`);
  }
  if (Number.isFinite(yearTo)) {
    values.push(yearTo);
    filters.push(`year <= $${values.length}`);
  }

  const odoMin = clampInt(query.odometer_min, 0, 5000000, NaN);
  const odoMax = clampInt(query.odometer_max, 0, 5000000, NaN);
  if (Number.isFinite(odoMin)) {
    values.push(odoMin);
    filters.push(`odometer_value >= $${values.length}`);
  }
  if (Number.isFinite(odoMax)) {
    values.push(odoMax);
    filters.push(`odometer_value <= $${values.length}`);
  }

  const buyNowMin = clampInt(query.buy_now_min, 0, 100000000, NaN);
  const buyNowMax = clampInt(query.buy_now_max, 0, 100000000, NaN);
  if (Number.isFinite(buyNowMin)) {
    values.push(buyNowMin);
    filters.push(`buy_now_price >= $${values.length}`);
  }
  if (Number.isFinite(buyNowMax)) {
    values.push(buyNowMax);
    filters.push(`buy_now_price <= $${values.length}`);
  }

  const make = typeof query.make === 'string' ? query.make.trim() : '';
  if (make) {
    values.push(make);
    filters.push(`make ILIKE $${values.length}`);
  }

  const model = typeof query.model === 'string' ? query.model.trim() : '';
  if (model) {
    values.push(model);
    filters.push(`model ILIKE $${values.length}`);
  }

  const interiorColor = typeof query.interior_color === 'string' ? query.interior_color.trim() : '';
  if (interiorColor) {
    values.push(interiorColor);
    filters.push(`interior_color ILIKE $${values.length}`);
  }

  const exteriorColor = typeof query.color === 'string' ? query.color.trim() : '';
  if (exteriorColor) {
    values.push(exteriorColor);
    filters.push(`color ILIKE $${values.length}`);
  }

  const fuel = typeof query.fuel === 'string' ? query.fuel.trim() : '';
  if (fuel) {
    values.push(fuel);
    filters.push(`fuel ILIKE $${values.length}`);
  }

  const drive = typeof query.drive === 'string' ? query.drive.trim() : '';
  if (drive) {
    values.push(drive);
    filters.push(`drive ILIKE $${values.length}`);
  }

  const transmission = typeof query.transmission === 'string' ? query.transmission.trim() : '';
  if (transmission) {
    values.push(transmission);
    filters.push(`transmission ILIKE $${values.length}`);
  }

  const condition = typeof query.condition === 'string' ? query.condition.trim() : '';
  if (condition) {
    values.push(condition);
    filters.push(`condition_note ILIKE $${values.length}`);
  }

  if (query.has_images === 'true') {
    filters.push('images IS NOT NULL');
  }

  if (query.has_buy_now === 'true') {
    filters.push('buy_now_price IS NOT NULL AND buy_now_price > 0');
  }
  if (query.has_buy_now === 'false') {
    filters.push('(buy_now_price IS NULL OR buy_now_price <= 0)');
  }

  return filters;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/cars/filters', async (_req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const sql = `
    SELECT
      (SELECT ARRAY_AGG(DISTINCT make ORDER BY make)
        FROM copart_lots
        WHERE make IS NOT NULL AND make <> '') AS makes,
      (SELECT ARRAY_AGG(DISTINCT color ORDER BY color)
        FROM copart_lots
        WHERE color IS NOT NULL AND color <> '') AS colors,
      (SELECT ARRAY_AGG(DISTINCT interior_color ORDER BY interior_color)
        FROM copart_lots
        WHERE interior_color IS NOT NULL AND interior_color <> '') AS interior_colors,
      (SELECT ARRAY_AGG(DISTINCT fuel ORDER BY fuel)
        FROM copart_lots
        WHERE fuel IS NOT NULL AND fuel <> '') AS fuels,
      (SELECT ARRAY_AGG(DISTINCT transmission ORDER BY transmission)
        FROM copart_lots
        WHERE transmission IS NOT NULL AND transmission <> '') AS transmissions,
      (SELECT ARRAY_AGG(DISTINCT condition_note ORDER BY condition_note)
        FROM copart_lots
        WHERE condition_note IS NOT NULL AND condition_note <> '') AS conditions,
      (SELECT ARRAY_AGG(DISTINCT year ORDER BY year DESC)
        FROM copart_lots
        WHERE year IS NOT NULL) AS years,
      (SELECT EXISTS(
        SELECT 1 FROM copart_lots WHERE buy_now_price IS NOT NULL AND buy_now_price > 0
      )) AS has_buy_now_available,
      (SELECT EXISTS(
        SELECT 1 FROM copart_lots WHERE buy_now_price IS NULL OR buy_now_price <= 0
      )) AS has_buy_now_not_available
  `;

  try {
    const result = await pool.query(sql);
    res.json(result.rows[0] ?? {});
  } catch (error) {
    console.error('API /api/cars/filters error', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/api/cars', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const limit = clampInt(req.query.limit, 1, 2000, 300);
  const offset = clampInt(req.query.offset, 0, 100000000, 0);

  const values = [];
  const filters = buildFilters(req.query, values);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  values.push(limit);
  const limitIdx = values.length;
  values.push(offset);
  const offsetIdx = values.length;

  const sql = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM copart_lots
    ${whereClause}
    ORDER BY auction_date_ts DESC NULLS LAST, created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  try {
    const result = await pool.query(sql, values);
    const total = result.rows.length > 0 ? Number.parseInt(result.rows[0].total_count, 10) : 0;
    const items = result.rows.map(({ total_count, ...row }) => row);
    res.json({ items, total, limit, offset });
  } catch (error) {
    console.error('API /api/cars error', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/api/cars/:lot', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const lot = req.params.lot;
  try {
    const result = await pool.query('SELECT * FROM copart_lots WHERE lot = $1 LIMIT 1', [lot]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('API /api/cars/:lot error', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.post('/api/cars/by-lots', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const lots = Array.isArray(req.body?.lots) ? req.body.lots.map(String) : [];
  if (lots.length === 0) {
    res.json({ items: [] });
    return;
  }

  const limitedLots = lots.slice(0, 500);
  try {
    const result = await pool.query('SELECT * FROM copart_lots WHERE lot = ANY($1::text[])', [limitedLots]);
    res.json({ items: result.rows });
  } catch (error) {
    console.error('API /api/cars/by-lots error', error);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/api/auctions', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const includeClosed = req.query.include_closed === 'true';

  const whereClause = includeClosed
    ? ''
    : "WHERE status IN ('live', 'scheduled', 'queued')";

  const sql = `
    SELECT *
    FROM live_auctions
    ${whereClause}
    ORDER BY
      CASE status
        WHEN 'live' THEN 0
        WHEN 'scheduled' THEN 1
        WHEN 'queued' THEN 2
        WHEN 'closed' THEN 3
        ELSE 4
      END ASC,
      ends_at ASC,
      created_at DESC
    LIMIT 200
  `;

  try {
    await ensureAuctionSchema();

    const closeResult = await pool.query(
      "UPDATE live_auctions SET status = 'closed' WHERE status IN ('live', 'scheduled') AND ends_at <= now() RETURNING *"
    );
    for (const closed of closeResult.rows ?? []) {
      await activateNextQueuedAuction(pool, closed);
    }
    await pool.query(
      `
        UPDATE live_auctions
        SET status = 'live'
        WHERE status = 'scheduled'
          AND starts_at <= now()
          AND created_at <= now() - ($1::int * interval '1 second')
          AND ends_at > now()
      `,
      [AUCTION_START_DELAY_SECONDS]
    );
    await pruneAuctionsToLastThreeLots(pool);

    const result = await pool.query(sql);
    res.json({ items: result.rows.map((row) => parseAuctionRow(row)) });
  } catch (error) {
    console.error('API /api/auctions error', error);
    res.status(500).json({ error: 'Query failed', details: error?.message || 'Unknown database error' });
  }
});

app.get('/api/auctions/:id/bids', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const auctionId = String(req.params.id ?? '').trim();
  if (!auctionId) {
    res.status(400).json({ error: 'Auction id is required' });
    return;
  }

  const limit = clampInt(req.query.limit, 1, 100, 20);
  const sql = `
    SELECT *
    FROM auction_bids
    WHERE auction_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  try {
    await ensureAuctionSchema();
    const result = await pool.query(sql, [auctionId, limit]);
    res.json({ items: result.rows.map((row) => parseAuctionBidRow(row)) });
  } catch (error) {
    console.error('API /api/auctions/:id/bids error', error);
    res.status(500).json({ error: 'Query failed', details: error?.message || 'Unknown database error' });
  }
});

app.post('/api/auctions', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const lotNumber = String(req.body?.lotNumber ?? '').trim();
  const startingBid = asMoney(req.body?.startingBid);
  const sellerUserId = typeof req.body?.sellerUserId === 'string' ? req.body.sellerUserId.trim() || null : null;

  if (!lotNumber) {
    res.status(400).json({ error: 'lotNumber is required' });
    return;
  }
  if (!Number.isFinite(startingBid) || startingBid < 0) {
    res.status(400).json({ error: 'startingBid must be >= 0' });
    return;
  }

  const auctionId = randomUUID();

  const sql = `
    INSERT INTO live_auctions (
      id,
      lot_number,
      seller_user_id,
      status,
      starts_at,
      ends_at,
      starting_bid,
      current_bid,
      min_increment
    )
    VALUES (
      $1,
      $2,
      $3,
      'scheduled',
      now() + ($4::int * interval '1 second'),
      now() + (($4::int + $5::int) * interval '1 second'),
      $6,
      $6,
      $7
    )
    RETURNING *
  `;

  try {
    await ensureAuctionSchema();
    const result = await pool.query(sql, [
      auctionId,
      lotNumber,
      sellerUserId,
      AUCTION_START_DELAY_SECONDS,
      AUCTION_BID_EXTENSION_SECONDS,
      startingBid,
      AUCTION_MIN_INCREMENT,
    ]);
    await pruneAuctionsToLastThreeLots(pool, { force: true });
    res.status(201).json(parseAuctionRow(result.rows[0]));
  } catch (error) {
    if (error && error.code === '23505') {
      res.status(409).json({ error: 'This lot already has an open auction.' });
      return;
    }
    console.error('API /api/auctions (POST) error', error);
    res.status(500).json({ error: 'Could not create auction', details: error?.message || 'Unknown database error' });
  }
});

app.post('/api/auctions/schedule', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const lotNumbersRaw = Array.isArray(req.body?.lotNumbers) ? req.body.lotNumbers : [];
  const lotNumbers = Array.from(
    new Set(
      lotNumbersRaw
        .map((lot) => String(lot ?? '').trim())
        .filter(Boolean)
    )
  ).slice(0, MAX_SAVED_AUCTION_LOTS);

  const startingBid = asMoney(req.body?.startingBid);
  const sellerUserId = typeof req.body?.sellerUserId === 'string' ? req.body.sellerUserId.trim() || null : null;

  if (lotNumbers.length === 0) {
    res.status(400).json({ error: 'lotNumbers must include at least one lot' });
    return;
  }
  if (!Number.isFinite(startingBid) || startingBid < 0) {
    res.status(400).json({ error: 'startingBid must be >= 0' });
    return;
  }

  const client = await pool.connect();
  try {
    await ensureAuctionSchema();
    await client.query('BEGIN');

    const existingResult = await client.query(
      `
        SELECT lot_number
        FROM live_auctions
        WHERE lot_number = ANY($1::text[])
          AND status IN ('queued', 'scheduled', 'live')
      `,
      [lotNumbers]
    );
    if (existingResult.rows.length > 0) {
      const lots = existingResult.rows.map((row) => row.lot_number);
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'Some lots already have open auctions',
        lots,
      });
      return;
    }

    const queueGroupId = randomUUID();
    const created = [];

    for (let index = 0; index < lotNumbers.length; index += 1) {
      const lotNumber = lotNumbers[index];
      const auctionId = randomUUID();
      const queuePosition = index + 1;
      const isFirst = index === 0;

      const result = await client.query(
        `
          INSERT INTO live_auctions (
            id,
            lot_number,
            seller_user_id,
            status,
            queue_group_id,
            queue_position,
            starts_at,
            ends_at,
            starting_bid,
            current_bid,
            min_increment
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            CASE
              WHEN $7::boolean THEN now() + ($8::int * interval '1 second')
              ELSE now()
            END,
            CASE
              WHEN $7::boolean THEN now() + (($8::int + $9::int) * interval '1 second')
              ELSE now() + ($9::int * interval '1 second')
            END,
            $10,
            $10,
            $11
          )
          RETURNING *
        `,
        [
          auctionId,
          lotNumber,
          sellerUserId,
          isFirst ? 'scheduled' : 'queued',
          queueGroupId,
          queuePosition,
          isFirst,
          AUCTION_START_DELAY_SECONDS,
          AUCTION_BID_EXTENSION_SECONDS,
          startingBid,
          AUCTION_MIN_INCREMENT,
        ]
      );

      created.push(parseAuctionRow(result.rows[0]));
    }

    await client.query('COMMIT');
    await pruneAuctionsToLastThreeLots(pool, { force: true });
    res.status(201).json({
      group_id: queueGroupId,
      items: created,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('API /api/auctions/schedule error', error);
    res.status(500).json({ error: 'Could not schedule auctions', details: error?.message || 'Unknown database error' });
  } finally {
    client.release();
  }
});

app.post('/api/auctions/:id/close', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const auctionId = String(req.params.id ?? '').trim();
  if (!auctionId) {
    res.status(400).json({ error: 'Auction id is required' });
    return;
  }

  const sql = `
    UPDATE live_auctions
    SET status = 'closed'
    WHERE id = $1
      AND status IN ('live', 'scheduled')
    RETURNING *
  `;

  try {
    await ensureAuctionSchema();
    const result = await pool.query(sql, [auctionId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Auction not found or already closed' });
      return;
    }
    await activateNextQueuedAuction(pool, result.rows[0]);
    await pruneAuctionsToLastThreeLots(pool, { force: true });
    res.json({ ok: true, auction: parseAuctionRow(result.rows[0]) });
  } catch (error) {
    console.error('API /api/auctions/:id/close error', error);
    res.status(500).json({ error: 'Could not close auction', details: error?.message || 'Unknown database error' });
  }
});

app.post('/api/auctions/:id/bid', async (req, res) => {
  if (!pool) {
    res.status(500).json({ error: 'DATABASE_URL not configured' });
    return;
  }

  const auctionId = String(req.params.id ?? '').trim();
  const bidAmount = asMoney(req.body?.amount);
  const bidderName = asBidderName(req.body?.bidderName);
  const bidderUserId = typeof req.body?.bidderUserId === 'string' ? req.body.bidderUserId.trim() || null : null;

  if (!auctionId) {
    res.status(400).json({ error: 'Auction id is required' });
    return;
  }
  if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
    res.status(400).json({ error: 'Bid amount must be greater than zero' });
    return;
  }

  const client = await pool.connect();
  try {
    await ensureAuctionSchema();

    await client.query('BEGIN');

    const lockResult = await client.query(
      'SELECT * FROM live_auctions WHERE id = $1 FOR UPDATE',
      [auctionId]
    );

    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Auction not found' });
      return;
    }

    let auction = lockResult.rows[0];
    const now = new Date();
    const startsAt = new Date(auction.starts_at);
    const createdAt = new Date(auction.created_at);
    const endsAt = new Date(auction.ends_at);
    const earliestAllowedStartAt = new Date(
      Math.max(
        startsAt.getTime(),
        createdAt.getTime() + AUCTION_START_DELAY_SECONDS * 1000
      )
    );

    if (now >= endsAt) {
      const closeResult = await client.query(
        "UPDATE live_auctions SET status = 'closed' WHERE id = $1 RETURNING *",
        [auctionId]
      );
      await client.query('COMMIT');
      if (closeResult.rows.length > 0) {
        await activateNextQueuedAuction(pool, closeResult.rows[0]);
        await pruneAuctionsToLastThreeLots(pool, { force: true });
      }
      res.status(400).json({ error: 'Auction has ended' });
      return;
    }

    if (auction.status === 'scheduled') {
      if (now < earliestAllowedStartAt) {
        const remainingSeconds = Math.max(
          1,
          Math.ceil((earliestAllowedStartAt.getTime() - now.getTime()) / 1000)
        );
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Auction has not started yet (${remainingSeconds}s remaining)` });
        return;
      }

      const activateResult = await client.query(
        "UPDATE live_auctions SET status = 'live' WHERE id = $1 RETURNING *",
        [auctionId]
      );
      auction = activateResult.rows[0] ?? auction;
    }

    if (auction.status !== 'live') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Auction is not live' });
      return;
    }

    const currentBid = Number(auction.current_bid);
    const startingBid = Number(auction.starting_bid);
    const minRequired = Math.max(currentBid, startingBid) + AUCTION_MIN_INCREMENT;

    if (bidAmount < minRequired) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: `Bid must be at least ${minRequired}`,
        minRequired,
      });
      return;
    }

    await client.query(
      `
        INSERT INTO auction_bids (auction_id, bidder_name, bidder_user_id, amount)
        VALUES ($1, $2, $3, $4)
      `,
      [auctionId, bidderName, bidderUserId, bidAmount]
    );

    const updateResult = await client.query(
      `
        UPDATE live_auctions
        SET
          current_bid = $2,
          min_increment = $3,
          current_bidder_name = $4,
          current_bidder_user_id = $5,
          current_bid_at = now(),
          ends_at = now() + ($6::int * interval '1 second'),
          total_bids = total_bids + 1
        WHERE id = $1
        RETURNING *
      `,
      [
        auctionId,
        bidAmount,
        AUCTION_MIN_INCREMENT,
        bidderName,
        bidderUserId,
        AUCTION_BID_EXTENSION_SECONDS,
      ]
    );

    await client.query('COMMIT');

    const updated = parseAuctionRow(updateResult.rows[0]);
    res.json({
      auction_id: updated.id,
      accepted_amount: bidAmount,
      current_bid: updated.current_bid,
      min_next_bid: updated.current_bid + AUCTION_MIN_INCREMENT,
      total_bids: updated.total_bids,
      ends_at: updated.ends_at,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('API /api/auctions/:id/bid error', error);
    res.status(500).json({ error: 'Could not place bid', details: error?.message || 'Unknown database error' });
  } finally {
    client.release();
  }
});

if (!process.env.VERCEL) {
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

export default app;
