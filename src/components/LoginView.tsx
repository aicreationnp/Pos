import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CupSoda, ShieldCheck, Store, ShoppingCart, BarChart3, AlertCircle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loggingIn, setLoggingIn] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoggingIn(true);
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-[#D98591] to-[#70445B] flex items-center justify-center text-white shadow-xl shadow-[#D98591]/25 mb-4">
          <CupSoda className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#70445B] tracking-tight">Falooda Point POS</h1>
        <p className="mt-1 text-sm text-[#79696D]">
          Multi-Branch Dessert Shop & Role-Based Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl shadow-[#70445B]/5 sm:rounded-3xl border border-[#EADBD6] sm:px-10 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h2 className="text-base font-bold text-[#493A3E] text-center">
              Sign In to Your Dessert Counter
            </h2>
            <p className="text-xs text-[#79696D] text-center mt-1">
              Authenticate securely using your registered Google account
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            disabled={loggingIn}
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-[#EADBD6] rounded-2xl shadow-xs bg-[#FFFCF8] hover:bg-[#F8E7E5] text-sm font-bold text-[#493A3E] transition active:scale-98 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loggingIn ? 'Connecting to Firebase...' : 'Continue with Google'}</span>
          </button>

          {/* Feature Highlights */}
          <div className="pt-4 border-t border-[#EADBD6]/60 space-y-2.5 text-xs text-[#79696D]">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#D98591] shrink-0" />
              <span>Multi-branch physical location management</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#D98591] shrink-0" />
              <span>Super Admin, Admin & Staff role boundaries</span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#D98591] shrink-0" />
              <span>High-speed POS billing with thermal receipt printing</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#D98591] shrink-0" />
              <span>Permission-protected financial and sales reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
