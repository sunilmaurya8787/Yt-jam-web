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

export default function PeopleTab({ roomCode, isRoomHost, allowMembersToAddVideos }) {
  const { user, profile } = useAuth();
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
      setRoomSettingError(err.message || "Couldn't update the room setting.");
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
      setPermissionError(err.message || "Couldn't kick and block this member.");
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
      setPermissionError(err.message || "Couldn't unblock this member.");
    } finally {
      setModerationBusy(false);
    }
  }

  return (
    <div>
      <div className="info-banner">
        <div className="ic">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 19c.5-3 2.5-5 6-5s5.5 2 6 5" />
            <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.2.5 3.5 2.1 4 4" />
          </svg>
        </div>
        <div>
          <h4>Room Members</h4>
          <p>{isHost ? "Control shared video access and manage member permissions." : "See everyone sharing this Jam in real time."}</p>
        </div>
      </div>

      {isHost && <div className="admin-setting">
        <div>
          <strong>Allow all members to add videos</strong>
          <div className="hint">Members can add videos without individual approval.</div>
          {roomSettingError && <div className="error-text">{roomSettingError}</div>}
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={allowMembersToAddVideos}
            disabled={savingRoomSetting}
            onChange={(event) => toggleRoomSetting(event.target.checked)}
          />
          <span className="track" />
        </label>
      </div>}

      {isHost && (
        <div className="people-subtabs" style={{ marginTop: 12, marginBottom: 12 }}>
          <button
            className={activeSection === "members" ? "active" : ""}
            onClick={() => setActiveSection("members")}
            type="button"
          >
            Members ({entries.length})
          </button>
          <button
            className={activeSection === "blocklist" ? "active" : ""}
            onClick={() => setActiveSection("blocklist")}
            type="button"
          >
            Blocklist ({blockedEntries.length})
          </button>
        </div>
      )}

      {activeSection === "members" && (
        entries.length === 0 ? (
          <div className="empty-block">No members in this room yet.</div>
        ) : (
          entries.map(([uid, m]) => (
            <div
              key={uid}
              className={`member-row ${isHost && !m.isHost ? "member-row-manageable" : ""}`}
              onClick={() => isHost && !m.isHost && setSelectedMember({ uid, member: m })}
            >
              <div className="avatar">{(m.name || "?").charAt(0).toUpperCase()}</div>
              <div className="info">
                <div className="n">
                  {m.name}
                  {uid === user?.uid && <span className="tag you">YOU</span>}
                </div>
                <div className="u">@{m.username}</div>
              </div>
              {m.isHost && <span className="tag dj">★ HOST</span>}
              {isHost && !m.isHost && <span className="tag manage-tag">MANAGE</span>}
            </div>
          ))
        )
      )}

      {activeSection === "blocklist" && isHost && (
        blockedEntries.length === 0 ? (
          <div className="empty-block">No blocked members in this room.</div>
        ) : (
          blockedEntries.map(([uid, member]) => (
            <div key={uid} className="member-row" style={{ justifyContent: "space-between" }}>
              <div className="info" style={{ flex: 1 }}>
                <div className="n">{member.name || "Blocked member"}</div>
                <div className="u">@{member.username || "blocked-user"}</div>
              </div>
              <button className="btn btn-outline btn-sm" disabled={moderationBusy} onClick={() => handleUnblock(uid)}>
                Unblock
              </button>
            </div>
          ))
        )
      )}

      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>Manage @{selectedMember.member.username || profile?.username || "member"}</h3>
            <p>Choose what this member can do in the shared Jam.</p>
            {[
              ["editOrder", "Reorder playlist", "Move videos up or down"],
              ["removeVideo", "Remove videos", "Delete videos from the queue"],
              ["addVideo", "Add videos", "Add videos to the shared queue"],
              ["changeVideo", "Choose videos", "Start another playlist video"],
            ].map(([key, label, description]) => (
              <div className="perm-toggle-row" key={key}>
                <div>
                  <div className="label">{label}</div>
                  <div className="desc">{description}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMember.member.permissions?.[key])}
                    onChange={(event) => togglePermission(key, event.target.checked)}
                  />
                  <span className="track" />
                </label>
              </div>
            ))}

            <div className="perm-toggle-row" style={{ marginTop: 18 }}>
              <div>
                <div className="label">Kick &amp; Block</div>
                <div className="desc">Remove this member and prevent them from rejoining this room.</div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                disabled={moderationBusy}
                onClick={() => handleKickAndBlock(selectedMember.uid)}
              >
                Kick &amp; Block
              </button>
            </div>

            {permissionError && <div className="error-text">{permissionError}</div>}
            <button className="btn btn-outline" onClick={() => setSelectedMember(null)} style={{ marginTop: 18 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
