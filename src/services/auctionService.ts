export type AuctionStatus = 'scheduled' | 'live' | 'closed' | 'cancelled';

export interface LiveAuction {
  id: string;
  lotNumber: string;
  status: AuctionStatus;
  startsAt: string;
  endsAt: string;
  startingBid: number;
  currentBid: number;
  minIncrement: number;
  currentBidderName: string | null;
  currentBidAt: string | null;
  totalBids: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionBid {
  id: number;
  auctionId: string;
  bidderName: string;
  bidderUserId: string | null;
  amount: number;
  createdAt: string;
}

export interface PlaceBidResult {
  auctionId: string;
  acceptedAmount: number;
  currentBid: number;
  minNextBid: number;
  totalBids: number;
  endsAt: string;
}

export interface CreateLiveAuctionInput {
  lotNumber: string;
  startingBid: number;
  sellerUserId?: string | null;
}

export interface PlaceAuctionBidInput {
  auctionId: string;
  amount: number;
  bidderName: string;
  bidderUserId?: string | null;
}

type LiveAuctionRow = {
  id: string;
  lot_number: string;
  status: AuctionStatus;
  starts_at: string;
  ends_at: string;
  starting_bid: number | string;
  current_bid: number | string;
  min_increment: number | string;
  current_bidder_name: string | null;
  current_bid_at: string | null;
  total_bids: number;
  created_at: string;
  updated_at: string;
};

type AuctionBidRow = {
  id: number;
  auction_id: string;
  bidder_name: string;
  bidder_user_id: string | null;
  amount: number | string;
  created_at: string;
};

type PlaceBidApiResponse = {
  auction_id: string;
  accepted_amount: number | string;
  current_bid: number | string;
  min_next_bid: number | string;
  total_bids: number;
  ends_at: string;
};

const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '';

function toNumber(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    const message = json?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  if (json === null) {
    throw new Error('Invalid API response');
  }
  return json as T;
}

function mapAuction(row: LiveAuctionRow): LiveAuction {
  return {
    id: row.id,
    lotNumber: row.lot_number,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startingBid: toNumber(row.starting_bid),
    currentBid: toNumber(row.current_bid),
    minIncrement: toNumber(row.min_increment),
    currentBidderName: row.current_bidder_name ?? null,
    currentBidAt: row.current_bid_at ?? null,
    totalBids: row.total_bids ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBid(row: AuctionBidRow): AuctionBid {
  return {
    id: row.id,
    auctionId: row.auction_id,
    bidderName: row.bidder_name,
    bidderUserId: row.bidder_user_id,
    amount: toNumber(row.amount),
    createdAt: row.created_at,
  };
}

export async function fetchLiveAuctions(options?: { includeClosed?: boolean }): Promise<LiveAuction[]> {
  const query = options?.includeClosed ? '?include_closed=true' : '';
  const data = await fetchApi<{ items?: LiveAuctionRow[] } | null>(`/api/auctions${query}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((row) => mapAuction(row));
}

export async function fetchAuctionBids(auctionId: string, limit = 20): Promise<AuctionBid[]> {
  const safeLimit = Math.min(Math.max(Math.round(limit), 1), 100);
  const data = await fetchApi<{ items?: AuctionBidRow[] } | null>(
    `/api/auctions/${encodeURIComponent(auctionId)}/bids?limit=${safeLimit}`
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((row) => mapBid(row));
}

export async function createLiveAuction(input: CreateLiveAuctionInput): Promise<LiveAuction> {
  const data = await fetchApi<LiveAuctionRow>('/api/auctions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lotNumber: input.lotNumber.trim(),
      startingBid: input.startingBid,
      sellerUserId: input.sellerUserId ?? null,
    }),
  });
  return mapAuction(data);
}

export async function closeLiveAuction(auctionId: string): Promise<void> {
  await fetchApi(`/api/auctions/${encodeURIComponent(auctionId)}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function placeAuctionBid(input: PlaceAuctionBidInput): Promise<PlaceBidResult> {
  const data = await fetchApi<PlaceBidApiResponse>(
    `/api/auctions/${encodeURIComponent(input.auctionId)}/bid`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: input.amount,
        bidderName: input.bidderName,
        bidderUserId: input.bidderUserId ?? null,
      }),
    }
  );

  return {
    auctionId: data.auction_id,
    acceptedAmount: toNumber(data.accepted_amount),
    currentBid: toNumber(data.current_bid),
    minNextBid: toNumber(data.min_next_bid),
    totalBids: data.total_bids ?? 0,
    endsAt: data.ends_at,
  };
}

export function subscribeToAuctionUpdates(onChange: () => void): () => void {
  const timer = window.setInterval(() => {
    onChange();
  }, 1000);
  return () => {
    window.clearInterval(timer);
  };
}
