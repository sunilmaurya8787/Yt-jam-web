import React, { useState } from "react";
import { signUp } from "../utils/roomRepository.js";

export default function SignUp({ onGoSignIn }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    <div className="auth-viewport-screen">
      <div className="auth-card-container">
        {/* Top Back Link */}
        <div className="auth-nav-back">
          <button className="btn-link back-link" onClick={onGoSignIn}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Sign In</span>
          </button>
        </div>

        {/* Auth Glass Card */}
        <div className="auth-glass-card">
          <div className="auth-brand-icon-small">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join YouTube Jam to watch with friends and sync queues</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                required
              />
            </div>

            <div className="field-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                placeholder="alex_m"
                required
              />
              <span className="input-hint">Letters, numbers, and underscores only (a-z, 0-9, _)</span>
            </div>

            <div className="field-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                required
              />
            </div>

            <div className="field-group">
              <label>Password (min 6 chars)</label>
              <div className="input-with-icon">
                <svg className="field-leading-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => setShowPw(!showPw)}
                  title={showPw ? "Hide password" : "Show password"}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="error-alert">{error}</div>}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: 10 }}
            >
              {loading ? <span className="spin" /> : "Complete Registration →"}
            </button>
          </form>

          <div className="auth-card-footer">
            <span>Already have an account?</span>
            <button className="btn-link" onClick={onGoSignIn}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
