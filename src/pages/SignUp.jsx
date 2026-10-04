import React, { useState } from "react";
import { signUp } from "../utils/roomRepository.js";

export default function SignUp({ onGoSignIn }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const usernameValid = /^[a-z0-9_]*$/.test(username);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!usernameValid || username.trim().length === 0) {
      setError("Username can only use letters, numbers, and underscores.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signUp({ name, username, email, password });
    } catch (err) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 20 }}>
        <button className="icon-btn" onClick={onGoSignIn} style={{ marginLeft: -6 }}>
          ← Create Account
        </button>
      </div>

      <div className="card">
        <h2>Join YouTube Jam</h2>
        <p className="sub">Create an account to host and watch videos with friends</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
            />
            <div className="hint">Only letters, numbers, and underscores (a-z, 0-9, _)</div>
          </div>
          <div className="field">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password (min 6 characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? <span className="spin" /> : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="btn-link" onClick={onGoSignIn}>
            Already have an account? Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
