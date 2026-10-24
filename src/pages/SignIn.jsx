import React, { useState } from "react";
import { signIn } from "../utils/roomRepository.js";

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
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-viewport-screen">
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-brand-hero">
          <div className="auth-brand-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1>YouTube Jam</h1>
          <p>Synchronized watch parties with your friends</p>
        </div>

        {/* Auth Glass Card */}
        <div className="auth-glass-card">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to join or host synchronized watch rooms</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <svg className="field-leading-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label>Password</label>
                <button
                  type="button"
                  className="btn-link inline-link"
                  onClick={onGoForgot}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-with-icon">
                <svg className="field-leading-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
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
              style={{ marginTop: 8 }}
            >
              {loading ? <span className="spin" /> : "Sign In to Jam"}
            </button>
          </form>

          <div className="auth-card-footer">
            <span>Don't have an account?</span>
            <button className="btn-link" onClick={onGoSignUp}>
              Create one for free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
