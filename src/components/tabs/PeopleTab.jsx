import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  observeAllRoomMembers,
  observeRoomBlocklist,
  kickAndBlockMember,
  unblockMemberFromRoom,
  updateMemberPermission,
  updateRoomMeta
} from "../../utils/roomRepository.js";

function getAvatarGradient(str = "") {
  const gradients = [
    "linear-gradient(135deg, #ef4444, #f97316)",
    "linear-gradient(135deg, #8b5cf6, #ec4899)",
    "linear-gradient(135deg, #06b6d4, #3b82f6)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f59e0b, #d97706)"
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export default function PeopleTab({ roomCode, isRoomHost, allowMembersToAddVideos }) {
  const { user } = useAuth();
  const [members, setMembers] = useState({});
  const [blockedMembers, setBlockedMembers] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [permissionError, setPermissionError] = useState("");
  const [roomSettingError, setRoomSettingError] = useState("");
  const [savingRoomSetting, setSavingRoomSetting] = useState(false);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [activeSection, setActiveSection] = useState("members");

  useEffect(() => observeAllRoomMembers(roomCode, setMembers), [roomCode]);
  useEffect(() => observeRoomBlocklist(roomCode, setBlockedMembers), [roomCode]);

  const entries = Object.entries(members);
  const blockedEntries = Object.entries(blockedMembers);
  const isHost = Boolean(isRoomHost) || entries.some(([uid, member]) => uid === user?.uid && member.isHost);

  async function togglePermission(key, value) {
    if (!selectedMember) return;
    setPermissionError("");
    try {
      await updateMemberPermission(roomCode, selectedMember.uid, key, value);
      setSelectedMember((current) => ({
        ...current,
        member: { ...current.member, permissions: { ...current.member.permissions, [key]: value } }
      }));
    } catch (err) {
      setPermissionError(err.message || "Couldn't update that permission.");
    }
  }

  async function toggleRoomSetting(value) {
    setSavingRoomSetting(true);
    setRoomSettingError("");
    try {
      await updateRoomMeta(roomCode, { allowMembersToAddVideos: value });
    } catch (err) {
      setRoomSettingError(err.message || "Couldn't update room setting.");
    } finally {
      setSavingRoomSetting(false);
    }
  }

  async function handleKickAndBlock(uid) {
    if (!isHost || !uid) return;
    setPermissionError("");
    setModerationBusy(true);
    try {
      await kickAndBlockMember(roomCode, uid);
      setSelectedMember(null);
    } catch (err) {
      setPermissionError(err.message || "Couldn't kick and block member.");
    } finally {
      setModerationBusy(false);
    }
  }

  async function handleUnblock(uid) {
    if (!isHost || !uid) return;
    setPermissionError("");
    setModerationBusy(true);
    try {
      await unblockMemberFromRoom(roomCode, uid);
    } catch (err) {
      setPermissionError(err.message || "Couldn't unblock member.");
    } finally {
      setModerationBusy(false);
    }
  }

  return (
    <div className="tab-pane-content people-pane">
      {/* Banner */}
      <div className="info-glass-card">
        <div className="info-card-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="info-card-text">
          <h4>Room Members ({entries.length})</h4>
          <p>{isHost ? "You are the host. Tap any member to adjust their permissions or moderate." : "All members currently synchronized to this Jam."}</p>
        </div>
      </div>

      {/* Host Quick Setting */}
      {isHost && (
        <div className="setting-glass-row">
          <div>
            <strong>Allow All Members to Add Videos</strong>
            <p className="setting-desc">When enabled, anyone in the room can add videos to the queue.</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={Boolean(allowMembersToAddVideos)}
              disabled={savingRoomSetting}
              onChange={(e) => toggleRoomSetting(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      )}

      {roomSettingError && <div className="error-alert">{roomSettingError}</div>}

      {/* Subtabs for Host */}
      {isHost && blockedEntries.length > 0 && (
        <div className="segmented-subtabs">
          <button
            className={`subtab-btn ${activeSection === "members" ? "active" : ""}`}
            onClick={() => setActiveSection("members")}
          >
            Active ({entries.length})
          </button>
          <button
            className={`subtab-btn ${activeSection === "blocked" ? "active" : ""}`}
            onClick={() => setActiveSection("blocked")}
          >
            Blocked ({blockedEntries.length})
          </button>
        </div>
      )}

      {/* List */}
      <div className="people-scroll-list">
        {activeSection === "members" ? (
          entries.map(([uid, member]) => {
            const isMe = uid === user?.uid;
            const displayName = member.name || member.username || "Jammer";
            const initial = displayName.charAt(0).toUpperCase();
            const perms = member.permissions || {};
            const isDJ = perms.addVideo || perms.changeVideo || perms.editOrder || perms.removeVideo;

            return (
              <div
                key={uid}
                className="member-item-row"
                onClick={() => isHost && !isMe && setSelectedMember({ uid, member })}
                style={{ cursor: isHost && !isMe ? "pointer" : "default" }}
              >
                <div className="member-avatar" style={{ background: getAvatarGradient(displayName) }}>
                  {initial}
                  {member.isOnline && (
                    <span className="online-status-dot" title="Online" aria-label="Online" />
                  )}
                </div>
                <div className="member-details">
                  <div className="member-name-row">
                    <span className="member-display-name">{displayName}</span>
                    {isMe && <span className="chip chip-you">YOU</span>}
                    {member.isHost && <span className="chip chip-host">★ HOST</span>}
                    {!member.isHost && isDJ && <span className="chip chip-dj">DJ</span>}
                  </div>
                  <div className="member-handle">@{member.username || "user"}</div>
                </div>

                {isHost && !isMe && (
                  <button className="queue-btn" title="Member settings">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        ) : (
          blockedEntries.map(([uid, info]) => (
            <div key={uid} className="member-item-row">
              <div className="member-avatar" style={{ background: "#475569" }}>
                ?
              </div>
              <div className="member-details">
                <div className="member-display-name">{info?.username ? `@${info.username}` : `UID: ${uid.slice(0, 8)}...`}</div>
                <div className="member-handle" style={{ color: "var(--danger)" }}>Blocked from room</div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleUnblock(uid)}
                disabled={moderationBusy}
              >
                Unblock
              </button>
            </div>
          ))
        )}
      </div>

      {/* Permissions Modal */}
      {selectedMember && (
        <div className="modal-backdrop" onClick={() => setSelectedMember(null)}>
          <div className="modal-glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Member Permissions</h3>
              <button className="modal-close-btn" onClick={() => setSelectedMember(null)}>✕</button>
            </div>
            <p className="modal-subtitle">
              Manage what <strong>@{selectedMember.member.username || "user"}</strong> can do in this Jam:
            </p>

            {permissionError && <div className="error-alert">{permissionError}</div>}

            <div className="permissions-list">
              <div className="permission-row">
                <div>
                  <div className="perm-label">Add Videos to Queue</div>
                  <div className="perm-hint">Can search or paste YouTube links</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.member.permissions?.addVideo)}
                    onChange={(e) => togglePermission("addVideo", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="permission-row">
                <div>
                  <div className="perm-label">Change Current Video</div>
                  <div className="perm-hint">Can skip or select any video in queue to play</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.member.permissions?.changeVideo)}
                    onChange={(e) => togglePermission("changeVideo", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="permission-row">
                <div>
                  <div className="perm-label">Reorder Queue</div>
                  <div className="perm-hint">Can move videos up or down in the playlist</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.member.permissions?.editOrder)}
                    onChange={(e) => togglePermission("editOrder", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="permission-row">
                <div>
                  <div className="perm-label">Remove Videos from Queue</div>
                  <div className="perm-hint">Can delete songs from the playlist</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.member.permissions?.removeVideo)}
                    onChange={(e) => togglePermission("removeVideo", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            <div className="modal-danger-section">
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleKickAndBlock(selectedMember.uid)}
                disabled={moderationBusy}
                style={{ width: "100%" }}
              >
                {moderationBusy ? <span className="spin" /> : "Kick & Block Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
