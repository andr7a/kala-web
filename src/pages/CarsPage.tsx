import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarCard } from '../components/CarCard';
import { useComparison } from '../context/ComparisonContext';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, X, Filter, User, LogOut, Heart, ChevronDown, Sparkles, Search } from 'lucide-react';
import { fetchAllCars, type Car } from '../services/carService';

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  let j = 0;
  while (i < needle.length && j < haystack.length) {
    if (needle[i] === haystack[j]) i += 1;
    j += 1;
  }
  return i === needle.length;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      );
      prev = temp;
    }
  }
  return dp[n];
}

function fuzzyTokenMatch(token: string, word: string): boolean {
  if (!token || !word) return false;
  if (word.includes(token) || token.includes(word)) return true;
  if (isSubsequence(token, word)) return true;
  const maxDistance = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
  return levenshtein(token, word) <= maxDistance;
}

export function CarsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedInteriorColor, setSelectedInteriorColor] = useState<string>('');
  const [selectedFuelType, setSelectedFuelType] = useState<string>('');
  const [selectedTransmission, setSelectedTransmission] = useState<string>('');
  const [selectedBuyNowAvailability, setSelectedBuyNowAvailability] = useState<string>('');
  const [selectedOdometerRange, setSelectedOdometerRange] = useState<string>('');
  const [selectedCondition, setSelectedCondition] = useState<string>('');
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const { selectedCars, toggleCar, clearComparison } = useComparison();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
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
    const loadCars = async () => {
      setLoading(true);
      try {
        const data = await fetchAllCars();
        setCars(data);
      } catch (error) {
        console.error('Error fetching cars:', error);
      }
      setLoading(false);
    };

    loadCars();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCarSelect = (car: Car) => {
    toggleCar(car);
  };

  const isCarSelected = (car: Car) => {
    return selectedCars.some(c => c.lot_number === car.lot_number);
  };

  const getCompany = (car: Car): string | null => {
    if (!car.base_site || !car.base_site.trim()) return null;
    return car.base_site.trim().toLowerCase();
  };

  const getInteriorColor = (car: Car): string | null => {
    const raw = (car.raw ?? {}) as Record<string, unknown>;
    const interiorRaw = raw.int_color ?? raw.interior_color ?? raw.interiorColor;
    if (typeof interiorRaw === 'string' && interiorRaw.trim()) return interiorRaw.trim();

    const exteriorRaw = raw.ext_color ?? raw.clr ?? raw.exterior_color ?? car.color;
    if (typeof exteriorRaw === 'string' && exteriorRaw.trim()) {
      return `${exteriorRaw.trim()} (estimated)`;
    }
    return null;
  };

  const getFuelType = (car: Car): string | null => {
    const raw = (car.raw ?? {}) as Record<string, unknown>;
    const fuelRaw = raw.fuel ?? raw.ft;
    return typeof fuelRaw === 'string' && fuelRaw.trim() ? fuelRaw.trim() : null;
  };

  const getTransmissionType = (car: Car): string | null => {
    const raw = (car.raw ?? {}) as Record<string, unknown>;
    const transmissionRaw = raw.tsmn ?? raw.transmission;
    return typeof transmissionRaw === 'string' && transmissionRaw.trim() ? transmissionRaw.trim() : null;
  };

  const hasBuyNowPrice = (car: Car): boolean => {
    const value = car.buy_it_now_price;
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  };

  // Get unique brands
  const brands = useMemo(() => {
    const uniqueBrands = Array.from(new Set(cars.map(car => car.make))).sort();
    return uniqueBrands;
  }, [cars]);

  const companies = useMemo(() => {
    const uniqueCompanies = Array.from(
      new Set(cars.map((car) => getCompany(car)).filter(Boolean))
    ).sort() as string[];
    return uniqueCompanies;
  }, [cars]);

  // Get models based on selected brand
  const models = useMemo(() => {
    if (!selectedBrand) return [];
    const brandCars = cars.filter(car => car.make === selectedBrand);
    const uniqueModels = Array.from(new Set(brandCars.map(car => car.model))).sort();
    return uniqueModels;
  }, [cars, selectedBrand]);

  // Get unique colors
  const colors = useMemo(() => {
    const uniqueColors = Array.from(new Set(cars.map(car => car.color).filter(Boolean))).sort() as string[];
    return uniqueColors;
  }, [cars]);

  // Get unique conditions
  const conditions = useMemo(() => {
    const uniqueConditions = Array.from(new Set(cars.map(car => car.condition).filter(Boolean))).sort() as string[];
    return uniqueConditions;
  }, [cars]);

  const interiorColors = useMemo(() => {
    const uniqueInteriorColors = Array.from(
      new Set(cars.map((car) => getInteriorColor(car)).filter(Boolean))
    ).sort() as string[];
    return uniqueInteriorColors;
  }, [cars]);

  const fuelTypes = useMemo(() => {
    const uniqueFuelTypes = Array.from(
      new Set(cars.map((car) => getFuelType(car)).filter(Boolean))
    ).sort() as string[];
    return uniqueFuelTypes;
  }, [cars]);

  const transmissions = useMemo(() => {
    const uniqueTransmissions = Array.from(
      new Set(cars.map((car) => getTransmissionType(car)).filter(Boolean))
    ).sort() as string[];
    return uniqueTransmissions;
  }, [cars]);

  const buyNowAvailabilityOptions = useMemo(() => {
    const hasAvailable = cars.some((car) => hasBuyNowPrice(car));
    const hasNotAvailable = cars.some((car) => !hasBuyNowPrice(car));

    return [
      hasAvailable ? { value: 'available', label: 'Buy Now Available' } : null,
      hasNotAvailable ? { value: 'not_available', label: 'Buy Now Not Available' } : null,
    ].filter(Boolean) as Array<{ value: string; label: string }>;
  }, [cars]);

  // Get available years for dropdown
  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(cars.map(car => car.year).filter((y): y is number => typeof y === 'number' && !Number.isNaN(y)))
    ).sort((a, b) => b - a);
    return years;
  }, [cars]);

  // Filter cars based on selected filters
  const filteredCars = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const tokens = tokenizeSearchText(searchQuery);
    return cars.filter(car => {
      if (normalizedQuery) {
        const haystack = normalizeSearchText(
          [
            car.make,
            car.model,
            car.year,
            car.lot_number,
            car.color,
            car.condition,
            car.primary_damage,
            car.secondary_damage,
            car.location,
            car.base_site,
          ]
            .filter(Boolean)
            .join(' ')
        );

        if (!haystack) return false;
        if (!haystack.includes(normalizedQuery)) {
          const words = haystack.split(/\s+/);
          const matches = tokens.every((token) =>
            words.some((word) => fuzzyTokenMatch(token, word))
          );
          if (!matches) return false;
        }
      }

      if (selectedCompany && car.base_site !== selectedCompany) return false;
      if (selectedBrand && car.make !== selectedBrand) return false;
      if (selectedModel && car.model !== selectedModel) return false;
      if (selectedColor && car.color !== selectedColor) return false;
      if (selectedInteriorColor && getInteriorColor(car) !== selectedInteriorColor) return false;
      if (selectedFuelType && getFuelType(car) !== selectedFuelType) return false;
      if (selectedTransmission && getTransmissionType(car) !== selectedTransmission) return false;
      if (selectedCondition && car.condition !== selectedCondition) return false;
      if (selectedBuyNowAvailability === 'available' && !hasBuyNowPrice(car)) return false;
      if (selectedBuyNowAvailability === 'not_available' && hasBuyNowPrice(car)) return false;

      // Odometer range filter
      if (selectedOdometerRange) {
        // Stored odometer is miles in source data; filter ranges are in km.
        const odometerValueKm = (car.odometer ?? 0) * 1.60934;
        const [min, max] = selectedOdometerRange.split('-').map(v => parseInt(v));
        if (max) {
          if (odometerValueKm < min || odometerValueKm > max) return false;
        } else {
          if (odometerValueKm < min) return false;
        }
      }

      if (yearFrom && car.year < parseInt(yearFrom)) return false;
      if (yearTo && car.year > parseInt(yearTo)) return false;
      return true;
    });
  }, [
    cars,
    searchQuery,
    selectedCompany,
    selectedBrand,
    selectedModel,
    selectedColor,
    selectedInteriorColor,
    selectedFuelType,
    selectedTransmission,
    selectedBuyNowAvailability,
    selectedOdometerRange,
    selectedCondition,
    yearFrom,
    yearTo,
  ]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCompany('');
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedColor('');
    setSelectedInteriorColor('');
    setSelectedFuelType('');
    setSelectedTransmission('');
    setSelectedBuyNowAvailability('');
    setSelectedOdometerRange('');
    setSelectedCondition('');
    setYearFrom('');
    setYearTo('');
  };

  // Reset model when brand changes
  useEffect(() => {
    setSelectedModel('');
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedCompany && !companies.includes(selectedCompany)) {
      setSelectedCompany('');
    }
  }, [companies, selectedCompany]);

  useEffect(() => {
    if (
      selectedBuyNowAvailability &&
      !buyNowAvailabilityOptions.some((option) => option.value === selectedBuyNowAvailability)
    ) {
      setSelectedBuyNowAvailability('');
    }
  }, [buyNowAvailabilityOptions, selectedBuyNowAvailability]);

  const hasActiveFilters =
    searchQuery ||
    selectedCompany ||
    selectedBrand ||
    selectedModel ||
    selectedColor ||
    selectedInteriorColor ||
    selectedFuelType ||
    selectedTransmission ||
    selectedBuyNowAvailability ||
    selectedOdometerRange ||
    selectedCondition ||
    yearFrom ||
    yearTo;
  const canCompare = selectedCars.length >= 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className={`sticky top-0 z-50 bg-white shadow-md transition-all duration-300 ${isScrolled ? 'shadow-lg' : ''}`}>
        <div className={`max-w-7xl mx-auto px-4 transition-all duration-300 ${isScrolled ? 'py-3' : 'py-6'}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className={`flex flex-col gap-4 sm:flex-row sm:items-center ${isScrolled ? 'lg:flex-1' : ''}`}>
              <div className="flex-shrink-0">
                <h1 className={`font-extrabold tracking-tight transition-all duration-300 ${isScrolled ? 'text-2xl' : 'text-5xl'}`}
                    style={{
                      fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
                      letterSpacing: '-0.03em',
                      fontWeight: '800'
                    }}>
                  <span className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">
                    kala
                  </span>
                </h1>
                {!isScrolled && (
                  <p className="text-gray-600 mt-1 text-sm tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Select cars to compare
                  </p>
                )}
              </div>

              {isScrolled && (
                <div className="hidden md:flex items-center gap-2 flex-1 overflow-x-auto">
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Companies</option>
                    {companies.map((company) => (
                      <option key={company} value={company}>
                        {company.toUpperCase()}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Brands</option>
                    {brands.map(brand => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={!selectedBrand}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                  >
                    <option value="">All Models</option>
                    {models.map(model => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Colors</option>
                    {colors.map(color => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedInteriorColor}
                    onChange={(e) => setSelectedInteriorColor(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Interior Colors</option>
                    {interiorColors.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedFuelType}
                    onChange={(e) => setSelectedFuelType(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Fuel Types</option>
                    {fuelTypes.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedTransmission}
                    onChange={(e) => setSelectedTransmission(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Transmissions</option>
                    {transmissions.map((transmission) => (
                      <option key={transmission} value={transmission}>
                        {transmission}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedOdometerRange}
                    onChange={(e) => setSelectedOdometerRange(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Distance</option>
                    <option value="0-40000">0 - 40k km</option>
                    <option value="40000-80000">40k - 80k km</option>
                    <option value="80000-120000">80k - 120k km</option>
                    <option value="120000-160000">120k - 160k km</option>
                    <option value="160000-999999">160k+ km</option>
                  </select>

                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">All Conditions</option>
                    {conditions.map(condition => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedBuyNowAvailability}
                    onChange={(e) => setSelectedBuyNowAvailability(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Buy Now: Any</option>
                    {buyNowAvailabilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={yearFrom}
                    onChange={(e) => setYearFrom(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Year From</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <select
                    value={yearTo}
                    onChange={(e) => setYearTo(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="">Year To</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 rounded-lg transition-all whitespace-nowrap"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end">
              {selectedCars.length > 0 && (
                <div className={`bg-blue-100 text-blue-800 rounded-lg font-semibold transition-all duration-300 flex-shrink-0 ${isScrolled ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}`}>
                  {selectedCars.length} car{selectedCars.length !== 1 ? 's' : ''} selected
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate('/about')}
                  className={`bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-lg font-medium transition-all duration-300 flex-shrink-0 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  About
                </button>
                <button
                  onClick={() => navigate('/ai')}
                  className={`bg-purple-100 text-purple-800 hover:bg-purple-200 rounded-lg font-medium transition-all duration-300 flex-shrink-0 flex items-center gap-2 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                  title="Answer 15 questions and get AI-style car suggestions"
                >
                  <Sparkles size={isScrolled ? 14 : 16} />
                  AI Finder
                </button>
                <button
                  onClick={() => navigate('/favorites')}
                  className={`bg-pink-100 text-pink-800 hover:bg-pink-200 rounded-lg font-medium transition-all duration-300 flex-shrink-0 flex items-center gap-2 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  <Heart size={isScrolled ? 14 : 16} />
                  Favorites
                </button>
                <div className={`${isGuest ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'} rounded-lg font-medium transition-all duration-300 flex-shrink-0 flex items-center gap-2 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}>
                  <User size={isScrolled ? 14 : 16} />
                  {isGuest ? 'Guest' : user?.email?.split('@')[0]}
                </div>
                <button
                  onClick={handleSignOut}
                  className={`${isGuest ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} rounded-lg font-medium transition-all duration-300 flex-shrink-0 flex items-center gap-2 ${isScrolled ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  <LogOut size={isScrolled ? 14 : 16} />
                  {isGuest ? 'Sign In' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="bg-white rounded-xl shadow-md mb-6 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search make, model, year, color..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-3 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Try “bmw”, “audi a8”, or even a typo — we’ll still find it.
          </p>
        </div>

        {!isScrolled && (
          <div className="bg-white rounded-xl shadow-md mb-8 transition-all duration-300">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                {hasActiveFilters && (
                  <span className="text-sm text-gray-500">
                    ({filteredCars.length} of {cars.length} cars)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFilters();
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                  >
                    Clear All
                  </button>
                )}
                <ChevronDown
                  size={20}
                  className={`text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {showFilters && (
              <div className="px-6 pb-6 border-t border-gray-200 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company} value={company}>
                      {company.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Brands</option>
                  {brands.map(brand => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={!selectedBrand}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">All Models</option>
                  {models.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Colors</option>
                  {colors.map(color => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interior Color
                </label>
                <select
                  value={selectedInteriorColor}
                  onChange={(e) => setSelectedInteriorColor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Interior Colors</option>
                  {interiorColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fuel Type
                </label>
                <select
                  value={selectedFuelType}
                  onChange={(e) => setSelectedFuelType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Fuel Types</option>
                  {fuelTypes.map((fuel) => (
                    <option key={fuel} value={fuel}>
                      {fuel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transmission
                </label>
                <select
                  value={selectedTransmission}
                  onChange={(e) => setSelectedTransmission(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Transmissions</option>
                  {transmissions.map((transmission) => (
                    <option key={transmission} value={transmission}>
                      {transmission}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mileage (km)
                </label>
                <select
                  value={selectedOdometerRange}
                  onChange={(e) => setSelectedOdometerRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Distance</option>
                  <option value="0-40000">0 - 40k km</option>
                  <option value="40000-80000">40k - 80k km</option>
                  <option value="80000-120000">80k - 120k km</option>
                  <option value="120000-160000">120k - 160k km</option>
                  <option value="160000-999999">160k+ km</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition
                </label>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Conditions</option>
                  {conditions.map(condition => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buy Now
                </label>
                <select
                  value={selectedBuyNowAvailability}
                  onChange={(e) => setSelectedBuyNowAvailability(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">Any</option>
                  {buyNowAvailabilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label.replace('Buy Now ', '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year From
                </label>
                <select
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year To
                </label>
                <select
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">Loading cars...</p>
            </div>
          ) : filteredCars.length > 0 ? (
            filteredCars.map(car => (
              <CarCard
                key={car.lot_number}
                car={car}
                isSelected={isCarSelected(car)}
                onSelect={() => handleCarSelect(car)}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No cars match your filters</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {canCompare && (
          <div className="hidden md:block fixed bottom-8 right-8">
            <button
              onClick={() => navigate('/compare')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-semibold text-lg"
            >
              Compare Now
              <ArrowRight size={24} />
            </button>
          </div>
        )}

        {canCompare && (
          <div className="hidden md:block fixed bottom-8 left-8 bg-white rounded-lg shadow-lg p-4 max-w-xs">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Ready to Compare:</p>
              <button
                onClick={clearComparison}
                className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedCars.map((car, idx) => (
                <div key={car.lot_number} className="flex items-center justify-between gap-2 text-sm text-gray-700 group">
                  <div>
                    <span className="font-semibold">{idx + 1}.</span> {car.make} {car.model} ({car.year})
                  </div>
                  <button
                    onClick={() => toggleCar(car)}
                    className="p-1 hover:bg-red-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from comparison"
                  >
                    <X size={16} className="text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {canCompare && (
          <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-700">
                {selectedCars.length} selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearComparison}
                  className="px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium"
                >
                  Clear
                </button>
                <button
                  onClick={() => navigate('/compare')}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold flex items-center gap-1"
                >
                  Compare
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
