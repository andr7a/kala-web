import { useNavigate } from 'react-router-dom';
import { useComparison } from '../context/ComparisonContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, ArrowRightLeft, Calendar, Tag, DollarSign, X, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Gauge, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { type Car } from '../services/carService';

type MediaItem = { type: 'image' | 'video'; url: string };

function normalizeMediaUrl(url: string): string {
  const cleaned = url.split('#')[0].split('?')[0].trim().toLowerCase();
  return cleaned.replace(/_(?:thb|ful|hrs|vthb|vful|vhrs)(\.[a-z0-9]+)$/i, '$1');
}

function dedupeMediaItems(items: MediaItem[]): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.url) continue;
    const key = `${item.type}:${normalizeMediaUrl(item.url)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function buildDisplayImages(car: Car): string[] {
  const images =
    car.images && car.images.length > 0
      ? car.images
          .map((img) => img.replace('_thb.jpg', '_ful.jpg'))
          .filter((img) => !img.includes('_vful.jpg') && !img.includes('_vhrs.jpg'))
      : ['https://via.placeholder.com/400x300?text=No+Image'];

  return dedupeMediaItems(images.map((url) => ({ type: 'image', url }))).map((item) => item.url);
}

function buildMediaItems(car: Car): MediaItem[] {
  const items: MediaItem[] = buildDisplayImages(car).map((url) => ({ type: 'image', url }));

  if (car.images_list_raw?.VIDEO) {
    car.images_list_raw.VIDEO.forEach((video) => {
      if (video.highResUrl) {
        items.push({ type: 'video', url: video.highResUrl });
      }
    });
  }

  if (car.images_list_raw?.ENGINE_VIDEO_SOUND) {
    car.images_list_raw.ENGINE_VIDEO_SOUND.forEach((video) => {
      if (video.highResUrl) {
        items.push({ type: 'video', url: video.highResUrl });
      }
    });
  }

  if (car.engine_video_high_res) {
    car.engine_video_high_res.forEach((url) => {
      items.push({ type: 'video', url });
    });
  }

  const deduped = dedupeMediaItems(items);
  return deduped.length > 0
    ? deduped
    : [{ type: 'image', url: 'https://via.placeholder.com/400x300?text=No+Image' }];
}

export function ComparePage() {
  const navigate = useNavigate();
  const { selectedCars, swapCars, clearComparison, toggleCar } = useComparison();
  const { user, signOut } = useAuth();
  const [galleryOpen, setGalleryOpen] = useState<{ car: Car; index: number } | null>(null);

  const isGuest = !user;

  const handleSignOut = async () => {
    if (isGuest) {
      navigate('/auth');
      return;
    }
    await signOut();
    navigate('/auth');
  };

  if (selectedCars.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">No Comparison Selected</h1>
          <p className="text-gray-600 text-lg mb-8">Please select cars to compare</p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
          >
            Go Back to Cars
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return 'Not available';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getEngineInfo = (car: Car) => {
    if (car.build_sheet?.engines && car.build_sheet.engines.length > 0) {
      return car.build_sheet.engines[0];
    }
    if (car.engines && car.engines.length > 0) {
      return car.engines[0];
    }
    return null;
  };

  const handleClearComparison = () => {
    clearComparison();
    navigate('/');
  };

  const renderCarDetails = (car: Car) => {
    const engine = getEngineInfo(car);
    const mediaItems = buildMediaItems(car);
    const images = buildDisplayImages(car);

    const raw = (car.raw ?? {}) as Record<string, any>;
    const currency = raw.cuc ?? raw.currency ?? null;
    const replacementCost = raw.rc ?? raw.replacement_cost ?? raw.replacementCost ?? null;
    const buyNowRaw = raw.bnp ?? null;
    const country = raw.locCountry ?? null;
    const city = raw.locCity ?? null;
    const state = raw.locState ?? null;
    const seller = raw.scn ?? null;
    const exteriorColor = raw.ext_color ?? raw.clr ?? raw.exterior_color ?? null;
    const interiorColorRaw = raw.int_color ?? raw.interior_color ?? raw.interiorColor ?? null;
    const interiorColor =
      interiorColorRaw ??
      (exteriorColor ? `${String(exteriorColor).trim()} (estimated)` : null);
    const odometerType = raw.ord ?? raw.odometer_type ?? null;
    const keys = raw.hk ?? null;
    const transmission = raw.tsmn ?? null;
    const drive = raw.drv ?? null;
    const fuelType = raw.fuel ?? raw.ft ?? null;
    const gradeAcs = raw.ac_s ?? raw.acs ?? null;
    const gradeArg = raw.crg ?? raw.arg ?? null;
    const crDamages = Array.isArray(raw.cr_damages) ? raw.cr_damages : null;
    const vin = raw.vin_masked ?? raw.fv ?? null;
    const titleType = raw.title_type ?? raw.tgd ?? null;
    const titleBrand = raw.title_brand ?? null;
    const saleStatus = raw.sale_status_text ?? raw.ess ?? null;
    const listingStatus = raw.listing_status ?? raw.lsts ?? null;
    const yardName = raw.yard_name ?? raw.yn ?? null;
    const stateCode = raw.state_code ?? raw.ts ?? null;
    const zip = raw.zip ?? null;

    const fmtText = (val: any): string => {
      if (val === null || val === undefined) return 'Not available';
      const s = String(val).trim();
      return s || 'Not available';
    };

    const fmtYesNo = (v: any) => {
      const s = fmtText(v);
      if (s === 'Not available') return s;
      if (s.toLowerCase() === 'yes') return 'Yes';
      if (s.toLowerCase() === 'no') return 'No';
      return s;
    };

    const fmtCurrency = (val: any): string => {
      return fmtText(val);
    };

    const fmtMoney = (val: any): string => {
      if (val === null || val === undefined) return 'Not available';
      const n = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.\-]/g, ''));
      if (!Number.isFinite(n) || n === 0) return 'Not available';
      const cur = currency ? String(currency).toUpperCase() : '';
      if (cur && cur !== 'USD') return `${cur} ${Math.round(n).toLocaleString()}`;
      return `$${Math.round(n).toLocaleString()}`;
    };

    const fmtPercent = (val: any, max: number) => {
      const n = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(n) || n < 0) return null;
      const pct = Math.max(0, Math.min(100, (n / max) * 100));
      return { n, pct };
    };

    return (
      <div className="bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="relative h-56 sm:h-72 bg-gray-200">
          <img
            src={images[0]}
            alt={`${car.make} ${car.model}`}
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => toggleCar(car)}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg transition-all"
            title="Remove from comparison"
          >
            <X size={20} />
          </button>
          <button
            onClick={() => setGalleryOpen({ car, index: 0 })}
            className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-xs sm:text-sm"
          >
            <ImageIcon size={18} />
            View Media ({mediaItems.length})
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {car.make}
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{car.model} {car.year}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Pricing</h3>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Estimated Value:</span>
                  <span className="font-semibold text-gray-900">
                    {fmtMoney(car.estimated_retail_value ?? raw.lotPlugAcv)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Buy Now Price:</span>
                  <span className="font-semibold text-green-600">{fmtMoney(car.buy_it_now_price ?? buyNowRaw)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Currency:</span>
                  <span className="font-semibold text-gray-900">{fmtCurrency(currency)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Replacement Cost:</span>
                  <span className="font-semibold text-gray-900">{fmtMoney(replacementCost)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Country:</span>
                  <span className="font-medium text-gray-900">{country || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">City:</span>
                  <span className="font-medium text-gray-900">{city || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">State:</span>
                  <span className="font-medium text-gray-900">{state || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Seller:</span>
                  <span className="font-medium text-gray-900">{seller || 'Not available'}</span>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge size={18} className="text-green-600" />
                <h3 className="font-semibold text-gray-900">Engine Specifications</h3>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Engine Type:</span>
                  <span className="font-semibold text-gray-900">{engine?.engineType || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Cylinders:</span>
                  <span className="font-semibold text-gray-900">{car.cylinders || engine?.cylinders || 'Not available'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Vehicle Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Interior Color:</span>
                  <span className="font-medium text-gray-900">{interiorColor || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Exterior Color:</span>
                  <span className="font-medium text-gray-900">{exteriorColor || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Odometer:</span>
                  <span className="font-medium text-gray-900">
                    {car.odometer_formatted ??
                      (car.odometer !== null && car.odometer !== undefined
                        ? `${Math.round(car.odometer * 1.60934).toLocaleString()} km`
                        : 'Not available')}
                  </span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Odometer Type:</span>
                  <span className="font-medium text-gray-900">{odometerType || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Keys:</span>
                  <span className="font-medium text-gray-900">{fmtYesNo(keys)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Transmission:</span>
                  <span className="font-medium text-gray-900">{transmission || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Drive:</span>
                  <span className="font-medium text-gray-900">{drive || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Fuel:</span>
                  <span className="font-medium text-gray-900">{fmtText(fuelType)}</span>
                </div>
              </div>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Condition & Damage</h3>
              <div className="space-y-2 text-sm">
                {car.condition && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-gray-600">Condition:</span>
                    <span className="font-medium text-gray-900">{car.condition}</span>
                  </div>
                )}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Primary Damage:</span>
                  <span className="font-medium text-red-700">{car.primary_damage || 'Not available'}</span>
                </div>
                {car.secondary_damage && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-gray-600">Secondary Damage:</span>
                    <span className="font-medium text-red-700">{car.secondary_damage}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-red-200">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-gray-600">CR Damage:</span>
                    <span className="font-medium text-red-700">{crDamages && crDamages.length ? `${crDamages.length} items` : 'Not available'}</span>
                  </div>
                  {crDamages && crDamages.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {crDamages.slice(0, 8).map((d: any, idx: number) => {
                        const item = (d.aasc_item_description ?? 'Item').toString();
                        const dmg = (d.aasc_damage_description ?? '').toString();
                        const sev = (d.aasc_severity_description ?? '').toString();
                        const area = (d.damage_area ?? '').toString();
                        const line = [item, dmg && `— ${dmg}`, sev && `(${sev})`].filter(Boolean).join(' ');
                        return (
                          <li key={idx} className="leading-snug">
                            <span className="font-medium">{line}</span>
                            {area ? <span className="text-red-700">{' '}[{area}]</span> : null}
                          </li>
                        );
                      })}
                      {crDamages.length > 8 && <li className="text-red-700">+ {crDamages.length - 8} more</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-gray-600" />
                <h3 className="font-semibold text-gray-900">Auction Info</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Lot Number:</span>
                  <span className="font-medium text-gray-900">{car.lot_number || 'Not available'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Company:</span>
                  <span className="font-medium text-gray-900">{car.base_site === 'iaai' ? 'IAAI' : 'Copart'}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Sale Date:</span>
                  <span className="font-medium text-gray-900">{formatDate(car.auction_date)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">VIN:</span>
                  <span className="font-medium text-gray-900">{fmtText(vin)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Title Type:</span>
                  <span className="font-medium text-gray-900">{fmtText(titleType)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Title Brand:</span>
                  <span className="font-medium text-gray-900">{fmtText(titleBrand)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Sale Status:</span>
                  <span className="font-medium text-gray-900">{fmtText(saleStatus)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Listing Status:</span>
                  <span className="font-medium text-gray-900">{fmtText(listingStatus)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">Yard:</span>
                  <span className="font-medium text-gray-900">{fmtText(yardName)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">State Code:</span>
                  <span className="font-medium text-gray-900">{fmtText(stateCode)}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-gray-600">ZIP:</span>
                  <span className="font-medium text-gray-900">{fmtText(zip)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Grade</h3>
              <div className="space-y-3 text-sm">
                {(() => {
                  const acs = fmtPercent(gradeAcs, 100);
                  return (
                    <div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-gray-600">ACS:</span>
                        <span className="font-medium text-gray-900">{acs ? acs.n : 'Not available'}</span>
                      </div>
                      {acs && (
                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${acs.pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  const arg = fmtPercent(gradeArg, 5);
                  return (
                    <div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-gray-600">ARG:</span>
                        <span className="font-medium text-gray-900">{arg ? arg.n : 'Not available'}</span>
                      </div>
                      {arg && (
                        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600" style={{ width: `${arg.pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {car.highlights && car.highlights.length > 0 && (
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={18} className="text-yellow-600" />
                  <h3 className="font-semibold text-gray-900">Highlights</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {car.highlights.map((highlight, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors self-start"
          >
            <ArrowLeft size={20} />
            Back to Cars
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 text-left lg:text-center">
            Car Comparison ({selectedCars.length})
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
            {selectedCars.length === 2 && (
              <button
                onClick={swapCars}
                className="flex items-center gap-2 bg-blue-100 text-blue-600 hover:bg-blue-200 px-4 py-2 rounded-lg font-semibold transition-all"
              >
                <ArrowRightLeft size={18} />
                Swap
              </button>
            )}
            <button
              onClick={handleClearComparison}
              className="flex items-center gap-2 bg-red-100 text-red-600 hover:bg-red-200 px-4 py-2 rounded-lg font-semibold transition-all"
            >
              <X size={18} />
              Clear
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`${isGuest ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'} rounded-lg font-medium px-4 py-2 text-sm flex items-center gap-2`}>
                <User size={16} />
                {isGuest ? 'Guest' : user?.email?.split('@')[0]}
              </div>
              <button
                onClick={handleSignOut}
                className={`${isGuest ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} rounded-lg font-medium px-4 py-2 text-sm flex items-center gap-2 transition-all`}
              >
                <LogOut size={16} />
                {isGuest ? 'Sign In' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className={`grid gap-6 ${selectedCars.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : selectedCars.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {selectedCars.map((car) => renderCarDetails(car as Car))}
        </div>
      </div>

      {galleryOpen && (
        <MediaGallery
          car={galleryOpen.car}
          initialIndex={galleryOpen.index}
          onClose={() => setGalleryOpen(null)}
        />
      )}
    </div>
  );
}

interface MediaGalleryProps {
  car: Car;
  initialIndex: number;
  onClose: () => void;
}

function MediaGallery({ car, initialIndex, onClose }: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const mediaItems = buildMediaItems(car);

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  };

  const currentItem = mediaItems[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-all z-10"
      >
        <X size={24} />
      </button>

      <div className="relative w-full h-full flex items-center justify-center px-4 sm:px-16">
        {mediaItems.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 sm:left-4 bg-white/10 hover:bg-white/20 text-white p-2 sm:p-3 rounded-full transition-all"
            >
              <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 sm:right-4 bg-white/10 hover:bg-white/20 text-white p-2 sm:p-3 rounded-full transition-all"
            >
              <ChevronRight size={24} className="sm:w-8 sm:h-8" />
            </button>
          </>
        )}

        <div className="max-w-6xl max-h-[90vh] flex flex-col items-center gap-4">
          {currentItem.type === 'image' ? (
            <img
              src={currentItem.url}
              alt={`${car.make} ${car.model}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          ) : (
            <video
              src={currentItem.url}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] rounded-lg"
            >
              Your browser does not support the video tag.
            </video>
          )}

          <div className="flex items-center gap-3 text-white">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
              {currentItem.type === 'image' ? <ImageIcon size={18} /> : <Video size={18} />}
              <span className="font-medium">
                {currentItem.type === 'image' ? 'Image' : 'Video'} {currentIndex + 1} of {mediaItems.length}
              </span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
            {mediaItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden transition-all ${
                  idx === currentIndex ? 'ring-4 ring-blue-500' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <Video size={24} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
