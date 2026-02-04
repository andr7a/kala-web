import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAllCars, type Car } from '../services/carService';
import { CarCard } from '../components/CarCard';

type AnswerMap = Record<string, string | string[]>;

function parseOdometerKm(odo?: number | string | null): number | null {
  if (odo === null || odo === undefined) return null;
  if (typeof odo === 'number') return Number.isFinite(odo) ? odo * 1.60934 : null;
  const digits = String(odo).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n * 1.60934 : null;
}

function toNumberOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type Question =
  | {
      id: string;
      title: string;
      description?: string;
      type: 'single';
      options: { label: string; value: string }[];
    }
  | {
      id: string;
      title: string;
      description?: string;
      type: 'multi';
      options: { label: string; value: string }[];
      maxPick?: number;
    };

export default function AIAdvisorPage() {
  const navigate = useNavigate();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAllCars();
        if (mounted) setCars(data);
      } catch (e) {
        console.error(e);
        if (mounted) setError('Could not load cars. Please refresh and try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const brands = useMemo(() => {
    const unique = Array.from(new Set(cars.map((c) => c.make).filter(Boolean))).sort();
    return unique.slice(0, 18); // keep UI simple
  }, [cars]);

  const colors = useMemo(() => {
    const unique = Array.from(new Set(cars.map((c) => c.color).filter(Boolean))) as string[];
    return unique.sort().slice(0, 18);
  }, [cars]);

  const questions: Question[] = useMemo(() => {
    return [
      {
        id: 'goal',
        title: 'What do you want this car mainly for?',
        type: 'single',
        options: [
          { label: 'Daily commute (reliable + low km)', value: 'commute' },
          { label: 'Family use (newer + roomy)', value: 'family' },
          { label: 'Budget deal (cheapest options)', value: 'budget' },
          { label: 'Resale / value (best value for money)', value: 'value' },
          { label: 'Project / rebuild (damage is OK)', value: 'project' },
        ],
      },
      {
        id: 'budget',
        title: 'What’s your maximum budget?',
        description: 'We’ll prioritize cars with a Buy It Now price when available.',
        type: 'single',
        options: [
          { label: 'Up to $2,000', value: '2000' },
          { label: 'Up to $5,000', value: '5000' },
          { label: 'Up to $10,000', value: '10000' },
          { label: 'Up to $15,000', value: '15000' },
          { label: 'Up to $25,000', value: '25000' },
          { label: 'No hard limit', value: 'nolimit' },
        ],
      },
      {
        id: 'year_pref',
        title: 'Do you prefer newer or older cars?',
        type: 'single',
        options: [
          { label: 'Newer (2018+)', value: 'newer' },
          { label: 'Mid (2012–2017)', value: 'mid' },
          { label: 'Older (2000–2011)', value: 'older' },
          { label: 'Any', value: 'any' },
        ],
      },
      {
        id: 'mileage',
        title: 'How much mileage are you comfortable with?',
        type: 'single',
        options: [
          { label: 'Low (under 96k km)', value: 'low' },
          { label: 'Medium (96k–193k km)', value: 'medium' },
          { label: 'High (193k+ is okay)', value: 'high' },
          { label: 'Any / don’t care', value: 'any' },
        ],
      },
      {
        id: 'damage_tolerance',
        title: 'How much damage are you okay with?',
        description: 'Auction cars may have damage listed (e.g. front end, hail).',
        type: 'single',
        options: [
          { label: 'Minimal / light damage only', value: 'low' },
          { label: 'Moderate is okay', value: 'medium' },
          { label: 'Any damage is okay (project car)', value: 'high' },
        ],
      },
      {
        id: 'buy_now',
        title: 'Do you want to focus on Buy It Now listings?',
        type: 'single',
        options: [
          { label: 'Yes (prefer Buy It Now)', value: 'yes' },
          { label: 'No (auction is fine)', value: 'no' },
        ],
      },
      {
        id: 'brand_pick',
        title: 'Pick up to 3 preferred brands',
        description: 'Optional. Skip if you want best match regardless of brand.',
        type: 'multi',
        maxPick: 3,
        options: [{ label: 'No preference', value: 'any' }, ...brands.map((b) => ({ label: b, value: b }))],
      },
      {
        id: 'color_pick',
        title: 'Preferred color?',
        description: 'Optional. Some listings don’t have a color.',
        type: 'single',
        options: [{ label: 'Any', value: 'any' }, ...colors.map((c) => ({ label: c, value: c }))],
      },
      {
        id: 'min_photos',
        title: 'Do you want listings with more photos?',
        type: 'single',
        options: [
          { label: 'Yes (more photos)', value: 'yes' },
          { label: 'No preference', value: 'no' },
        ],
      },
      {
        id: 'location_pref',
        title: 'Do you want to prioritize a specific location?',
        description: 'Optional. We’ll match text in the location field.',
        type: 'single',
        options: [
          { label: 'No preference', value: 'any' },
          { label: 'Near me (enter manually on next screen)', value: 'manual' },
        ],
      },
      {
        id: 'repair_budget',
        title: 'How much do you want to spend on repairs?',
        type: 'single',
        options: [
          { label: 'Very little', value: 'low' },
          { label: 'Some repairs are ok', value: 'medium' },
          { label: 'Big rebuild is ok', value: 'high' },
        ],
      },
      {
        id: 'value_focus',
        title: 'What matters more?',
        type: 'single',
        options: [
          { label: 'Cheapest price', value: 'cheap' },
          { label: 'Newer year', value: 'newer' },
          { label: 'Lower km', value: 'miles' },
          { label: 'Higher retail value (potential upside)', value: 'retail' },
        ],
      },
      {
        id: 'avoid_damage',
        title: 'Anything you want to avoid?',
        description: 'We’ll de-prioritize these damage keywords when possible.',
        type: 'multi',
        maxPick: 3,
        options: [
          { label: 'No preference', value: 'none' },
          { label: 'Front End', value: 'FRONT' },
          { label: 'Rear End', value: 'REAR' },
          { label: 'Hail', value: 'HAIL' },
          { label: 'Water / Flood', value: 'WATER' },
          { label: 'Burn', value: 'BURN' },
        ],
      },
      {
        id: 'explain',
        title: 'Do you want a short explanation for the match?',
        type: 'single',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
      },
      {
        id: 'ready',
        title: 'Ready to get your AI matches?',
        type: 'single',
        options: [
          { label: 'Yes, show me cars', value: 'yes' },
        ],
      },
    ];
  }, [brands, colors]);

  const [manualLocation, setManualLocation] = useState('');

  const totalSteps = questions.length;
  const currentQuestion = questions[clamp(step, 0, totalSteps - 1)];

  const progressPct = useMemo(() => {
    return Math.round(((step + 1) / totalSteps) * 100);
  }, [step, totalSteps]);

  const getAnswer = (id: string): string | string[] | undefined => answers[id];

  const setSingle = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMulti = (id: string, value: string, maxPick = 3) => {
    setAnswers((prev) => {
      const existing = prev[id];
      const cur = Array.isArray(existing) ? existing : [];

      // "any" / "none" act like reset.
      if (value === 'any' || value === 'none') {
        return { ...prev, [id]: [value] };
      }

      const cleaned = cur.filter((v) => v !== 'any' && v !== 'none');
      const has = cleaned.includes(value);
      let next = has ? cleaned.filter((v) => v !== value) : [...cleaned, value];
      if (next.length > maxPick) next = next.slice(0, maxPick);
      return { ...prev, [id]: next };
    });
  };

  const canGoNext = useMemo(() => {
    const a = getAnswer(currentQuestion.id);
    if (currentQuestion.type === 'single') return typeof a === 'string' && a.length > 0;
    if (currentQuestion.type === 'multi') return Array.isArray(a) && a.length > 0;
    return false;
  }, [answers, currentQuestion]);

  const goNext = () => {
    if (!canGoNext) return;
    setStep((s) => clamp(s + 1, 0, totalSteps));
  };

  const goBack = () => setStep((s) => clamp(s - 1, 0, totalSteps));

  const isResultStep = step >= totalSteps;

  type Match = { car: Car; score: number; reasons: string[] };

  const matches: Match[] = useMemo(() => {
    if (!isResultStep) return [];
    if (cars.length === 0) return [];

    const goal = String(answers.goal ?? 'value');
    const budgetRaw = String(answers.budget ?? 'nolimit');
    const yearPref = String(answers.year_pref ?? 'any');
    const mileagePref = String(answers.mileage ?? 'any');
    const damageTol = String(answers.damage_tolerance ?? 'medium');
    const buyNowPref = String(answers.buy_now ?? 'no');
    const colorPick = String(answers.color_pick ?? 'any');
    const minPhotos = String(answers.min_photos ?? 'no');
    const locationPref = String(answers.location_pref ?? 'any');
    const repairBudget = String(answers.repair_budget ?? 'medium');
    const valueFocus = String(answers.value_focus ?? 'cheap');
    const explain = String(answers.explain ?? 'yes');

    const brandsPick = answers.brand_pick;
    const preferredBrands = Array.isArray(brandsPick)
      ? brandsPick.filter((b) => b !== 'any')
      : [];

    const avoid = answers.avoid_damage;
    const avoidKeys = Array.isArray(avoid)
      ? avoid.filter((k) => k !== 'none')
      : [];

    const budgetMax = budgetRaw === 'nolimit' ? null : toNumberOrNull(budgetRaw);

    const yearTarget = (() => {
      if (yearPref === 'newer') return { min: 2018, max: 2050 };
      if (yearPref === 'mid') return { min: 2012, max: 2017 };
      if (yearPref === 'older') return { min: 2000, max: 2011 };
      return { min: 0, max: 3000 };
    })();

    const mileageTarget = (() => {
      if (mileagePref === 'low') return { max: 96_000 };
      if (mileagePref === 'medium') return { min: 96_000, max: 193_000 };
      if (mileagePref === 'high') return { min: 193_000 };
      return {} as { min?: number; max?: number };
    })();

    const damageRisk = (d?: string | null) => {
      const s = String(d ?? '').toUpperCase();
      if (!s) return 0.45; // unknown
      if (s.includes('NORMAL') || s.includes('MINOR') || s.includes('DENT') || s.includes('SCRATCH')) return 0.2;
      if (s.includes('FRONT') || s.includes('REAR') || s.includes('SIDE')) return 0.55;
      if (s.includes('HAIL')) return 0.5;
      if (s.includes('WATER') || s.includes('FLOOD')) return 0.85;
      if (s.includes('BURN') || s.includes('FIRE')) return 0.9;
      return 0.55;
    };

    const tolerate = (() => {
      if (damageTol === 'low') return 0.45;
      if (damageTol === 'medium') return 0.7;
      return 1.0;
    })();

    const repairFactor = (() => {
      if (repairBudget === 'low') return 0.55;
      if (repairBudget === 'medium') return 0.8;
      return 1.0;
    })();

    const wantBuyNow = buyNowPref === 'yes';

    const locText = locationPref === 'manual' ? manualLocation.trim().toLowerCase() : '';

    const scored: Match[] = cars
      .map((car) => {
        let score = 0;
        const reasons: string[] = [];

        const year = typeof car.year === 'number' ? car.year : 0;
        const odometerKm = parseOdometerKm(car.odometer);
        const price = car.buy_it_now_price ?? car.estimated_retail_value ?? null;
        const retail = car.estimated_retail_value ?? null;

        // Budget filter (soft, not hard)
        if (budgetMax && price) {
          if (price <= budgetMax) {
            score += 20;
            reasons.push(`Within budget (≈ $${price.toLocaleString()}).`);
          } else {
            const over = (price - budgetMax) / budgetMax;
            score -= clamp(over * 25, 5, 30);
            reasons.push(`Above budget (≈ $${price.toLocaleString()}).`);
          }
        } else if (budgetMax && !price) {
          score -= 5;
          reasons.push('Price not listed; harder to match your budget.');
        }

        // Year preference
        if (year >= yearTarget.min && year <= yearTarget.max) {
          score += 18;
          reasons.push(`Year matches your preference (${year}).`);
        } else if (year > 0) {
          score += 6;
        }

        // Mileage preference
        if (odometerKm != null) {
          if (mileageTarget.max != null && odometerKm <= mileageTarget.max) {
            score += 16;
            reasons.push(`Low km (${Math.round(odometerKm).toLocaleString()} km).`);
          } else if (mileageTarget.min != null && mileageTarget.max != null) {
            if (odometerKm >= mileageTarget.min && odometerKm <= mileageTarget.max) {
              score += 14;
              reasons.push(`KM in your range (${Math.round(odometerKm).toLocaleString()} km).`);
            } else {
              score -= 6;
            }
          } else if (mileageTarget.min != null && odometerKm >= mileageTarget.min) {
            score += 10;
            reasons.push(`High km OK (${Math.round(odometerKm).toLocaleString()} km).`);
          } else {
            score += 6;
          }
        } else {
          score -= 3;
        }

        // Brand preference
        if (preferredBrands.length > 0) {
          if (preferredBrands.includes(car.make)) {
            score += 14;
            reasons.push(`Preferred brand (${car.make}).`);
          } else {
            score -= 4;
          }
        }

        // Color
        if (colorPick !== 'any') {
          if ((car.color ?? '').toLowerCase() === colorPick.toLowerCase()) {
            score += 6;
            reasons.push(`Color match (${car.color}).`);
          } else {
            score -= 2;
          }
        }

        // Photos
        if (minPhotos === 'yes') {
          const count = car.images?.length ?? 0;
          if (count >= 12) {
            score += 6;
            reasons.push(`Many photos (${count}).`);
          } else {
            score -= 2;
          }
        }

        // Location
        if (locText) {
          const loc = (car.location ?? '').toLowerCase();
          if (loc.includes(locText)) {
            score += 6;
            reasons.push(`Matches location preference (${car.location}).`);
          } else {
            score -= 2;
          }
        }

        // Buy It Now
        if (wantBuyNow) {
          if (car.buy_it_now_price != null) {
            score += 10;
            reasons.push('Has Buy It Now price.');
          } else {
            score -= 10;
          }
        }

        // Damage tolerance
        const risk = Math.max(damageRisk(car.primary_damage), damageRisk(car.secondary_damage));
        const toleranceScore = (1 - risk) * 20 * tolerate * repairFactor;
        score += toleranceScore;
        if (risk >= 0.85) reasons.push('Higher damage risk; might need bigger repairs.');
        else if (risk <= 0.25) reasons.push('Looks like lighter damage overall.');

        // Avoid keywords
        if (avoidKeys.length > 0) {
          const dmg = `${car.primary_damage ?? ''} ${car.secondary_damage ?? ''}`.toUpperCase();
          const hit = avoidKeys.some((k) => dmg.includes(k));
          if (hit) {
            score -= 10;
            reasons.push('Contains a damage type you wanted to avoid.');
          }
        }

        // Goal / focus tuning
        if (goal === 'budget') {
          if (price != null) score += clamp(25_000 / Math.max(price, 1), 0, 20);
        }
        if (goal === 'family' || goal === 'commute') {
          score += year >= 2016 ? 6 : 0;
          if (odometerKm != null) score += odometerKm <= 145_000 ? 4 : 0;
        }
        if (goal === 'project') {
          score += risk >= 0.55 ? 8 : 0;
        }
        if (goal === 'value' && retail != null && price != null) {
          const upside = retail - price;
          score += clamp(upside / 1000, -10, 20);
        }

        // Value focus
        if (valueFocus === 'cheap' && price != null) score += clamp(18_000 / Math.max(price, 1), 0, 18);
        if (valueFocus === 'newer') score += clamp((year - 2000) / 2.2, 0, 20);
        if (valueFocus === 'miles' && odometerKm != null) score += clamp(193_000 / Math.max(odometerKm, 1), 0, 18);
        if (valueFocus === 'retail' && retail != null) score += clamp(retail / 2000, 0, 18);

        // Keep reasons short unless requested.
        const finalReasons = explain === 'yes' ? reasons.slice(0, 4) : [];
        return { car, score, reasons: finalReasons };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return scored;
  }, [answers, cars, isResultStep, manualLocation]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cars')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition"
            >
              <ArrowLeft size={18} />
              Back to Cars
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="text-blue-600" size={20} />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">AI Car Finder</h1>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {isResultStep ? 'Results' : `Question ${step + 1} / ${totalSteps}`}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="bg-white rounded-xl shadow p-8">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow p-8">
            <p className="text-red-600 font-semibold">{error}</p>
          </div>
        ) : isResultStep ? (
          <>
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Your best matches</h2>
                  <p className="text-gray-600">
                    These are ranked using your answers (budget, year, mileage, damage tolerance, and preferences).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setAnswers({});
                    setManualLocation('');
                    setStep(0);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium"
                >
                  Start over
                </button>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8">
                <p className="text-gray-700">No cars found to recommend. Try relaxing constraints (budget, brand, or damage limits).</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {matches.map((m) => (
                  <div key={m.car.lot_number} className="space-y-3">
                    <CarCard car={m.car} isSelected={false} onSelect={() => {}} />
                    {m.reasons.length > 0 && (
                      <div className="bg-white rounded-lg shadow p-4">
                        <p className="font-semibold text-gray-900 mb-2">Why this match</p>
                        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
                          {m.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="mb-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{currentQuestion.title}</h2>
                  {currentQuestion.description && (
                    <p className="text-gray-600 mt-1">{currentQuestion.description}</p>
                  )}
                </div>
                <div className="w-40">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="text-xs text-gray-600 mt-1 text-right">{progressPct}%</div>
                </div>
              </div>
            </div>

            {/* Special input for manual location */}
            {currentQuestion.id === 'location_pref' && String(getAnswer('location_pref') ?? '') === 'manual' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Enter location keyword (example: Tbilisi, GA, New York)</label>
                <input
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type a location…"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.type === 'single' &&
                currentQuestion.options.map((o) => {
                  const selected = getAnswer(currentQuestion.id) === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => setSingle(currentQuestion.id, o.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <div className="font-semibold">{o.label}</div>
                    </button>
                  );
                })}

              {currentQuestion.type === 'multi' &&
                currentQuestion.options.map((o) => {
                  const cur = getAnswer(currentQuestion.id);
                  const arr = Array.isArray(cur) ? cur : [];
                  const selected = arr.includes(o.value);
                  const maxPick = currentQuestion.maxPick ?? 3;
                  return (
                    <button
                      key={o.value}
                      onClick={() => toggleMulti(currentQuestion.id, o.value, maxPick)}
                      className={`text-left px-4 py-3 rounded-lg border transition ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-900'
                      }`}
                    >
                      <div className="font-semibold">{o.label}</div>
                      {currentQuestion.maxPick && o.value !== 'any' && o.value !== 'none' && (
                        <div className="text-xs text-gray-600 mt-1">Pick up to {currentQuestion.maxPick}</div>
                      )}
                    </button>
                  );
                })}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
                Back
              </button>

              <button
                onClick={() => {
                  if (step === totalSteps - 1) {
                    // last question
                    setStep(totalSteps);
                  } else {
                    goNext();
                  }
                }}
                disabled={!canGoNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Note: This “AI” match uses your answers to rank the cars in your dataset (price, year, mileage, damage keywords, photos, and preferences).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
