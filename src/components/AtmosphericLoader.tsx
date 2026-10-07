import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Database, Shield, Scroll } from 'lucide-react';

interface AtmosphericLoaderProps {
  title?: string;
  subtitle?: string;
  isSupabaseWarming?: boolean;
}

export function AtmosphericLoader({
  title = 'Cronache di Campagna',
  subtitle = 'Apertura del Grimorio Arcano...',
  isSupabaseWarming = false,
}: AtmosphericLoaderProps) {
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(1), 1200);
    const timer2 = setTimeout(() => setPhase(2), 2800);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden font-sans">
      {/* Background Magic Glow & Ambient Radial Gradient */}
      <div className="absolute inset-0 bg-radial from-primary/10 via-surface-0/90 to-surface-0 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl animate-pulse pointer-events-none" />

      {/* Atmospheric Center Card */}
      <div className="relative z-10 max-w-md w-full bg-surface-1/60 backdrop-blur-md border border-surface-2/80 rounded-2xl p-8 shadow-2xl space-y-6 flex flex-col items-center">
        
        {/* Animated Runic Icon Ring */}
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border border-dashed border-primary/40 animate-spin-slow" />
          <div className="w-16 h-16 rounded-2xl bg-surface-2/80 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            {phase === 0 ? (
              <Scroll size={30} className="animate-pulse" />
            ) : phase === 1 ? (
              <Compass size={30} className="animate-spin-slow" />
            ) : (
              <Sparkles size={30} className="text-amber-400 animate-bounce" />
            )}
          </div>
        </div>

        {/* Campaign Title & Status */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-content-1 tracking-wide">
            {title}
          </h2>
          <p className="text-xs font-mono uppercase tracking-widest text-primary font-semibold flex items-center justify-center gap-1.5">
            <Sparkles size={12} />
            <span>{subtitle}</span>
          </p>
        </div>

        {/* Smooth Glowing Progress Bar */}
        <div className="w-full bg-surface-2/80 rounded-full h-1.5 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/40 via-primary to-amber-400 rounded-full animate-progress" />
        </div>

        {/* Immersive Lore Progress Indicator */}
        <div className="pt-2 text-xs text-content-3 font-mono space-y-1">
          {phase === 0 && (
            <p className="flex items-center justify-center gap-1.5">
              <span>Apertura dei tomo e delle pergamene...</span>
            </p>
          )}
          {phase === 1 && (
            <p className="flex items-center justify-center gap-1.5 text-amber-400/90 font-medium">
              <Scroll size={13} className="animate-pulse" />
              <span>Risveglio delle Antiche Cronache...</span>
            </p>
          )}
          {phase === 2 && (
            <p className="flex items-center justify-center gap-1.5 text-primary">
              <Shield size={13} />
              <span>Armonizzazione di Mappe e Memorie...</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
