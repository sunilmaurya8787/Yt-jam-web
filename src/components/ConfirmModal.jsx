import React, { useEffect } from "react";

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger", // "danger" | "primary"
  icon,
  busy = false,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape" && !busy) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, busy, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onCancel()}>
      <div
        className="modal-glass-card confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="confirm-modal-icon-row">
          <div className={`confirm-modal-icon ${confirmVariant}`}>
            {icon || (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>
        </div>

        <h3 id="confirm-modal-title" className="confirm-modal-title">
          {title}
        </h3>

        {message && <p className="confirm-modal-message">{message}</p>}

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${confirmVariant === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? <span className="spin" /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
