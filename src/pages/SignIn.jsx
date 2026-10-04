import React, { useState } from "react";
import { signIn } from "../utils/roomRepository.js";

const PlayIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);

export default function SignIn({ onGoSignUp, onGoForgot }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div className="brand-hero">
        <div className="icon"><PlayIcon /></div>
        <h1>YouTube Jam</h1>
        <p>Synchronized watch parties with friends</p>
      </div>

      <div className="card">
        <h2>Sign In</h2>
        <p className="sub">Enter your credentials to enter the jam lobby</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div style={{ textAlign: "right", marginBottom: 16 }}>
            <button type="button" className="btn-link" onClick={onGoForgot}>
              Forgot Password?
            </button>
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: error ? 14 : 0 }}>
            {loading ? <span className="spin" /> : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <button className="btn btn-outline" type="button" onClick={onGoSignUp}>
            Create a New Account
          </button>
        </div>
      </div>
    </div>
  );
}
