import React, { useState } from "react";
import { useRoomPlayer } from "../../context/RoomPlayerContext.jsx";
import { addVideoToPlaylist, removePlaylistItem, reorderPlaylistItem } from "../../utils/roomRepository.js";
import { extractYoutubeVideoId, fetchYouTubeTitle, getYouTubeThumbnailUrl } from "../../utils/youtube.js";
import AddVideoModal from "../AddVideoModal.jsx";

export default function PlaylistTab({ roomCode }) {
  const {
    playlist,
    playerState,
    isHost,
    canAddVideo,
    canEditOrder,
    canRemoveVideo,
    canChangeVideo,
    playItemNow
  } = useRoomPlayer();

  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");

  async function handleAddVideo(urlOrId) {
    if (!canAddVideo) return;
    const item = await addVideoToPlaylist(
      roomCode,
      urlOrId,
      extractYoutubeVideoId,
      fetchYouTubeTitle,
      getYouTubeThumbnailUrl
    );
    if (!playerState?.currentVideoId && isHost && item) {
      playItemNow(item);
    }
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

  return (
    <div className="tab-pane-content playlist-pane">
      {/* Pane Top Header */}
      <div className="pane-header-row">
        <div className="pane-title-area">
          <h3>Queue</h3>
          <span className="count-pill">{playlist?.length || 0}</span>
        </div>
        {canAddVideo && (
          <button
            className="btn btn-primary btn-sm add-video-cta"
            onClick={() => setShowAddModal(true)}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Video</span>
          </button>
        )}
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Queue List */}
      <div className="playlist-scroll-list">
        {!playlist || playlist.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon-circle">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 6 4 14" />
                <path d="M12 6v14" />
                <path d="M8 8v12" />
                <path d="M4 4v16" />
              </svg>
            </div>
            <h4>Queue is empty</h4>
            <p>Paste a YouTube video or Shorts link to start jamming together!</p>
            {canAddVideo && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
                style={{ marginTop: 12 }}
              >
                ＋ Add First Video
              </button>
            )}
          </div>
        ) : (
          playlist.map((item, i) => {
            const isActive = item.videoId === playerState?.currentVideoId;
            return (
              <div
                key={item.id || `${item.videoId}-${item.addedAt || i}`}
                className={`queue-item-card ${isActive ? "active-track" : ""}`}
              >
                {/* Thumbnail with overlay play trigger */}
                <div
                  className="queue-thumb-wrap"
                  onClick={() => canChangeVideo && playItemNow(item)}
                  style={{ cursor: canChangeVideo ? "pointer" : "default" }}
                >
                  <img
                    className="queue-thumb-img"
                    src={item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                  />
                  {isActive && (
                    <div className="queue-playing-indicator">
                      <div className="eq-bar bar-1" />
                      <div className="eq-bar bar-2" />
                      <div className="eq-bar bar-3" />
                    </div>
                  )}
                  {canChangeVideo && !isActive && (
                    <div className="queue-thumb-hover-play">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info Text */}
                <div
                  className="queue-item-info"
                  onClick={() => canChangeVideo && playItemNow(item)}
                  style={{ cursor: canChangeVideo ? "pointer" : "default" }}
                >
                  <div className="queue-item-title" title={item.title}>
                    {item.title}
                  </div>
                  <div className="queue-item-meta">
                    <span className="queue-curator">@{item.addedByUsername || "member"}</span>
                    {isActive && <span className="now-playing-tag">PLAYING</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="queue-actions">
                  {canEditOrder && (
                    <div className="reorder-button-group">
                      <button
                        className="queue-btn"
                        title="Move Up"
                        onClick={() => handleMove(item, -1)}
                        disabled={i === 0}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        className="queue-btn"
                        title="Move Down"
                        onClick={() => handleMove(item, 1)}
                        disabled={i === playlist.length - 1}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {canRemoveVideo && (
                    <button
                      className="queue-btn delete-btn"
                      title="Remove from queue"
                      onClick={() => handleRemove(item)}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showAddModal && (
        <AddVideoModal onAdd={handleAddVideo} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
