import { createContext, useContext, useState } from 'react';
import type { Car } from '../services/carService';

interface ComparisonContextType {
  selectedCars: Car[];
  toggleCar: (car: Car) => void;
  swapCars: () => void;
  clearComparison: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [selectedCars, setSelectedCars] = useState<Car[]>([]);

  const toggleCar = (car: Car) => {
    setSelectedCars(prev => {
      const existingIndex = prev.findIndex(c => c.lot_number === car.lot_number);
      if (existingIndex !== -1) {
        return prev.filter((_, idx) => idx !== existingIndex);
      } else {
        return [...prev, car];
      }
    });
  };

  const swapCars = () => {
    setSelectedCars((prev) => {
      if (prev.length < 2) return prev;
      return [prev[1], prev[0]];
    });
  };

  const clearComparison = () => {
    setSelectedCars([]);
  };

  return (
    <ComparisonContext.Provider value={{ selectedCars, toggleCar, swapCars, clearComparison }}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within ComparisonProvider');
  }
  return context;
}
