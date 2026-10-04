import React, { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Lobby from "./pages/Lobby.jsx";
import Room from "./pages/Room.jsx";

function Shell() {
  const { user } = useAuth();
  const [authScreen, setAuthScreen] = useState("signin"); // signin | signup | forgot
  const [roomCode, setRoomCode] = useState(null);

  if (user === undefined) {
    return (
      <div className="screen">
        <div className="spin" style={{ width: 24, height: 24 }} />
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
