import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Lobby from "./pages/Lobby.jsx";
import Room from "./pages/Room.jsx";
import { validateActiveRoom } from "./utils/roomRepository.js";

function Shell() {
  const { user } = useAuth();
  const [authScreen, setAuthScreen] = useState("signin"); // signin | signup | forgot
  const [roomCode, setRoomCode] = useState(null);
  const [isCheckingActive, setIsCheckingActive] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsCheckingActive(false);
      return;
    }

    let isMounted = true;
    setIsCheckingActive(true);

    validateActiveRoom(user.uid)
      .then((active) => {
        if (!isMounted) return;
        if (active && active.roomCode) {
          setRoomCode(active.roomCode);
        }
      })
      .catch((err) => {
        console.error("Auto-join check failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsCheckingActive(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (user === undefined || (user && isCheckingActive && !roomCode)) {
    return (
      <div className="room-loading-screen">
        <div className="spin" style={{ width: 32, height: 32 }} />
        {isCheckingActive && (
          <p style={{ marginTop: 14, color: "var(--text-dim)", fontSize: 14 }}>
            Checking your active Jam...
          </p>
        )}
      </div>
    );
  }

  if (!user) {
    if (authScreen === "signup") return <SignUp onGoSignIn={() => setAuthScreen("signin")} />;
    if (authScreen === "forgot") return <ForgotPassword onGoSignIn={() => setAuthScreen("signin")} />;
    return (
      <SignIn
        onGoSignUp={() => setAuthScreen("signup")}
        onGoForgot={() => setAuthScreen("forgot")}
      />
    );
  }

  if (roomCode) {
    return <Room roomCode={roomCode} onBackToLobby={() => setRoomCode(null)} />;
  }

  return <Lobby onEnterRoom={setRoomCode} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
