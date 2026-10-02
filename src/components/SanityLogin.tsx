import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  BookOpen,
  Loader2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Crown,
} from 'lucide-react';

export function SanityLogin() {
  const { loginWithGoogle } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (!res.success && res.error) {
        setLoginError(res.error);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-content-1 flex flex-col items-center justify-center p-4 sm:p-6 font-body relative">
      {/* Subtle Arcane Glow Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-900/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full border border-surface-3 rounded-3xl overflow-hidden bg-surface-1/90 backdrop-blur-2xl shadow-2xl shadow-black/60 relative z-10">
        {/* Main Header & Branding */}
        <div className="p-8 sm:p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#27272A] to-[#18181B] border border-surface-3 flex items-center justify-center mb-4 shadow-lg shadow-black/80">
            <BookOpen size={30} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-content-1 uppercase font-heading">
            Chronicle
          </h1>
          <p className="text-[11px] font-bold text-primary uppercase tracking-widest mt-1">
            Diario & Compendio di Campagna
          </p>
          <p className="text-xs text-content-3 mt-3 max-w-xs mx-auto leading-relaxed">
            Accedi con il tuo account Google per gestire le tue campagne D&D, note, capitoli e mappe condivise in tempo reale.
          </p>

          {/* Primary Action: Google Sign-In */}
          <div className="mt-8 space-y-4">
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full py-3.5 px-5 bg-surface-0 hover:bg-surface-2 border border-surface-3 hover:border-primary/50 text-content-1 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-xl active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-primary" />
                  <span>Accesso con Google in corso...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span>Continua con Google</span>
                  <span className="ml-auto text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Rapido & Sicuro
                  </span>
                </>
              )}
            </button>

            {loginError && (
              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/40 text-red-200 text-xs text-left flex items-start gap-2.5 animate-fade-in">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{loginError}</p>
              </div>
            )}

            <div className="pt-4 border-t border-surface-2 flex items-center justify-between text-[11px] text-content-3">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Autenticazione Cloud</span>
              </span>
              <span className="flex items-center gap-1 text-primary">
                <Crown size={12} />
                <span>Pronto per DM & Party</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
