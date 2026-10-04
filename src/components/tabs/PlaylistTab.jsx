import React, { useState } from "react";
import { useRoomPlayer } from "../../context/RoomPlayerContext.jsx";
import { addVideoToPlaylist, removePlaylistItem, reorderPlaylistItem } from "../../utils/roomRepository.js";
import { extractYoutubeVideoId, fetchYouTubeTitle, getYouTubeThumbnailUrl, formatTime } from "../../utils/youtube.js";
import AddVideoModal from "../AddVideoModal.jsx";

// Any room member can add, reorder, remove, and play items — no per-member
// permission gate. The host is still the one whose client drives
// auto-advance-on-end (see RoomPlayerContext), which keeps that one thing
// deterministic without restricting everyday queue/playback actions.
export default function PlaylistTab({ roomCode }) {
  const { playlist, playerState, localTime, duration, isHost, canAddVideo, canEditOrder, canRemoveVideo, canChangeVideo, canControlPlayback, handlePlayPause, handleSyncWithHost, handleSeekByRatio, handleNext, playItemNow } = useRoomPlayer();
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");
  const [synced, setSynced] = useState(false);
  const [seeking, setSeeking] = useState(false);

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
    if (canControlPlayback && seeking) seekFromPointer(e);
    setSeeking(false);
  }

  async function handleAddVideo(urlOrId) {
    if (!canAddVideo) return;
    const item = await addVideoToPlaylist(roomCode, urlOrId, extractYoutubeVideoId, fetchYouTubeTitle, getYouTubeThumbnailUrl);
    if (!playerState?.currentVideoId && isHost) playItemNow(item);
  }

  async function handleRemove(item) {
    if (!canRemoveVideo) return;
    setError("");
    try {
      await removePlaylistItem(roomCode, item.id);
    } catch (err) {
      setError(err.message || "Couldn't remove that video.");
    }
  }

  async function handleMove(item, direction) {
    if (!canEditOrder) return;
    setError("");
    const idx = playlist.findIndex((it) => it.id === item.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= playlist.length) return;
    const other = playlist[swapIdx];
    try {
      await reorderPlaylistItem(roomCode, item.id, other.order);
      await reorderPlaylistItem(roomCode, other.id, item.order);
    } catch (err) {
      setError(err.message || "Couldn't reorder the queue.");
    }
  }

  function handleSync() {
    handleSyncWithHost();
    setSynced(true);
    window.setTimeout(() => setSynced(false), 2000);
  }

  const nowPlayingTitle = playerState?.currentVideoTitle || "Nothing playing yet";

  return (
    <div>
      <div className="now-playing">
        <div className="title-row">
          <div className="t">{nowPlayingTitle}</div>
          <div className="title-actions">
            {canChangeVideo && <button className="icon-btn" title="Play next in queue" onClick={handleNext}>⏭</button>}
            {isHost ? (
              <span className="host-status">HOST</span>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={handleSync} disabled={synced || !playerState?.currentVideoId}>
                {synced ? "Synced" : "Sync with host"}
              </button>
            )}
          </div>
        </div>
        <div className="transport">
          {canControlPlayback && <button onClick={handlePlayPause}>{playerState?.isPlaying ? "⏸" : "▶"}</button>}
          <span className="seek-time">{formatTime(localTime)}</span>
          <div
            className={`seek-bar ${seeking ? "seeking" : ""}`}
            onPointerDown={handleSeekPointerDown}
            onPointerMove={handleSeekPointerMove}
            onPointerUp={handleSeekPointerUp}
            onPointerCancel={handleSeekPointerUp}
          >
            <div className="fill" style={{ width: duration ? `${(localTime / duration) * 100}%` : "0%" }} />
          </div>
          <span className="seek-time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="section-head">
        <h3>Jam Queue ({playlist.length})</h3>
        {canAddVideo && <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>＋ Add Video</button>}
      </div>

      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}

      {playlist.length === 0 ? (
        <div className="empty-block">No videos yet — add the first one to get the Jam started.</div>
      ) : (
          playlist.map((item, i) => {
          const isActive = item.videoId === playerState?.currentVideoId;
          return (
            <div key={item.id || `${item.videoId}-${item.addedAt || i}`} className={`list-row ${isActive ? "active" : ""}`}>
              <img className="thumb" src={item.thumbnailUrl} alt="" onClick={() => canChangeVideo && playItemNow(item)} style={{ cursor: canChangeVideo ? "pointer" : "default" }} />
              <div className="info" onClick={() => canChangeVideo && playItemNow(item)} style={{ cursor: canChangeVideo ? "pointer" : "default" }}>
                <div className="t">{item.title}</div>
                <div className="by">Added by @{item.addedByUsername}</div>
              </div>
              <div className="actions">
                {canEditOrder && <>
                  <button title="Move up" onClick={() => handleMove(item, -1)} disabled={i === 0}>▲</button>
                  <button title="Move down" onClick={() => handleMove(item, 1)} disabled={i === playlist.length - 1}>▼</button>
                </>}
                {canRemoveVideo && (
                  <button title="Remove" onClick={() => handleRemove(item)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {showAddModal && (
        <AddVideoModal onAdd={handleAddVideo} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
