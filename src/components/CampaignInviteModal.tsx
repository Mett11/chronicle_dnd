import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  ExternalLink,
  Shield,
  Download,
  Sparkles,
} from 'lucide-react';

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

  useEffect(() => {
    if (!isOpen || !cleanCode) return;

    QRCode.toDataURL(inviteUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#111827',
        light: '#f9fafb',
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
    } catch {
      // Fallback
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-body">
      <div
        className="bg-surface-1 border border-surface-3 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-2 flex items-center justify-between bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
              <QrCode size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-content-1 font-heading flex items-center gap-1.5">
                Invita nel Party
              </h2>
              <p className="text-xs text-content-3 truncate max-w-[260px]">
                {campaignName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* QR Code Section */}
          <div className="flex flex-col items-center justify-center">
            <div className="p-3 bg-white rounded-2xl shadow-lg border-2 border-primary/30 relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code invito per ${campaignName}`}
                  className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl object-contain block"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center bg-gray-100 rounded-xl text-gray-400 text-xs">
                  Generazione QR Code...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="px-3 py-1.5 text-xs text-content-2 hover:text-content-1 bg-surface-2 hover:bg-surface-3 rounded-lg border border-surface-3 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Scarica QR Code</span>
              </button>
            </div>
          </div>

          {/* Direct Invite Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-2 flex items-center justify-between">
              <span>Link d'Invito Diretto</span>
              <span className="text-[10px] text-content-3 font-normal">
                Accesso automatico alla campagna
              </span>
            </label>
            <div className="flex items-center gap-1.5 bg-surface-0 border border-surface-3 rounded-xl p-1.5 pl-3">
              <span className="text-xs text-content-2 font-mono truncate flex-1 select-all">
                {inviteUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copiedLink
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary text-surface-0 hover:bg-primary/90 font-bold'
                }`}
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

          {/* Action Buttons: Native Share */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 py-2.5 bg-surface-2 hover:bg-surface-3 text-content-1 rounded-xl text-xs font-medium border border-surface-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {shareSuccess ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span>Condiviso!</span>
                </>
              ) : (
                <>
                  <Share2 size={14} className="text-primary" />
                  <span>Condividi Invito</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              title="Copia solo il codice alfanumerico"
              className="px-3 py-2.5 bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 rounded-xl text-xs font-mono border border-surface-3 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{cleanCode}</span>
            </button>
          </div>

          {/* Explanation note */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-[11px] text-content-2 flex items-start gap-2 leading-relaxed">
            <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
            <p>
              I giocatori che aprono il link o inquadrano il QR code dal telefono entreranno <strong>direttamente in questa campagna</strong>. Se non hanno ancora effettuato l'accesso, potranno farlo con Google in un click.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-surface-2/30 border-t border-surface-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-medium rounded-xl transition-colors cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
