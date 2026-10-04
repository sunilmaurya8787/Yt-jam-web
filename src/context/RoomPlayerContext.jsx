import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import {
  observePlaylist,
  observePlayerState,
  updatePlayerState
} from "../utils/roomRepository.js";

const RoomPlayerContext = createContext(null);

let iframeApiPromise = null;
function loadYouTubeIframeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (iframeApiPromise) return iframeApiPromise;
  iframeApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return iframeApiPromise;
}

const RESYNC_DRIFT = 3; // seconds — converge without constantly restarting playback
const HOST_SYNC_INTERVAL = 3000;

export function RoomPlayerProvider({ roomCode, hostUid, permissions, allowMembersToAddVideos, children }) {
  const { user } = useAuth();
  const isHost = user?.uid === hostUid;
  const access = isHost
    ? { editOrder: true, removeVideo: true, changeVideo: true }
    : (permissions || {});

  const [playlist, setPlaylist] = useState([]);
  const [playerState, setPlayerState] = useState(null);
  const [localTime, setLocalTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const seekPreviewRef = useRef(null);

  const playerDivRef = useRef(null); // the actual DOM node the iframe mounts into — never unmounted
  const playerRef = useRef(null); // the YT.Player instance
  const isHostRef = useRef(isHost);
  const applyingRemoteRef = useRef(false);
  const lastVideoIdRef = useRef(null);
  const lastAppliedEventRef = useRef("");
  const lastAppliedStateRef = useRef("");
  const lastAppliedPlayingRef = useRef(null);
  const remoteTargetRef = useRef(null);
  const lastSeekCommandRef = useRef(null);

  isHostRef.current = isHost;

  useEffect(() => observePlaylist(roomCode, setPlaylist), [roomCode]);
  useEffect(() => observePlayerState(roomCode, setPlayerState), [roomCode]);

  // Create the YT.Player exactly once, in the persistent mount div.
  useEffect(() => {
    let cancelled = false;
    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || playerRef.current || !playerDivRef.current) return;
      playerRef.current = new YT.Player(playerDivRef.current, {
        height: "100%",
        width: "100%",
        playerVars: {
          playsinline: 1,
          rel: 0,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          modestbranding: 0,
          fs: 1,
          autohide: 0,
          origin: window.location.origin
        },
        events: {
          onReady: () => setReady(true),
          onStateChange: onPlayerStateChange
        }
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlayerStateChange(e) {
    if (!isHostRef.current) return;

    const YT = window.YT;
    const remoteTarget = remoteTargetRef.current;
    const currentTime = playerRef.current?.getCurrentTime?.() || 0;
    const isExpectedRemoteEvent = remoteTarget
      && (e.data === remoteTarget.playerState
        || (e.data === YT.PlayerState.PLAYING && remoteTarget.isPlaying)
        || (e.data === YT.PlayerState.PAUSED && !remoteTarget.isPlaying))
      && Math.abs(currentTime - remoteTarget.positionSeconds) < 4;

    if (isExpectedRemoteEvent) {
      remoteTargetRef.current = null;
      return;
    }

    if (!applyingRemoteRef.current) {
      // A real local user action (not us mirroring the DB) — write it back.
      if (e.data === YT.PlayerState.PLAYING) {
        updatePlayerState(roomCode, { isPlaying: true, positionSeconds: playerRef.current.getCurrentTime(), syncAction: "play" });
      } else if (e.data === YT.PlayerState.PAUSED) {
        updatePlayerState(roomCode, { isPlaying: false, positionSeconds: playerRef.current.getCurrentTime(), syncAction: "pause" });
      }
    }
    // Autoplay-next is driven by the host only, so every member's client
    // doesn't race to advance the queue at the same moment.
    if (e.data === YT.PlayerState.ENDED && isHostRef.current) {
      advanceToNext();
    }
  }

  // Mirror playerState from the DB onto the local player.
  useEffect(() => {
    if (!ready || !playerState || !playerRef.current) return;
    const p = playerRef.current;
    const updatedAt = playerState.updatedAt || 0;
    const eventKey = playerState.eventId || `${playerState.updatedBy || ""}-${updatedAt}`;
    const stateKey = [
      eventKey,
      playerState.currentVideoId || "",
      playerState.positionSeconds || 0,
      playerState.isPlaying ? "playing" : "paused"
    ].join("|");
    const isNewVideo = playerState.currentVideoId !== lastVideoIdRef.current;
    const playbackModeChanged = lastAppliedPlayingRef.current !== null
      && playerState.isPlaying !== lastAppliedPlayingRef.current;
    const explicitSeek = playerState.seekCommand
      && playerState.seekCommand !== lastSeekCommandRef.current;

    applyingRemoteRef.current = true;

    const expectedPos = playerState.isPlaying
      ? playerState.positionSeconds + (Date.now() - updatedAt) / 1000
      : playerState.positionSeconds;

    try {
      if (playerState.currentVideoId && isNewVideo) {
        lastVideoIdRef.current = playerState.currentVideoId;
        remoteTargetRef.current = {
          playerState: playerState.isPlaying ? 1 : 2,
          isPlaying: playerState.isPlaying,
          positionSeconds: expectedPos
        };
        p.loadVideoById(playerState.currentVideoId, Math.max(0, expectedPos));
        if (!playerState.isPlaying) setTimeout(() => p.pauseVideo && p.pauseVideo(), 400);
      } else if (playerState.currentVideoId) {
        const current = p.getCurrentTime ? p.getCurrentTime() : 0;
        const drift = Math.abs(current - expectedPos);
        // Heartbeats update the shared position every few seconds. Do not
        // seek for those small changes: seeking causes visible stutter and
        // can replay a few seconds. Apply pause/play immediately, or correct
        // only when a real seek creates a large enough drift.
        if (explicitSeek) {
          remoteTargetRef.current = {
            playerState: playerState.isPlaying ? 1 : 2,
            isPlaying: playerState.isPlaying,
            positionSeconds: expectedPos
          };
          p.seekTo(Math.max(0, expectedPos), true);
        } else if (drift > RESYNC_DRIFT) {
          remoteTargetRef.current = {
            playerState: playerState.isPlaying ? 1 : 2,
            isPlaying: playerState.isPlaying,
            positionSeconds: expectedPos
          };
          p.seekTo(Math.max(0, expectedPos), true);
        }

        // Keep play/pause enforcement separate from position correction. A
        // pause update must pause even when the position is also corrected.
        if (playerState.isPlaying && (playbackModeChanged || p.getPlayerState() !== 1)) {
          remoteTargetRef.current = {
            playerState: 1,
            isPlaying: true,
            positionSeconds: expectedPos
          };
          p.playVideo();
        }
        if (!playerState.isPlaying && (playbackModeChanged || p.getPlayerState() === 1)) {
          remoteTargetRef.current = {
            playerState: 2,
            isPlaying: false,
            positionSeconds: expectedPos
          };
          p.pauseVideo();
        }
      }
    } catch {
      // player not fully ready for this call yet — next state tick will retry
    }

    lastAppliedEventRef.current = eventKey;
    lastAppliedStateRef.current = stateKey;
    lastAppliedPlayingRef.current = playerState.isPlaying;
    if (playerState.seekCommand) lastSeekCommandRef.current = playerState.seekCommand;
    setTimeout(() => { applyingRemoteRef.current = false; }, 1000);
  }, [playerState, ready]);

  // Poll local playback time for the seek bar UI.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (p && p.getCurrentTime) {
        try {
          setLocalTime(p.getCurrentTime());
          setDuration(p.getDuration() || 0);
        } catch {}
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Keep a host heartbeat so members joining late, buffering, or waking from
  // the background receive a recent playback position.
  useEffect(() => {
    if (!isHost || !ready) return undefined;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p || !window.YT) return;
      const state = p.getPlayerState();
      if (state !== window.YT.PlayerState.PLAYING) return;
      updatePlayerState(roomCode, {
        isPlaying: true,
        positionSeconds: p.getCurrentTime(),
        durationSeconds: p.getDuration() || 0,
        syncAction: "heartbeat"
      });
    }, HOST_SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [isHost, ready, roomCode]);

  const playItemNow = useCallback((item) => {
    updatePlayerState(roomCode, {
      currentVideoId: item.videoId,
      currentVideoTitle: item.title,
      isPlaying: true,
      positionSeconds: 0,
      durationSeconds: 0,
      syncAction: "video"
    });
  }, [roomCode]);

  const advanceToNext = useCallback(() => {
    setPlaylist((current) => {
      if (current.length === 0) return current;
      const idx = current.findIndex((it) => it.videoId === lastVideoIdRef.current);
      const next = current[idx + 1] || current[0];
      if (next) playItemNow(next);
      return current;
    });
  }, [playItemNow]);

  function handlePlayPause() {
    if (!isHostRef.current) return;
    const p = playerRef.current;
    if (!p) return;

    if (p.getPlayerState() === 1) {
      p.pauseVideo();
      updatePlayerState(roomCode, {
        isPlaying: false,
        positionSeconds: p.getCurrentTime(),
        syncAction: "pause"
      });
    } else {
      p.playVideo();
      updatePlayerState(roomCode, {
        isPlaying: true,
        positionSeconds: p.getCurrentTime(),
        syncAction: "play"
      });
    }
  }

  function handleSyncWithHost() {
    const p = playerRef.current;
    if (isHost || !p || !playerState?.currentVideoId) return;
    const updatedAt = playerState.updatedAt || Date.now();
    const hostPosition = playerState.isPlaying
      ? playerState.positionSeconds + (Date.now() - updatedAt) / 1000
      : playerState.positionSeconds;

    applyingRemoteRef.current = true;
    lastVideoIdRef.current = playerState.currentVideoId;
    remoteTargetRef.current = {
      playerState: playerState.isPlaying ? 1 : 2,
      isPlaying: Boolean(playerState.isPlaying),
      positionSeconds: hostPosition
    };
    p.loadVideoById(playerState.currentVideoId, Math.max(0, hostPosition));
    if (!playerState.isPlaying) setTimeout(() => p.pauseVideo && p.pauseVideo(), 400);
    setTimeout(() => { applyingRemoteRef.current = false; }, 1000);
  }

  // ratio: 0..1 position along the seek bar — used by both the big
  // transport bar and the mini floating player's progress bar.
  function handleSeekByRatio(ratio, commit = true) {
    if (!isHostRef.current) return;
    const p = playerRef.current;
    if (!isHost || !p || !duration) return;
    const target = ratio * duration;
    p.seekTo(target, true);
    setLocalTime(target);
    if (commit) {
      updatePlayerState(roomCode, {
        currentVideoId: playerState?.currentVideoId || "",
        currentVideoTitle: playerState?.currentVideoTitle || "",
        positionSeconds: target,
        durationSeconds: duration,
        isPlaying: playerState?.isPlaying ?? true,
        syncAction: "seek"
      });
    }
  }

  function handleNext() {
    if (playlist.length === 0) return;
    const idx = playlist.findIndex((it) => it.videoId === playerState?.currentVideoId);
    const next = playlist[(idx + 1) % playlist.length];
    if (next) playItemNow(next);
  }

  const value = {
    playerDivRef,
    playlist,
    playerState,
    localTime,
    duration,
    isHost,
    handlePlayPause,
    handleSyncWithHost,
    canAddVideo: isHost || Boolean(allowMembersToAddVideos) || Boolean(access.addVideo),
    handleSeekByRatio,
    handleNext,
    playItemNow,
    canEditOrder: Boolean(access.editOrder),
    canRemoveVideo: Boolean(access.removeVideo),
    canChangeVideo: Boolean(access.changeVideo),
    canControlPlayback: isHost
  };

  return <RoomPlayerContext.Provider value={value}>{children}</RoomPlayerContext.Provider>;
}

export function useRoomPlayer() {
  return useContext(RoomPlayerContext);
}
