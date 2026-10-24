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
  onDisconnect
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

  // Enforce maximum 5 active rooms limit per user via 5 slots (0 to 4)
  const createdSnap = await get(ref(db, `users/${user.uid}/createdRooms`));
  const currentSlots = createdSnap.val() || {};
  let freeSlot = null;
  const now = Date.now();

  for (let i = 0; i < 5; i++) {
    const s = String(i);
    const existingCode = currentSlots[s];
    if (!existingCode) {
      freeSlot = s;
      break;
    }
    // Check if the room currently in this slot was deleted or has expired
    const rMetaSnap = await get(ref(db, `rooms/${existingCode}/meta`));
    if (!rMetaSnap.exists()) {
      freeSlot = s;
      break;
    }
    const exp = Number(rMetaSnap.val()?.expiresAt) || 0;
    if (exp !== 0 && now >= exp) {
      freeSlot = s;
      break;
    }
  }

  if (freeSlot === null) {
    throw new Error("You have reached the maximum limit of 5 active rooms. Please delete an existing room to create a new one.");
  }

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

    // Pre-allocate the slot in users/$uid/createdRooms/$freeSlot so security rules validate the room creation
    await set(ref(db, `users/${user.uid}/createdRooms/${freeSlot}`), code);

    const claimed = await claimRoomMeta(code, meta);
    if (!claimed) {
      await remove(ref(db, `users/${user.uid}/createdRooms/${freeSlot}`)).catch(() => {});
      continue;
    }

    const hostMember = {
      name: hostName,
      username: hostUsername,
      isHost: true,
      isOnline: true,
      lastSeen: Date.now(),
      joinedAt: Date.now(),
      permissions: {
        editOrder: true,
        removeVideo: true,
        changeVideo: true
      }
    };

    try {
      await set(ref(db, `rooms/${code}/members/${user.uid}`), hostMember);
      await setActiveRoom(user.uid, code);
      await set(ref(db, `users/${user.uid}/hostedRoomCode`), code);
      return code;
    } catch (e) {
      await remove(ref(db, `rooms/${code}`)).catch(() => {});
      await remove(ref(db, `users/${user.uid}/createdRooms/${freeSlot}`)).catch(() => {});
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
  const blockedSnap = await get(ref(db, `rooms/${code}/blocklist/${user.uid}`)).catch(() => null);
  if (blockedSnap && blockedSnap.exists()) {
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

  const existingMemberSnap = await get(ref(db, `rooms/${code}/members/${user.uid}`));
  const existingMember = existingMemberSnap.exists() ? existingMemberSnap.val() : null;
  const isHost = meta.hostUid === user.uid;
  const existingPerms = existingMember?.permissions || {};

  const member = {
    name: memberName,
    username: memberUsername,
    isHost,
    isOnline: true,
    lastSeen: Date.now(),
    joinedAt: existingMember?.joinedAt || Date.now(),
    permissions: {
      editOrder: isHost ? true : Boolean(existingPerms.editOrder),
      removeVideo: isHost ? true : Boolean(existingPerms.removeVideo),
      changeVideo: isHost ? true : Boolean(existingPerms.changeVideo),
    }
  };

  await set(ref(db, `rooms/${code}/members/${user.uid}`), member);
  await setActiveRoom(user.uid, code);
  return code;
}

// ---- Active Room & Hosted Room Tracking on Firebase ----

export async function getActiveRoom(uid) {
  if (!uid) return null;
  const snap = await get(ref(db, `users/${uid}/activeRoom`));
  return snap.exists() ? snap.val() : null;
}

export async function setActiveRoom(uid, code) {
  if (!uid || !code) return;
  await set(ref(db, `users/${uid}/activeRoom`), {
    roomCode: String(code),
    joinedAt: Date.now()
  });
}

export async function clearActiveRoom(uid) {
  if (!uid) return;
  await remove(ref(db, `users/${uid}/activeRoom`));
}

export async function validateActiveRoom(uid) {
  if (!uid) return null;
  const active = await getActiveRoom(uid);
  if (!active || !active.roomCode) return null;

  const code = active.roomCode;
  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) {
    await clearActiveRoom(uid);
    return null;
  }

  const meta = metaSnap.val();
  if (meta.expiresAt && meta.expiresAt !== 0 && Date.now() >= meta.expiresAt) {
    await clearActiveRoom(uid);
    return null;
  }

  const blockedSnap = await get(ref(db, `rooms/${code}/blocklist/${uid}`)).catch(() => null);
  if (blockedSnap && blockedSnap.exists()) {
    await clearActiveRoom(uid);
    return null;
  }

  // Ensure member record exists if user didn't leave
  const memberSnap = await get(ref(db, `rooms/${code}/members/${uid}`));
  if (!memberSnap.exists()) {
    const profile = await getUserProfile(uid);
    const user = auth.currentUser;
    const isHost = meta.hostUid === uid;
    const member = {
      name: profile?.name || user?.displayName || (isHost ? "Host" : "Member"),
      username: profile?.username || (user?.email ? user.email.split("@")[0] : "user"),
      isHost,
      isOnline: true,
      lastSeen: Date.now(),
      joinedAt: active.joinedAt || Date.now(),
      permissions: {
        editOrder: isHost,
        removeVideo: isHost,
        changeVideo: isHost,
      }
    };
    await set(ref(db, `rooms/${code}/members/${uid}`), member).catch(() => {});
  }

  return { roomCode: code, meta };
}

export async function deleteRoom(code) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to delete a room.");

  const metaSnap = await get(ref(db, `rooms/${code}/meta`));
  if (!metaSnap.exists()) {
    await clearActiveRoom(user.uid);
    await remove(ref(db, `users/${user.uid}/hostedRoomCode`)).catch(() => {});
    // Clear slot or key matching code
    const sSnap = await get(ref(db, `users/${user.uid}/createdRooms`));
    if (sSnap.exists()) {
      for (const [slot, val] of Object.entries(sSnap.val())) {
        if (val === code || slot === code) {
          await remove(ref(db, `users/${user.uid}/createdRooms/${slot}`)).catch(() => {});
        }
      }
    }
    return;
  }

  const meta = metaSnap.val();
  if (meta?.hostUid !== user.uid) {
    throw new Error("Only the room creator can delete this room.");
  }

  // Delete the room node (authorized by rule: data.child('meta/hostUid').val() == auth.uid)
  await remove(ref(db, `rooms/${code}`));
  await clearActiveRoom(user.uid);
  await remove(ref(db, `users/${user.uid}/hostedRoomCode`)).catch(() => {});

  // Free up the slot in users/$uid/createdRooms
  const sSnap = await get(ref(db, `users/${user.uid}/createdRooms`));
  if (sSnap.exists()) {
    for (const [slot, val] of Object.entries(sSnap.val())) {
      if (val === code || slot === code) {
        await remove(ref(db, `users/${user.uid}/createdRooms/${slot}`)).catch(() => {});
      }
    }
  }
}

export function observeUserCreatedRooms(uid, callback) {
  if (!uid) {
    callback([]);
    return () => {};
  }

  const createdRef = ref(db, `users/${uid}/createdRooms`);
  const roomListeners = new Map();
  const roomsData = new Map();

  function emit() {
    const now = Date.now();
    const list = Array.from(roomsData.values())
      .filter((r) => r.expiresAt === 0 || now < r.expiresAt)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  }

  const unsubCreated = onValue(createdRef, async (snap) => {
    const val = snap.val() || {};
    // Extract codes from slot values or direct map
    let codes = Object.entries(val)
      .map(([k, v]) => (typeof v === "string" ? v : k))
      .filter((c) => /^\d{5}$/.test(c));

    // Fallback: If createdRooms is empty, check hostedRoomCode to recover single room
    if (codes.length === 0) {
      try {
        const hostedSnap = await get(ref(db, `users/${uid}/hostedRoomCode`));
        if (hostedSnap.exists()) {
          const hCode = hostedSnap.val();
          if (/^\d{5}$/.test(hCode)) {
            const hMetaSnap = await get(ref(db, `rooms/${hCode}/meta`));
            if (hMetaSnap.exists() && hMetaSnap.val()?.hostUid === uid) {
              const exp = Number(hMetaSnap.val()?.expiresAt) || 0;
              if (exp === 0 || Date.now() < exp) {
                codes = [hCode];
                set(ref(db, `users/${uid}/createdRooms/0`), hCode).catch(() => {});
              }
            }
          }
        }
      } catch {
        // ignore fallback errors
      }
    }

    // Remove listeners for codes no longer present
    for (const [existingCode, unsubFn] of roomListeners.entries()) {
      if (!codes.includes(existingCode)) {
        unsubFn();
        roomListeners.delete(existingCode);
        roomsData.delete(existingCode);
      }
    }

    if (codes.length === 0) {
      emit();
      return;
    }

    for (const code of codes) {
      if (!roomListeners.has(code)) {
        const metaRef = ref(db, `rooms/${code}/meta`);
        const membersRef = ref(db, `rooms/${code}/members`);
        let currentMeta = null;
        let memberCount = 0;

        function updateRoomEntry() {
          if (!currentMeta) {
            roomsData.delete(code);
            emit();
            return;
          }
          const now = Date.now();
          const expiresAt = Number(currentMeta.expiresAt) || 0;
          if (expiresAt !== 0 && now >= expiresAt) {
            roomsData.delete(code);
            emit();
            return;
          }
          roomsData.set(code, {
            roomCode: code,
            name: currentMeta.name || `Jam #${code}`,
            description: currentMeta.description || "",
            expiresAt,
            createdAt: currentMeta.createdAt || 0,
            maxMembers: Number(currentMeta.maxMembers) || 20,
            memberCount
          });
          emit();
        }

        const metaListener = onValue(metaRef, (mSnap) => {
          if (!mSnap.exists()) {
            // Room meta was deleted -> room no longer exists! Clean slot from createdRooms
            currentMeta = null;
            get(ref(db, `users/${uid}/createdRooms`)).then((sSnap) => {
              if (sSnap.exists()) {
                for (const [slot, sVal] of Object.entries(sSnap.val())) {
                  if (sVal === code || slot === code) {
                    remove(ref(db, `users/${uid}/createdRooms/${slot}`)).catch(() => {});
                  }
                }
              }
            }).catch(() => {});
            updateRoomEntry();
            return;
          }
          currentMeta = mSnap.val();
          updateRoomEntry();
        }, (err) => {
          console.warn(`[observeUserCreatedRooms] meta error for ${code}:`, err);
        });

        const membersListener = onValue(membersRef, (memSnap) => {
          const memVal = memSnap.val() || {};
          memberCount = memVal && typeof memVal === "object" ? Object.keys(memVal).length : 0;
          if (currentMeta) {
            updateRoomEntry();
          }
        }, (err) => {
          console.warn(`[observeUserCreatedRooms] members error for ${code}:`, err);
        });

        roomListeners.set(code, () => {
          off(metaRef, "value", metaListener);
          off(membersRef, "value", membersListener);
        });
      }
    }
    emit();
  });

  return () => {
    for (const unsub of roomListeners.values()) {
      unsub();
    }
    roomListeners.clear();
    roomsData.clear();
    off(createdRef, "value", unsubCreated);
  };
}

export function observeUserRoomStatus(uid, callback) {
  if (!uid) {
    callback(null);
    return () => {};
  }

  const activeRef = ref(db, `users/${uid}/activeRoom`);
  const hostedRef = ref(db, `users/${uid}/hostedRoomCode`);

  let activeMetaUnsub = null;
  let hostedMetaUnsub = null;
  let activeCode = null;
  let hostedCode = null;
  let activeData = null;
  let hostedData = null;

  function pushUpdate() {
    callback({
      activeRoom: activeData,
      hostedRoom: hostedData
    });
  }

  function listenActiveMeta(code) {
    if (activeMetaUnsub) {
      activeMetaUnsub();
      activeMetaUnsub = null;
    }
    if (!code) {
      activeData = null;
      pushUpdate();
      return;
    }
    const metaRef = ref(db, `rooms/${code}/meta`);
    const membersRef = ref(db, `rooms/${code}/members`);
    activeMetaUnsub = onValue(metaRef, async (snap) => {
      if (!snap.exists()) {
        clearActiveRoom(uid).catch(() => {});
        activeData = null;
        pushUpdate();
        return;
      }
      const meta = snap.val();
      if (meta.expiresAt && meta.expiresAt !== 0 && Date.now() >= meta.expiresAt) {
        clearActiveRoom(uid).catch(() => {});
        activeData = null;
        pushUpdate();
        return;
      }
      const membersSnap = await get(membersRef);
      const members = membersSnap.val() || {};
      const memberCount = Object.keys(members).length;
      activeData = {
        roomCode: code,
        meta,
        isHost: meta.hostUid === uid,
        memberCount
      };
      pushUpdate();
    });
  }

  function listenHostedMeta(code) {
    if (hostedMetaUnsub) {
      hostedMetaUnsub();
      hostedMetaUnsub = null;
    }
    if (!code) {
      hostedData = null;
      pushUpdate();
      return;
    }
    const metaRef = ref(db, `rooms/${code}/meta`);
    const membersRef = ref(db, `rooms/${code}/members`);
    hostedMetaUnsub = onValue(metaRef, async (snap) => {
      if (!snap.exists()) {
        remove(ref(db, `users/${uid}/hostedRoomCode`)).catch(() => {});
        hostedData = null;
        pushUpdate();
        return;
      }
      const meta = snap.val();
      if (meta.expiresAt && meta.expiresAt !== 0 && Date.now() >= meta.expiresAt) {
        // Room expired
        hostedData = {
          roomCode: code,
          meta,
          isExpired: true,
          memberCount: 0
        };
        pushUpdate();
        return;
      }
      const membersSnap = await get(membersRef);
      const members = membersSnap.val() || {};
      const memberCount = Object.keys(members).length;
      hostedData = {
        roomCode: code,
        meta,
        isExpired: false,
        memberCount
      };
      pushUpdate();
    });
  }

  const unsubActive = onValue(activeRef, (snap) => {
    activeCode = snap.val()?.roomCode || null;
    listenActiveMeta(activeCode);
  });

  const unsubHosted = onValue(hostedRef, (snap) => {
    hostedCode = snap.val() || null;
    listenHostedMeta(hostedCode);
  });

  return () => {
    if (activeMetaUnsub) activeMetaUnsub();
    if (hostedMetaUnsub) hostedMetaUnsub();
    off(activeRef, "value", unsubActive);
    off(hostedRef, "value", unsubHosted);
  };
}

export function trackRoomPresence(code, uid) {
  if (!code || !uid) return () => {};

  const connectedRef = ref(db, ".info/connected");
  const memberOnlineRef = ref(db, `rooms/${code}/members/${uid}/isOnline`);
  const memberLastSeenRef = ref(db, `rooms/${code}/members/${uid}/lastSeen`);

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // Automatically mark offline on server disconnect (tab close, crash, network loss)
      onDisconnect(memberOnlineRef).set(false).catch(() => {});
      onDisconnect(memberLastSeenRef).set(serverTimestamp()).catch(() => {});

      // Set online
      set(memberOnlineRef, true).catch(() => {});
    }
  });

  return () => {
    unsub();
    set(memberOnlineRef, false).catch(() => {});
    set(memberLastSeenRef, serverTimestamp()).catch(() => {});
    onDisconnect(memberOnlineRef).cancel().catch(() => {});
    onDisconnect(memberLastSeenRef).cancel().catch(() => {});
  };
}

export async function leaveRoom(code) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in.");
  await remove(ref(db, `rooms/${code}/members/${user.uid}`)).catch(() => {});
  await clearActiveRoom(user.uid);
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

export function observeChatMessages(code, limit = 500, callback, onError) {
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
      callback(limit ? messages.slice(-limit) : messages);
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
  const name = profile?.name || user.displayName || username;

  const chatRef = push(ref(db, `rooms/${code}/chat`));
  await set(chatRef, {
    uid: user.uid,
    username,
    name,
    message: trimmed,
    timestamp: serverTimestamp()
  });
}
