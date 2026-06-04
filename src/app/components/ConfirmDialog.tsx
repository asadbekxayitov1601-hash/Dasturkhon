import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centered modal confirmation with Cancel / Confirm buttons. */
export function ConfirmDialog({
  open, title, message, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onCancel}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-[28px] shadow-2xl max-w-sm w-full p-7 text-center"
          >
            <div
              className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(74,124,126,0.1)' }}
            >
              <AlertTriangle className="w-7 h-7" style={{ color: danger ? '#ef4444' : 'var(--primary)' }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            {message && <p className="text-sm text-gray-500 mt-2">{message}</p>}
            <div className="flex gap-3 mt-7">
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 rounded-2xl font-semibold text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
