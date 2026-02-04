import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Calendar, Tag, DollarSign, ChevronLeft, ChevronRight, Image as ImageIcon, Video, Gauge, ExternalLink, X, User, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Cars
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {car.year} {car.make} {car.model}
          </h1>
          <div className="flex items-center gap-2">
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
              <div className="relative h-96 bg-gray-200">
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
                  <p className="text-4xl font-bold text-gray-900">{car.model} {car.year}</p>
                </div>

                {car.item_url && (
                  isGuest ? (
                    <button
                      onClick={() => navigate('/auth')}
                      className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-gray-300 text-gray-500 cursor-not-allowed flex items-center justify-center gap-2"
                      title="Sign in to view auction listing"
                    >
                      Sign In to View Auction
                      <ExternalLink size={18} />
                    </button>
                  ) : (
                    <a
                      href={car.item_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                      View Auction Listing
                      <ExternalLink size={18} />
                    </a>
                  )
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="bg-white rounded-xl shadow-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                  <span>Image Gallery</span>
                  <span className="text-sm text-gray-500">{images.length} photos</span>
                </h3>
                <div className="grid grid-cols-4 gap-2">
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
            <div className="columns-1 md:columns-2 gap-6 [column-fill:_balance]">
            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={20} className="text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-900">Pricing</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Estimated Value:</span>
                  <span className="text-xl font-bold text-gray-900">
                    {fmtMoney(car.estimated_retail_value ?? raw.lotPlugAcv)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Buy Now Price:</span>
                  <span className="text-xl font-bold text-green-600">
                    {fmtMoney(car.buy_it_now_price ?? buyNowRaw)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Currency:</span>
                  <span className="text-xl font-bold text-gray-900">{fmtCurrency(currency)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 font-medium">Replacement Cost:</span>
                  <span className="text-xl font-bold text-gray-900">{fmtMoney(replacementCost)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Location</h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Country:</span>
                  <span className="font-semibold text-gray-900">{country || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">City:</span>
                  <span className="font-semibold text-gray-900">{city || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">State:</span>
                  <span className="font-semibold text-gray-900">{state || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Seller:</span>
                  <span className="font-semibold text-gray-900">{seller || 'Not available'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <Gauge size={20} className="text-green-600" />
                <h3 className="text-xl font-semibold text-gray-900">Engine Specifications</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Engine Type:</span>
                  <span className="font-semibold text-gray-900">{engine?.engineType || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Cylinders:</span>
                  <span className="font-semibold text-gray-900">{car.cylinders || engine?.cylinders || 'Not available'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Vehicle Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Interior Color:</span>
                  <span className="font-semibold text-gray-900">{interiorColor || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Exterior Color:</span>
                  <span className="font-semibold text-gray-900">{exteriorColor || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Odometer:</span>
                  <span className="font-semibold text-gray-900">
                    {car.odometer_formatted ??
                      (car.odometer !== null && car.odometer !== undefined
                        ? `${Math.round(car.odometer * 1.60934).toLocaleString()} km`
                        : 'Not available')}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Odometer Type:</span>
                  <span className="font-semibold text-gray-900">{odometerType || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Keys:</span>
                  <span className="font-semibold text-gray-900">{fmtYesNo(keys)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Transmission:</span>
                  <span className="font-semibold text-gray-900">{transmission || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Drive:</span>
                  <span className="font-semibold text-gray-900">{drive || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Fuel:</span>
                  <span className="font-semibold text-gray-900">{fmtText(fuelType)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Condition & Damage</h3>
              <div className="space-y-3">
                {car.condition && (
                  <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Condition:</span>
                    <span className="font-semibold text-gray-900">{car.condition}</span>
                  </div>
                )}
                <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-gray-600">Primary Damage:</span>
                  <span className="font-semibold text-red-700">{car.primary_damage || 'Not available'}</span>
                </div>
                {car.secondary_damage && (
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-gray-600">Secondary Damage:</span>
                    <span className="font-semibold text-red-700">{car.secondary_damage}</span>
                  </div>
                )}

                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-600">CR Damage:</span>
                    <span className="font-semibold text-red-700">{crDamages && crDamages.length ? `${crDamages.length} items` : 'Not available'}</span>
                  </div>
                  {crDamages && crDamages.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-red-800">
                      {crDamages.slice(0, 12).map((d: any, idx: number) => {
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
                      {crDamages.length > 12 && (
                        <li className="text-red-700">+ {crDamages.length - 12} more</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={20} className="text-gray-600" />
                <h3 className="text-xl font-semibold text-gray-900">Auction Info</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Lot Number:</span>
                  <span className="font-semibold text-gray-900">{car.lot_number || 'Not available'}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Company:</span>
                  <span className="font-semibold text-gray-900">
                    {car.base_site === 'iaai' ? 'IAAI' : 'Copart'}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Sale Date:</span>
                  <span className="font-semibold text-gray-900">{formatDate(car.auction_date)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">VIN:</span>
                  <span className="font-semibold text-gray-900">{fmtText(vin)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Title Type:</span>
                  <span className="font-semibold text-gray-900">{fmtText(titleType)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Title Brand:</span>
                  <span className="font-semibold text-gray-900">{fmtText(titleBrand)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Sale Status:</span>
                  <span className="font-semibold text-gray-900">{fmtText(saleStatus)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Listing Status:</span>
                  <span className="font-semibold text-gray-900">{fmtText(listingStatus)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Yard:</span>
                  <span className="font-semibold text-gray-900">{fmtText(yardName)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">State Code:</span>
                  <span className="font-semibold text-gray-900">{fmtText(stateCode)}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">ZIP:</span>
                  <span className="font-semibold text-gray-900">{fmtText(zip)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Grade</h3>
              <div className="space-y-3">
                {(() => {
                  const acs = fmtPercent(gradeAcs, 100);
                  return (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ACS:</span>
                        <span className="font-semibold text-gray-900">{acs ? acs.n : 'Not available'}</span>
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
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ARG:</span>
                        <span className="font-semibold text-gray-900">{arg ? arg.n : 'Not available'}</span>
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
              <div className="bg-white rounded-xl shadow-xl p-6 mb-6 break-inside-avoid">
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={20} className="text-yellow-600" />
                  <h3 className="text-xl font-semibold text-gray-900">Highlights</h3>
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

      <div className="relative w-full h-full flex items-center justify-center px-16">
        {mediaItems.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-all"
            >
              <ChevronRight size={32} />
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
