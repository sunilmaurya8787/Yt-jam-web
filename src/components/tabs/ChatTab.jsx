import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { observeChatMessages, sendChatMessage } from "../../utils/roomRepository.js";

export default function ChatTab({ roomCode }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    setLoadError("");
    return observeChatMessages(roomCode, 200, setMessages, (err) => {
      setLoadError(err.message || "Couldn't load chat messages.");
    });
  }, [roomCode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSendError("");
    const previous = text;
    setText("");
    try {
      await sendChatMessage(roomCode, value);
    } catch (err) {
      setText(previous); // restore what they typed so it isn't silently lost
      setSendError(err.message || "Message didn't send — check your connection and try again.");
    }
  }

  return (
    <div className="chat-tab-container">
      {loadError && <div className="error-text" style={{ marginBottom: 10 }}>{loadError}</div>}

      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="empty-block">
            Say hi to everyone in the Jam! Messages sent here sync in real-time with all room members.
          </div>
        ) : (
          messages.map((m) => {
            const senderUid = m.uid || m.senderUid;
            const senderName = m.username || m.senderName || "User";
            const mine = senderUid === user?.uid;
            return (
              <div key={m.messageId} className={`chat-bubble ${mine ? "mine" : ""}`}>
                {!mine && <div className="u">@{senderName}</div>}
                <div className="msg">{m.message}</div>
                <div className="t">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {sendError && <div className="error-text" style={{ marginBottom: 6 }}>{sendError}</div>}

      <form className="chat-input-row" onSubmit={handleSend}>
        <input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="send-btn" type="submit" disabled={!text.trim()}>➤</button>
      </form>
    </div>
  );
}
