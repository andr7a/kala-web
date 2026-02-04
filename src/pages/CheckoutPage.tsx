import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function CheckoutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate('/cars')}
          className="flex items-center gap-2 text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft size={18} />
          Back to cars
        </button>

        <div className="mt-8 bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900">Payments disabled</h1>
          <p className="text-slate-600 mt-3">
            This project was converted to an API-free version. Checkout and subscriptions are currently turned off.
          </p>
          <p className="text-slate-600 mt-2">
            You can still browse, compare, and favorite cars locally using the Copart JSON file.
          </p>
        </div>
      </div>
    </div>
  );
}
