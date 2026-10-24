import React, { useState } from "react";

export default function RoomCreatedModal({ code, onEnter, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: "Join my YouTube Jam",
        text: `Hey! Join my YouTube Jam room with code: ${code}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      copyCode();
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-glass-card room-created-modal">
        <div className="celebration-badge">🎬 WATCH PARTY READY</div>
        <h3>Your Jam is Live!</h3>
        <p className="modal-subtitle">
          Share this 5-digit room code with your friends so they can tune in with live video and audio sync:
        </p>

        {/* Big Code Display */}
        <div className="room-code-display-box" onClick={copyCode} title="Click to copy">
          <span className="big-code">{code}</span>
          <span className="click-copy-hint">{copied ? "Copied to clipboard! ✓" : "Click to copy"}</span>
        </div>

        <div className="modal-actions-row">
          <button className="btn btn-outline" onClick={copyCode} style={{ flex: 1 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>{copied ? "Copied!" : "Copy Code"}</span>
          </button>
          <button className="btn btn-outline" onClick={shareCode} style={{ flex: 1 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>Share Link</span>
          </button>
        </div>

        <button className="btn btn-primary" onClick={onEnter} style={{ marginTop: 14 }}>
          Enter Watch Party →
        </button>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button className="btn-link" onClick={onClose}>
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
