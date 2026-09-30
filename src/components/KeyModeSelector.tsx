import React from 'react';
import { KeySourceMode } from '../lib/apiKeyManager';
import { User, Users, ShieldCheck, Crown } from 'lucide-react';

interface KeyModeSelectorProps {
  currentMode: KeySourceMode;
  onModeChange: (mode: KeySourceMode) => void;
  className?: string;
  isDm?: boolean;
}

export function KeyModeSelector({ currentMode, onModeChange, className = '', isDm = false }: KeyModeSelectorProps) {
  const modes: Array<{
    id: KeySourceMode;
    title: string;
    description: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string;
  }> = [
    {
      id: 'campaign',
      title: 'Chiave di Campagna',
      description: isDm
        ? 'Impostata da te (Dungeon Master). Attiva, crittografata e a disposizione di tutti i membri del party della campagna.'
        : 'Usa le chiavi fornite dal Dungeon Master per questa campagna. Condivisa con tutti i membri del party.',
      icon: isDm ? Crown : Users,
      badge: isDm ? 'Gestita dal DM' : 'Condivisa Party',
    },
    {
      id: 'personal',
      title: 'Chiave Personale',
      description: 'Usa la tua API Key privata salvata sul tuo profilo personale. Ideale se vuoi usare una tua chiave specifica o propri crediti.',
      icon: User,
      badge: 'Privata / Account',
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-content-1 flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <span>Sorgente API Key per la Campagna</span>
        </label>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          Attiva: {currentMode === 'campaign' ? 'CAMPAGNA (MASTER)' : 'PERSONALE'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map((m) => {
          const Icon = m.icon;
          const isSelected = currentMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isSelected
                  ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xs'
                  : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2 hover:border-surface-3/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-surface-0' : 'bg-surface-3 text-content-2'
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-bold text-content-1">{m.title}</span>
                </div>
                {m.badge && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      isSelected
                        ? 'bg-primary/20 text-primary border-primary/30 font-semibold'
                        : 'bg-surface-3 text-content-3 border-surface-3'
                    }`}
                  >
                    {m.badge}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-content-3 leading-relaxed">{m.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
