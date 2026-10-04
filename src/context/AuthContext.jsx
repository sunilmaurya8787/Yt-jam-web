import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, off, ref } from "firebase/database";
import { auth, db } from "../firebase.js";
import { getUserProfile } from "../utils/roomRepository.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomCreationOpenToAll, setRoomCreationOpenToAll] = useState(false);

  useEffect(() => {
    let stopAdmin;
    let stopConfig;

    const unsub = onAuthStateChanged(auth, async (u) => {
      stopAdmin?.();
      stopConfig?.();
      setUser(u);
      if (u) {
        const p = await getUserProfile(u.uid);
        setProfile(p);
        const adminRef = ref(db, `admins/${u.uid}`);
        const configRef = ref(db, "config/roomCreationOpenToAll");
        const adminListener = onValue(adminRef, (snap) => setIsAdmin(snap.val() === true));
        const configListener = onValue(configRef, (snap) => setRoomCreationOpenToAll(snap.val() === true));
        stopAdmin = () => off(adminRef, "value", adminListener);
        stopConfig = () => off(configRef, "value", configListener);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setRoomCreationOpenToAll(false);
      }
    });
    return () => {
      stopAdmin?.();
      stopConfig?.();
      unsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, isAdmin, roomCreationOpenToAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

