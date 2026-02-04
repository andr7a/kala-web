import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (profile?.subscription_status !== 'active' || profile?.subscription_tier !== 'premium') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Premium Feature
          </h2>
          <p className="text-slate-600 mb-6">
            This feature requires a premium subscription. Upgrade now to access our complete car database and comparison tools.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/pricing'}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              View Pricing Plans
            </button>
            <button
              onClick={() => window.location.href = '/about'}
              className="w-full bg-slate-100 text-slate-700 py-3 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
