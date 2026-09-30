import React, { useState } from 'react';
import { Sparkles, Check, X, Sliders, Type } from 'lucide-react';
import { CampaignMeta, CampaignTitleFont, CampaignTitleEffect } from '../types';
import { CampaignManager } from '../store/campaignStore';

interface CampaignTypographyModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignMeta;
  onSaved?: (updated: CampaignMeta) => void;
}

export interface FontOption {
  id: CampaignTitleFont;
  name: string;
  subtitle: string;
  fontClass: string;
  sample: string;
  desc: string;
}

export const CAMPAIGN_FONTS: FontOption[] = [
  {
    id: 'cinzel',
    name: 'Imperiale Divino',
    subtitle: 'Cinzel Decorative',
    fontClass: 'font-cinzel',
    sample: 'DIVINE ORDER',
    desc: 'Monumentale, maestoso e sacro. Ideale per ordini cavallereschi, divinità ed epoche d\'oro.',
  },
  {
    id: 'medieval',
    name: 'Cronaca Gotica',
    subtitle: 'MedievalSharp',
    fontClass: 'font-medieval',
    sample: 'Antiche Cronache',
    desc: 'Tomi consumati, pergamene di biblioteche proibite e ballate di taverna.',
  },
  {
    id: 'uncial',
    name: 'Runa Primordiale',
    subtitle: 'Uncial Antiqua',
    fontClass: 'font-uncial',
    sample: 'Misteri Elfici',
    desc: 'Celtico, druidico e arcaico. Perfetto per magia silvana, feywild e segreti antichi.',
  },
  {
    id: 'almendra',
    name: 'Corte Arcana',
    subtitle: 'Almendra Display',
    fontClass: 'font-almendra',
    sample: 'Regno d\'Ombre',
    desc: 'Gotico nobiliare affilato. Intrighi di corte, patti oscuri, vampiri e nobiltà sinistra.',
  },
  {
    id: 'pirata',
    name: 'Spada & Dungeon',
    subtitle: 'Pirata One',
    fontClass: 'font-pirata',
    sample: 'Lame & Gloria',
    desc: 'Audace, ruggente e tagliente. Per avventurieri intrepidi, cappe e spade, e dungeon letali.',
  },
  {
    id: 'modern',
    name: 'Essenziale',
    subtitle: 'Space Grotesk',
    fontClass: 'font-heading',
    sample: 'Cronaca Moderna',
    desc: 'Pulito, moderno e geometrico. Senza tempo ed estremamente leggibile.',
  },
];

export interface EffectOption {
  id: CampaignTitleEffect;
  name: string;
  colorHex: string;
  glowHex: string;
  colorClass: string;
  badgeBg: string;
}

export const CAMPAIGN_EFFECTS: EffectOption[] = [
  {
    id: 'default',
    name: 'Tema Attivo',
    colorHex: '',
    glowHex: '',
    colorClass: 'text-content-1 group-hover:text-primary',
    badgeBg: 'bg-primary/20 text-primary border-primary/40',
  },
  {
    id: 'gold',
    name: 'Oro Forgiato',
    colorHex: '#fbbf24',
    glowHex: 'rgba(251, 191, 36, 0.45)',
    colorClass: 'text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'ruby',
    name: 'Sangue di Drago',
    colorHex: '#fb7185',
    glowHex: 'rgba(251, 113, 133, 0.45)',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  },
  {
    id: 'amethyst',
    name: 'Arcano d\'Ametista',
    colorHex: '#e879f9',
    glowHex: 'rgba(232, 121, 249, 0.45)',
    colorClass: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
  },
  {
    id: 'moonlight',
    name: 'Argento Astrale',
    colorHex: '#67e8f9',
    glowHex: 'rgba(103, 232, 249, 0.45)',
    colorClass: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
  },
  {
    id: 'emerald',
    name: 'Smeraldo Antico',
    colorHex: '#6ee7b7',
    glowHex: 'rgba(110, 231, 183, 0.45)',
    colorClass: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
];

export function getCampaignTitleStyle(meta?: CampaignMeta | null): React.CSSProperties {
  const effectId = meta?.titleEffect || 'default';
  const effectDef = CAMPAIGN_EFFECTS.find((e) => e.id === effectId) || CAMPAIGN_EFFECTS[0];

  if (!effectDef.colorHex) {
    return {};
  }

  return {
    color: effectDef.colorHex,
    textShadow: `0 0 16px ${effectDef.glowHex}, 0 0 2px ${effectDef.colorHex}`,
  };
}

export function getCampaignTitleClasses(meta?: CampaignMeta | null) {
  const fontId = meta?.titleFont || 'cinzel';
  const effectId = meta?.titleEffect || 'default';
  const isUppercase = meta?.titleUppercase !== false;
  const tracking = meta?.titleTracking || 'normal';

  const fontDef = CAMPAIGN_FONTS.find((f) => f.id === fontId) || CAMPAIGN_FONTS[0];
  const effectDef = CAMPAIGN_EFFECTS.find((e) => e.id === effectId) || CAMPAIGN_EFFECTS[0];

  let trackingClass = 'tracking-normal';
  if (tracking === 'tight') trackingClass = 'tracking-tight';
  else if (tracking === 'normal') trackingClass = 'tracking-normal';
  else if (tracking === 'wide') trackingClass = 'tracking-wide';

  const fontClass = fontDef.fontClass;
  const caseClass = isUppercase ? 'uppercase' : '';
  const colorClass = effectDef.colorHex ? '' : effectDef.colorClass;
  const style = getCampaignTitleStyle(meta);

  return {
    fontClass,
    caseClass,
    colorClass,
    trackingClass,
    style,
    fullClass: `${fontClass} ${caseClass} ${trackingClass} ${colorClass}`.trim(),
  };
}

export const CampaignTypographyModal: React.FC<CampaignTypographyModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSaved,
}) => {
  const [campaignName, setCampaignName] = useState<string>(campaign.name || '');
  const [selectedFont, setSelectedFont] = useState<CampaignTitleFont>(
    campaign.titleFont || 'cinzel'
  );
  const [selectedEffect, setSelectedEffect] = useState<CampaignTitleEffect>(
    campaign.titleEffect || 'default'
  );
  const [isUppercase, setIsUppercase] = useState<boolean>(
    campaign.titleUppercase !== false
  );
  const [tracking, setTracking] = useState<'tight' | 'normal' | 'wide'>(
    campaign.titleTracking === 'tight' || campaign.titleTracking === 'wide' ? campaign.titleTracking : 'normal'
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync campaign name state if campaign meta updates
  React.useEffect(() => {
    setCampaignName(campaign.name || '');
  }, [campaign.name]);

  if (!isOpen) return null;

  const handleSave = () => {
    setIsSaving(true);
    const updated = CampaignManager.updateCampaignMeta(campaign.code, {
      name: campaignName.trim() || campaign.name,
      titleFont: selectedFont,
      titleEffect: selectedEffect,
      titleUppercase: isUppercase,
      titleTracking: tracking,
    });

    setIsSaving(false);
    if (updated) {
      onSaved?.(updated);
    }
    onClose();
  };

  const previewMeta: CampaignMeta = {
    ...campaign,
    name: campaignName.trim() || campaign.name,
    titleFont: selectedFont,
    titleEffect: selectedEffect,
    titleUppercase: isUppercase,
    titleTracking: tracking,
  };

  const previewClasses = getCampaignTitleClasses(previewMeta);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-0/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-2 bg-surface-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Type size={17} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-content-1 flex items-center gap-2">
                Tipografia & Stile Logo Campagna
              </h2>
              <p className="text-xs text-content-3">
                Scegli l'identità tipografica e l'atmosfera per il titolo del party
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-content-3 hover:text-content-1 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1">
          {/* Campaign Name Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-content-2 flex items-center gap-1.5">
              <Type size={14} className="text-primary" />
              <span>Nome Ufficiale della Campagna (Riservato al Master)</span>
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Inserisci il nome della campagna..."
              className="w-full bg-surface-0 border border-surface-3 focus:border-primary rounded-xl px-4 py-2.5 text-sm text-content-1 font-semibold outline-none transition-all shadow-inner"
            />
          </div>

          {/* Live Preview Box */}
          <div className="bg-surface-0/90 border border-surface-2/80 rounded-xl p-5 relative overflow-hidden shadow-inner">
            <div className="absolute top-2.5 right-3 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-content-3">
              <Sparkles size={11} className="text-primary" />
              Anteprima Header
            </div>
            <p className="text-[11px] text-content-3 mb-2 font-mono uppercase tracking-wider">
              Resa nel menu principale
            </p>
            <div className="h-14 px-4 bg-surface-1/90 border border-surface-2 rounded-lg flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <span
                  className={`text-base sm:text-lg transition-all select-none truncate block ${previewClasses.fullClass}`}
                  style={previewClasses.style}
                >
                  {campaignName.trim() || 'Cronaca di Campagna'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-content-3 shrink-0 ml-3">
                56px Header
              </span>
            </div>
          </div>

          {/* 1. Font Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-content-2 flex items-center gap-1.5">
              <Sliders size={13} className="text-primary" />
              1. Scegli il Carattere del Logo (5 Tipografie Selezionate)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CAMPAIGN_FONTS.map((font) => {
                const isSelected = selectedFont === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setSelectedFont(font.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                        : 'border-surface-2 bg-surface-0/50 hover:bg-surface-2/60 hover:border-surface-3'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-xs font-semibold text-content-1 flex items-center gap-1.5">
                          {font.name}
                        </div>
                        <div className="text-[10px] text-content-3 font-mono">
                          {font.subtitle}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary text-surface-0 flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div
                      className={`text-base my-1.5 truncate text-content-1 ${font.fontClass} ${
                        isUppercase ? 'uppercase' : ''
                      }`}
                    >
                      {campaign.name || font.sample}
                    </div>

                    <p className="text-[11px] text-content-3 line-clamp-2 mt-1 leading-relaxed">
                      {font.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Color Finish / Effect */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-content-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" />
              2. Finitura Cromatico-Metallica & Bagliore
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMPAIGN_EFFECTS.map((eff) => {
                const isSelected = selectedEffect === eff.id;
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => setSelectedEffect(eff.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-surface-2 bg-surface-0/40 hover:bg-surface-2/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded-full border ${eff.badgeBg}`} />
                      <span className="text-xs font-medium text-content-1 truncate">
                        {eff.name}
                      </span>
                    </div>
                    {isSelected && <Check size={14} className="text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Formatting details: Case & Spacing */}
          <div className="space-y-3 pt-1 border-t border-surface-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-content-2">
              3. Spaziatura & Maiuscole
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Uppercase toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-surface-2 bg-surface-0/40">
                <span className="text-xs text-content-2 font-medium">Formato Testo</span>
                <div className="flex rounded-lg bg-surface-2 p-0.5 border border-surface-3">
                  <button
                    type="button"
                    onClick={() => setIsUppercase(true)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      isUppercase
                        ? 'bg-primary text-surface-0'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    MAIUSCOLO
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUppercase(false)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      !isUppercase
                        ? 'bg-primary text-surface-0'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                  >
                    Naturale
                  </button>
                </div>
              </div>

              {/* Tracking / Letter spacing */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-surface-2 bg-surface-0/40">
                <span className="text-xs text-content-2 font-medium">Spaziatura Lettere</span>
                <div className="flex rounded-lg bg-surface-2 p-0.5 border border-surface-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setTracking('tight')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      tracking === 'tight'
                        ? 'bg-primary text-surface-0 font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                    title="Compatta"
                  >
                    Stretta
                  </button>
                  <button
                    type="button"
                    onClick={() => setTracking('normal')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      tracking === 'normal'
                        ? 'bg-primary text-surface-0 font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                    title="Normale"
                  >
                    Media
                  </button>
                  <button
                    type="button"
                    onClick={() => setTracking('wide')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      tracking === 'wide'
                        ? 'bg-primary text-surface-0 font-semibold'
                        : 'text-content-3 hover:text-content-1'
                    }`}
                    title="Spaziata"
                  >
                    Ampia
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-2 bg-surface-1 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-content-2 hover:text-content-1 hover:bg-surface-2 rounded-xl transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover text-surface-0 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Check size={14} />
            Salva Tipografia Logo
          </button>
        </div>
      </div>
    </div>
  );
};
