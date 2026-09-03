"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { DiscordMarkdown } from "../../../../../components/DiscordMarkdown.jsx";

const ITEM_TYPES = [
  { id: "legislation", label: "LEGISLATION", code: "[01]" },
  { id: "promotion", label: "PROMOTION", code: "[02]" },
  { id: "disciplinary", label: "TRIBUNAL", code: "[03]" },
  { id: "kaggath", label: "KAGGATH", code: "[04]" }
];

export default function DocketClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("agenda"); // "agenda" | "submissions"
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formType, setFormType] = useState("legislation");
  const [statusNotice, setStatusNotice] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    body: "",
    candidate: "",
    targetRank: "",
    accused: "",
    challenger: "",
    charges: "",
    evidenceUrl: "",
    kaggathStakes: "",
    proposedSanction: ""
  });

  useEffect(() => {
    if (statusNotice) {
      const timer = setTimeout(() => setStatusNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusNotice]);

  const loadData = async () => {
    try {
      const res = await fetch("/api/council-floor?view=docket");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load docket data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const permissions = data?.permissions || {};
  const isDarkCouncil = Boolean(permissions.canPropose || permissions.isSuperUser);
  const proposals = data?.proposals || [];

  const parseItemContent = (item) => {
    try {
      if (typeof item.body === "string" && item.body.trim().startsWith("{") && item.body.trim().endsWith("}")) {
        return JSON.parse(item.body);
      }
    } catch { }
    return { text: item.body };
  };

  // Filter proposals
  const docketItems = useMemo(() => {
    return proposals.filter(p => p.status === "docket" || p.storedStatus === "docket");
  }, [proposals]);

  const submissionItems = useMemo(() => {
    return proposals.filter(p => p.status === "submitted" || p.storedStatus === "submitted");
  }, [proposals]);

  const archiveItems = useMemo(() => {
    return proposals.filter(p => ["passed", "failed", "vetoed", "concluded"].includes(p.status));
  }, [proposals]);

  // Dark Council Actions
  const handleApproveToDocket = async (proposalId) => {
    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "docket_approve", proposalId })
      });
      const result = await res.json();
      if (result.ok) {
        setStatusNotice({ type: "success", message: "Proposal approved and placed on the Council Docket." });
        loadData();
      } else {
        setStatusNotice({ type: "error", message: result.reason || "Action failed." });
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const handleOpenToFloor = async (proposalId) => {
    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_floor", proposalId, durationHours: 48 })
      });
      const result = await res.json();
      if (result.ok) {
        setStatusNotice({ type: "success", message: "Item promoted to Council Floor voting session." });
        loadData();
      } else {
        setStatusNotice({ type: "error", message: result.reason || "Action failed." });
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const handleDismiss = async (proposalId) => {
    if (!window.confirm("Dismiss this proposal from the queue?")) return;
    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "veto", proposalId, reason: "Dismissed from docket review" })
      });
      const result = await res.json();
      if (result.ok) {
        setStatusNotice({ type: "success", message: "Proposal dismissed." });
        loadData();
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusNotice(null);

    const structuredPayload = {
      text: formData.body,
      category: formType,
      candidate: formData.candidate || null,
      targetRank: formData.targetRank || null,
      accused: formData.accused || null,
      challenger: formData.challenger || null,
      charges: formData.charges || null,
      evidenceUrl: formData.evidenceUrl || null,
      kaggathStakes: formData.kaggathStakes || null,
      proposedSanction: formData.proposedSanction || null
    };

    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          proposalType: formType,
          title: formData.title,
          body: JSON.stringify(structuredPayload),
          targetStatus: isDarkCouncil ? "docket" : "submitted"
        })
      });

      const json = await res.json().catch(() => ({}));
      if (json.ok) {
        setStatusNotice({
          type: "success",
          message: isDarkCouncil
            ? "Item added to the Council Floor queue."
            : "Proposal submitted successfully. Awaiting Dark Council review."
        });
        setIsSubmitOpen(false);
        setFormData({
          title: "",
          body: "",
          candidate: "",
          targetRank: "",
          accused: "",
          challenger: "",
          charges: "",
          evidenceUrl: "",
          kaggathStakes: "",
          proposedSanction: ""
        });
        setSelectedTab("agenda");
        loadData();
      } else {
        const errorReason = json.reason || json.error || json.detail || "Failed to submit proposal.";
        setStatusNotice({ type: "error", message: errorReason });
      }
    } catch (err) {
      setStatusNotice({ type: "error", message: `Transmission failure: ${err.message || "Network error"}` });
    } finally {
      setSubmitting(false);
    }
  };

  const currentDisplayList = useMemo(() => {
    let list = [];
    if (selectedTab === "agenda") list = docketItems;
    else if (selectedTab === "submissions") list = submissionItems;

    if (typeFilter !== "ALL") {
      list = list.filter(item => {
        const parsed = parseItemContent(item);
        const cat = parsed.category || item.proposalType;
        return String(cat).toLowerCase() === typeFilter.toLowerCase();
      });
    }
    return list;
  }, [selectedTab, docketItems, submissionItems, archiveItems, typeFilter]);

  return (
    <div className="hub-shell" style={{ paddingBottom: "4rem" }}>

      {/* Top Identity Hero (Matching Hub Hero Structure Exactly) */}
      <div className="hub-hero">
        <div className="hub-identity">
          <div>
            <span className="hub-kicker">Registry Node / DC-06 &bull; Docket</span>
            <h1 className="hub-title" style={{ margin: "8px 0 0" }}>COUNCIL DOCKET</h1>
          </div>
          <div>
            <span className="hub-kicker">Access Authority</span>
            <span className="hub-value">{permissions.role || (isDarkCouncil ? "Dark Councilor" : "Council Observer")}</span>
          </div>
        </div>

        <p className="hub-summary">
          Official meeting schedule, legislative proposals, promotion nominations, and hearing dockets.
        </p>

        {/* Meeting Status & Docket Metrics in standard Hub Status Grid */}
        <div className="hub-status-grid">
          <div className="hub-status-cell">
            <span className="hub-label">Next Session</span>
            <span className="hub-value">SCHEDULED</span>
          </div>
          <div className="hub-status-cell">
            <span className="hub-label">On Docket</span>
            <span className="hub-value">{docketItems.length}</span>
          </div>
          <div className="hub-status-cell">
            <span className="hub-label">In Review</span>
            <span className="hub-value">{submissionItems.length}</span>
          </div>
        </div>
      </div>

      {statusNotice && (
        <div style={{
          padding: "0.8rem 1.2rem",
          marginBottom: "1.5rem",
          background: statusNotice.type === "success" ? "rgba(53, 196, 111, 0.1)" : "rgba(192, 0, 26, 0.12)",
          border: `1px solid ${statusNotice.type === "success" ? "#35c46f" : "var(--theme-border-hot)"}`,
          color: statusNotice.type === "success" ? "#8affb2" : "#ff8080",
          fontFamily: "Share Tech Mono, monospace",
          fontSize: "0.85rem"
        }}>
          {statusNotice.message}
        </div>
      )}

      {/* Main Hierarchy-Style Tag Filter Strip */}
      <div className="hierarchy-tabs-shell" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div className="hierarchy-tab-strip" role="tablist" aria-label="Docket Views">
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === "agenda"}
              className={`hierarchy-tab${selectedTab === "agenda" ? " is-active" : ""}`}
              onClick={() => setSelectedTab("agenda")}
            >
              CURRENT DOCKET ({docketItems.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedTab === "submissions"}
              className={`hierarchy-tab${selectedTab === "submissions" ? " is-active" : ""}`}
              onClick={() => setSelectedTab("submissions")}
            >
              PROPOSALS QUEUE ({submissionItems.length})
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            {/* Quick Item Type Pill Filter */}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                style={{
                  background: typeFilter === "ALL" ? "rgba(168, 151, 134, 0.2)" : "transparent",
                  border: "1px solid var(--theme-border-hot)",
                  color: typeFilter === "ALL" ? "var(--theme-accent)" : "var(--text-dim)",
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.68rem",
                  fontFamily: "Share Tech Mono, monospace",
                  cursor: "pointer"
                }}
              >
                ALL
              </button>
              {ITEM_TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  style={{
                    background: typeFilter === t.id ? "rgba(168, 151, 134, 0.2)" : "transparent",
                    border: "1px solid var(--theme-border-hot)",
                    color: typeFilter === t.id ? "var(--theme-accent)" : "var(--text-dim)",
                    padding: "0.25rem 0.6rem",
                    fontSize: "0.68rem",
                    fontFamily: "Share Tech Mono, monospace",
                    cursor: "pointer"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Trigger Action Button */}
            <button
              type="button"
              onClick={() => setIsSubmitOpen(true)}
              style={{
                background: "rgba(168, 151, 134, 0.15)",
                border: "1px solid var(--theme-accent)",
                color: "var(--theme-accent)",
                padding: "0.45rem 1.1rem",
                fontFamily: "Orbitron, monospace",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: "0 0 10px var(--theme-accent-glow)"
              }}
            >
              + SUBMIT PROPOSAL
            </button>
          </div>
        </div>
      </div>

      {/* VIEW: Item List (Agenda or Submissions) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        {loading ? (
          <p style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", textAlign: "center", padding: "3rem" }}>
            Loading Council records...
          </p>
        ) : currentDisplayList.length === 0 ? (
          <div style={{
            padding: "3.5rem 1rem",
            textAlign: "center",
            border: "1px dashed var(--theme-border-hot)",
            background: "transparent"
          }}>
            <p style={{ fontFamily: "Orbitron, monospace", fontSize: "0.95rem", fontWeight: 700, color: "var(--theme-accent)", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
              No Records Found
            </p>
            <p style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
              {selectedTab === "agenda" ? "Submit a proposal or approve items from the queue." : "Submit a proposal or approve items from the queue."}
            </p>
          </div>
        ) : (
          currentDisplayList.map(item => {
            const parsed = parseItemContent(item);
            const cat = (parsed.category || item.proposalType || "legislation").toLowerCase();

            const typeBadge = {
              legislation: { label: "LEGISLATION", color: "var(--theme-accent)" },
              promotion: { label: "PROMOTION HEARING", color: "#e3a857" },
              disciplinary: { label: "DISCIPLINARY HEARING", color: "#ff5252" },
              kaggath: { label: "KAGGATH HEARING", color: "#c0ab98" }
            }[cat] || { label: "PROPOSAL", color: "var(--theme-accent)" };

            return (
              <div
                key={item.id}
                style={{
                  background: "linear-gradient(135deg, rgba(168, 151, 134, 0.05) 0%, transparent 60%), #1c1814",
                  border: "1px solid var(--theme-border-hot)",
                  padding: "1.5rem",
                  position: "relative"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.8rem", marginBottom: "0.8rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.6rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem" }}>
                      <span style={{
                        fontFamily: "Share Tech Mono, monospace",
                        fontSize: "0.7rem",
                        color: typeBadge.color,
                        background: "rgba(0,0,0,0.5)",
                        border: `1px solid ${typeBadge.color}`,
                        padding: "0.15rem 0.5rem",
                        letterSpacing: "0.1em"
                      }}>
                          // {typeBadge.label}
                      </span>
                      <span style={{
                        fontFamily: "Share Tech Mono, monospace",
                        fontSize: "0.7rem",
                        color: "var(--text-dim)",
                        background: "rgba(0,0,0,0.3)",
                        padding: "0.15rem 0.4rem"
                      }}>
                        STATUS: {String(item.status || "DOCKET").toUpperCase()}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.05rem", fontWeight: 700, color: "var(--theme-accent)", margin: 0, letterSpacing: "0.03em" }}>
                      {item.title}
                    </h3>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-dim)" }}>
                      Author / Sponsor: {item.createdByName || "Councilor"}
                    </span>
                    <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-faint)" }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>

                {/* Summary / Metadata Details */}
                {parsed.summary && (
                  <div style={{ background: "rgba(168, 151, 134, 0.06)", borderLeft: "3px solid var(--theme-accent)", padding: "0.8rem 1rem", marginBottom: "1rem", fontStyle: "italic", color: "var(--text-bright)" }}>
                    <DiscordMarkdown content={parsed.summary} />
                  </div>
                )}

                {/* Specific Hearing Highlights */}
                {cat === "promotion" && parsed.candidate && (
                  <div style={{ display: "flex", gap: "1.5rem", background: "rgba(0,0,0,0.3)", padding: "0.6rem 1rem", border: "1px solid var(--theme-border-hot)", marginBottom: "1rem", fontSize: "0.8rem", fontFamily: "Share Tech Mono, monospace" }}>
                    <span>Candidate: <strong style={{ color: "var(--theme-accent)" }}>{parsed.candidate}</strong></span>
                    <span>Target Rank: <strong style={{ color: "#e3a857" }}>{parsed.targetRank || "Not Specified"}</strong></span>
                  </div>
                )}

                {cat === "disciplinary" && parsed.accused && (
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", background: "rgba(255, 82, 82, 0.05)", padding: "0.6rem 1rem", border: "1px solid rgba(255, 82, 82, 0.2)", marginBottom: "1rem", fontSize: "0.8rem", fontFamily: "Share Tech Mono, monospace" }}>
                    <span>Accused: <strong style={{ color: "#ff8080" }}>{parsed.accused}</strong></span>
                    {parsed.proposedSanction && <span>Sanction: <strong style={{ color: "var(--text-bright)" }}>{parsed.proposedSanction}</strong></span>}
                    {parsed.evidenceUrl && <a href={parsed.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--theme-accent)", textDecoration: "underline" }}>View Evidence Log</a>}
                  </div>
                )}

                {cat === "kaggath" && (parsed.challenger || parsed.accused) && (
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", background: "rgba(168, 151, 134, 0.08)", padding: "0.6rem 1rem", border: "1px solid var(--theme-border-hot)", marginBottom: "1rem", fontSize: "0.8rem", fontFamily: "Share Tech Mono, monospace" }}>
                    <span>Challenger: <strong style={{ color: "var(--theme-accent)" }}>{parsed.challenger || "Unknown"}</strong></span>
                    <span style={{ color: "var(--text-faint)" }}>VS</span>
                    <span>Rival: <strong style={{ color: "#ff8080" }}>{parsed.accused || "Unknown"}</strong></span>
                    {parsed.kaggathStakes && <span>Stakes: <strong style={{ color: "var(--text-bright)" }}>{parsed.kaggathStakes}</strong></span>}
                  </div>
                )}

                <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.88rem", lineHeight: "1.6", color: "var(--text-bright)", maxHeight: "180px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  <DiscordMarkdown content={parsed.text || item.body} />
                </div>

                {/* Dark Council Action Panel */}
                {isDarkCouncil && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem", marginTop: "1.2rem", paddingTop: "0.8rem", borderTop: "1px solid var(--border)" }}>
                    {selectedTab === "submissions" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDismiss(item.id)}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text-dim)",
                            padding: "0.35rem 0.8rem",
                            fontSize: "0.72rem",
                            fontFamily: "Orbitron, monospace",
                            cursor: "pointer"
                          }}
                        >
                          DISMISS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveToDocket(item.id)}
                          style={{
                            background: "rgba(168, 151, 134, 0.2)",
                            border: "1px solid var(--theme-accent)",
                            color: "var(--theme-accent)",
                            padding: "0.35rem 0.9rem",
                            fontSize: "0.72rem",
                            fontFamily: "Orbitron, monospace",
                            cursor: "pointer"
                          }}
                        >
                          APPROVE TO DOCKET
                        </button>
                      </>
                    )}

                    {selectedTab === "agenda" && (
                      <button
                        type="button"
                        onClick={() => handleFastTrackFloor(item.id)}
                        style={{
                          background: "rgba(168, 151, 134, 0.25)",
                          border: "1px solid var(--theme-accent)",
                          color: "var(--theme-accent)",
                          padding: "0.4rem 1rem",
                          fontSize: "0.72rem",
                          fontFamily: "Orbitron, monospace",
                          cursor: "pointer",
                          boxShadow: "0 0 8px var(--theme-accent-glow)"
                        }}
                      >
                        FAST-TRACK TO FLOOR →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* POPUP MODAL: Submit Council Proposal */}
      {isSubmitOpen && (
        <div
          className="codex-modal-backdrop active"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: "1rem"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSubmitOpen(false);
          }}
        >
          <div
            className="codex-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-proposal-title"
            style={{
              width: "min(780px, calc(100vw - 32px))",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#161310",
              border: "1px solid var(--theme-border-hot)",
              boxShadow: "0 0 40px rgba(0,0,0,0.9)",
              position: "relative"
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--theme-border-hot)",
              background: "rgba(0,0,0,0.4)"
            }}>
              <div>
                <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--theme-accent)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Council Docket // Protocol DC-06
                </span>
                <h2 id="submit-proposal-title" style={{ fontFamily: "Orbitron, monospace", fontSize: "1.15rem", fontWeight: 700, color: "var(--theme-accent)", margin: "0.2rem 0 0", letterSpacing: "0.05em" }}>
                  SUBMIT COUNCIL PROPOSAL
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--theme-border-hot)",
                  color: "var(--theme-accent)",
                  fontSize: "1.2rem",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  lineHeight: 1
                }}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem" }}>
              {/* Type Selector Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem", marginBottom: "1.5rem" }}>
                {ITEM_TYPES.map(t => {
                  const active = formType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormType(t.id)}
                      style={{
                        background: active ? "rgba(168, 151, 134, 0.2)" : "rgba(0,0,0,0.35)",
                        border: `1px solid ${active ? "var(--theme-accent)" : "var(--theme-border-hot)"}`,
                        padding: "0.8rem 1rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        textAlign: "left"
                      }}
                    >
                      <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: active ? "var(--theme-accent)" : "var(--text-dim)" }}>
                        {t.code}
                      </span>
                      <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.78rem", fontWeight: 700, color: active ? "var(--theme-accent)" : "var(--text-bright)" }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmitProposal}>
                {/* Title */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                    PROPOSAL TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Make Arcalis members Kill On Sight..."
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.8rem",
                      background: "#110e0b",
                      border: "1px solid var(--theme-border-hot)",
                      color: "var(--text-bright)",
                      fontFamily: "Orbitron, monospace",
                      fontSize: "0.9rem"
                    }}
                  />
                </div>

                {/* Specific Fields by Type */}
                {formType === "promotion" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                        CANDIDATE USERNAME *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.candidate}
                        onChange={e => setFormData({ ...formData, candidate: e.target.value })}
                        placeholder="e.g., xDarthArctis"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "#110e0b",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text-bright)",
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                        TARGET RANK / OFFICE *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.targetRank}
                        onChange={e => setFormData({ ...formData, targetRank: e.target.value })}
                        placeholder="e.g., Dark Council / Warmaster"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "#110e0b",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text-bright)",
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                  </div>
                )}

                {formType === "disciplinary" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "#ff8080", marginBottom: "0.4rem" }}>
                          ACCUSED SITH USERNAME *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.accused}
                          onChange={e => setFormData({ ...formData, accused: e.target.value })}
                          placeholder="e.g., TraitorousDog"
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.8rem",
                            background: "#110e0b",
                            border: "1px solid rgba(255, 82, 82, 0.4)",
                            color: "var(--text-bright)",
                            fontFamily: "Share Tech Mono, monospace",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                          PROPOSED SANCTION
                        </label>
                        <select
                          value={formData.proposedSanction}
                          onChange={e => setFormData({ ...formData, proposedSanction: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.8rem",
                            background: "#110e0b",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text-bright)",
                            fontFamily: "Share Tech Mono, monospace",
                            fontSize: "0.85rem"
                          }}
                        >
                          <option value="Demotion in Rank">Demotion in Rank</option>
                          <option value="Probational Inactivity / Watch">Probational Inactivity / Watch</option>
                          <option value="Official Demerits & Warning">Official Demerits & Warning</option>
                          <option value="Sphere Resource Fine">Sphere Resource Fine</option>
                          <option value="Chamber Censure">Chamber Censure</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                          PRIMARY CHARGES (SUMMARY)
                        </label>
                        <input
                          type="text"
                          value={formData.charges}
                          onChange={e => setFormData({ ...formData, charges: e.target.value })}
                          placeholder="e.g., Treason, Insubordination, dereliction..."
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.8rem",
                            background: "#110e0b",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text-bright)",
                            fontFamily: "Share Tech Mono, monospace",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                          EVIDENCE LOG LINK (OPTIONAL)
                        </label>
                        <input
                          type="url"
                          value={formData.evidenceUrl}
                          onChange={e => setFormData({ ...formData, evidenceUrl: e.target.value })}
                          placeholder="https://..."
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.8rem",
                            background: "#110e0b",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text-bright)",
                            fontFamily: "Share Tech Mono, monospace",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {formType === "kaggath" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        CHALLENGER (CLAIMANT) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.challenger}
                        onChange={e => setFormData({ ...formData, challenger: e.target.value })}
                        placeholder="e.g., TraitorousDog"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "#110e0b",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text-bright)",
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "#ff8080", marginBottom: "0.4rem" }}>
                        RIVAL (TARGET OF CHALLENGE) *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.accused}
                        onChange={e => setFormData({ ...formData, accused: e.target.value })}
                        placeholder="e.g., xDarthArctis"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "#110e0b",
                          border: "1px solid rgba(255, 82, 82, 0.4)",
                          color: "var(--text-bright)",
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>
                  </div>
                )}

                {formType === "kaggath" && (
                  <div style={{ marginBottom: "1.2rem" }}>
                    <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                      STAKES OF THE KAGGATH (POWERBASE / SPHERE JURISDICTION / EXILE)
                    </label>
                    <input
                      type="text"
                      value={formData.kaggathStakes}
                      onChange={e => setFormData({ ...formData, kaggathStakes: e.target.value })}
                      placeholder="e.g., Relinquishment of all Korriban military assets to victor..."
                      style={{
                        width: "100%",
                        padding: "0.65rem 0.8rem",
                        background: "#110e0b",
                        border: "1px solid var(--theme-border-hot)",
                        color: "var(--text-bright)",
                        fontFamily: "Share Tech Mono, monospace",
                        fontSize: "0.85rem"
                      }}
                    />
                  </div>
                )}

                {/* Description Body */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.4rem" }}>
                    FULL PROPOSAL DESCRIPTION / MOTION TEXT *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.body}
                    onChange={e => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Enter full legislative clauses, hearing testimony, or petition details (Markdown supported)..."
                    style={{
                      width: "100%",
                      padding: "0.8rem",
                      background: "#110e0b",
                      border: "1px solid var(--theme-border-hot)",
                      color: "var(--text-bright)",
                      fontFamily: "Share Tech Mono, monospace",
                      fontSize: "0.85rem",
                      lineHeight: "1.5"
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsSubmitOpen(false)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--theme-border-hot)",
                      color: "var(--text-dim)",
                      padding: "0.6rem 1.4rem",
                      fontFamily: "Orbitron, monospace",
                      fontSize: "0.8rem",
                      cursor: "pointer"
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: "rgba(168, 151, 134, 0.2)",
                      border: "1px solid var(--theme-accent)",
                      color: "var(--theme-accent)",
                      padding: "0.6rem 1.5rem",
                      fontFamily: "Orbitron, monospace",
                      fontSize: "0.8rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                      boxShadow: "0 0 10px var(--theme-accent-glow)"
                    }}
                  >
                    {submitting ? "SUBMITTING..." : isDarkCouncil ? "ADD TO DOCKET" : "SUBMIT PROPOSAL"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
