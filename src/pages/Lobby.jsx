import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  deleteRoom,
  observeUserRoomStatus,
  observeUserCreatedRooms,
  setRoomCreationOpenToAll,
  signOutUser
} from "../utils/roomRepository.js";
import RoomCreatedModal from "../components/RoomCreatedModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

function formatExpiry(expiresAt) {
  if (!expiresAt || expiresAt === 0) return "Never expires";
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Expires in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `Expires in ${hours}h ${minutes}m`;
  }
  return `Expires in ${minutes}m`;
}

export default function Lobby({ onEnterRoom }) {
  const { user, profile, isAdmin, roomCreationOpenToAll } = useAuth();
  const [activeTab, setActiveTab] = useState("join"); // "join" | "my-rooms" | "create"
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(20);
  const [expiryHours, setExpiryHours] = useState(0);
  const [roomStatus, setRoomStatus] = useState({ activeRoom: null, hostedRoom: null });
  const [createdRooms, setCreatedRooms] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteTargetCode, setDeleteTargetCode] = useState(null);
  const [leaveGuestTargetCode, setLeaveGuestTargetCode] = useState(null);
  const [leavingGuest, setLeavingGuest] = useState(false);
  const [enteringCode, setEnteringCode] = useState(null);
  const [, setTimeTick] = useState(0);

  const canCreateRoom = isAdmin || roomCreationOpenToAll;
  const displayName = profile?.name || user?.displayName || "Jammer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  // If user cannot create room and is on "create" tab, fallback to "join"
  useEffect(() => {
    if (!canCreateRoom && activeTab === "create") {
      setActiveTab("join");
    }
  }, [canCreateRoom, activeTab]);

  // Real-time listener for user's active/hosted rooms stored on Firebase
  useEffect(() => {
    if (!user?.uid) return;
    return observeUserRoomStatus(user.uid, setRoomStatus);
  }, [user?.uid]);

  // Real-time listener for all non-expired rooms created by this user
  useEffect(() => {
    if (!user?.uid) return;
    return observeUserCreatedRooms(user.uid, setCreatedRooms);
  }, [user?.uid]);

  // Periodic tick to refresh relative expiry display
  useEffect(() => {
    const timer = setInterval(() => setTimeTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  async function handleCreate(e) {
    if (e) e.preventDefault();
    if (!roomName.trim()) return;
    setError("");
    setCreating(true);
    try {
      const expiresAt = expiryHours > 0 ? Date.now() + Number(expiryHours) * 60 * 60 * 1000 : 0;
      const code = await createRoom({
        name: roomName.trim(),
        description: roomDescription.trim(),
        maxMembers: Number(maxMembers) || 20,
        expiresAt
      });
      setCreatedCode(code);
    } catch (err) {
      setError(err.message || "Failed to create Jam.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (joinCode.length !== 5) return;
    setError("");
    setJoining(true);
    try {
      const code = await joinRoom(joinCode);
      onEnterRoom(code);
    } catch (err) {
      setError(err.message || "Failed to join Jam.");
    } finally {
      setJoining(false);
    }
  }

  async function handleEnterRoom(code) {
    if (!code) return;
    setError("");
    setEnteringCode(code);
    try {
      await joinRoom(code);
      onEnterRoom(code);
    } catch (err) {
      setError(err.message || "Failed to enter Jam room.");
    } finally {
      setEnteringCode(null);
    }
  }

  function handleDeleteRoom(code) {
    setDeleteTargetCode(code);
  }

  async function handleConfirmDelete() {
    if (!deleteTargetCode) return;
    setError("");
    setDeleting(true);
    try {
      await deleteRoom(deleteTargetCode);
      setDeleteTargetCode(null);
    } catch (err) {
      setError(err.message || "Failed to delete room.");
    } finally {
      setDeleting(false);
    }
  }

  function handleLeaveActiveRoom(code) {
    setLeaveGuestTargetCode(code);
  }

  async function handleConfirmLeaveGuest() {
    if (!leaveGuestTargetCode) return;
    setError("");
    setLeavingGuest(true);
    try {
      await leaveRoom(leaveGuestTargetCode);
      setLeaveGuestTargetCode(null);
    } catch (err) {
      setError(err.message || "Failed to leave room.");
    } finally {
      setLeavingGuest(false);
    }
  }

  async function handleConfirmSignOut() {
    setSigningOut(true);
    try {
      await signOutUser();
    } catch (err) {
      setError(err.message || "Failed to sign out.");
    } finally {
      setSigningOut(false);
      setShowSignOutConfirm(false);
    }
  }

  function handleCopyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1800);
    });
  }

  async function pasteCode() {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, 5);
      if (digits) setJoinCode(digits);
    } catch {
      // clipboard permission denied
    }
  }

  // Determine what to display: Hosted Room take priority, or Active Room
  const hostedRoom = roomStatus.hostedRoom;
  const activeRoom = roomStatus.activeRoom;

  return (
    <div className="lobby-viewport-screen">
      {/* Lobby Top Navbar */}
      <header className="lobby-topbar">
        <div className="lobby-brand">
          <div className="brand-logo-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="brand-titles">
            <h2>YouTube Jam</h2>
            <span className="brand-tagline">Watch Together in Sync</span>
          </div>
        </div>

        {/* User Profile Pill */}
        <div className="lobby-user-pill">
          <div className="user-avatar-sm">{initial}</div>
          <div className="user-text-info">
            <span className="user-pill-name">{displayName}</span>
            <span className="user-pill-email">{user?.email}</span>
          </div>
          <button
            className="sign-out-btn"
            onClick={() => setShowSignOutConfirm(true)}
            title="Sign out of your account"
            aria-label="Sign out"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="lobby-main-container">
        {/* Hero Welcome Banner */}
        <section className="lobby-hero-card">
          <div className="hero-content">
            <h1>Start a Synchronized Watch Party</h1>
            <p>
              Invite friends to stream YouTube videos together with real-time video sync,
              live room chat, and collaborative playlists across desktop, mobile, and Android.
            </p>
          </div>
        </section>

        {error && <div className="error-alert lobby-error">{error}</div>}

        {/* 1. Active Room Banner (for member who joined someone else's room and hasn't left) */}
        {activeRoom && !activeRoom.isHost && (
          <section className="active-room-banner-card member-card">
            <div className="active-room-header">
              <div className="active-room-badge member-badge">
                <span className="live-pulsing-dot" />
                <span>ACTIVE WATCH PARTY</span>
              </div>
              <button
                className="leave-room-text-btn"
                onClick={() => handleLeaveActiveRoom(activeRoom.roomCode)}
                title="Leave this watch party"
              >
                Leave Party
              </button>
            </div>

            <div className="active-room-main-info">
              <div className="active-room-details">
                <h3 className="active-room-title">{activeRoom.meta?.name || `Jam #${activeRoom.roomCode}`}</h3>
                <div className="active-room-meta-chips">
                  {/* Code chip */}
                  <button
                    type="button"
                    className="room-code-tag"
                    onClick={() => handleCopyCode(activeRoom.roomCode)}
                    title="Click to copy code"
                  >
                    <span className="code-prefix">CODE:</span>
                    <strong>{activeRoom.roomCode}</strong>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {copiedCode === activeRoom.roomCode && <span className="copied-bubble">Copied!</span>}
                  </button>

                  {/* Expiry Chip */}
                  <div className="expiry-meta-chip">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{formatExpiry(activeRoom.meta?.expiresAt)}</span>
                  </div>

                  {/* Host Chip */}
                  <div className="members-meta-chip">
                    <span>Host: @{activeRoom.meta?.hostUsername || "host"}</span>
                  </div>
                </div>
              </div>

              <div className="active-room-action-buttons">
                <button
                  className="btn btn-primary rejoin-btn"
                  onClick={() => handleEnterRoom(activeRoom.roomCode)}
                  disabled={enteringCode === activeRoom.roomCode}
                >
                  {enteringCode === activeRoom.roomCode ? <span className="spin" /> : "Rejoin Jam →"}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Top-Left Segmented Navigation Tabs */}
        <div className="lobby-tabs-nav-bar">
          <button
            type="button"
            className={`lobby-nav-tab-btn ${activeTab === "join" ? "active" : ""}`}
            onClick={() => setActiveTab("join")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Join Watch Party</span>
          </button>

          <button
            type="button"
            className={`lobby-nav-tab-btn ${activeTab === "my-rooms" ? "active" : ""}`}
            onClick={() => setActiveTab("my-rooms")}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Your Rooms</span>
            {createdRooms.length > 0 && (
              <span className="lobby-tab-count-pill">{createdRooms.length}</span>
            )}
          </button>

          {canCreateRoom && (
            <button
              type="button"
              className={`lobby-nav-tab-btn ${activeTab === "create" ? "active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>Create Room</span>
            </button>
          )}
        </div>

        {/* Tab 1: Join Watch Party */}
        {activeTab === "join" && (
          <div className="lobby-tab-content-pane">
            <section className="action-glass-card join-card centered-panel">
              <div className="card-header-icon join-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3>Join a Watch Party</h3>
              <p className="card-subtitle">
                Enter the 5-digit room code shared by your friend to jump into their synchronized stream.
              </p>

              <form onSubmit={handleJoin} className="join-form">
                <div className="pin-input-container">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="pin-code-input"
                    placeholder="• • • • •"
                    value={joinCode}
                    maxLength={5}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <button
                    type="button"
                    className="pin-paste-btn"
                    onClick={pasteCode}
                    title="Paste code from clipboard"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                    <span>Paste</span>
                  </button>
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={joining || joinCode.length !== 5}
                >
                  {joining ? <span className="spin" /> : "Join Jam Room →"}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* Tab 2: Your Created Rooms */}
        {activeTab === "my-rooms" && (
          <div className="lobby-tab-content-pane">
            {createdRooms.length > 0 ? (
              <section className="created-rooms-section">
                <div className="section-title-row">
                  <div className="section-title-left">
                    <div className="section-badge-icon">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="section-heading">
                        Your Created Rooms
                        <span className="count-pill">{createdRooms.length} / 5 active</span>
                      </h3>
                      <span className="section-subheading">
                        Live watch party rooms created by you that have not expired.
                      </span>
                    </div>
                  </div>
                  {canCreateRoom && createdRooms.length < 5 && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setActiveTab("create")}
                    >
                      ＋ Create Another
                    </button>
                  )}
                </div>

                <div className="created-rooms-grid">
                  {createdRooms.map((r) => {
                    const isCurrentlyActive = activeRoom?.roomCode === r.roomCode;
                    return (
                      <div key={r.roomCode} className={`created-room-card ${isCurrentlyActive ? "is-joined" : ""}`}>
                        <div className="created-room-card-header">
                          <div className="card-status-row">
                            <span className="live-status-pill small">
                              <span className="live-pulsing-dot" /> LIVE
                            </span>
                            {isCurrentlyActive && (
                              <span className="current-active-tag">Joined</span>
                            )}
                          </div>
                          <button
                            className="delete-icon-btn"
                            onClick={() => handleDeleteRoom(r.roomCode)}
                            disabled={deleting}
                            title="Delete this room permanently"
                            aria-label={`Delete ${r.name}`}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        </div>

                        <div className="created-room-body">
                          <h4 className="created-room-name" title={r.name}>{r.name}</h4>
                          {r.description && (
                            <p className="created-room-desc" title={r.description}>{r.description}</p>
                          )}

                          <div className="created-room-meta-row">
                            <button
                              type="button"
                              className="room-code-tag small"
                              onClick={() => handleCopyCode(r.roomCode)}
                              title="Click to copy code"
                            >
                              <span className="code-prefix">CODE:</span>
                              <strong>{r.roomCode}</strong>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                              {copiedCode === r.roomCode && <span className="copied-bubble">Copied!</span>}
                            </button>

                            <div className="expiry-meta-chip small">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span>{formatExpiry(r.expiresAt)}</span>
                            </div>

                            <div className="members-meta-chip small">
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                              </svg>
                              <span>{r.memberCount} / {r.maxMembers}</span>
                            </div>
                          </div>
                        </div>

                        <div className="created-room-card-footer">
                          <button
                            className="btn btn-primary enter-room-btn"
                            onClick={() => handleEnterRoom(r.roomCode)}
                            disabled={enteringCode === r.roomCode}
                          >
                            {enteringCode === r.roomCode ? <span className="spin" /> : "Enter Jam Room →"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="empty-rooms-placeholder">
                <div className="empty-rooms-icon">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </div>
                <h3>No Active Created Rooms</h3>
                <p>You haven't created any live rooms yet. Any rooms you create will appear here until they expire.</p>
                {canCreateRoom ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab("create")}
                    style={{ marginTop: 14 }}
                  >
                    ＋ Create a Room Now
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setActiveTab("join")}
                    style={{ marginTop: 14 }}
                  >
                    Join a Watch Party →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Create Room (Visible only if allowed) */}
        {canCreateRoom && activeTab === "create" && (
          <div className="lobby-tab-content-pane">
            <section className="action-glass-card create-card centered-panel">
              <div className="card-header-icon create-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="create-card-header-row">
                <h3>Create a Room</h3>
                <span className={`room-limit-badge ${createdRooms.length >= 5 ? "limit-reached" : ""}`}>
                  {createdRooms.length} / 5 rooms active
                </span>
              </div>
              <p className="card-subtitle">
                Set up a new watch party. You will be the host and can manage the playlist and playback.
              </p>

              {createdRooms.length >= 5 && (
                <div className="limit-warning-alert">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <strong>Room limit reached (5/5 active)</strong>
                    <p>Each user can create up to 5 active rooms. Please delete an existing room in "Your Rooms" to create a new one.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleCreate} className="create-form">
                <div className="field-group">
                  <label>Room Name *</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g. Friday Anime Night"
                    maxLength={60}
                    disabled={createdRooms.length >= 5}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Description (optional)</label>
                  <input
                    type="text"
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="What are you watching?"
                    maxLength={180}
                    disabled={createdRooms.length >= 5}
                  />
                </div>

                <div className="form-row-two-col">
                  <div className="field-group">
                    <label>Max Members</label>
                    <select
                      value={maxMembers}
                      onChange={(e) => setMaxMembers(Number(e.target.value))}
                      disabled={createdRooms.length >= 5}
                    >
                      <option value={5}>5 members</option>
                      <option value={10}>10 members</option>
                      <option value={20}>20 members</option>
                      <option value={50}>50 members</option>
                      <option value={100}>100 members</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label>Room Expiry</label>
                    <select
                      value={expiryHours}
                      onChange={(e) => setExpiryHours(Number(e.target.value))}
                      disabled={createdRooms.length >= 5}
                    >
                      <option value={0}>Never expires</option>
                      <option value={1}>1 hour</option>
                      <option value={6}>6 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={72}>3 days</option>
                    </select>
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={creating || !roomName.trim() || createdRooms.length >= 5}
                  style={{ marginTop: 8 }}
                >
                  {creating ? <span className="spin" /> : "＋ Launch Watch Party"}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* Admin Configuration (if applicable) */}
        {isAdmin && (
          <section className="lobby-admin-panel">
            <div className="admin-info">
              <strong>Admin Control: Room Creation</strong>
              <span className="admin-hint">Allow any registered user to create watch party rooms.</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={roomCreationOpenToAll}
                onChange={(e) => setRoomCreationOpenToAll(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </section>
        )}
      </main>

      {/* Modal on Room Creation */}
      {createdCode && (
        <RoomCreatedModal
          code={createdCode}
          onEnter={() => handleEnterRoom(createdCode)}
          onClose={() => setCreatedCode(null)}
        />
      )}

      {/* Custom Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={showSignOutConfirm}
        title="Sign Out?"
        message="Are you sure you want to sign out of your account?"
        confirmText="Sign Out"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={signingOut}
        icon={
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        }
        onConfirm={handleConfirmSignOut}
        onCancel={() => !signingOut && setShowSignOutConfirm(false)}
      />

      {/* Custom Delete Room Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetCode)}
        title="Delete Jam Room?"
        message={`Are you sure you want to permanently delete room #${deleteTargetCode}? All connected members will be disconnected.`}
        confirmText="Delete Jam"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={deleting}
        icon={
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setDeleteTargetCode(null)}
      />

      {/* Custom Leave Guest Room Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(leaveGuestTargetCode)}
        title="Leave Watch Party?"
        message="Are you sure you want to leave this Jam Room?"
        confirmText="Leave Room"
        cancelText="Cancel"
        confirmVariant="danger"
        busy={leavingGuest}
        onConfirm={handleConfirmLeaveGuest}
        onCancel={() => !leavingGuest && setLeaveGuestTargetCode(null)}
      />
    </div>
  );
}
