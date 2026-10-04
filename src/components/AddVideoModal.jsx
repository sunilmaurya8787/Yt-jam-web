import React, { useState } from "react";

export default function AddVideoModal({ onAdd, onClose }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    setError("");
    setLoading(true);
    try {
      await onAdd(value);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add video.");
    } finally {
      setLoading(false);
    }
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
    } catch {
      // clipboard access denied — user can paste manually
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>🔗 Add YouTube Video</h3>
        <p>Paste a YouTube video or Shorts link to add it to the shared Jam playlist.</p>

        <div className="field" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{ flex: 1, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 13, color: "var(--text)", fontSize: 14 }}
            placeholder="YouTube URL or Video ID"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button className="btn-sm btn-outline btn" type="button" onClick={pasteFromClipboard} style={{ width: 44, padding: 10 }}>
            📋
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading || !value.trim()}>
            {loading ? <span className="spin" /> : "Add to Playlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
