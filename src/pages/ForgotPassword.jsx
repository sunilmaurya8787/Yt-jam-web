import React, { useState } from "react";
import { resetPassword } from "../utils/roomRepository.js";

export default function ForgotPassword({ onGoSignIn }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send reset link. Verify your email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-viewport-screen">
      <div className="auth-card-container">
        <div className="auth-nav-back">
          <button className="btn-link back-link" onClick={onGoSignIn}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Sign In</span>
          </button>
        </div>

        <div className="auth-glass-card">
          <div className="auth-brand-icon-small">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2>Reset Password</h2>
          <p className="auth-subtitle">
            Enter your registered email address and we'll send you a link to reset your password.
          </p>

          {sent ? (
            <div className="success-state-box">
              <div className="success-check-icon">✓</div>
              <h4>Check Your Inbox</h4>
              <p>We sent a password reset link to <strong>{email}</strong>.</p>
              <button className="btn btn-outline" onClick={onGoSignIn} style={{ marginTop: 14 }}>
                Return to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="field-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoFocus
                />
              </div>

              {error && <div className="error-alert">{error}</div>}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ marginTop: 8 }}
              >
                {loading ? <span className="spin" /> : "Send Password Reset Link →"}
              </button>
            </form>
          )}

          <div className="auth-card-footer">
            <span>Remembered your password?</span>
            <button className="btn-link" onClick={onGoSignIn}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
