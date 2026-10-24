import React, { useEffect, useRef, useState } from "react";
import { useRoomPlayer } from "../context/RoomPlayerContext.jsx";

/**
 * PlayerBox remains mounted persistently at a stable DOM location
 * to ensure the YouTube iframe and its Firebase sync loop are NEVER destroyed
 * when switching between tabs (Chat, Queue, People, Settings).
 */
export default function PlayerBox({ mode = "big", onExpand, onToggleMinimize }) {
  const { playerDivRef, playerState, localTime, duration, canControlPlayback, handlePlayPause } = useRoomPlayer();
  const [position, setPosition] = useState(() => ({
    bottom: 24,
    right: 24
  }));
  const [showControls, setShowControls] = useState(false);
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  const progress = duration ? (localTime / duration) * 100 : 0;
  const isMini = mode === "mini";

  useEffect(() => {
    if (!showControls || !isMini) return undefined;
    const timeoutId = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timeoutId);
  }, [showControls, isMini]);

  function handlePointerDown(event) {
    if (!isMini) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startBottom: position.bottom,
      startRight: position.right
    };
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const nextBottom = Math.max(16, Math.min(window.innerHeight - 160, drag.startBottom - event.clientY + drag.startY));
    const nextRight = Math.max(16, Math.min(window.innerWidth - 220, drag.startRight - event.clientX + drag.startX));
    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
      movedRef.current = true;
    }
    setPosition({ bottom: nextBottom, right: nextRight });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleOverlayClick() {
    if (!movedRef.current) {
      if (onExpand) onExpand();
    }
    movedRef.current = false;
  }

  const miniStyle = isMini ? { bottom: position.bottom, right: position.right } : undefined;

  return (
    <div
      className={`player-container ${isMini ? "player-mini" : "player-stage"}`}
      style={miniStyle}
    >
      <div className="player-viewport">
        {/* The persistent mount node for YouTube iframe */}
        <div className="player-iframe-mount" ref={playerDivRef} />

        {/* Ambient video reflection glow effect behind player on desktop */}
        {!isMini && <div className="player-ambient-glow" aria-hidden="true" />}
      </div>

      {isMini && (
        <div
          className={`mini-overlay ${showControls ? "active" : ""}`}
          onClick={handleOverlayClick}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="mini-top-bar">
            <span className="mini-title">{playerState?.currentVideoTitle || "Playing Video"}</span>
            <button
              className="mini-expand-btn"
              title="Expand Player"
              onClick={(e) => {
                e.stopPropagation();
                if (onExpand) onExpand();
              }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          </div>

          <div className="mini-bottom-bar">
            {canControlPlayback && (
              <button
                className="mini-play-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
              >
                {playerState?.isPlaying ? "⏸" : "▶"}
              </button>
            )}
            <div className="mini-progress-bar">
              <div className="mini-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
