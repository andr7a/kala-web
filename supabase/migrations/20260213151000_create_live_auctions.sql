/*
  Live auctions schema for API + DigitalOcean Postgres.
  Rules:
  - Each accepted bid must be at least current_bid + 100 USD.
  - Each accepted bid extends the auction by 10 seconds.
*/

CREATE TABLE IF NOT EXISTS live_auctions (
  id uuid PRIMARY KEY,
  lot_number text NOT NULL,
  seller_user_id uuid,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('scheduled', 'live', 'closed', 'cancelled')),
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

CREATE INDEX IF NOT EXISTS idx_live_auctions_lot
  ON live_auctions(lot_number);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_created_at
  ON auction_bids(auction_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_auctions_single_open_lot
  ON live_auctions(lot_number)
  WHERE status IN ('scheduled', 'live');

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

CREATE OR REPLACE FUNCTION close_expired_live_auctions()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE live_auctions
  SET status = 'closed'
  WHERE status = 'live'
    AND ends_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
