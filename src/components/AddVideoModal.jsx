import React, { useState } from "react";

export default function AddVideoModal({ onAdd, onClose }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e) {
    if (e) e.preventDefault();
    if (!value.trim()) return;
    setError("");
    setLoading(true);
    try {
      await onAdd(value.trim());
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add video. Check link or ID.");
    } finally {
      setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
    } catch {
      // clipboard access denied
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-glass-card add-video-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h3>Add YouTube Video</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="modal-subtitle">
          Paste a YouTube video link, Shorts URL, or 11-character video ID to add it to the room playlist.
        </p>

        <form onSubmit={handleAdd}>
          <div className="field-group">
            <label>YouTube Link or Video ID</label>
            <div className="input-with-button">
              <input
                type="text"
                placeholder="https://youtu.be/... or video ID"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                className="btn btn-outline btn-sm paste-action-btn"
                onClick={pasteFromClipboard}
                title="Paste from clipboard"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                <span>Paste</span>
              </button>
            </div>
            <span className="input-hint">Supports: youtube.com, youtu.be, youtube.com/shorts</span>
          </div>

          {error && <div className="error-alert">{error}</div>}

          <div className="modal-actions-row">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !value.trim()}
            >
              {loading ? <span className="spin" /> : "＋ Add to Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
