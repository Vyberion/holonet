"use client";

import React, { useState, useRef, useEffect } from "react";

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "LINK ESTABLISHED: I am H.O.L.O, the Holonet Operations and Logistics Overseer. State your query."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend) => {
    const query = String(textToSend || input).trim();
    if (!query || isLoading) return;

    const newMessages = [...messages, { role: "user", content: query }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        throw new Error("Transmission error");
      }

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.content || "Query received." }]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "ALERT: Subspace link failure. H.O.L.O sub-processor is currently unreachable."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        className="ai-widget-launcher"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Holonet Overseer Assistant"
        title="Holonet Operations & Logistics Overseer"
      >
        <div className="nav-link-corners" aria-hidden="true" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Floating Chat Container */}
      {isOpen && (
        <div className="ai-widget-container">
          <div className="ai-widget-corners" aria-hidden="true" />
          <div className="ai-widget-scanlines" aria-hidden="true" />

          {/* Header */}
          <div className="ai-widget-header">
            <div className="ai-widget-header-title">
              <div className="ai-widget-status-dot" />
              <div className="ai-widget-header-text">
                <h3>H.O.L.O</h3>
              </div>
            </div>
            <button className="ai-widget-close-btn" onClick={() => setIsOpen(false)} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Message Stream */}
          <div className="ai-widget-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ai-message-${msg.role}`}>
                {msg.role === "assistant" && <div className="ai-message-tag">H.O.L.O</div>}
                {msg.role === "user" && <div className="ai-message-tag">OPERATIVE</div>}
                {msg.content}
              </div>
            ))}

            {isLoading && (
              <div className="ai-message ai-message-assistant ai-typing-indicator">
                <div className="ai-message-tag">PROCESSING</div>
                <div className="ai-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            className="ai-widget-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              type="text"
              className="ai-widget-input"
              placeholder="Query H.O.L.O terminal..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="ai-widget-send-btn" disabled={isLoading || !input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
