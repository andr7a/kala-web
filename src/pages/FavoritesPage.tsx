import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft, Trash2 } from 'lucide-react';
import { CarCard } from '../components/CarCard';
import { fetchAllCars, type Car } from '../services/carService';

const FAVORITES_KEY = 'favorite_lots';

function getFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setFavoriteIds(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [allCars, setAllCars] = useState<Car[]>([]);
  const [favoriteIds, setFavoriteIdsState] = useState<string[]>(() => getFavoriteIds());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cars = await fetchAllCars();
        setAllCars(cars);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Keep in sync if user favorites/unfavorites on other pages.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY) setFavoriteIdsState(getFavoriteIds());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favorites = useMemo(() => {
    const idSet = new Set(favoriteIds);
    return allCars.filter((c) => idSet.has(c.lot_number));
  }, [allCars, favoriteIds]);

  const clearAll = () => {
    if (!confirm('Remove all favorites?')) return;
    setFavoriteIds([]);
    setFavoriteIdsState([]);
  };

  const removeOne = (lotNumber: string) => {
    const next = favoriteIds.filter((id) => id !== lotNumber);
    setFavoriteIds(next);
    setFavoriteIdsState(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/cars')}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <div className="flex items-center gap-3">
                <Heart size={28} className="text-red-500 fill-red-500" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">My Favorites</h1>
                  <p className="text-sm text-gray-600">
                    {favorites.length} car{favorites.length !== 1 ? 's' : ''} saved
                  </p>
                </div>
              </div>
            </div>

            {favorites.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 size={16} />
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading favorites...</p>
          </div>
        ) : favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((car) => (
              <div key={car.lot_number} className="relative">
                <CarCard car={car} isSelected={false} onSelect={() => {}} hideFavoriteButton />
                <button
                  onClick={() => removeOne(car.lot_number)}
                  className="absolute top-3 left-3 bg-white/90 hover:bg-white text-red-600 rounded-full px-3 py-1 text-xs font-semibold shadow"
                  title="Remove from favorites"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Heart size={64} className="mx-auto text-gray-300" />
            <h2 className="text-2xl font-bold text-gray-900 mt-4">No favorites yet</h2>
            <p className="text-gray-600 mt-2">Tap the heart on any car to save it here.</p>
            <button
              onClick={() => navigate('/cars')}
              className="mt-6 bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700"
            >
              Browse cars
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
