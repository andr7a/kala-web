export type FieldEntry = {
  key: string;
  label: string;
  value: string;
};

// Friendly labels for Copart / "copra" fields (common abbreviations).
// Add more mappings here anytime you see a confusing key.
const KEY_LABELS: Record<string, string> = {
  // Identity
  ln: 'Lot Number',
  lotNumberStr: 'Lot Number',
  fv: 'VIN',

  // Vehicle basics
  mkn: 'Make',
  mmod: 'Model',
  mtrim: 'Trim',
  lcy: 'Year',
  orr: 'Odometer',
  ord: 'Odometer Type',
  clr: 'Exterior Color',
  ext_color: 'Exterior Color',
  int_color: 'Interior Color',

  // Condition / specs
  lcd: 'Condition',
  dd: 'Primary Damage',
  sd: 'Secondary Damage',
  egn: 'Engine',
  cy: 'Cylinders',
  ft: 'Fuel Type',
  drv: 'Drive',
  tsmn: 'Transmission',
  hk: 'Keys',

  // Location
  locCity: 'City',
  locState: 'State',
  locCountry: 'Country',

  // Auction / seller
  ad: 'Sale Date',
  scn: 'Seller',
  tgd: 'Title',

  // Pricing
  lotPlugAcv: 'Estimated Value',
  bnp: 'Buy Now Price',
  cuc: 'Currency',
  rc: 'Replacement Cost',

  // Grades
  ac_s: 'ACS',
  crg: 'ARG',

  // Damage details
  cr_damages: 'CR Damage Details',

  // Media
  images: 'Photos',
};

const MONEY_KEYS = new Set(['lotPlugAcv', 'bnp', 'rc', 'estimated_retail_value', 'buy_it_now_price']);

function toTitleCaseFromKey(key: string): string {
  if (!key) return 'Field';

  // If we already have a mapping, use it.
  if (KEY_LABELS[key]) return KEY_LABELS[key];

  // Turn camelCase, snake_case, or weird keys into readable labels.
  const spaced = key
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  // For very short keys, keep them uppercase rather than "Bnp".
  if (spaced.length <= 4 && !spaced.includes(' ')) {
    return spaced.toUpperCase();
  }

  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '' || v.trim().toLowerCase() === 'n/a';
  return false;
}

function formatValue(v: any): string {
  if (v === null || v === undefined) return 'Not available';
  if (typeof v === 'string') return v.trim() || 'Not available';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toString() : 'Not available';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';

  // Arrays
  if (Array.isArray(v)) {
    if (v.length === 0) return 'Not available';
    // If it's an array of strings/numbers, join a few.
    const simple = v.every((x) => ['string', 'number', 'boolean'].includes(typeof x));
    if (simple) {
      const parts = v.slice(0, 6).map((x) => String(x));
      return v.length > 6 ? `${parts.join(', ')} +${v.length - 6} more` : parts.join(', ');
    }

    // Arrays of objects: try to summarize in a human-friendly way.
    const objects = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
    if (objects.length === v.length) {
      // Special case: Copart "CR" damage details.
      const looksLikeCr = objects.some((o: any) =>
        'aasc_item_description' in o || 'aasc_damage_description' in o || 'aasc_severity_description' in o
      );
      if (looksLikeCr) {
        const parts = objects.slice(0, 6).map((o: any) => {
          const item = (o.aasc_item_description ?? 'Item').toString();
          const dmg = (o.aasc_damage_description ?? '').toString();
          const sev = (o.aasc_severity_description ?? '').toString();
          const area = (o.damage_area ?? '').toString();
          const core = [item, dmg && `— ${dmg}`, sev && `(${sev})`].filter(Boolean).join(' ');
          return area ? `${core} [${area}]` : core;
        });
        return v.length > 6 ? `${parts.join(' • ')} • +${v.length - 6} more` : parts.join(' • ');
      }

      // Generic object list summary.
      const parts = objects.slice(0, 4).map((o: any) => {
        const keys = Object.keys(o).slice(0, 3);
        const kv = keys.map((k) => `${toTitleCaseFromKey(k)}: ${formatValue((o as any)[k])}`);
        return kv.join(', ');
      });
      return v.length > 4 ? `${parts.join(' • ')} • +${v.length - 4} more` : parts.join(' • ');
    }

    return `${v.length} items`;
  }

  // Objects
  try {
    const s = JSON.stringify(v);
    return s.length > 180 ? `${s.slice(0, 180)}…` : s;
  } catch {
    return String(v);
  }
}

function shouldHideField(key: string, v: any): boolean {
  if (isEmptyValue(v)) return true;

  // Hide noisy / huge fields that don't help users.
  if (key === 'raw') return true;

  // Photos: show as count, not full list
  if (key === 'images' && Array.isArray(v)) return false;

  // Money fields: hide if 0
  if (MONEY_KEYS.has(key) && typeof v === 'number' && v === 0) return true;

  // Some datasets send "0" as a string.
  if (MONEY_KEYS.has(key) && typeof v === 'string' && v.trim().replace(/[$,]/g, '') === '0') return true;

  return false;
}

export function buildReadableEntries(raw?: Record<string, any> | null): FieldEntry[] {
  if (!raw || typeof raw !== 'object') return [];

  const entries: FieldEntry[] = [];

  for (const [k, v] of Object.entries(raw)) {
    if (shouldHideField(k, v)) continue;

    // Special formatting
    if (k === 'images' && Array.isArray(v)) {
      entries.push({
        key: k,
        label: toTitleCaseFromKey(k),
        value: `${v.length} photos`,
      });
      continue;
    }

    entries.push({
      key: k,
      label: toTitleCaseFromKey(k),
      value: formatValue(v),
    });
  }

  // Sort by label, but keep super important fields near the top.
  const priority = new Map<string, number>([
    ['Lot Number', 1],
    ['VIN', 2],
    ['Sale Date', 3],
    ['Estimated Value', 4],
    ['Buy Now Price', 5],
    ['Condition', 6],
    ['Primary Damage', 7],
    ['Transmission', 8],
    ['Drive', 9],
  ]);

  return entries
    .sort((a, b) => {
      const pa = priority.get(a.label) ?? 999;
      const pb = priority.get(b.label) ?? 999;
      if (pa !== pb) return pa - pb;
      return a.label.localeCompare(b.label);
    });
}

export function displayMoney(value: number | null | undefined, formatted?: string | null): string {
  if (value === null || value === undefined) {
    // If formatted exists but is $0 / 0, treat as N/A.
    if (formatted) {
      const cleaned = formatted.replace(/[$,\s]/g, '');
      if (cleaned === '0') return 'Not available';
      return formatted;
    }
    return 'Not available';
  }
  if (value === 0) return 'Not available';
  return formatted || `$${value.toLocaleString()}`;
}
