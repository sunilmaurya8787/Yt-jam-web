import React, { useState } from "react";

export default function RoomCreatedModal({ code, onEnter, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({ title: "Join my YouTube Jam", text: `Join my Jam with code ${code}` }).catch(() => {});
    } else {
      copyCode();
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>🎬 Jam Party Created!</h3>
        <p>Share this 5-digit code with friends so they can watch with you in sync:</p>

        <div className="room-code-display">{code}</div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={copyCode}>{copied ? "Copied!" : "Copy"}</button>
          <button className="btn btn-outline" onClick={shareCode}>Share</button>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onEnter}>
          Enter Room →
        </button>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn-link" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
