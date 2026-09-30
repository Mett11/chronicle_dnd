import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import {
  BookOpen,
  Mail,
  Lock,
  User,
  LogIn,
  UserPlus,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export function SanityLogin() {
  const { login, loginWithGoogle, register } = useAuth();
  const [view, setView] = useState<'login' | 'register'>('login');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register Form State (Only Username, Email, Password)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setRegError(null);
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await login(loginEmail, loginPassword);
      if (!res.success) {
        setLoginError(res.error || 'Email o password non validi.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Inserisci il tuo nome o username.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Inserisci un indirizzo email valido.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setRegError('La password deve contenere almeno 6 caratteri.');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await register({
        email: regEmail,
        password: regPassword,
        characterName: regName.trim(),
      });

      if (!res.success) {
        setRegError(res.error || 'Impossibile creare l’account.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-content-1 flex flex-col items-center justify-center p-4 sm:p-6 font-body relative">
      {/* Subtle Arcane Glow Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-900/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full border border-[#2A2A2A] rounded-3xl overflow-hidden bg-surface-1/85 backdrop-blur-2xl shadow-2xl shadow-black/50 border border-white/5 relative z-10">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-surface-1 border-b border-surface-3 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#27272A] to-[#18181B] border border-surface-3 flex items-center justify-center mb-3.5 shadow-lg shadow-black/80">
            <BookOpen size={30} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-wider text-content-1 uppercase">
            Chronicle
          </h1>
          <p className="text-[11px] font-bold text-primary uppercase tracking-widest mt-1">
            Diario & Compendio di Campagna
          </p>

          {/* Primary Action: Google 1-Click Sign-In */}
          <div className="mt-6 space-y-2">
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoggingIn}
              className="w-full py-3 px-4 bg-surface-0 hover:bg-surface-2 border border-surface-3 hover:border-surface-4 text-content-1 rounded-2xl font-semibold text-xs transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span>Accesso con Google in corso...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                    Sicuro
                  </span>
                </>
              )}
            </button>

            {loginError && loginError.includes('Domini Autorizzati') && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs text-left flex items-start gap-2.5">
                <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-300">Dominio in anteprima non ancora autorizzato su Firebase Console</p>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Puoi utilizzare il modulo sottostante per effettuare il login o creare un account tramite Email e Password.
                  </p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-content-3 flex items-center justify-center gap-1">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span>Nessuna password memorizzata nel database</span>
            </p>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-3" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
              <span className="bg-surface-1 px-3 text-content-3">oppure con credenziali</span>
            </div>
          </div>

          {/* Clean 2-Form Switcher (Login & Registrazione) */}
          <div className="flex bg-surface-0 p-1 rounded-xl border border-surface-3">
            <button
              id="tab-btn-login"
              type="button"
              onClick={() => {
                setView('login');
                setLoginError(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                view === 'login'
                  ? 'bg-primary text-surface-0 shadow-md'
                  : 'text-content-2 hover:text-content-1'
              }`}
            >
              <LogIn size={13} />
              Accedi
            </button>
            <button
              id="tab-btn-register"
              type="button"
              onClick={() => {
                setView('register');
                setRegError(null);
              }}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                view === 'register'
                  ? 'bg-primary text-surface-0 shadow-md'
                  : 'text-content-2 hover:text-content-1'
              }`}
            >
              <UserPlus size={13} />
              Registrati
            </button>
          </div>
        </div>

        {/* ================= VIEW 1: LOGIN ================= */}
        {view === 'login' && (
          <div className="p-6 sm:p-8 space-y-5">
            {loginError && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Indirizzo Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    placeholder="iltuonome@esempio.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="login-password-input"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                id="btn-submit-login"
                type="submit"
                disabled={isLoggingIn || isGoogleLoading}
                className="w-full py-3.5 bg-primary hover:bg-primary text-surface-0 font-bold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#3B82F6]/20 mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Verifica in corso...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Accedi</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-surface-3 text-center space-y-2">
              <p className="text-xs text-content-2">
                Non hai ancora un account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('register');
                    setRegError(null);
                  }}
                  className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                >
                  Registrati qui
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: REGISTRAZIONE ================= */}
        {view === 'register' && (
          <div className="p-6 sm:p-8 space-y-5">
            {regError && (
              <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/50 text-red-300 text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Nome Utente / Giocatore
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="reg-character-input"
                    type="text"
                    required
                    placeholder="Es. Mattia / Luke"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
                <p className="text-[11px] text-content-3 mt-1.5 leading-relaxed">
                  Nome del tuo profilo. Il nome del tuo personaggio (PG) ti verrà chiesto all'ingresso di ciascuna campagna.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Indirizzo Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="reg-email-input"
                    type="email"
                    required
                    placeholder="nome@esempio.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-content-2 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    id="reg-password-input"
                    type="password"
                    required
                    placeholder="Almeno 6 caratteri..."
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-xl pl-10 pr-4 py-3 text-xs text-content-1 placeholder-[#555] outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                id="btn-submit-register"
                type="submit"
                disabled={isGoogleLoading || isRegistering}
                className="w-full py-3.5 bg-primary hover:bg-primary text-surface-0 font-bold text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#3B82F6]/20 mt-2 cursor-pointer disabled:opacity-50"
              >
                {isRegistering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creazione in corso...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Crea Account</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-4 border-t border-surface-3 text-center">
              <p className="text-xs text-content-2">
                Hai già un account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('login');
                    setLoginError(null);
                  }}
                  className="text-primary font-bold hover:underline ml-1 cursor-pointer"
                >
                  Accedi qui
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

