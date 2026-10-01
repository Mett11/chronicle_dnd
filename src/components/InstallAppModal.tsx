import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Check,
  Smartphone,
  Monitor,
  Apple,
  Share,
  PlusSquare,
  ShieldCheck,
  Zap,
  HardDrive,
} from 'lucide-react';
import { Portal } from './Portal';
import { getPwaStatus, subscribePwa, PwaStatus } from '../lib/pwa';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InstallAppModal({ isOpen, onClose }: InstallAppModalProps) {
  const [pwaStatus, setPwaStatus] = useState<PwaStatus>(getPwaStatus);
  const [activeTab, setActiveTab] = useState<'windows' | 'android' | 'ios'>(() => {
    const status = getPwaStatus();
    if (status.isIOS) return 'ios';
    if (status.isAndroid) return 'android';
    return 'windows';
  });

  useEffect(() => {
    const update = () => {
      const status = getPwaStatus();
      setPwaStatus(status);
      if (status.isIOS) setActiveTab('ios');
      else if (status.isAndroid) setActiveTab('android');
      else setActiveTab('windows');
    };
    update();
    return subscribePwa(update);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-surface-1 border border-surface-2 rounded-2xl p-6 max-w-xl w-full space-y-6 shadow-2xl relative max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-surface-2 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 shrink-0">
                <img src="/icons/icon.svg" alt="Chronicle App Icon" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-lg text-content-1">
                    Installa Chronicle come App
                  </h2>
                  {pwaStatus.isStandalone && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1">
                      <Check size={10} /> Installata
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-3">
                  Progressive Web App per Windows Desktop, Android e Apple iOS
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-content-3 hover:text-content-1 p-1 rounded-md cursor-pointer transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Recognized Platform Notice */}
          <div className="bg-surface-2/70 border border-surface-3 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Zap size={18} className="text-amber-400" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                Dispositivo rilevato: <span className="text-primary">{pwaStatus.platformName}</span>
              </p>
              <p className="text-[11px] text-content-3">
                Segui le brevi istruzioni qui sotto per aggiungere Chronicle alla schermata principale o alla barra delle applicazioni.
              </p>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-surface-2 border border-surface-3/80 flex items-start gap-2.5">
              <HardDrive size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-content-1 text-[11px]">Nessun Download Pesante</p>
                <p className="text-[10px] text-content-3">Si installa in pochi secondi direttamente dal browser.</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-2 border border-surface-3/80 flex items-start gap-2.5">
              <Monitor size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-content-1 text-[11px]">Finestra Indipendente</p>
                <p className="text-[10px] text-content-3">Icona su desktop, barra delle applicazioni e home.</p>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-2 border border-surface-3/80 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-content-1 text-[11px]">Sempre Aggiornata</p>
                <p className="text-[10px] text-content-3">Riceve gli aggiornamenti in automatico in tempo reale.</p>
              </div>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="space-y-3">
            <div className="flex border-b border-surface-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('windows')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'windows'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-content-3 hover:text-content-1'
                }`}
              >
                <Monitor size={14} />
                <span>Windows / Desktop</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'android'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-content-3 hover:text-content-1'
                }`}
              >
                <Smartphone size={14} />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'ios'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-content-3 hover:text-content-1'
                }`}
              >
                <Apple size={14} />
                <span>iOS (iPhone / iPad)</span>
              </button>
            </div>

            {/* Tab Instructions Content */}
            <div className="bg-surface-2/50 border border-surface-3 rounded-2xl p-4">
              {activeTab === 'windows' && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-semibold text-content-1 flex items-center gap-1.5 text-sm">
                    <Monitor size={15} className="text-primary" /> Installazione su Windows (Chrome / Microsoft Edge)
                  </h4>
                  <ol className="space-y-2 list-decimal list-inside text-content-2 leading-relaxed">
                    <li>
                      Fai clic sull'icona di installazione <span className="font-mono bg-surface-3 px-1.5 py-0.5 rounded text-[10px]">⊕</span> nella barra degli indirizzi del browser (a destra).
                    </li>
                    <li>
                      Se utilizzi Microsoft Edge, puoi anche cliccare sul menu in alto a destra <span className="font-mono bg-surface-3 px-1.5 py-0.5 rounded text-[10px]">...</span> &rarr; <strong>App</strong> &rarr; <strong>"Installa Chronicle"</strong>.
                    </li>
                    <li>
                      Conferma l'installazione: Chronicle si aprirà come finestra desktop dedicata e potrai appuntarla alla barra delle applicazioni o al menu Start di Windows!
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === 'android' && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-semibold text-content-1 flex items-center gap-1.5 text-sm">
                    <Smartphone size={15} className="text-emerald-400" /> Installazione su Android (Chrome / Samsung Internet)
                  </h4>
                  <ol className="space-y-2 list-decimal list-inside text-content-2 leading-relaxed">
                    <li>
                      Apri il menu del browser toccando i tre puntini <span className="font-mono bg-surface-3 px-1.5 py-0.5 rounded text-[10px]">⋮</span> in alto a destra.
                    </li>
                    <li>
                      Seleziona <strong>"Aggiungi a schermata Home"</strong> o <strong>"Installa App"</strong>.
                    </li>
                    <li>
                      Conferma per creare l'icona con il logo di Chronicle nella schermata iniziale del tuo smartphone o tablet.
                    </li>
                  </ol>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-semibold text-content-1 flex items-center gap-1.5 text-sm">
                    <Apple size={15} className="text-content-1" /> Installazione su iPhone &amp; iPad (Safari)
                  </h4>
                  <p className="text-content-3 text-[11px]">
                    Apple iOS supporta le Progressive Web App direttamente tramite Safari:
                  </p>
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-1 border border-surface-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Share size={14} />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-content-1">1. Tocca il tasto Condividi</span>
                        <p className="text-content-3 text-[11px]">Tocca l'icona di condivisione <span className="font-mono bg-surface-3 px-1.5 py-0.5 rounded text-[10px]">⎋</span> nella barra inferiore di Safari.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-1 border border-surface-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                        <PlusSquare size={14} />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-content-1">2. Scegli "Aggiungi alla schermata Home"</span>
                        <p className="text-content-3 text-[11px]">Scorri le opzioni verso il basso e tocca <strong>"Aggiungi a schermata Home"</strong>.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-surface-1 border border-surface-3">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                        <Check size={14} />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-content-1">3. Tocca "Aggiungi" in alto a destra</span>
                        <p className="text-content-3 text-[11px]">Chronicle apparirà sulla schermata principale come una vera app nativa.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end border-t border-surface-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </motion.div>
      </div>
    </Portal>
  );
}
