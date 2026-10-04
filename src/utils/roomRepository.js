// Mirrors the Kotlin RoomRepository 1:1 against the same RTDB paths and
// the same field names as Models.kt, so the web and Android clients read
// and write data the same way.
import { db, auth } from "../firebase.js";
import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  runTransaction,
  serverTimestamp,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
}

async function claimUsername(username, uid) {
  // Rules only allow claiming a username that doesn't exist yet, or
  // re-writing your own — matches the "usernames" rule in database.rules.json.
  await set(ref(db, `usernames/${username}`), uid);
}

export async function signUp({ name, username, email, password }) {
  const cleanUsername = username.trim().toLowerCase();

  const existing = await get(ref(db, `usernames/${cleanUsername}`));
  if (existing.exists()) {
    throw new Error("That username is already taken.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const uid = cred.user.uid;

  await updateProfile(cred.user, { displayName: name.trim() });

  await set(ref(db, `users/${uid}`), {
    name: name.trim(),
    username: cleanUsername,
    email: email.trim(),
    createdAt: Date.now()
  });

  await claimUsername(cleanUsername, uid);

  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export function signOutUser() {
  return auth.signOut();
}

export async function setRoomCreationOpenToAll(value) {
  await set(ref(db, "config/roomCreationOpenToAll"), Boolean(value));
}

// ---- Rooms ----

async function claimRoomMeta(code, meta) {
  const metaRef = ref(db, `rooms/${code}/meta`);
  const result = await runTransaction(metaRef, (current) => {
    if (current !== null) return; // abort — code already taken
    return meta;
  });
  return result.committed;
}

export async function createRoom({ name, description, maxMembers, expiresAt }) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to create a Jam.");
  const cleanName = name.trim();
  const cleanDescription = description.trim();
  const capacity = Number(maxMembers);
  if (!cleanName) throw new Error("Please enter a room name.");
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) {
    throw new Error("Room capacity must be between 2 and 100.");
  }
  const expiry = Number(expiresAt) || 0;
  if (expiry !== 0 && expiry <= Date.now()) throw new Error("Expiry must be in the future.");

  const profile = await getUserProfile(user.uid);
  const hostName = profile?.name || user.displayName || "Host";
  const hostUsername = profile?.username || (user.email ? user.email.split("@")[0] : "host");

  for (let attempts = 0; attempts < 5; attempts++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const meta = {
      hostUid: user.uid,
      hostUsername,
      createdAt: Date.now(),
      name: cleanName,
      description: cleanDescription,
      allowMembersToAddVideos: false,
      maxMembers: capacity,
      expiresAt: expiry
    };

    const claimed = await claimRoomMeta(code, meta);
    if (!claimed) continue;

    const hostMember = {
      name: hostName,
      username: hostUsername,
      isHost: true,
      joinedAt: Date.now(),
      permissions: {
        editOrder: true,
        removeVideo: true,
        changeVideo: true
      }
    };

    try {
      await set(ref(db, `rooms/${code}/members/${user.uid}`), hostMember);
      return code;
    } catch (e) {
      await remove(ref(db, `rooms/${code}`)).catch(() => {});
      throw new Error(e.message || "Failed to initialize Jam room.");
    }
  }

  throw new Error("Unable to generate a unique room code. Please try again.");
}

export async function joinRoom(rawCode) {
  const code = rawCode.trim();
  if (!/^\d{5}$/.test(code)) {
    throw new Error("Please enter a valid 5-digit room code.");
  }

  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to join a Jam.");

  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) {
    throw new Error("Room not found.");
  }
  const meta = metaSnap.val();
  if (meta.expiresAt && meta.expiresAt !== 0 && Date.now() >= meta.expiresAt) {
    throw new Error("This room has expired.");
  }
  const blockedSnap = await get(ref(db, `rooms/${code}/blocklist/${user.uid}`));
  if (blockedSnap.exists()) {
    throw new Error("You are blocked from this room.");
  }

  const membersSnap = await get(ref(db, `rooms/${code}/members`));
  const members = membersSnap.val();
  const memberCount = members && typeof members === "object" ? Object.keys(members).length : 0;
  if (!membersSnap.child(user.uid).exists() && memberCount >= (Number(meta.maxMembers) || 20)) {
    throw new Error("This room is full.");
  }

  const profile = await getUserProfile(user.uid);
  const memberName = profile?.name || user.displayName || "Member";
  const memberUsername = profile?.username || (user.email ? user.email.split("@")[0] : "member");

  const member = {
    name: memberName,
    username: memberUsername,
    isHost: false,
    joinedAt: Date.now(),
    permissions: {
      editOrder: false,
      removeVideo: false,
      changeVideo: false,
    }
  };

  await set(ref(db, `rooms/${code}/members/${user.uid}`), member);
  return code;
}

export async function leaveRoom(code) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  await remove(ref(db, `rooms/${code}/members/${user.uid}`));
}

export async function kickAndBlockMember(code, memberUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");

  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) throw new Error("Room not found.");
  if (metaSnap.val()?.hostUid !== user.uid) {
    throw new Error("Only the room host can kick and block members.");
  }

  const memberSnap = await get(ref(db, `rooms/${code}/members/${memberUid}`));
  const member = memberSnap.exists() ? memberSnap.val() : null;
  const profileSnap = await get(ref(db, `users/${memberUid}`));
  const profile = profileSnap.exists() ? profileSnap.val() : null;

  const blockEntry = {
    uid: memberUid,
    name: profile?.name || member?.name || "Member",
    username: profile?.username || member?.username || "member",
    blockedByUid: user.uid,
    blockedAt: Date.now()
  };

  await remove(ref(db, `rooms/${code}/members/${memberUid}`));
  await set(ref(db, `rooms/${code}/blocklist/${memberUid}`), blockEntry);
}

export async function unblockMemberFromRoom(code, memberUid) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");

  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) throw new Error("Room not found.");
  if (metaSnap.val()?.hostUid !== user.uid) {
    throw new Error("Only the room host can unblock members.");
  }

  await remove(ref(db, `rooms/${code}/blocklist/${memberUid}`));
}

export function observeRoomMeta(code, callback) {
  const metaRef = ref(db, `rooms/${code}/meta`);
  const listener = onValue(metaRef, (snap) => callback(snap.val()));
  return () => off(metaRef, "value", listener);
}

export async function updateRoomMeta(code, patch) {
  const changes = {};
  if (typeof patch.name === "string") changes.name = patch.name.trim();
  if (typeof patch.description === "string") changes.description = patch.description.trim();
  if (typeof patch.allowMembersToAddVideos === "boolean") {
    changes.allowMembersToAddVideos = patch.allowMembersToAddVideos;
  }
  await update(ref(db, `rooms/${code}/meta`), changes);
}

export function observeAllRoomMembers(code, callback) {
  const membersRef = ref(db, `rooms/${code}/members`);
  const listener = onValue(membersRef, (snap) => callback(snap.val() || {}));
  return () => off(membersRef, "value", listener);
}

export function observeRoomBlocklist(code, callback) {
  const blocklistRef = ref(db, `rooms/${code}/blocklist`);
  const listener = onValue(blocklistRef, (snap) => callback(snap.val() || {}));
  return () => off(blocklistRef, "value", listener);
}

export async function updateMemberPermission(code, memberUid, key, value) {
  await update(ref(db, `rooms/${code}/members/${memberUid}/permissions`), { [key]: value });
}

async function assertRoomActive(code) {
  const snap = await get(ref(db, `rooms/${code}/meta/expiresAt`));
  const expiresAt = Number(snap.val()) || 0;
  if (expiresAt !== 0 && Date.now() >= expiresAt) throw new Error("This room has expired.");
}

// ---- Playlist ----

export async function addVideoToPlaylist(code, videoUrlOrId, extractId, fetchTitle, thumbUrl) {
  await assertRoomActive(code);
  const videoId = extractId(videoUrlOrId);
  if (!videoId) throw new Error("Invalid YouTube URL. Please enter a valid YouTube video link.");

  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to add videos.");

  const profile = await getUserProfile(user.uid);
  const addedByUsername = profile?.username || (user.email ? user.email.split("@")[0] : "member");

  const title = await fetchTitle(videoId);
  const thumbnailUrl = thumbUrl(videoId);

  const playlistRef = ref(db, `rooms/${code}/playlist`);
  const snap = await get(playlistRef);
  let maxOrder = 0;
  snap.forEach((child) => {
    const item = child.val();
    if (item.order > maxOrder) maxOrder = item.order;
  });

  const newRef = push(playlistRef);
  const newItem = {
    id: newRef.key,
    videoId,
    title,
    thumbnailUrl,
    addedByUid: user.uid,
    addedByUsername,
    addedAt: Date.now(),
    order: maxOrder + 1
  };
  await set(newRef, newItem);
  return newItem;
}

export function observePlaylist(code, callback, onError) {
  const playlistRef = ref(db, `rooms/${code}/playlist`);
  const listener = onValue(
    playlistRef,
    (snap) => {
      const items = [];
      snap.forEach((child) => {
        const value = child.val();
        if (value && typeof value === "object" && !Array.isArray(value)) {
          items.push({ ...value, id: value.id || child.key });
        }
      });
      items.sort((a, b) => (a.order || 0) - (b.order || 0) || (a.addedAt || 0) - (b.addedAt || 0));
      callback(items);
    },
    (err) => {
      console.error("Playlist listener error:", err);
      if (onError) onError(err);
    }
  );
  return () => off(playlistRef, "value", listener);
}

export async function removePlaylistItem(code, itemId) {
  await assertRoomActive(code);
  await remove(ref(db, `rooms/${code}/playlist/${itemId}`));
}

export async function reorderPlaylistItem(code, itemId, newOrder) {
  await assertRoomActive(code);
  await update(ref(db, `rooms/${code}/playlist/${itemId}`), { order: newOrder });
}

// ---- Player state (sync) ----

export function observePlayerState(code, callback) {
  const stateRef = ref(db, `rooms/${code}/playerState`);
  const listener = onValue(stateRef, (snap) => callback(snap.val()));
  return () => off(stateRef, "value", listener);
}

export async function updatePlayerState(code, patch) {
  await assertRoomActive(code);
  const user = auth.currentUser;
  const payload = {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: user ? user.uid : ""
  };
  if (patch.syncAction === "seek") {
    payload.seekCommand = Date.now();
  }
  if (patch.syncAction === "seek") {
    console.info("[PlaybackSync] web seek write started", {
      path: `rooms/${code}/playerState`,
      positionSeconds: patch.positionSeconds,
      seekCommand: payload.seekCommand,
      isPlaying: patch.isPlaying,
      at: new Date().toISOString()
    });
  }
  await update(ref(db, `rooms/${code}/playerState`), payload);
  if (patch.syncAction === "seek") {
    console.info("[PlaybackSync] web seek write completed", {
      path: `rooms/${code}/playerState`,
      positionSeconds: patch.positionSeconds,
      seekCommand: payload.seekCommand,
      at: new Date().toISOString()
    });
  }
}

// ---- Chat ----

export function observeChatMessages(code, limit = 200, callback, onError) {
  // Read the complete chat node. Android clients can write records with a
  // null server timestamp briefly, which makes an ordered RTDB query omit or
  // reorder messages while the server resolves it.
  const chatRef = ref(db, `rooms/${code}/chat`);
  const listener = onValue(
    chatRef,
    (snap) => {
      const messages = [];
      snap.forEach((child) => {
        const value = child.val();
        if (value && typeof value === "object" && !Array.isArray(value)) {
          messages.push({ ...value, messageId: value.messageId || child.key });
        }
      });
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      callback(messages.slice(-limit));
    },
    (err) => {
      console.error("Chat listener error:", err);
      if (onError) onError(err);
    }
  );
  return () => off(chatRef, "value", listener);
}

export async function sendChatMessage(code, text) {
  await assertRoomActive(code);
  const trimmed = text.trim();
  if (!trimmed) return;
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to send messages.");

  const profile = await getUserProfile(user.uid);
  const username = profile?.username || user.displayName || (user.email ? user.email.split("@")[0] : "user");

  const chatRef = push(ref(db, `rooms/${code}/chat`));
  await set(chatRef, {
    uid: user.uid,
    username,
    message: trimmed,
    timestamp: serverTimestamp()
  });
}
