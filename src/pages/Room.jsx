import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { RoomPlayerProvider } from "../context/RoomPlayerContext.jsx";
import { observeRoomMeta, observeAllRoomMembers, trackRoomPresence, clearActiveRoom, leaveRoom, joinRoom } from "../utils/roomRepository.js";
import ConfirmModal from "../components/ConfirmModal.jsx";
import PlayerBox from "../components/PlayerBox.jsx";
import NowPlayingBar from "../components/NowPlayingBar.jsx";
import PlaylistTab from "../components/tabs/PlaylistTab.jsx";
import ChatTab from "../components/tabs/ChatTab.jsx";
import PeopleTab from "../components/tabs/PeopleTab.jsx";
import ProfileTab from "../components/tabs/ProfileTab.jsx";

const TABS = [
  {
    key: "playlist",
    label: "Queue",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    )
  },
  {
    key: "chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    )
  },
  {
    key: "people",
    label: "Members",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    key: "profile",
    label: "Room Info",
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  }
];

export default function Room({ roomCode, onBackToLobby }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [members, setMembers] = useState({});
  const [tab, setTab] = useState("playlist");
  const [copiedCode, setCopiedCode] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [roomClosedReason, setRoomClosedReason] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [connectTimeout, setConnectTimeout] = useState(false);

  useEffect(() => {
    if (members[user?.uid]) {
      setConnectTimeout(false);
      return;
    }
    // Attempt auto-join in background if member record is absent after 1.5s
    const healTimer = setTimeout(() => {
      if (!members[user?.uid] && user?.uid && roomCode) {
        joinRoom(roomCode).catch(() => {});
      }
    }, 1500);

    const timeoutTimer = setTimeout(() => {
      setConnectTimeout(true);
    }, 6000);

    return () => {
      clearTimeout(healTimer);
      clearTimeout(timeoutTimer);
    };
  }, [members, user?.uid, roomCode]);

  useEffect(() => {
    return observeRoomMeta(roomCode, (metaVal) => {
      if (!metaVal) {
        setRoomClosedReason("This Jam room has been ended or deleted by the host.");
        if (user?.uid) clearActiveRoom(user.uid);
      } else if (metaVal.expiresAt > 0 && Date.now() >= metaVal.expiresAt) {
        setRoomClosedReason("This Jam room has reached its scheduled expiration time.");
        if (user?.uid) clearActiveRoom(user.uid);
      } else {
        setMeta(metaVal);
      }
    });
  }, [roomCode, user?.uid]);

  useEffect(() => {
    if (!meta?.expiresAt || meta.expiresAt === 0) return;
    const timeLeft = meta.expiresAt - Date.now();
    if (timeLeft <= 0) {
      setRoomClosedReason("This Jam room has reached its scheduled expiration time.");
      if (user?.uid) clearActiveRoom(user.uid);
      return;
    }
    const timer = setTimeout(() => {
      setRoomClosedReason("This Jam room has reached its scheduled expiration time.");
      if (user?.uid) clearActiveRoom(user.uid);
    }, timeLeft);
    return () => clearTimeout(timer);
  }, [meta?.expiresAt, user?.uid]);

  useEffect(() => observeAllRoomMembers(roomCode, setMembers), [roomCode]);
  useEffect(() => {
    if (user?.uid && roomCode) {
      return trackRoomPresence(roomCode, user.uid);
    }
  }, [roomCode, user?.uid]);

  const myMember = members[user?.uid];
  const isHost = meta?.hostUid === user?.uid;
  const memberList = Object.values(members);
  const memberCount = memberList.length;

  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    });
  }

  function handleBack() {
    setShowLeaveConfirm(true);
  }

  async function handleConfirmLeave() {
    setLeaving(true);
    try {
      await leaveRoom(roomCode);
      onBackToLobby();
    } catch (err) {
      console.error("Error leaving room:", err);
      onBackToLobby();
    } finally {
      setLeaving(false);
      setShowLeaveConfirm(false);
    }
  }

  if (roomClosedReason) {
    return (
      <div className="room-loading-screen">
        <div className="room-closed-card">
          <div className="closed-icon-badge">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3>Jam Closed</h3>
          <p>{roomClosedReason}</p>
          <button className="btn btn-primary" onClick={onBackToLobby} style={{ marginTop: 14 }}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!myMember) {
    return (
      <div className="room-loading-screen">
        <div className="spin" style={{ width: 32, height: 32 }} />
        <p>Connecting to Jam #{roomCode}...</p>
        {connectTimeout && (
          <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-outline" onClick={onBackToLobby}>
              Back to Lobby
            </button>
            <button className="btn btn-primary" onClick={() => joinRoom(roomCode).catch(() => {})}>
              Retry Joining
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <RoomPlayerProvider
      roomCode={roomCode}
      hostUid={meta?.hostUid}
      permissions={myMember.permissions}
      allowMembersToAddVideos={meta?.allowMembersToAddVideos}
    >
      <div className="room-root-shell">
        {/* Top App Bar */}
        <header className="room-navbar">
          <div className="room-nav-left">
            <button className="nav-back-btn" onClick={handleBack} title="Back to Lobby">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span className="btn-label-desktop">Lobby</span>
            </button>

            <div className="room-branding">
              <div className="room-title-row">
                <h1 className="room-name">{meta?.name || `Jam #${roomCode}`}</h1>
                <span className="live-status-pill">
                  <span className="live-pulsing-dot" /> LIVE
                </span>
              </div>
              {meta?.description && (
                <div className="room-desc-subtitle" title={meta.description}>
                  {meta.description}
                </div>
              )}
            </div>
          </div>

          <div className="room-nav-right">
            {/* Quick 1-click room code copy */}
            <button
              className={`room-code-chip ${copiedCode ? "copied" : ""}`}
              onClick={copyRoomCode}
              title="Click to copy 5-digit room code"
            >
              <span className="code-label">CODE:</span>
              <span className="code-val">{roomCode}</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {copiedCode ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </>
                )}
              </svg>
            </button>

            {/* Member count indicator */}
            <div className="room-members-chip" title="Joined Members">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>{memberCount} / {meta?.maxMembers || 20}</span>
            </div>

            {/* Role Badge */}
            <span className={`role-badge ${isHost ? "host" : "member"}`}>
              {isHost ? "★ HOST" : "● MEMBER"}
            </span>
          </div>
        </header>

        {/* Responsive Body: 2-column Theater on Desktop, Stacked Stage on Mobile */}
        <div className="room-content-layout">
          {/* Main Stage (Player + Controls) */}
          <section className="room-stage-section">
            {/* Exactly one persistent PlayerBox mounted here */}
            <PlayerBox
              mode={isMiniPlayer ? "mini" : "big"}
              onExpand={() => setIsMiniPlayer(false)}
            />

            {/* Transport & Seek Controls */}
            {!isMiniPlayer && <NowPlayingBar />}
          </section>

          {/* Sidebar / Tabs Section */}
          <section className="room-sidebar-section">
            {/* Segmented Tab Headers */}
            <nav className="room-tabs-nav" aria-label="Room tabs">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    className={`tab-nav-btn ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setTab(t.key);
                    }}
                    aria-selected={isActive}
                  >
                    {t.icon}
                    <span className="tab-label">{t.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Active Tab Content Pane */}
            <div className="room-tab-body">
              {tab === "playlist" && <PlaylistTab roomCode={roomCode} />}
              {tab === "chat" && <ChatTab roomCode={roomCode} />}
              {tab === "people" && (
                <PeopleTab
                  roomCode={roomCode}
                  isRoomHost={isHost}
                  allowMembersToAddVideos={Boolean(meta?.allowMembersToAddVideos)}
                />
              )}
              {tab === "profile" && (
                <ProfileTab
                  roomCode={roomCode}
                  meta={meta}
                  memberCount={memberCount}
                  isHost={isHost}
                  onLeaveRoom={onBackToLobby}
                />
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Leave Watch Party Confirmation Modal */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave Watch Party?"
        message="Are you sure you want to leave this Jam Room?"
        confirmText="Leave Room"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={leaving}
        onConfirm={handleConfirmLeave}
        onCancel={() => !leaving && setShowLeaveConfirm(false)}
      />
    </RoomPlayerProvider>
  );
}
