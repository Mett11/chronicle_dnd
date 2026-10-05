import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  Download,
  Sparkles,
} from 'lucide-react';
import { getStoredTheme } from '../lib/theme';

interface CampaignInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignCode: string;
  campaignName: string;
}

export function CampaignInviteModal({
  isOpen,
  onClose,
  campaignCode,
  campaignName,
}: CampaignInviteModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareSuccess, setShareSuccess] = useState(false);

  const cleanCode = campaignCode.trim().toUpperCase();
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?join=${cleanCode}`
    : `https://chronicle.dnd/?join=${cleanCode}`;

  const currentTheme = getStoredTheme();
  const accentColor = currentTheme?.colors?.primary || '#d4af37';

  useEffect(() => {
    if (!isOpen || !cleanCode) return;

    QRCode.toDataURL(inviteUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#070709',
        light: '#fbf7ee', // Soft parchment ivory instead of blinding white
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR Code:', err));
  }, [isOpen, inviteUrl, cleanCode]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Unisciti alla campagna D&D: ${campaignName}`,
          text: `Sei invitato ad unirti alla campagna "${campaignName}" su Chronicle! Clicca sul link o inquadra il QR code per entrare nel party:`,
          url: inviteUrl,
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `chronicle-invite-${cleanCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050406]/85 backdrop-blur-md animate-fade-in text-[#e8e1d5]"
      style={{ fontFamily: "'Newsreader', 'Lora', Georgia, serif" }}
      onClick={onClose}
    >
      <div
        className="bg-[#0c0b0f] border border-[#3a3020] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Corner Fleurons */}
        <div className="absolute top-2 left-2 text-[#a38043]/30 text-xs select-none">⌜</div>
        <div className="absolute top-2 right-2 text-[#a38043]/30 text-xs select-none">⌝</div>
        <div className="absolute bottom-2 left-2 text-[#a38043]/30 text-xs select-none">⌞</div>
        <div className="absolute bottom-2 right-2 text-[#a38043]/30 text-xs select-none">⌟</div>

        {/* Header */}
        <div className="p-5 border-b border-[#241f17] flex items-center justify-between bg-[#110f16]/60">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <QrCode size={19} />
            </div>
            <div>
              <h2
                className="text-base text-[#f3ebd9] font-normal tracking-wider uppercase"
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                Sigillo d'Invito
              </h2>
              <p className="text-xs text-[#8c7b64] italic truncate max-w-[240px]">
                {campaignName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8c7b64] hover:text-[#f3ebd9] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-left">
          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="p-3 bg-[#fbf7ee] rounded-xl shadow-xl border-2 transition-colors relative"
              style={{ borderColor: `${accentColor}55` }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code invito per ${campaignName}`}
                  className="w-48 h-48 sm:w-52 sm:h-52 rounded-lg object-contain block"
                />
              ) : (
                <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-[#f0e8d6] rounded-lg text-slate-500 text-xs font-mono">
                  Generazione Sigillo...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3.5 py-1.5 text-xs text-[#a99982] hover:text-[#f5ede0] bg-[#16131a] hover:bg-[#201c26] rounded-lg border border-[#3a3020] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span className="font-mono text-[11px]">Scarica Sigillo QR</span>
              </button>
            </div>
          </div>

          {/* Direct Invite Link */}
          <div className="space-y-1.5">
            <label
              className="text-xs uppercase tracking-wider text-[#a99982] flex items-center justify-between"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              <span>Link d'Invito Diretto</span>
              <span className="text-[10px] text-[#6e604d] italic lowercase font-sans">
                accesso istantaneo al tavolo
              </span>
            </label>
            <div className="flex items-center gap-2 bg-[#16131a] border border-[#3e3424] focus-within:border-[#d4af37] rounded-xl p-1.5 pl-3 transition-colors">
              <span className="text-xs text-[#a99982] font-mono truncate flex-1 select-all">
                {inviteUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-800 text-white'
                    : 'bg-[#221e2c] hover:bg-[#2e293c] border border-[#a38043] text-[#f5ede0]'
                }`}
                style={{ fontFamily: "'Cinzel', Georgia, serif" }}
              >
                {copiedLink ? (
                  <>
                    <Check size={13} />
                    <span>Copiato!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copia Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons: Native Share & Code Copy */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 py-2.5 bg-[#16131a] hover:bg-[#201c26] border border-[#3a3020] hover:border-[#a38043] text-[#f5ede0] rounded-xl text-xs uppercase tracking-wider font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              {shareSuccess ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Condiviso!</span>
                </>
              ) : (
                <>
                  <Share2 size={14} style={{ color: accentColor }} />
                  <span>Condividi</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copia codice alfanumerico"
              className="px-4 py-2.5 bg-[#16131a] hover:bg-[#201c26] border border-[#3a3020] hover:border-[#a38043] text-[#a99982] hover:text-[#f5ede0] rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{cleanCode}</span>
            </button>
          </div>

          {/* Atmospheric Explanation Note */}
          <div className="bg-[#121016] border border-[#2b2316] rounded-xl p-3.5 text-xs text-[#8c7b64] flex items-start gap-2.5 leading-relaxed italic">
            <Sparkles size={14} style={{ color: accentColor }} className="shrink-0 mt-0.5" />
            <p>
              I compagni che aprono questo link o inquadrano il sigillo entreranno <strong>direttamente in questa campagna</strong>. Se è il loro primo accesso, potranno registrarsi con Google in un istante.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#09080c] border-t border-[#241f17] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#16131a] hover:bg-[#201c26] border border-[#3a3020] text-[#a99982] hover:text-[#f5ede0] text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
