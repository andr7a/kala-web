import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ComparisonProvider } from './context/ComparisonContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CarsPage } from './pages/CarsPage';
import { ComparePage } from './pages/ComparePage';
import { CarDetailPage } from './pages/CarDetailPage';
import { AuthPage } from './pages/AuthPage';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import CheckoutPage from './pages/CheckoutPage';
import FavoritesPage from './pages/FavoritesPage';
import AIAdvisorPage from './pages/AIAdvisorPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ComparisonProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<Navigate to="/cars" replace />} />
            <Route
              path="/about"
              element={<AboutPage />}
            />
            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <PricingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cars"
              element={<CarsPage />}
            />
            <Route
              path="/compare"
              element={
                <ProtectedRoute>
                  <ComparePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/car/:lotNumber"
              element={<CarDetailPage />}
            />
            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <FavoritesPage />
                </ProtectedRoute>
              }
            />

            <Route path="/ai" element={<AIAdvisorPage />} />
          </Routes>
        </ComparisonProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
