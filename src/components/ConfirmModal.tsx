import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Portal } from './Portal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Elimina',
  cancelLabel = 'Annulla',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-surface-0/80 backdrop-blur-sm"
          />

          {/* Modal Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-md bg-surface-1 border border-surface-3 rounded-2xl p-5 sm:p-6 shadow-2xl z-10 space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto shrink-0"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    isDestructive
                      ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                      : 'bg-primary/10 border-primary/20 text-primary'
                  }`}
                >
                  {isDestructive ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
                </div>
                <h3 className="font-semibold text-base sm:text-lg text-content-1">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="text-content-1/40 hover:text-content-1 transition-colors p-1 rounded-lg hover:bg-content-1/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message */}
            <p className="text-xs sm:text-sm text-content-1/80 leading-relaxed">{message}</p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-xs text-content-1/70 hover:text-content-1 hover:bg-content-1/5 border border-transparent transition-all cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400/40 shadow-red-950/50'
                    : 'bg-primary text-surface-0 hover:bg-primary-hover transition-colors'
                }`}
              >
                {isDestructive && <Trash2 size={14} />}
                <span>{confirmLabel}</span>
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </Portal>
  );
}
