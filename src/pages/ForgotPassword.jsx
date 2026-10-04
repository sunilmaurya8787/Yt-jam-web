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
      setError(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen">
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 20 }}>
        <button className="icon-btn" onClick={onGoSignIn} style={{ marginLeft: -6 }}>
          ← Reset Password
        </button>
      </div>

      <div className="card">
        <h2>Forgot Password</h2>
        <p className="sub">Enter your registered email address and we'll send you a password reset link</p>

        {sent ? (
          <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 14, marginBottom: 10 }}>
            Reset link sent — check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? <span className="spin" /> : "Send Reset Link"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button className="btn-link" onClick={onGoSignIn}>Back to Sign In</button>
        </div>
      </div>
    </div>
  );
}
