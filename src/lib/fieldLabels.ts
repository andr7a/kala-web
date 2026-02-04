// Friendly labels for abbreviated/technical fields coming from Copart (and similar sources).
// The goal is: show human-readable labels in the UI instead of raw keys like "bnp" or "tsmn".

const KEY_LABELS: Record<string, string> = {
  // Common identifiers
  ln: 'Lot Number',
  lotNumberStr: 'Lot Number',
  fv: 'VIN',
  ld: 'Title',

  // Vehicle basics
  mkn: 'Make',
  mmod: 'Model',
  mtrim: 'Trim',
  lcy: 'Year',

  // Location
  locCity: 'City',
  locState: 'State',
  locCountry: 'Country',

  // Condition / damage
  lcd: 'Condition',
  dd: 'Primary Damage',
  cr_damages: 'Damage Details',

  // Colors
  clr: 'Color',
  ext_color: 'Exterior Color',
  int_color: 'Interior Color',

  // Odometer
  orr: 'Odometer',
  ord: 'Odometer Type',

  // Auction / pricing
  ad: 'Sale Date',
  lotPlugAcv: 'Estimated Value',
  bnp: 'Buy Now Price',
  cuc: 'Currency',
  brand: 'Company',

  // Powertrain
  egn: 'Engine',
  cy: 'Cylinders',
  tsmn: 'Transmission',
  drv: 'Drive',
  ft: 'Fuel Type',

  // Other common flags
  hk: 'Keys',
  tgd: 'Title Type',
  scn: 'Seller',
  syn: 'Sale Type',
  serviceOrderType: 'Sale Category',

  // Media
  images: 'Photos',
};

const ACRONYMS = new Set(['vin', 'url', 'id', 'acv', 'usd', 'msrp']);

function titleCaseWords(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      return lw.charAt(0).toUpperCase() + lw.slice(1);
    })
    .join(' ');
}

/** Convert raw keys like "lotPlugAcv" or "primary_damage" to friendly labels. */
export function labelForFieldKey(key: string): string {
  if (!key) return 'Field';
  if (KEY_LABELS[key]) return KEY_LABELS[key];

  // snake_case
  if (key.includes('_')) {
    return titleCaseWords(key.replace(/_/g, ' '));
  }

  // camelCase
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return titleCaseWords(spaced);
}

function isEpochMs(n: number): boolean {
  return n > 10_000_000_000; // > ~1970-04-26 in ms
}

function moneyFormat(n: number): string {
  // Keep it simple; currency is usually USD in the dataset.
  return `$${Math.round(n).toLocaleString()}`;
}

export function formatFieldValue(key: string, value: any, _fullObject?: Record<string, any> | null): string {
  if (value === null || value === undefined || value === '') return 'Not available';

  // Special cases
  if (key === 'images' && Array.isArray(value)) {
    return `${value.length} photos`;
  }

  if (typeof value === 'number') {
    if (key === 'ad' && isEpochMs(value)) {
      return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (key === 'lotPlugAcv' || key === 'bnp') {
      // Avoid showing "0" as a value.
      if (value === 0) return 'Not available';
      // If currency code exists, you could extend this later.
      return moneyFormat(value);
    }
    return Number.isFinite(value) ? value.toString() : 'Not available';
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'string') {
    const s = value.trim();
    return s || 'Not available';
  }

  // Arrays / objects
  try {
    const s = JSON.stringify(value);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return String(value);
  }
}

/**
 * Build a friendly list of entries from a raw object.
 * Filters out very noisy fields, but keeps "everything important".
 */
export function buildFriendlyRawEntries(raw?: Record<string, any> | null): Array<{ key: string; label: string; value: string }> {
  if (!raw) return [];

  const noisyKeys = new Set<string>([
    // internal / overly technical buckets that are not useful to users
    'cr_damages', // can be huge; still included above in labels, but we hide if too long
  ]);

  return Object.keys(raw)
    .sort((a, b) => a.localeCompare(b))
    .filter((k) => k && !k.startsWith('_'))
    .map((key) => {
      const v = (raw as any)[key];
      let formatted = formatFieldValue(key, v, raw);

      // If something is extremely long, keep it readable.
      if (typeof formatted === 'string' && formatted.length > 220) {
        formatted = `${formatted.slice(0, 220)}…`;
      }

      // Hide noisy keys if empty.
      if (noisyKeys.has(key) && (formatted === 'Not available' || formatted === '[]' || formatted === '{}')) {
        return null;
      }

      return {
        key,
        label: labelForFieldKey(key),
        value: formatted,
      };
    })
    .filter(Boolean) as any;
}
