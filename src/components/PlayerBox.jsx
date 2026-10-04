import React, { useEffect, useRef, useState } from "react";
import { useRoomPlayer } from "../context/RoomPlayerContext.jsx";

// Always mounted in Room.jsx, regardless of active tab — this is what
// keeps the video (and its Firebase-synced playback) alive when the user
// switches to Chat/People/Profile. Only the CSS wrapper class changes
// between the two modes; the <div> the YT iframe lives in never unmounts.
export default function PlayerBox({ mode, onExpand, tab }) {
  const { playerDivRef, playerState, localTime, duration, canControlPlayback, handlePlayPause } = useRoomPlayer();
  const [position, setPosition] = useState(() => ({
    bottom: 104,
    right: 16
  }));
  const [showControls, setShowControls] = useState(false);
  const [showMiniInfo, setShowMiniInfo] = useState(false);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const miniInfoTimeoutRef = useRef(null);

  const progress = duration ? localTime / duration : 0;
  const forceVisibleControls = !canControlPlayback;

  useEffect(() => {
    if (!showControls || mode !== "mini") return undefined;
    const timeoutId = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(timeoutId);
  }, [showControls, mode]);

  useEffect(() => {
    if (!showMiniInfo || mode !== "mini") return undefined;
    if (miniInfoTimeoutRef.current) clearTimeout(miniInfoTimeoutRef.current);
    miniInfoTimeoutRef.current = setTimeout(() => setShowMiniInfo(false), 5000);
    return () => {
      if (miniInfoTimeoutRef.current) clearTimeout(miniInfoTimeoutRef.current);
    };
  }, [showMiniInfo, mode]);

  function handlePointerDown(event) {
    if (mode !== "mini") return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startBottom: position.bottom,
      startRight: position.right,
      moved: false
    };
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const nextBottom = Math.max(12, Math.min(window.innerHeight - 200, drag.startBottom - event.clientY + drag.startY));
    const nextRight = Math.max(12, Math.min(window.innerWidth - 180, drag.startRight - event.clientX + drag.startX));
    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) drag.moved = true;
    movedRef.current = drag.moved;
    setPosition({ bottom: nextBottom, right: nextRight });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleClick() {
    if (!movedRef.current) onExpand();
    movedRef.current = false;
  }

  const positionStyle = mode === "mini" ? { bottom: position.bottom, right: position.right } : undefined;

  const floatingStyle = mode === "big" && tab === "chat" ? {
    position: "fixed",
    top: 110,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(calc(100% - 36px), 720px)",
    maxWidth: "720px",
    zIndex: 40
  } : undefined;

  return (
    <div
      className={mode === "big" ? "player-slot player-slot-big" : "player-slot player-slot-mini"}
      style={floatingStyle || positionStyle}
    >
      <div className="player-iframe-mount" ref={playerDivRef} />

      {mode === "mini" && (
        <div
          className={`mini-player-overlay ${showControls || forceVisibleControls ? "controls-visible" : ""}`}
          onClick={() => {
            setShowControls(true);
            setShowMiniInfo(true);
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {showMiniInfo && <div className="mini-player-bottom">
            <div className="mini-player-info">
              <div className="mini-player-title">
                {playerState?.currentVideoTitle || "Nothing playing"}
              </div>
              <div className="mini-progress">
                <div className="mini-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
              </div>
            </div>
            {canControlPlayback && <button
              className="mini-play-btn"
              onClick={(e) => { e.stopPropagation(); handlePlayPause(); setShowControls(true); }}
              aria-label="Play or pause"
            >
              {playerState?.isPlaying ? "⏸" : "▶"}
            </button>}
          </div>}
        </div>
      )}
    </div>
  );
}
