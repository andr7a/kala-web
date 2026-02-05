import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Tag, ChevronLeft, ChevronRight, ChevronDown, Image as ImageIcon, Video, ExternalLink, X, User, LogOut } from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { fetchCarByLotNumber, type Car } from '../services/carService';

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

export function CarDetailPage() {
  const navigate = useNavigate();
  const { lotNumber } = useParams();
  const { user, signOut } = useAuth();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const isGuest = !user;

  const handleSignOut = async () => {
    if (isGuest) {
      navigate('/auth');
    } else {
      await signOut();
      navigate('/auth');
    }
  };

  useEffect(() => {
    const loadCar = async () => {
      if (!lotNumber) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const foundCar = await fetchCarByLotNumber(lotNumber);
        setCar(foundCar);
      } catch (error) {
        console.error('Error fetching car:', error);
      }
      setLoading(false);
    };

    loadCar();
  }, [lotNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Loading car details...</p>
        </div>
      </div>
    );
  }

  if (!car) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Car Not Found</h1>
          <p className="text-gray-600 text-lg mb-8">The car you're looking for doesn't exist</p>
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

  const locationShort =
    [city, state].filter(Boolean).join(', ') || country || 'Not available';
  const stateForShipping = (() => {
    const value = raw.state_code ?? raw.ts ?? raw.locState ?? state;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  })();

  const estimateShippingToGeorgia = (stateCode: string | null, countryCode: string | null) => {
    if (!stateCode) return null;
    if (countryCode && countryCode.toUpperCase() !== 'USA') return null;
    const code = stateCode.toUpperCase();

    const buckets: Array<{ states: string[]; low: number; high: number }> = [
      {
        states: ['GA', 'FL', 'AL', 'TN', 'KY', 'SC', 'NC'],
        low: 1800,
        high: 2200,
      },
      {
        states: ['VA', 'WV', 'MD', 'DC', 'DE', 'PA', 'NJ', 'NY', 'CT', 'RI', 'MA', 'VT', 'NH', 'ME'],
        low: 2000,
        high: 2300,
      },
      {
        states: ['LA', 'MS', 'TX'],
        low: 2100,
        high: 2500,
      },
      {
        states: ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
        low: 2200,
        high: 2600,
      },
      {
        states: ['OK', 'AR', 'AZ', 'NM'],
        low: 2300,
        high: 2700,
      },
      {
        states: ['CO', 'UT', 'ID', 'MT', 'WY', 'NV'],
        low: 2400,
        high: 2800,
      },
      {
        states: ['CA', 'OR', 'WA'],
        low: 2500,
        high: 2800,
      },
      {
        states: ['AK', 'HI'],
        low: 2600,
        high: 2800,
      },
    ];

    const bucket = buckets.find((b) => b.states.includes(code));
    if (!bucket) return null;
    return bucket;
  };

  const shippingEstimate = estimateShippingToGeorgia(stateForShipping, country);

  const estimateRepairRange = (
    primary: string | null,
    secondary: string | null,
    conditionNote: string | null,
    retailBase: number | null
  ) => {
    const text = [primary, secondary, conditionNote].filter(Boolean).join(' ').toUpperCase();
    if (!text) return null;

    const severe = [
      'FLOOD',
      'WATER',
      'BURN',
      'FIRE',
      'ROLLOVER',
      'FRAME',
      'ROOF',
      'SUSPENSION',
      'ENGINE',
      'TRANSMISSION',
      'BIO',
      'STRIP',
      'MISSING',
    ];
    const medium = [
      'FRONT',
      'REAR',
      'SIDE',
      'UNDERCARRIAGE',
      'HAIL',
      'VANDALISM',
      'THEFT',
      'MECHANICAL',
      'GLASS',
    ];
    const light = ['MINOR', 'SCRATCH', 'DENT', 'COSMETIC'];

    let severity = 1;
    if (severe.some((k) => text.includes(k))) severity = 3;
    else if (medium.some((k) => text.includes(k))) severity = 2;
    else if (light.some((k) => text.includes(k))) severity = 1;

    if (text.includes('RUNS AND DRIVES')) severity = Math.max(1, severity - 1);
    if (text.includes('NON-RUNNER') || text.includes('DOES NOT RUN') || text.includes('NOT RUN')) {
      severity = Math.min(4, severity + 1);
    }

    const basePercent: Record<number, number> = {
      1: 0.08,
      2: 0.16,
      3: 0.28,
      4: 0.4,
    };

    const baseFlat: Record<number, number> = {
      1: 1200,
      2: 2400,
      3: 4200,
      4: 7000,
    };

    const variance = 0.15; // +/- 15% for a tighter range

    if (retailBase && retailBase > 0) {
      const pct = basePercent[severity] ?? basePercent[2];
      return {
        low: Math.round(retailBase * pct * (1 - variance)),
        high: Math.round(retailBase * pct * (1 + variance)),
        severity,
      };
    }

    const mid = baseFlat[severity] ?? baseFlat[2];
    return {
      low: Math.round(mid * (1 - 0.2)),
      high: Math.round(mid * (1 + 0.2)),
      severity,
    };
  };

  const retailBase =
    (typeof car.estimated_retail_value === 'number' && car.estimated_retail_value > 0
      ? car.estimated_retail_value
      : typeof raw.lotPlugAcv === 'number' && raw.lotPlugAcv > 0
      ? raw.lotPlugAcv
      : null);

  const repairEstimate = estimateRepairRange(
    car.primary_damage ?? null,
    car.secondary_damage ?? null,
    car.condition ?? null,
    retailBase
  );

  const QuickItem = ({
    label,
    value,
    tone = 'neutral',
  }: {
    label: string;
    value: ReactNode;
    tone?: 'neutral' | 'accent' | 'success' | 'danger';
  }) => {
    const toneClass =
      tone === 'success'
        ? 'bg-emerald-50'
        : tone === 'accent'
        ? 'bg-sky-50'
        : tone === 'danger'
        ? 'bg-rose-50'
        : 'bg-slate-50';
    return (
      <div className={`rounded-lg p-3 ${toneClass}`}>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-semibold text-slate-900">{value}</p>
      </div>
    );
  };

  const InfoRow = ({
    label,
    value,
    tone = 'neutral',
  }: {
    label: string;
    value: ReactNode;
    tone?: 'neutral' | 'accent' | 'success' | 'danger';
  }) => {
    const toneClass =
      tone === 'success'
        ? 'bg-emerald-50'
        : tone === 'accent'
        ? 'bg-sky-50'
        : tone === 'danger'
        ? 'bg-rose-50'
        : 'bg-slate-50';
    return (
      <div
        className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-lg px-3 py-2 ${toneClass}`}
      >
        <span className="text-sm text-slate-500">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
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
            {car.year} {car.make} {car.model}
          </h1>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-6">
              <div className="relative h-64 sm:h-80 lg:h-96 bg-gray-200">
                <img
                  src={images[0]}
                  alt={`${car.make} ${car.model}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => {
                    setCurrentMediaIndex(0);
                    setGalleryOpen(true);
                  }}
                  className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  <ImageIcon size={18} />
                  View All Media ({mediaItems.length})
                </button>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {car.make}
                  </h2>
                  <p className="text-2xl sm:text-4xl font-bold text-gray-900">{car.model} {car.year}</p>
                </div>

                {car.item_url && (
                  <a
                    href={car.item_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    View Auction Listing
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="bg-white rounded-xl shadow-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                  <span>Image Gallery</span>
                  <span className="text-sm text-gray-500">{images.length} photos</span>
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {images.slice(0, 12).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentMediaIndex(idx);
                        setGalleryOpen(true);
                      }}
                      className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all relative group"
                    >
                      <img
                        src={img}
                        alt={`${car.make} ${car.model} - Image ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20} />
                      </div>
                    </button>
                  ))}
                </div>
                {images.length > 12 && (
                  <button
                    onClick={() => setGalleryOpen(true)}
                    className="mt-3 w-full text-center text-blue-600 hover:text-blue-700 font-semibold text-sm py-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    View all {images.length} images
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="lg:pl-2">
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Facts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  <QuickItem
                    label="Buy Now Price"
                    value={fmtMoney(car.buy_it_now_price ?? buyNowRaw)}
                    tone="success"
                  />
                  <QuickItem
                    label="Estimated Value"
                    value={fmtMoney(car.estimated_retail_value ?? raw.lotPlugAcv)}
                    tone="accent"
                  />
                  <QuickItem
                    label="Odometer"
                    value={
                      car.odometer_formatted ??
                      (car.odometer !== null && car.odometer !== undefined
                        ? `${Math.round(car.odometer * 1.60934).toLocaleString()} km`
                        : 'Not available')
                    }
                  />
                  <QuickItem label="Condition" value={fmtText(car.condition)} />
                  <QuickItem label="Primary Damage" value={fmtText(car.primary_damage)} tone="danger" />
                  <QuickItem label="Location" value={locationShort} />
                  <QuickItem
                    label="Est. Shipping to Georgia"
                    value={
                      shippingEstimate
                        ? `$${shippingEstimate.low.toLocaleString()}–$${shippingEstimate.high.toLocaleString()}`
                        : 'Not available'
                    }
                    tone="accent"
                  />
                  <QuickItem
                    label="Est. Repair (damage-based)"
                    value={
                      repairEstimate
                        ? `$${repairEstimate.low.toLocaleString()}–$${repairEstimate.high.toLocaleString()}`
                        : 'Not available'
                    }
                    tone="accent"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Rough estimate to the Port of Poti (inland + ocean). Final quotes vary by carrier and timing.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Repair estimate is a rough guess based on damage keywords and value.
                </p>
              </div>

              {car.highlights && car.highlights.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag size={18} className="text-yellow-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Highlights</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {car.highlights.map((highlight, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <details open className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Pricing & Costs</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-2">
                  <InfoRow label="Estimated Value" value={fmtMoney(car.estimated_retail_value ?? raw.lotPlugAcv)} />
                  <InfoRow label="Buy Now Price" value={fmtMoney(car.buy_it_now_price ?? buyNowRaw)} tone="success" />
                  <InfoRow
                    label="Est. Repair (damage-based)"
                    value={
                      repairEstimate
                        ? `$${repairEstimate.low.toLocaleString()}–$${repairEstimate.high.toLocaleString()}`
                        : 'Not available'
                    }
                    tone="accent"
                  />
                  <InfoRow label="Currency" value={fmtCurrency(currency)} />
                  <InfoRow label="Replacement Cost" value={fmtMoney(replacementCost)} />
                </div>
              </details>

              <details open className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Vehicle Specs</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-2">
                  <InfoRow label="Interior Color" value={interiorColor || 'Not available'} />
                  <InfoRow label="Exterior Color" value={exteriorColor || 'Not available'} />
                  <InfoRow
                    label="Odometer"
                    value={
                      car.odometer_formatted ??
                      (car.odometer !== null && car.odometer !== undefined
                        ? `${Math.round(car.odometer * 1.60934).toLocaleString()} km`
                        : 'Not available')
                    }
                  />
                  <InfoRow label="Odometer Type" value={odometerType || 'Not available'} />
                  <InfoRow label="Transmission" value={transmission || 'Not available'} />
                  <InfoRow label="Drive" value={drive || 'Not available'} />
                  <InfoRow label="Fuel" value={fmtText(fuelType)} />
                  <InfoRow label="Engine Type" value={engine?.engineType || 'Not available'} />
                  <InfoRow label="Cylinders" value={car.cylinders || engine?.cylinders || 'Not available'} />
                  <InfoRow label="Keys" value={fmtYesNo(keys)} />
                </div>
              </details>

              <details className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Location & Seller</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-2">
                  <InfoRow label="Country" value={country || 'Not available'} />
                  <InfoRow label="City" value={city || 'Not available'} />
                  <InfoRow label="State" value={state || 'Not available'} />
                  <InfoRow label="Seller" value={seller || 'Not available'} />
                  <InfoRow
                    label="Est. Shipping to Georgia"
                    value={
                      shippingEstimate
                        ? `$${shippingEstimate.low.toLocaleString()}–$${shippingEstimate.high.toLocaleString()}`
                        : 'Not available'
                    }
                  />
                </div>
              </details>

              <details className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Condition & Damage</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-2">
                  <InfoRow label="Condition" value={fmtText(car.condition)} />
                  <InfoRow label="Primary Damage" value={fmtText(car.primary_damage)} tone="danger" />
                  <InfoRow label="Secondary Damage" value={fmtText(car.secondary_damage)} tone="danger" />
                  <div className="rounded-lg bg-rose-50 p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm text-slate-500">CR Damage</span>
                      <span className="font-semibold text-rose-700">
                        {crDamages && crDamages.length ? `${crDamages.length} items` : 'Not available'}
                      </span>
                    </div>
                    {crDamages && crDamages.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-rose-800">
                        {crDamages.slice(0, 12).map((d: any, idx: number) => {
                          const item = (d.aasc_item_description ?? 'Item').toString();
                          const dmg = (d.aasc_damage_description ?? '').toString();
                          const sev = (d.aasc_severity_description ?? '').toString();
                          const area = (d.damage_area ?? '').toString();
                          const line = [item, dmg && `— ${dmg}`, sev && `(${sev})`].filter(Boolean).join(' ');
                          return (
                            <li key={idx} className="leading-snug">
                              <span className="font-medium">{line}</span>
                              {area ? <span className="text-rose-700">{' '}[{area}]</span> : null}
                            </li>
                          );
                        })}
                        {crDamages.length > 12 && (
                          <li className="text-rose-700">+ {crDamages.length - 12} more</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </details>

              <details className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Auction & Title</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-2">
                  <InfoRow label="Lot Number" value={car.lot_number || 'Not available'} />
                  <InfoRow label="Company" value={car.base_site === 'iaai' ? 'IAAI' : 'Copart'} />
                  <InfoRow label="Sale Date" value={formatDate(car.auction_date)} />
                  <InfoRow label="VIN" value={fmtText(vin)} />
                  <InfoRow label="Title Type" value={fmtText(titleType)} />
                  <InfoRow label="Title Brand" value={fmtText(titleBrand)} />
                  <InfoRow label="Sale Status" value={fmtText(saleStatus)} />
                  <InfoRow label="Listing Status" value={fmtText(listingStatus)} />
                  <InfoRow label="Yard" value={fmtText(yardName)} />
                  <InfoRow label="State Code" value={fmtText(stateCode)} />
                  <InfoRow label="ZIP" value={fmtText(zip)} />
                </div>
              </details>

              <details className="group bg-white rounded-xl shadow-lg">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none text-slate-900 font-semibold">
                  <span>Grade</span>
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t px-5 pb-5 pt-4 space-y-3">
                  {(() => {
                    const acs = fmtPercent(gradeAcs, 100);
                    return (
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-slate-500">ACS</span>
                          <span className="font-semibold text-slate-900">{acs ? acs.n : 'Not available'}</span>
                        </div>
                        {acs && (
                          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${acs.pct}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {(() => {
                    const arg = fmtPercent(gradeArg, 5);
                    return (
                      <div className="rounded-lg bg-slate-50 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-slate-500">ARG</span>
                          <span className="font-semibold text-slate-900">{arg ? arg.n : 'Not available'}</span>
                        </div>
                        {arg && (
                          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600" style={{ width: `${arg.pct}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {galleryOpen && (
        <MediaGallery
          car={car}
          initialIndex={currentMediaIndex}
          onClose={() => setGalleryOpen(false)}
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
