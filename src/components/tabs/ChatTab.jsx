import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { observeChatMessages, sendChatMessage, observeAllRoomMembers } from "../../utils/roomRepository.js";

const PAGE_SIZE = 20;

function getAvatarGradient(str = "") {
  const gradients = [
    "linear-gradient(135deg, #ef4444, #f97316)",
    "linear-gradient(135deg, #8b5cf6, #ec4899)",
    "linear-gradient(135deg, #06b6d4, #3b82f6)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #ec4899, #f43f5e)"
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export default function ChatTab({ roomCode }) {
  const { user, profile } = useAuth();
  const [allMessages, setAllMessages] = useState([]);
  const [members, setMembers] = useState({});
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [text, setText] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  const chatScrollRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevScrollHeightRef = useRef(0);
  const prevScrollTopRef = useRef(0);
  const isPrependRef = useRef(false);

  // Subscribe to real-time chat & room members (for online status)
  useEffect(() => {
    setLoadError("");
    const unsubChat = observeChatMessages(roomCode, 500, (messages) => {
      setAllMessages(messages || []);
    }, (err) => {
      setLoadError(err.message || "Couldn't load chat messages.");
    });
    const unsubMembers = observeAllRoomMembers(roomCode, setMembers);

    return () => {
      unsubChat();
      unsubMembers();
    };
  }, [roomCode]);

  // Paginated visible slice of messages (newest `visibleLimit` messages)
  const displayedMessages = allMessages.slice(-visibleLimit);
  const hasMore = allMessages.length > visibleLimit;
  const remainingCount = allMessages.length - visibleLimit;

  // On first load, scroll to bottom without moving parent page
  useEffect(() => {
    if (displayedMessages.length > 0 && isInitialLoadRef.current) {
      const container = chatScrollRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      isInitialLoadRef.current = false;
    }
  }, [displayedMessages.length]);

  // Handle scroll position preservation when loading older messages
  useLayoutEffect(() => {
    if (isPrependRef.current) {
      const container = chatScrollRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const diff = newScrollHeight - prevScrollHeightRef.current;
        container.scrollTop = prevScrollTopRef.current + diff;
      }
      isPrependRef.current = false;
    }
  }, [displayedMessages.length]);

  // Auto-scroll when new messages arrive (only if already near bottom)
  const lastMessage = displayedMessages[displayedMessages.length - 1];
  useEffect(() => {
    if (isInitialLoadRef.current || isPrependRef.current) return;
    const container = chatScrollRef.current;
    if (!container) return;

    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
      setShowScrollBottomBtn(false);
    } else {
      setShowScrollBottomBtn(true);
    }
  }, [lastMessage?.messageId]);

  function handleScroll(e) {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    if (isAtBottom) {
      setShowScrollBottomBtn(false);
    }

    // Auto-paginate when scrolling near the top
    if (container.scrollTop < 24 && hasMore && !loadingMore) {
      handleLoadOlder();
    }
  }

  function handleLoadOlder() {
    if (!hasMore || loadingMore) return;
    const container = chatScrollRef.current;
    if (container) {
      prevScrollHeightRef.current = container.scrollHeight;
      prevScrollTopRef.current = container.scrollTop;
      isPrependRef.current = true;
    }

    setLoadingMore(true);
    setTimeout(() => {
      setVisibleLimit((prev) => Math.min(allMessages.length, prev + PAGE_SIZE));
      setLoadingMore(false);
    }, 120);
  }

  function scrollToBottom() {
    const container = chatScrollRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth"
      });
      setShowScrollBottomBtn(false);
    }
  }

  async function handleSend(e) {
    if (e) e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSendError("");
    const previous = text;
    setText("");
    setSending(true);

    try {
      await sendChatMessage(roomCode, value);
      // Ensure newly sent message is scrolled into view immediately
      setTimeout(() => {
        const container = chatScrollRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
          setShowScrollBottomBtn(false);
        }
      }, 50);
    } catch (err) {
      setText(previous);
      setSendError(err.message || "Message didn't send. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="tab-pane-content chat-pane">
      {loadError && <div className="error-alert">{loadError}</div>}

      {/* Messages Scroll View */}
      <div
        className="chat-messages-scroll"
        ref={chatScrollRef}
        onScroll={handleScroll}
      >
        {/* Load Older Messages Pill / Button */}
        {hasMore && (
          <div className="chat-pagination-bar">
            <button
              type="button"
              className="chat-load-older-btn"
              onClick={handleLoadOlder}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <span className="spin" style={{ width: 12, height: 12 }} />
                  <span>Loading history...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                  <span>Load older messages ({remainingCount} more)</span>
                </>
              )}
            </button>
          </div>
        )}

        {displayedMessages.length === 0 ? (
          <div className="empty-state-card chat-empty">
            <div className="empty-icon-circle">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h4>Welcome to Room Chat</h4>
            <p>Send a message! Everything you say syncs live with everyone watching.</p>
          </div>
        ) : (
          displayedMessages.map((m) => {
            const senderUid = m.uid || m.senderUid;
            const memberObj = members[senderUid];
            const mine = senderUid === user?.uid;
            const senderDisplayName =
              (mine && (profile?.name || user?.displayName)) ||
              memberObj?.name ||
              m.name ||
              m.senderName ||
              memberObj?.username ||
              m.username ||
              "Jammer";
            const avatarInitial = senderDisplayName.charAt(0).toUpperCase() || "?";
            const timeStr = m.timestamp
              ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            const isSenderOnline = mine ? true : Boolean(memberObj?.isOnline);

            return (
              <div key={m.messageId} className={`chat-message-row ${mine ? "mine" : "peer"}`}>
                <div
                  className="chat-avatar"
                  style={{ background: getAvatarGradient(senderDisplayName) }}
                  title={mine ? "You (Online)" : `${senderDisplayName} ${isSenderOnline ? "(Online)" : "(Offline)"}`}
                >
                  {avatarInitial}
                  {isSenderOnline && (
                    <span className="online-status-dot" title="Online" aria-label="Online" />
                  )}
                </div>
                <div className="chat-bubble-container">
                  {!mine && <div className="chat-sender-name">{senderDisplayName}</div>}
                  <div className="chat-message-bubble">
                    <span className="chat-text">{m.message}</span>
                  </div>
                  <div className="chat-time-tag">{timeStr}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Scroll to Bottom / New Messages Pill */}
      {showScrollBottomBtn && (
        <button
          type="button"
          className="chat-scroll-bottom-pill"
          onClick={scrollToBottom}
          aria-label="Scroll to newest messages"
        >
          <span>New messages ↓</span>
        </button>
      )}

      {sendError && <div className="error-alert chat-error-alert">{sendError}</div>}

      {/* Pinned Bottom Input Form */}
      <form className="chat-composer-row" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-composer-input"
          placeholder="Send a message to everyone..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <button
          className="chat-send-btn"
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send message"
        >
          {sending ? (
            <span className="spin" style={{ width: 14, height: 14 }} />
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
