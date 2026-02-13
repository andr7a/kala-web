import copartData from '../data/copart-from-new-project.json';

export type Engine = {
  engineType?: string | null;
  displacement?: string | { value: string; uom: string } | null;
  cylinders?: string | number | null;
  netHorsePower?: string | null;
  netTorque?: string | null;
};

export type ImagesListRaw = {
  VIDEO?: { highResUrl?: string | null }[];
  ENGINE_VIDEO_SOUND?: { highResUrl?: string | null }[];
  IMAGE?: {
    highResUrl?: string | null;
    fullUrl?: string | null;
    thumbnailUrl?: string | null;
  }[];
  [k: string]: unknown;
};

export interface Car {
  lot_number: string;
  images: string[];
  make: string;
  model: string;
  year: number;
  odometer: number | null;
  odometer_formatted?: string | null;
  item_url: string;

  raw?: Record<string, unknown> | null;

  location?: string | null;
  color?: string | null;
  primary_damage?: string | null;
  secondary_damage?: string | null;
  condition?: string | null;

  estimated_retail_value?: number | null;
  estimated_retail_value_formatted?: string | null;
  buy_it_now_price?: number | null;
  buy_it_now_formatted?: string | null;

  auction_date?: number | null;

  cylinders?: string | number | null;
  highlights?: string[] | null;

  engines?: Engine[] | null;
  build_sheet?: { engines?: Engine[] | null } | null;
  images_list_raw?: ImagesListRaw | null;
  engine_video_high_res?: string[] | null;

  base_site?: 'copart' | 'iaai' | string;
}

const API_BASE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '';

const API_DEFAULT_LIMIT = (() => {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_CARS_LIMIT : undefined;
  const parsed = raw ? Number.parseInt(String(raw), 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.min(parsed, 2000);
})();

export type CarFilterParams = {
  search?: string;
  make?: string;
  model?: string;
  color?: string;
  interiorColor?: string;
  fuel?: string;
  transmission?: string;
  condition?: string;
  yearFrom?: number;
  yearTo?: number;
  odometerMin?: number;
  odometerMax?: number;
  buyNowAvailability?: 'available' | 'not_available';
};

export type FilterOptions = {
  makes: string[];
  colors: string[];
  interior_colors: string[];
  fuels: string[];
  transmissions: string[];
  conditions: string[];
  years: number[];
  has_buy_now_available?: boolean;
  has_buy_now_not_available?: boolean;
};

async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

type CopartImageEntry = {
  highResUrl?: string | null;
  fullUrl?: string | null;
  thumbnailUrl?: string | null;
};

type CopartVideoEntry = {
  highResUrl?: string | null;
};

type CopartImagesPayload = {
  data?: {
    imagesList?: {
      IMAGE?: CopartImageEntry[];
      VIDEO?: CopartVideoEntry[];
      ENGINE_VIDEO_SOUND?: CopartVideoEntry[];
      [k: string]: unknown;
    };
  };
};

type CopartDetailItem = {
  lot?: string | number | null;
  lot_number_numeric?: number | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  full_title?: string | null;
  lot_url?: string | null;
  yard_name?: string | null;
  state?: string | null;
  country?: string | null;
  color?: string | null;
  primary_damage?: string | null;
  secondary_damage?: string | null;
  condition_note?: string | null;
  estimated_retail_value?: number | null;
  buy_now_price?: number | null;
  repair_cost?: number | null;
  auction_date_ts?: number | null;
  auction_date_iso?: string | null;
  odometer_value?: number | null;
  odometer_status?: string | null;
  engine?: string | null;
  cylinders?: string | number | null;
  transmission?: string | null;
  drive?: string | null;
  fuel?: string | null;
  keys_text?: string | null;
  title_brand?: string | null;
  title_type?: string | null;
  interior_color?: string | null;
  sale_status_text?: string | null;
  vin_masked?: string | null;
  damage_highlights?: string[] | null;
  thumbnail_url?: string | null;
  images?: CopartImagesPayload | null;
  [k: string]: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asPositiveMoney(value: unknown): number | null {
  const n = asFiniteNumber(value);
  if (n === null || n <= 0) return null;
  return n;
}

function uniqueStrings(values: Array<string | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function normalizeMediaIdentity(url: string): string {
  const cleaned = url.split('#')[0].split('?')[0].trim().toLowerCase();
  // Copart uses suffixes like _thb/_ful/_hrs (and video variants _v*).
  // Strip those so the same media is not shown multiple times.
  return cleaned.replace(/_(?:thb|ful|hrs|vthb|vful|vhrs)(\.[a-z0-9]+)$/i, '$1');
}

function uniqueMediaUrls(values: Array<string | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const key = normalizeMediaIdentity(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function parseModelFromTitle(title: string | null): string | null {
  if (!title) return null;
  const parts = title.trim().split(/\s+/);
  if (parts.length < 3) return null;
  return parts.slice(2).join(' ');
}

function parseCityFromYardName(yardName: string | null): string | null {
  if (!yardName) return null;
  const parts = yardName.split('-');
  if (parts.length < 2) return null;
  const city = parts.slice(1).join('-').trim();
  return city || null;
}

function buildCopartLotUrl(lot: string): string {
  return `https://www.copart.com/lot/${encodeURIComponent(lot)}`;
}

function formatOdometer(odometer: number | null): string | null {
  if (odometer === null || !Number.isFinite(odometer)) return null;
  const odometerKm = odometer * 1.60934;
  return `${Math.round(odometerKm).toLocaleString()} km`;
}

function parseAuctionDate(item: CopartDetailItem): number | null {
  const ts = asFiniteNumber(item.auction_date_ts);
  if (ts !== null) return ts;
  const iso = asString(item.auction_date_iso);
  if (!iso) return null;
  const parsed = new Date(iso).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function buildQueryParams(filters: CarFilterParams | undefined, limit: number, offset: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  if (filters?.search) params.set('search', filters.search);
  if (filters?.make) params.set('make', filters.make);
  if (filters?.model) params.set('model', filters.model);
  if (filters?.color) params.set('color', filters.color);
  if (filters?.interiorColor) params.set('interior_color', filters.interiorColor);
  if (filters?.fuel) params.set('fuel', filters.fuel);
  if (filters?.transmission) params.set('transmission', filters.transmission);
  if (filters?.condition) params.set('condition', filters.condition);
  if (typeof filters?.yearFrom === 'number') params.set('year_from', String(filters.yearFrom));
  if (typeof filters?.yearTo === 'number') params.set('year_to', String(filters.yearTo));
  if (typeof filters?.odometerMin === 'number') params.set('odometer_min', String(filters.odometerMin));
  if (typeof filters?.odometerMax === 'number') params.set('odometer_max', String(filters.odometerMax));
  if (filters?.buyNowAvailability === 'available') params.set('has_buy_now', 'true');
  if (filters?.buyNowAvailability === 'not_available') params.set('has_buy_now', 'false');

  const query = params.toString();
  return query ? `?${query}` : '';
}

async function fetchCarsPage(
  filters: CarFilterParams | undefined,
  limit: number,
  offset: number
): Promise<{ items: CopartDetailItem[]; total: number; limit: number; offset: number }> {
  const query = buildQueryParams(filters, limit, offset);
  const data = await fetchApi<{
    items?: CopartDetailItem[];
    total?: number;
    limit?: number;
    offset?: number;
  }>(`/api/cars${query}`);
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === 'number' ? data.total : 0,
    limit: typeof data.limit === 'number' ? data.limit : limit,
    offset: typeof data.offset === 'number' ? data.offset : offset,
  };
}

function extractImagesListRaw(item: CopartDetailItem): ImagesListRaw | null {
  const list = item.images?.data?.imagesList;
  if (!list || typeof list !== 'object') return null;
  return list as ImagesListRaw;
}

function extractPhotoUrls(item: CopartDetailItem): string[] {
  const list = item.images?.data?.imagesList?.IMAGE;
  const urls: Array<string | null> = [];

  if (Array.isArray(list)) {
    for (const entry of list) {
      // Pick one best URL per image to avoid rendering the same image
      // in multiple sizes (_thb/_ful/_hrs).
      urls.push(
        asString(entry.highResUrl) ??
          asString(entry.fullUrl) ??
          asString(entry.thumbnailUrl)
      );
    }
  }

  if (urls.length === 0) {
    urls.push(asString(item.thumbnail_url));
  }

  return uniqueMediaUrls(urls).slice(0, 40);
}

function extractEngineVideoUrls(listRaw: ImagesListRaw | null): string[] | null {
  if (!listRaw) return null;
  const source = listRaw.ENGINE_VIDEO_SOUND;
  if (!Array.isArray(source) || source.length === 0) return null;
  const urls = uniqueMediaUrls(source.map((video) => asString(video.highResUrl)));
  return urls.length > 0 ? urls : null;
}

function extractHighlights(item: CopartDetailItem): string[] | null {
  const fromDamage = Array.isArray(item.damage_highlights)
    ? item.damage_highlights.map((h) => asString(h)).filter((h): h is string => h !== null)
    : [];

  const extra = [
    asString(item.sale_status_text),
    asString(item.title_brand),
    asString(item.title_type),
    asString(item.fuel),
  ];

  const values = uniqueStrings([...fromDamage, ...extra]);
  return values.length > 0 ? values : null;
}

function withLegacyRawAliases(item: CopartDetailItem, city: string | null, retail: number | null, buyNow: number | null, repairCost: number | null): Record<string, unknown> {
  const existingRaw = item as Record<string, unknown>;
  const currency = asString(existingRaw.cuc) ?? asString(existingRaw.currency) ?? 'USD';
  const odometerType = asString(existingRaw.ord) ?? asString(item.odometer_status);
  const keys = asString(existingRaw.hk) ?? asString(item.keys_text);
  const transmission = asString(existingRaw.tsmn) ?? asString(item.transmission);
  const drive = asString(existingRaw.drv) ?? asString(item.drive);
  const exteriorColor = asString(existingRaw.ext_color) ?? asString(existingRaw.clr) ?? asString(item.color);
  const interiorColor =
    asString(existingRaw.int_color) ??
    asString(existingRaw.interior_color) ??
    asString(item.interior_color);

  return {
    ...existingRaw,
    cuc: currency,
    currency,
    rc: asPositiveMoney(existingRaw.rc) ?? repairCost,
    replacement_cost: asPositiveMoney(existingRaw.replacement_cost) ?? repairCost,
    bnp: asPositiveMoney(existingRaw.bnp) ?? buyNow,
    lotPlugAcv: asPositiveMoney(existingRaw.lotPlugAcv) ?? retail,
    locCountry: asString(existingRaw.locCountry) ?? asString(item.country),
    locState: asString(existingRaw.locState) ?? asString(item.state),
    locCity: asString(existingRaw.locCity) ?? city,
    scn: asString(existingRaw.scn) ?? null,
    int_color: interiorColor ?? null,
    ext_color: exteriorColor,
    clr: exteriorColor,
    ord: odometerType,
    hk: keys,
    tsmn: transmission,
    drv: drive,
    ac_s: asFiniteNumber(existingRaw.ac_s),
    crg: asFiniteNumber(existingRaw.crg),
    cr_damages: Array.isArray(existingRaw.cr_damages) ? existingRaw.cr_damages : [],
  };
}

function toCar(item: CopartDetailItem): Car {
  const lot =
    asString(item.lot) ??
    asString(item.lot_number_numeric) ??
    '0';

  const year = Math.max(0, Math.round(asFiniteNumber(item.year) ?? 0));
  const make = asString(item.make) ?? 'Unknown';
  const model = asString(item.model) ?? parseModelFromTitle(asString(item.full_title)) ?? 'Unknown';
  const odometer = asFiniteNumber(item.odometer_value);
  const city = parseCityFromYardName(asString(item.yard_name));
  const state = asString(item.state);
  const country = asString(item.country);
  const yard = asString(item.yard_name);
  const location = uniqueStrings([city, state, country, yard]).join(', ') || null;

  const retailValue = asPositiveMoney(item.estimated_retail_value);
  const buyNow = asPositiveMoney(item.buy_now_price);
  const repairCost = asPositiveMoney(item.repair_cost);
  const auctionDate = parseAuctionDate(item);

  const imagesListRaw = extractImagesListRaw(item);
  const raw = withLegacyRawAliases(item, city, retailValue, buyNow, repairCost);

  return {
    lot_number: lot,
    images: extractPhotoUrls(item),
    make,
    model,
    year,
    odometer,
    odometer_formatted: formatOdometer(odometer),
    item_url: asString(item.lot_url) ?? buildCopartLotUrl(lot),
    raw,
    location,
    color: asString(item.color),
    primary_damage: asString(item.primary_damage),
    secondary_damage: asString(item.secondary_damage),
    condition: asString(item.condition_note),
    estimated_retail_value: retailValue,
    estimated_retail_value_formatted: retailValue ? `$${Math.round(retailValue).toLocaleString()}` : null,
    buy_it_now_price: buyNow,
    buy_it_now_formatted: buyNow ? `$${Math.round(buyNow).toLocaleString()}` : null,
    auction_date: auctionDate,
    cylinders: item.cylinders ?? null,
    highlights: extractHighlights(item),
    engines: asString(item.engine)
      ? [
          {
            engineType: asString(item.engine),
            cylinders: item.cylinders ?? null,
            displacement: null,
            netHorsePower: null,
            netTorque: null,
          },
        ]
      : null,
    build_sheet: null,
    images_list_raw: imagesListRaw,
    engine_video_high_res: extractEngineVideoUrls(imagesListRaw),
    base_site: 'copart',
  };
}

export async function fetchCars(options?: {
  filters?: CarFilterParams;
  fetchAll?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: Car[]; total: number }> {
  const limit = options?.limit ?? API_DEFAULT_LIMIT;
  const offset = options?.offset ?? 0;
  const fetchAll = options?.fetchAll ?? false;

  try {
    if (!fetchAll) {
      const page = await fetchCarsPage(options?.filters, limit, offset);
      const items = page.items.map((item) => toCar(item));
      return { items, total: page.total };
    }

    const pageSize = Math.min(Math.max(limit, 1), 2000);
    let pageOffset = 0;
    let total = 0;
    const items: Car[] = [];

    while (true) {
      const page = await fetchCarsPage(options?.filters, pageSize, pageOffset);
      if (page.items.length === 0) break;
      items.push(...page.items.map((item) => toCar(item)));
      total = page.total;
      pageOffset += page.items.length;
      if (pageOffset >= total) break;
    }

    return { items, total: total || items.length };
  } catch (error) {
    console.warn('API unavailable, falling back to local data.', error);
  }

  const items = Array.isArray(copartData.items) ? copartData.items : [];
  return {
    items: items.map((item) => toCar(item as CopartDetailItem)),
    total: items.length,
  };
}

export async function fetchFilterOptions(): Promise<FilterOptions | null> {
  try {
    const data = await fetchApi<FilterOptions>('/api/cars/filters');
    return {
      makes: Array.isArray(data.makes) ? data.makes.filter(Boolean) : [],
      colors: Array.isArray(data.colors) ? data.colors.filter(Boolean) : [],
      interior_colors: Array.isArray(data.interior_colors) ? data.interior_colors.filter(Boolean) : [],
      fuels: Array.isArray(data.fuels) ? data.fuels.filter(Boolean) : [],
      transmissions: Array.isArray(data.transmissions) ? data.transmissions.filter(Boolean) : [],
      conditions: Array.isArray(data.conditions) ? data.conditions.filter(Boolean) : [],
      years: Array.isArray(data.years) ? data.years.filter((y) => typeof y === 'number') : [],
      has_buy_now_available: Boolean(data.has_buy_now_available),
      has_buy_now_not_available: Boolean(data.has_buy_now_not_available),
    };
  } catch (error) {
    console.warn('API unavailable for filter options.', error);
    return null;
  }
}

export async function fetchAllCars(): Promise<Car[]> {
  const result = await fetchCars({ limit: API_DEFAULT_LIMIT });
  return result.items;
}

export async function fetchCarByLotNumber(lotNumber: string): Promise<Car | null> {
  try {
    const item = await fetchApi<CopartDetailItem>(`/api/cars/${encodeURIComponent(lotNumber)}`);
    if (item) return toCar(item);
  } catch (error) {
    console.warn('API unavailable for lot lookup, falling back to local data.', error);
  }

  const cars = await fetchAllCars();
  return cars.find((car) => car.lot_number === lotNumber) ?? null;
}

export async function fetchCarsByLotNumbers(lots: string[]): Promise<Car[]> {
  const uniqueLots = Array.from(new Set(lots.map(String))).filter(Boolean);
  if (uniqueLots.length === 0) return [];

  try {
    const data = await fetchApi<{ items?: CopartDetailItem[] }>('/api/cars/by-lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lots: uniqueLots }),
    });
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length > 0) {
      return items.map((item) => toCar(item));
    }
  } catch (error) {
    console.warn('API unavailable for favorites lookup, falling back to local data.', error);
  }

  const items = Array.isArray(copartData.items) ? copartData.items : [];
  const lotSet = new Set(uniqueLots);
  return items
    .filter((item) =>
      lotSet.has(
        String(
          (item as CopartDetailItem).lot ??
            (item as CopartDetailItem).lot_number_numeric ??
            ''
        )
      )
    )
    .map((item) => toCar(item as CopartDetailItem));
}
