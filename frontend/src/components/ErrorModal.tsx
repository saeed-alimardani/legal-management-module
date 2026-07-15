'use client';

interface ErrorModalProps {
  message: string;
  onClose: () => void;
}

export function ErrorModal({ message, onClose }: ErrorModalProps) {
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-modal-title"
      onClick={onClose}
    >
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3 id="error-modal-title" className="text-lg font-semibold text-red-700">
          Something went wrong
        </h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{message}</p>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
