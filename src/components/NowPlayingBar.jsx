import React, { useState } from "react";
import { useRoomPlayer } from "../context/RoomPlayerContext.jsx";
import { formatTime } from "../utils/youtube.js";

export default function NowPlayingBar({ compact = false }) {
  const {
    playlist,
    playerState,
    localTime,
    duration,
    isHost,
    canChangeVideo,
    canControlPlayback,
    handlePlayPause,
    handleSyncWithHost,
    handleSeekByRatio,
    handleNext,
    playerRef
  } = useRoomPlayer();

  const [seeking, setSeeking] = useState(false);
  const [synced, setSynced] = useState(false);

  function handleSeekPointerDown(e) {
    if (!canControlPlayback || !duration) return;
    setSeeking(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e, false);
  }

  function seekFromPointer(e, commit = true) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    handleSeekByRatio(ratio, commit);
  }

  function handleSeekPointerMove(e) {
    if (canControlPlayback && seeking) seekFromPointer(e, false);
  }

  function handleSeekPointerUp(e) {
    if (canControlPlayback && seeking) seekFromPointer(e, true);
    setSeeking(false);
  }

  function handleSync() {
    handleSyncWithHost();
    setSynced(true);
    window.setTimeout(() => setSynced(false), 2000);
  }

  function handleToggleFullscreen() {
    try {
      const iframe = playerRef?.current?.getIframe?.();
      if (iframe) {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else if (iframe.requestFullscreen) {
          iframe.requestFullscreen();
        } else if (iframe.webkitRequestFullscreen) {
          iframe.webkitRequestFullscreen();
        }
      }
    } catch {
      // fallback
    }
  }

  const title = playerState?.currentVideoTitle || "No video playing";
  const isPlaying = Boolean(playerState?.isPlaying);
  const progressRatio = duration ? Math.min(100, Math.max(0, (localTime / duration) * 100)) : 0;
  const currentItem = playlist?.find((it) => it.videoId === playerState?.currentVideoId);

  return (
    <div className={`now-playing-panel ${compact ? "compact" : ""}`}>
      {/* Upper Info Row */}
      <div className="np-header">
        <div className="np-title-group">
          {isPlaying && (
            <div className="live-equalizer" title="Playing">
              <span className="eq-bar bar-1" />
              <span className="eq-bar bar-2" />
              <span className="eq-bar bar-3" />
            </div>
          )}
          <div className="np-title-text" title={title}>
            <span className="np-title">{title}</span>
            {currentItem?.addedByUsername && (
              <span className="np-curator">Added by @{currentItem.addedByUsername}</span>
            )}
          </div>
        </div>

        <div className="np-actions">
          {isHost ? (
            <span className="np-host-pill" title="You are controlling playback sync">
              <span className="pill-dot" /> HOST DJ
            </span>
          ) : (
            <button
              className={`np-sync-btn ${synced ? "synced" : ""}`}
              onClick={handleSync}
              disabled={synced || !playerState?.currentVideoId}
              title="Resync with Host player"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>{synced ? "Synced ✓" : "Sync"}</span>
            </button>
          )}

          {canChangeVideo && (
            <button
              className="np-icon-btn"
              title="Play next video in queue"
              onClick={handleNext}
              disabled={!playlist || playlist.length === 0}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          )}

          <button
            className="np-icon-btn"
            title="Fullscreen player"
            onClick={handleToggleFullscreen}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Transport Controls & Seekbar */}
      <div className="np-transport">
        {canControlPlayback && (
          <button
            className={`np-play-btn ${isPlaying ? "playing" : ""}`}
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause video" : "Play video"}
            title={isPlaying ? "Pause (syncs with room)" : "Play (syncs with room)"}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        <span className="np-time-label current">{formatTime(localTime)}</span>

        <div
          className={`np-seekbar-wrapper ${seeking ? "seeking" : ""}`}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={handleSeekPointerUp}
          title={canControlPlayback ? "Scrub video position" : "Live playback progress"}
        >
          <div className="np-seekbar-track">
            <div className="np-seekbar-fill" style={{ width: `${progressRatio}%` }} />
            {canControlPlayback && (
              <div className="np-seekbar-thumb" style={{ left: `${progressRatio}%` }} />
            )}
          </div>
        </div>

        <span className="np-time-label total">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
