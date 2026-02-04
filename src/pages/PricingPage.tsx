import { Link, useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PricingPage() {
  const navigate = useNavigate();
  const { user, isGuest, profile } = useAuth();

  if (isGuest) {
    navigate('/auth');
    return null;
  }

  const handleSelectPlan = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile?.subscription_status === 'active' && profile?.subscription_tier === 'premium') {
      navigate('/cars');
      return;
    }

    navigate('/checkout');
  };

  const isPremiumActive = profile?.subscription_status === 'active' && profile?.subscription_tier === 'premium';
  const isFreeActive = !isPremiumActive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-600">
            Get full access to our comprehensive car database and comparison tools
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border-2 border-slate-200 p-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-600 ml-2">/month</span>
              </div>
              <p className="text-slate-600">
                Perfect for browsing and learning about our platform
              </p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">View About page</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Create account</span>
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-slate-400">Access car database</span>
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-slate-400">Compare vehicles</span>
              </li>
              <li className="flex items-start">
                <X className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0 mt-0.5" />
                <span className="text-slate-400">Save favorites</span>
              </li>
            </ul>

            <button
              disabled
              className="w-full bg-slate-200 text-slate-500 py-3 rounded-lg font-semibold cursor-not-allowed"
            >
              {isFreeActive ? 'Current Plan' : 'Free Plan'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-xl border-2 border-blue-600 p-8 text-white relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                RECOMMENDED
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold mb-2">Premium</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-4xl font-bold">$9.99</span>
                <span className="text-blue-200 ml-2">/month</span>
              </div>
              <p className="text-blue-100">
                Full access to all features and our complete car database
              </p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                <span>Everything in Free</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                <span>Access complete car database</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                <span>Unlimited car comparisons</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                <span>Save unlimited favorites</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-white mr-3 flex-shrink-0 mt-0.5" />
                <span>Priority support</span>
              </li>
            </ul>

            <button
              onClick={handleSelectPlan}
              disabled={isPremiumActive}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                isPremiumActive
                  ? 'bg-blue-800 text-blue-300 cursor-not-allowed'
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              {isPremiumActive ? 'Current Plan' : 'Get Premium'}
            </button>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-600 mb-4">
            Have questions? <Link to="/about" className="text-blue-600 hover:text-blue-700 font-semibold">Learn more about our platform</Link>
          </p>
          <p className="text-sm text-slate-500">
            Cancel anytime. No long-term commitments.
          </p>
        </div>
      </div>
    </div>
  );
}
