import {
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Car } from '../services/carService';

const FAVORITES_KEY = 'favorite_lots';

function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setFavorites(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids))));
}

interface CarCardProps {
  car: Car;
  isSelected: boolean;
  onSelect: () => void;
  hideFavoriteButton?: boolean;
}

export function CarCard({
  car,
  isSelected,
  onSelect,
  hideFavoriteButton = false,
}: CarCardProps) {
  useAuth(); // keep provider mounted (API-free local auth)
  const navigate = useNavigate();

  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images =
    car.images?.length > 0
      ? car.images.map((img) =>
          img.includes('_thb') ? img.replace('_thb', '_ful') : img
        )
      : ['https://via.placeholder.com/400x300?text=No+Image'];

  /* ---------------- FAVORITES ---------------- */

  const checkIfFavorite = useCallback(async () => {
    const favs = getFavorites();
    setIsFavorite(favs.includes(car.lot_number));
  }, [car.lot_number]);

  useEffect(() => {
    checkIfFavorite();
  }, [checkIfFavorite]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // API-free: favorites are stored locally in the browser.
    const favs = getFavorites();
    if (favs.includes(car.lot_number)) {
      setFavorites(favs.filter((id) => id !== car.lot_number));
      setIsFavorite(false);
    } else {
      setFavorites([...favs, car.lot_number]);
      setIsFavorite(true);
    }
  };

  /* ---------------- IMAGES ---------------- */

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((i: number) => (i + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((i: number) => (i - 1 + images.length) % images.length);
  };

  const goToImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex(index);
  };

  /* ---------------- ACTIONS ---------------- */

  const handleViewMore = () => {
    navigate(`/car/${car.lot_number}`);
  };

  const handleCompare = () => {
    onSelect();
  };

  /* ---------------- RENDER ---------------- */

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
      <div className="relative h-56 overflow-hidden bg-gray-200 group">
        <img
          src={images[currentImageIndex]}
          alt={`${car.make} ${car.model}`}
          className="w-full h-full object-cover"
        />

        {!hideFavoriteButton && (
          <button
            onClick={toggleFavorite}
            className="absolute top-3 right-3 p-2 rounded-full shadow-md z-10 bg-white hover:bg-gray-50"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              size={20}
              className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
            />
          </button>
        )}

        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 z-20"
            >
              <ChevronLeft size={20} />
            </button>

            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 z-20"
            >
              <ChevronRight size={20} />
            </button>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <div className="flex gap-1.5">
                {images.slice(0, 6).map((img, index) => (
                  <button
                    key={index}
                    onClick={(e) => goToImage(index, e)}
                    className={`w-12 h-12 rounded overflow-hidden ${
                      index === currentImageIndex
                        ? 'ring-2 ring-white'
                        : 'opacity-60'
                    }`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {isSelected && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
            <div className="bg-blue-600 rounded-full p-3">
              <Check className="text-white" size={24} />
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 uppercase">{car.make}</p>
        <p className="text-2xl font-bold">{car.model}</p>

        <div className="flex justify-between my-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Year</p>
            <p className="font-semibold">{car.year}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Odometer</p>
            <p className="font-semibold">
              {car.odometer_formatted ??
                (car.odometer !== null && car.odometer !== undefined
                  ? `${Math.round(car.odometer * 1.60934).toLocaleString()} km`
                  : 'Not available')}
            </p>
          </div>
        </div>

        <button
          onClick={handleViewMore}
          className="w-full mb-2 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 bg-slate-600 text-white hover:bg-slate-700"
        >
          <Eye size={16} />
          View More
        </button>

        <div className="flex gap-2">
          <button
            onClick={handleCompare}
            className={`flex-1 py-2 rounded-lg font-semibold ${
              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isSelected ? 'Selected' : 'Compare'}
          </button>

          <a
            href={car.item_url}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
          >
            Auction
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
