import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { createRoom, joinRoom, setRoomCreationOpenToAll, signOutUser } from "../utils/roomRepository.js";
import RoomCreatedModal from "../components/RoomCreatedModal.jsx";

export default function Lobby({ onEnterRoom }) {
  const { user, profile, isAdmin, roomCreationOpenToAll } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(20);
  const [expiryHours, setExpiryHours] = useState(0);
  const canCreateRoom = isAdmin || roomCreationOpenToAll;

  const displayName = profile?.name || user?.displayName || "Jammer";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  async function handleCreate() {
    setError("");
    setCreating(true);
    try {
      const expiresAt = expiryHours > 0 ? Date.now() + Number(expiryHours) * 60 * 60 * 1000 : 0;
      const code = await createRoom({ name: roomName, description: roomDescription, maxMembers, expiresAt });
      setCreatedCode(code);
    } catch (err) {
      setError(err.message || "Failed to create Jam.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
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

  return (
    <div className="screen">
      <div className="lobby-wrap">
        <div className="lobby-header">
          <h1>YouTube Jam — Lobby</h1>
          <button className="icon-btn" title="Sign out" onClick={signOutUser}>⏻</button>
        </div>

        <div className="profile-strip">
          <div className="avatar">{initial}</div>
          <div>
            <div className="name">{displayName}</div>
            <div className="email">{user?.email}</div>
          </div>
        </div>

        {canCreateRoom && <div className="panel-red">
          <h3>＋ Create a Room</h3>
          <p>Set up a watch room with a name, capacity, and optional expiry.</p>
          <div className="field">
            <label>Room Name</label>
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Friday night watch party" maxLength={60} />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <textarea value={roomDescription} onChange={(e) => setRoomDescription(e.target.value)} placeholder="What are we watching?" maxLength={180} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Max Members</label>
              <input type="number" min="2" max="100" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
            </div>
            <div className="field">
              <label>Expires After</label>
              <select value={expiryHours} onChange={(e) => setExpiryHours(Number(e.target.value))}>
                <option value={0}>Never</option>
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !roomName.trim()}>
            {creating ? <span className="spin" /> : "Create Room"}
          </button>
        </div>}

        {isAdmin && <div className="admin-setting">
          <div>
            <strong>Room creation access</strong>
            <div className="hint">Allow every signed-in user to create rooms.</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={roomCreationOpenToAll} onChange={(e) => setRoomCreationOpenToAll(e.target.checked)} />
            <span className="track" />
          </label>
        </div>}

        <div className="panel-plain">
          <h3>
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 19c.5-3 2.5-5 6-5s5.5 2 6 5" />
              <path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.2.5 3.5 2.1 4 4" />
            </svg>
            Join a Jam
          </h3>
          <p>Enter the 5-digit room code shared by your friend to join the synchronized watch party.</p>
          <form onSubmit={handleJoin}>
            <input
              className="code-input"
              placeholder="5-Digit Room Code"
              value={joinCode}
              maxLength={5}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
            />
            <button className="btn btn-outline" type="submit" disabled={joining || joinCode.length !== 5}>
              {joining ? <span className="spin" /> : "→ Join Jam"}
            </button>
          </form>
        </div>

        {error && <div className="error-text">{error}</div>}
      </div>

      {createdCode && (
        <RoomCreatedModal
          code={createdCode}
          onEnter={() => onEnterRoom(createdCode)}
          onClose={() => setCreatedCode(null)}
        />
      )}
    </div>
  );
}
