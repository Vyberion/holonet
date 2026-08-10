"use client";

import React, { useState, useRef, useEffect } from "react";

const QUICK_PROMPTS = [
  "Query Citadel Statutes",
  "Look up personnel",
  "Check shift protocols",
  "Explain Powerbase structures"
];

export function AiChatWidget() {
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "INSPECTION LINK ESTABLISHED: I am the Holonet Operations & Logistics Overseer. State your administrative or personnel query."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/check-access")
      .then(res => res.json())
      .then(data => {
        if (active && data?.profile?.isSuperUser) {
          setIsSuperUser(true);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isSuperUser) return null;

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
          content: "ALERT: Subspace link failure. Holonet Overseer sub-processor is currently unreachable."
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      </button>

      {/* Floating Chat Container */}
      {isOpen && (
        <div className="ai-widget-container">
          {/* Header */}
          <div className="ai-widget-header">
            <div className="ai-widget-header-title">
              <div className="ai-widget-status-dot" />
              <div className="ai-widget-header-text">
                <h3>Holonet Overseer</h3>
                <span>CITADEL DIRECT LINK // ONLINE</span>
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
                {msg.content}
              </div>
            ))}

            {isLoading && (
              <div className="ai-message ai-message-assistant ai-typing-indicator">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="ai-quick-prompts">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button key={i} className="ai-prompt-chip" onClick={() => handleSendMessage(prompt)}>
                {prompt}
              </button>
            ))}
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
              placeholder="Transmit query to Overseer..."
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
