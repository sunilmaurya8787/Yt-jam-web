import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { leaveRoom, signOutUser, updateRoomMeta } from "../../utils/roomRepository.js";

export default function ProfileTab({ roomCode, meta, memberCount, isHost, onLeaveRoom }) {
  const { user, profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const name = profile?.name || user?.displayName || "Jammer";
  const username = profile?.username || "";
  const [roomName, setRoomName] = useState(meta?.name || "");
  const [roomDescription, setRoomDescription] = useState(meta?.description || "");
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  useEffect(() => {
    setRoomName(meta?.name || "");
    setRoomDescription(meta?.description || "");
  }, [meta?.name, meta?.description]);

  async function saveRoomSettings() {
    setSaving(true);
    setSettingsError("");
    try {
      await updateRoomMeta(roomCode, { name: roomName, description: roomDescription });
    } catch (err) {
      setSettingsError(err.message || "Couldn't save room settings.");
    } finally {
      setSaving(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({ title: "Join my YouTube Jam", text: `Join my Jam with code ${roomCode}` }).catch(() => {});
    } else {
      copyCode();
    }
  }

  async function handleLeave() {
    setLeaving(true);
    try {
      await leaveRoom(roomCode);
      onLeaveRoom();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div>
      <div className="profile-card">
        <div className="avatar avatar-lg" style={{ margin: "0 auto 14px" }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <h2>{name}</h2>
        {username && <div className="handle"># {username}</div>}
        <div className="email-row">
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          {user?.email}
        </div>
      </div>

      <div className="eyebrow">Current Jam Room</div>
      <div className="room-stats-grid">
        <div className="room-stat-card">
          <div className="room-stat-label">Room</div>
          <div className="room-stat-value code">{roomCode}</div>
          {isHost && <span className="created-tag">★ HOST</span>}
        </div>
        <div className="room-stat-card">
          <div className="room-stat-label">Joined</div>
          <div className="room-stat-value">{memberCount} / {meta?.maxMembers || 20}</div>
          <div className="room-stat-hint">members</div>
        </div>
        <div className="room-stat-card">
          <div className="room-stat-label">Expires</div>
          <div className="room-stat-value room-expiry-value">
            {meta?.expiresAt > 0 ? new Date(meta.expiresAt).toLocaleString() : "Never expires"}
          </div>
        </div>
      </div>
      <div className="two-col">
        <button className="btn btn-outline" onClick={copyCode}>
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4H2v14a2 2 0 0 0 2 2h12V6a2 2 0 0 0-2-2Z" />
            <path d="M22 6v12a2 2 0 0 1-2 2h-6" />
          </svg>
          {copied ? "Copied!" : "Copy Code"}
        </button>
        <button className="btn btn-primary" onClick={shareCode}>
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13M22 2l-7 21-4-9-9-4 21-7Z" />
          </svg>
          Share Room
        </button>
      </div>

      <div className="eyebrow">Session & Account</div>
      {isHost && <>
        <div className="eyebrow">Room Settings</div>
        <div className="field">
          <label>Room Name</label>
          <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={60} />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={roomDescription} onChange={(e) => setRoomDescription(e.target.value)} maxLength={180} />
        </div>
        {settingsError && <div className="error-text">{settingsError}</div>}
        <button className="btn btn-primary" onClick={saveRoomSettings} disabled={saving || !roomName.trim()} style={{ marginBottom: 10 }}>
          {saving ? <span className="spin" /> : "Save Room Settings"}
        </button>
      </>}
      
      <div className="two-col">
        <button className="btn btn-outline" onClick={handleLeave} disabled={leaving}>
          {leaving ? <span className="spin" /> : "→ Leave Room"}
        </button>
        <button className="btn btn-danger" onClick={signOutUser}>
          <svg viewBox="0 0 24 24" width="16" height="16" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h4M16 17l4-4m0 0-4-4m4 4H9" />
          </svg>
          Sign Out
        </button>
      </div>
    </div>
  );
}
