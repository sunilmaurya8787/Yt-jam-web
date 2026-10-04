import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { RoomPlayerProvider } from "../context/RoomPlayerContext.jsx";
import { observeRoomMeta, observeAllRoomMembers } from "../utils/roomRepository.js";
import PlayerBox from "../components/PlayerBox.jsx";
import PlaylistTab from "../components/tabs/PlaylistTab.jsx";
import ChatTab from "../components/tabs/ChatTab.jsx";
import PeopleTab from "../components/tabs/PeopleTab.jsx";
import ProfileTab from "../components/tabs/ProfileTab.jsx";

const TABS = [
  { key: "playlist", label: "Playlist", icon: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></> },
  { key: "chat", label: "Chat", icon: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4-.9L4 20l1.2-3.3A7.5 7.5 0 1 1 20 11.5Z" /> },
  { key: "people", label: "People", icon: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.5-3 2.5-5 6-5s5.5 2 6 5" /><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14c2.2.5 3.5 2.1 4 4" /></> },
  { key: "profile", label: "Profile", icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-3.5 3-5.5 7-5.5s6.4 2 7 5.5" /></> }
];

export default function Room({ roomCode, onBackToLobby }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [members, setMembers] = useState({});
  const [tab, setTab] = useState("playlist");

  useEffect(() => observeRoomMeta(roomCode, setMeta), [roomCode]);
  useEffect(() => observeAllRoomMembers(roomCode, setMembers), [roomCode]);

  const myMember = members[user?.uid];
  const isHost = meta?.hostUid === user?.uid;

  if (!myMember) {
    return (
      <div className="screen">
        <div className="spin" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  return (
    <RoomPlayerProvider roomCode={roomCode} hostUid={meta?.hostUid} permissions={myMember.permissions} allowMembersToAddVideos={meta?.allowMembersToAddVideos}>
      <div className="room-shell">
        <div className="room-topbar">
          <button className="icon-btn" onClick={onBackToLobby}>←</button>
          <div className="room-heading">
            <div className="code">{meta?.name || `Jam #${roomCode}`}</div>
            {meta?.description && <div className="room-description">{meta.description}</div>}
          </div>
          <div className="room-role-stack">
            <span className={isHost ? "host-badge" : "member-badge"}>
              {isHost ? "★ HOST" : "● MEMBER"}
            </span>
            <div className="room-meta-stack">
              <span className="room-members-count" title="Joined members">
                {Object.keys(members).length} / {meta?.maxMembers || 20}
              </span>
              <span className="room-code-under-role">Room #{roomCode}</span>
            </div>
          </div>
          <div className="spacer" />
        </div>

        <div className="room-tabbar">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)} aria-label={t.label}>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {t.icon}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="room-body">
          {/* Exactly one PlayerBox, always mounted at a stable position in
              the tree — this is what keeps the video and its Firebase sync
              alive across tab switches. Only the `mode` prop (and its CSS)
              changes; the component itself never unmounts. Two separate
              conditional instances would defeat this entirely. */}
          <PlayerBox mode={tab === "playlist" || tab === "chat" ? "big" : "mini"} onExpand={() => setTab("playlist")} tab={tab} />

          {tab === "playlist" && <PlaylistTab roomCode={roomCode} />}
          {tab === "chat" && <ChatTab roomCode={roomCode} />}
          {tab === "people" && <PeopleTab roomCode={roomCode} isRoomHost={isHost} allowMembersToAddVideos={Boolean(meta?.allowMembersToAddVideos)} />}
            {tab === "profile" && <ProfileTab roomCode={roomCode} meta={meta} memberCount={Object.keys(members).length} isHost={isHost} onLeaveRoom={onBackToLobby} />}
        </div>
      </div>
    </RoomPlayerProvider>
  );
}
