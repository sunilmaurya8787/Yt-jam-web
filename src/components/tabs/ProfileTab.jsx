import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { leaveRoom, deleteRoom, updateRoomMeta } from "../../utils/roomRepository.js";
import ConfirmModal from "../ConfirmModal.jsx";

export default function ProfileTab({ roomCode, meta, memberCount, isHost, onLeaveRoom }) {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const name = profile?.name || user?.displayName || "Jammer";
  const username = profile?.username || "";
  const [roomName, setRoomName] = useState(meta?.name || "");
  const [roomDescription, setRoomDescription] = useState(meta?.description || "");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setRoomName(meta?.name || "");
    setRoomDescription(meta?.description || "");
  }, [meta?.name, meta?.description]);

  async function saveRoomSettings() {
    setSaving(true);
    setSettingsError("");
    setSavedSuccess(false);
    try {
      await updateRoomMeta(roomCode, { name: roomName, description: roomDescription });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      setSettingsError(err.message || "Couldn't save room settings.");
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: "Join my YouTube Jam",
        text: `Watch YouTube together with me on Jam! Room code: ${roomCode}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      copyCode();
    }
  }

  async function confirmLeave() {
    setLeaving(true);
    try {
      await leaveRoom(roomCode);
      onLeaveRoom();
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteRoom(roomCode);
      onLeaveRoom();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <div className="tab-pane-content profile-pane">
      {/* Profile Card */}
      <div className="user-profile-card">
        <div className="user-avatar-lg">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="user-meta">
          <h3 className="user-name">{name}</h3>
          {username && <span className="user-handle-pill">@{username}</span>}
          <div className="user-email-text">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <span>{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Room Stats Cards */}
      <div className="section-label">Room Information</div>
      <div className="room-stats-grid">
        <div className="stat-card">
          <div className="stat-label">Room Code</div>
          <div className="stat-value code-font">{roomCode}</div>
          <span className="stat-tag">{isHost ? "★ You are Host" : "Member"}</span>
        </div>

        <div className="stat-card">
          <div className="stat-label">Capacity</div>
          <div className="stat-value">{memberCount} / {meta?.maxMembers || 20}</div>
          <span className="stat-hint">Active members</span>
        </div>

        <div className="stat-card">
          <div className="stat-label">Expires</div>
          <div className="stat-value small-text">
            {meta?.expiresAt > 0
              ? new Date(meta.expiresAt).toLocaleTimeString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "Never"}
          </div>
          <span className="stat-hint">{meta?.expiresAt > 0 ? "Auto-closes" : "Permanent"}</span>
        </div>
      </div>

      {/* Quick Action Share Buttons */}
      <div className="action-button-row">
        <button className="btn btn-outline" onClick={copyCode} style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{copied ? "Copied!" : "Copy Code"}</span>
        </button>

        <button className="btn btn-outline" onClick={shareCode} style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Invite Friends</span>
        </button>
      </div>

      {/* Host Settings */}
      {isHost && (
        <div className="host-settings-card">
          <h4>Room Settings</h4>
          <div className="field-group">
            <label>Room Name</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Friday Movie Jam"
              maxLength={60}
            />
          </div>
          <div className="field-group">
            <label>Description</label>
            <textarea
              value={roomDescription}
              onChange={(e) => setRoomDescription(e.target.value)}
              placeholder="What are we watching today?"
              maxLength={180}
              rows={2}
            />
          </div>

          {settingsError && <div className="error-alert">{settingsError}</div>}
          {savedSuccess && <div className="success-alert">Room settings saved successfully!</div>}

          <button
            className="btn btn-primary btn-sm"
            onClick={saveRoomSettings}
            disabled={saving || !roomName.trim()}
          >
            {saving ? <span className="spin" /> : "Save Changes"}
          </button>
        </div>
      )}

      {/* Leave / Delete Room Button */}
      <div className="leave-room-box" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          className="btn btn-outline"
          onClick={() => setShowLeaveConfirm(true)}
          disabled={leaving || deleting}
        >
          {leaving ? <span className="spin" /> : "Leave Watch Party"}
        </button>

        {isHost && (
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting || leaving}
          >
            {deleting ? <span className="spin" /> : "Delete Jam for Everyone"}
          </button>
        )}
      </div>

      {/* Custom Confirmation Modals */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave Watch Party?"
        message="Are you sure you want to leave this Jam Room?"
        confirmText="Leave Room"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={leaving}
        onConfirm={confirmLeave}
        onCancel={() => !leaving && setShowLeaveConfirm(false)}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Jam for Everyone?"
        message={`Are you sure you want to permanently delete room #${roomCode}? All connected members will be removed.`}
        confirmText="Delete Jam"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setShowDeleteConfirm(false)}
      />
    </div>
  );
}
