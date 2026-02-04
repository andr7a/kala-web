import { Link } from 'react-router-dom';
import { Car, CheckCircle, TrendingUp, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AboutPage() {
  const { user, profile, loading } = useAuth();
  const isSignedIn = Boolean(user);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl">
              <Car className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Compare Cars with Confidence
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Make informed decisions with comprehensive car comparisons, detailed specifications, and expert insights.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <CheckCircle className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Comprehensive Database
            </h3>
            <p className="text-slate-600">
              Access detailed specifications, pricing, and features for thousands of vehicles across all major brands.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-green-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Side-by-Side Comparisons
            </h3>
            <p className="text-slate-600">
              Compare multiple vehicles at once with our intuitive comparison tool to find your perfect match.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <div className="bg-amber-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Trusted Information
            </h3>
            <p className="text-slate-600">
              Verified data from manufacturers and expert reviews to help you make the best decision.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">
            Why Choose Us?
          </h2>
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-4 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Up-to-Date Information
                </h4>
                <p className="text-slate-600">
                  Our database is constantly updated with the latest models, prices, and specifications.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-4 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Easy to Use
                </h4>
                <p className="text-slate-600">
                  Our intuitive interface makes finding and comparing cars simple and efficient.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-4 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Save Your Favorites
                </h4>
                <p className="text-slate-600">
                  Create an account to save your favorite vehicles and comparisons for easy access later.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mr-4 mt-1">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">
                  Expert Insights
                </h4>
                <p className="text-slate-600">
                  Get access to expert analysis and recommendations for every vehicle category.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Find Your Perfect Car?
          </h2>
          {!isSignedIn ? (
            <>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                {loading
                  ? 'Loading your account status... you can already browse as guest.'
                  : 'Sign up or log in to unlock all features, or browse as a guest to get started.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/auth"
                  className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  Sign Up / Log In
                </Link>
                <Link
                  to="/cars"
                  className="inline-block bg-blue-500 text-white border-2 border-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-400 transition-colors shadow-lg"
                >
                  Continue as Guest
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Browse our comprehensive car database and start comparing vehicles today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/cars"
                  className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
                >
                  Browse Cars
                </Link>
                {(!profile?.subscription_status || profile?.subscription_status !== 'active') && (
                  <Link
                    to="/pricing"
                    className="inline-block bg-blue-500 text-white border-2 border-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-400 transition-colors shadow-lg"
                  >
                    View Premium Plans
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
