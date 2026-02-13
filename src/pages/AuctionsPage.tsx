import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, Gavel, Search } from 'lucide-react';
import { fetchCars, fetchCarsByLotNumbers, type Car } from '../services/carService';
import { useAuth } from '../context/AuthContext';
import {
  closeLiveAuction,
  createLiveAuction,
  fetchAuctionBids,
  fetchLiveAuctions,
  placeAuctionBid,
  subscribeToAuctionUpdates,
  type AuctionBid,
  type LiveAuction,
} from '../services/auctionService';

const BIDDER_NAME_KEY = 'auction_bidder_name';
const FIXED_MIN_INCREMENT = 100;
const BID_WINDOW_SECONDS = 10;

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCountdown(endAtIso: string, nowMs: number): string {
  const endMs = new Date(endAtIso).getTime();
  const diff = endMs - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return 'Ended';

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type AuctionView = LiveAuction & {
  car: Car | null;
  bids: AuctionBid[];
};

export default function AuctionsPage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<LiveAuction[]>([]);
  const [auctionCars, setAuctionCars] = useState<Record<string, Car>>({});
  const [auctionBids, setAuctionBids] = useState<Record<string, AuctionBid[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [carQuery, setCarQuery] = useState('');
  const [carResults, setCarResults] = useState<Car[]>([]);
  const [searchingCars, setSearchingCars] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);

  const [startingBid, setStartingBid] = useState('1000');

  const [creatingAuction, setCreatingAuction] = useState(false);
  const [placingBidForAuctionId, setPlacingBidForAuctionId] = useState<string | null>(null);
  const [closingAuctionId, setClosingAuctionId] = useState<string | null>(null);
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [lastActionError, setLastActionError] = useState<string | null>(null);

  const [bidderName, setBidderName] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(BIDDER_NAME_KEY);
      return raw?.trim() || 'Guest';
    } catch {
      return 'Guest';
    }
  });

  const [nowMs, setNowMs] = useState(() => Date.now());

  const refreshAuctions = useCallback(async () => {
    try {
      setError(null);
      const liveAuctions = await fetchLiveAuctions();
      setAuctions(liveAuctions);

      if (liveAuctions.length === 0) {
        setAuctionCars({});
        setAuctionBids({});
        return;
      }

      const lots = Array.from(new Set(liveAuctions.map((auction) => auction.lotNumber)));
      const [cars, bidsPerAuction] = await Promise.all([
        fetchCarsByLotNumbers(lots),
        Promise.all(
          liveAuctions.map(async (auction) => {
            const bids = await fetchAuctionBids(auction.id, 8);
            return [auction.id, bids] as const;
          })
        ),
      ]);

      const carsByLot: Record<string, Car> = {};
      for (const car of cars) {
        carsByLot[car.lot_number] = car;
      }
      setAuctionCars(carsByLot);
      setAuctionBids(Object.fromEntries(bidsPerAuction));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load auctions.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await refreshAuctions();
    };

    void run();
    const unsubscribe = subscribeToAuctionUpdates(() => {
      void refreshAuctions();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshAuctions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BIDDER_NAME_KEY, bidderName.trim() || 'Guest');
    } catch {
      // ignore storage failures
    }
  }, [bidderName]);

  useEffect(() => {
    const emailName = user?.email?.split('@')[0]?.trim();
    if (!emailName) return;
    setBidderName((prev) => {
      const current = prev.trim();
      if (!current || current.toLowerCase() === 'guest') {
        return emailName;
      }
      return prev;
    });
  }, [user?.id, user?.email]);

  useEffect(() => {
    const query = carQuery.trim();
    if (query.length < 2) {
      setCarResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setSearchingCars(true);
        const result = await fetchCars({
          filters: { search: query },
          fetchAll: false,
          limit: 20,
          offset: 0,
        });
        if (!active) return;
        setCarResults(result.items);
      } catch {
        if (!active) return;
        setCarResults([]);
      } finally {
        if (active) {
          setSearchingCars(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [carQuery]);

  useEffect(() => {
    setBidInputs((prev) => {
      const next = { ...prev };
      for (const auction of auctions) {
        if (!next[auction.id]) {
          next[auction.id] = String(Math.round(auction.currentBid + FIXED_MIN_INCREMENT));
        }
      }
      return next;
    });
  }, [auctions]);

  const auctionsView = useMemo<AuctionView[]>(() => {
    return auctions.map((auction) => ({
      ...auction,
      car: auctionCars[auction.lotNumber] ?? null,
      bids: auctionBids[auction.id] ?? [],
    }));
  }, [auctions, auctionBids, auctionCars]);

  const handleCreateAuction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCar) {
      setLastActionError('Select a car first.');
      return;
    }

    const starting = parseNumber(startingBid, NaN);
    if (!Number.isFinite(starting) || starting < 0) {
      setLastActionError('Starting bid must be a valid number.');
      return;
    }

    try {
      setLastActionError(null);
      setCreatingAuction(true);
      await createLiveAuction({
        lotNumber: selectedCar.lot_number,
        startingBid: starting,
        sellerUserId: user?.id ?? null,
      });
      setCarQuery('');
      setCarResults([]);
      setSelectedCar(null);
      await refreshAuctions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start auction.';
      setLastActionError(message);
    } finally {
      setCreatingAuction(false);
    }
  };

  const handlePlaceBid = async (auction: LiveAuction) => {
    const minRequired = auction.currentBid + FIXED_MIN_INCREMENT;
    const inputValue = bidInputs[auction.id] ?? String(Math.round(minRequired));
    const amount = parseNumber(inputValue, NaN);

    if (!Number.isFinite(amount)) {
      setLastActionError('Bid amount is invalid.');
      return;
    }

    try {
      setLastActionError(null);
      setPlacingBidForAuctionId(auction.id);
      await placeAuctionBid({
        auctionId: auction.id,
        amount,
        bidderName: bidderName.trim() || 'Guest',
        bidderUserId: user?.id ?? null,
      });
      setBidInputs((prev) => ({
        ...prev,
        [auction.id]: String(Math.round(amount + FIXED_MIN_INCREMENT)),
      }));
      await refreshAuctions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not place bid.';
      setLastActionError(message);
    } finally {
      setPlacingBidForAuctionId(null);
    }
  };

  const handleCloseAuction = async (auctionId: string) => {
    try {
      setLastActionError(null);
      setClosingAuctionId(auctionId);
      await closeLiveAuction(auctionId);
      await refreshAuctions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not close auction.';
      setLastActionError(message);
    } finally {
      setClosingAuctionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Live Auctions</h1>
            <p className="mt-1 text-sm text-slate-600">
              Start auctions from your car API data and accept bids in real time.
              Each accepted bid resets the timer to {BID_WINDOW_SECONDS} seconds.
            </p>
          </div>
          <Link
            to="/cars"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Cars
          </Link>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)]">
          <form
            onSubmit={handleCreateAuction}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Start Auction Now</h2>

            <label className="mb-2 block text-sm font-medium text-slate-700">Search car</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={carQuery}
                onChange={(event) => setCarQuery(event.target.value)}
                placeholder="Lot, make, model..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none ring-blue-500 focus:ring-2"
              />
            </div>
            {searchingCars && <p className="mt-2 text-xs text-slate-500">Searching cars...</p>}

            <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
              {carResults.map((car) => {
                const isActive = selectedCar?.lot_number === car.lot_number;
                return (
                  <button
                    key={car.lot_number}
                    type="button"
                    onClick={() => setSelectedCar(car)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      isActive
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <p className="font-medium text-slate-800">
                      {car.year} {car.make} {car.model}
                    </p>
                    <p className="text-xs text-slate-600">Lot #{car.lot_number}</p>
                  </button>
                );
              })}
              {!searchingCars && carQuery.trim().length >= 2 && carResults.length === 0 && (
                <p className="text-xs text-slate-500">No cars found.</p>
              )}
            </div>

            {selectedCar && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Selected: {selectedCar.year} {selectedCar.make} {selectedCar.model} (Lot #{selectedCar.lot_number})
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Starting bid (USD)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={startingBid}
                  onChange={(event) => setStartingBid(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Rules</label>
                <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  +${FIXED_MIN_INCREMENT} per bid, {BID_WINDOW_SECONDS}s timer reset on each bid
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingAuction}
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Gavel className="mr-2 h-4 w-4" />
              {creatingAuction ? 'Starting...' : 'Start Auction'}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Bidder Profile</h2>
            <p className="mb-3 text-sm text-slate-600">
              This name is attached to each bid. Keep it short so it is readable in live bidding.
            </p>
            <p className="mb-2 text-xs text-slate-500">
              {user?.email ? `Signed in as ${user.email}` : 'Guest mode (no account required)'}
            </p>
            <label className="mb-1 block text-xs font-medium text-slate-700">Bidder name</label>
            <input
              type="text"
              maxLength={40}
              value={bidderName}
              onChange={(event) => setBidderName(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <p className="mt-3 text-xs text-slate-500">
              Live updates refresh every second for all connected users.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        {lastActionError && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
            {lastActionError}
          </div>
        )}

        <div className="space-y-5">
          {loading && <p className="text-sm text-slate-600">Loading auctions...</p>}

          {!loading && auctionsView.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              No live auctions right now. Start one from the panel above.
            </div>
          )}

          {auctionsView.map((auction) => {
            const countdown = formatCountdown(auction.endsAt, nowMs);
            const minRequired = auction.currentBid + FIXED_MIN_INCREMENT;
            const bidInput = bidInputs[auction.id] ?? String(Math.round(minRequired));
            const isEnded = countdown === 'Ended' || auction.status !== 'live';
            const image = auction.car?.images?.[0] || 'https://via.placeholder.com/640x360?text=No+Image';

            return (
              <article
                key={auction.id}
                className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[240px_minmax(0,1fr)]"
              >
                <img
                  src={image}
                  alt={
                    auction.car
                      ? `${auction.car.year} ${auction.car.make} ${auction.car.model}`
                      : `Auction lot ${auction.lotNumber}`
                  }
                  className="h-48 w-full rounded-lg object-cover"
                />

                <div>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Lot #{auction.lotNumber}</p>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {auction.car
                          ? `${auction.car.year} ${auction.car.make} ${auction.car.model}`
                          : 'Car details unavailable'}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {auction.car?.location || 'Location not available'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-100 px-3 py-2 text-right">
                      <div className="inline-flex items-center text-xs font-medium text-slate-600">
                        <Clock3 className="mr-1 h-3.5 w-3.5" />
                        Ends in
                      </div>
                      <p className="text-lg font-bold text-slate-900">{countdown}</p>
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Current bid</p>
                      <p className="text-lg font-semibold text-slate-900">{formatMoney(auction.currentBid)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Minimum next</p>
                      <p className="text-lg font-semibold text-slate-900">{formatMoney(minRequired)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Min increment</p>
                      <p className="text-lg font-semibold text-slate-900">{formatMoney(FIXED_MIN_INCREMENT)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Total bids</p>
                      <p className="text-lg font-semibold text-slate-900">{auction.totalBids}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="mb-2 text-sm font-medium text-slate-700">Recent bids</p>
                    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                      {auction.bids.length === 0 && (
                        <p className="px-2 py-1 text-sm text-slate-500">No bids yet.</p>
                      )}
                      {auction.bids.map((bid) => (
                        <div
                          key={bid.id}
                          className="flex items-center justify-between rounded-md bg-white px-2 py-1 text-sm"
                        >
                          <span className="font-medium text-slate-700">{bid.bidderName}</span>
                          <span className="font-semibold text-slate-900">{formatMoney(bid.amount)}</span>
                          <span className="text-xs text-slate-500">
                            {new Date(bid.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full sm:max-w-[220px]">
                      <label className="mb-1 block text-xs font-medium text-slate-700">Your bid (USD)</label>
                      <input
                        type="number"
                        min={Math.ceil(minRequired)}
                        step={1}
                        value={bidInput}
                        disabled={isEnded}
                        onChange={(event) =>
                          setBidInputs((prev) => ({
                            ...prev,
                            [auction.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 disabled:bg-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isEnded || placingBidForAuctionId === auction.id}
                      onClick={() => void handlePlaceBid(auction)}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {placingBidForAuctionId === auction.id ? 'Submitting...' : 'Place Bid'}
                    </button>
                    <button
                      type="button"
                      disabled={closingAuctionId === auction.id}
                      onClick={() => void handleCloseAuction(auction.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {closingAuctionId === auction.id ? 'Closing...' : 'Close Auction'}
                    </button>
                    {auction.currentBidderName && (
                      <p className="text-sm text-slate-600">
                        Leader: <span className="font-semibold text-slate-900">{auction.currentBidderName}</span>
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
