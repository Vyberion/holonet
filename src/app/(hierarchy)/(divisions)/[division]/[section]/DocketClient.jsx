"use client";

import React, { useState, useEffect, useMemo } from "react";
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

  const handleSubmitPetition = async (e) => {
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
    <div className="council-floor-shell" style={{ maxWidth: "1160px", margin: "0 auto", paddingBottom: "4rem" }}>

      {/* Top Identity Hero */}
      <div className="hub-hero" style={{ borderBottom: "1px solid var(--theme-border-hot)", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--theme-accent)", letterSpacing: "0.26em", textTransform: "uppercase" }}>
              Registry Node / DC-06 &bull; Docket
            </span>
            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "clamp(2rem, 5vw, 3.8rem)", color: "var(--theme-accent)", margin: "0.4rem 0", textShadow: "0 0 20px var(--theme-accent-glow)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              COUNCIL DOCKET
            </h1>
            <p style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.85rem", margin: 0, maxWidth: "680px", lineHeight: "1.65" }}>
              Official meeting schedule, legislative proposals, promotion nominations, and hearing dockets.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Access Authority
            </span>
            <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.95rem", fontWeight: 700, color: "var(--theme-accent)", textShadow: "0 0 8px var(--theme-accent-glow)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {permissions.role || (isDarkCouncil ? "Dark Councilor" : "Council Observer")}
            </span>
          </div>
        </div>

        {/* Next Session Broadcast Banner */}
        <div style={{
          marginTop: "1.5rem",
          background: "linear-gradient(135deg, rgba(168, 151, 134, 0.08) 0%, rgba(22, 19, 16, 0.95) 100%)",
          border: "1px solid var(--theme-border-hot)",
          padding: "1rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--theme-accent)", boxShadow: "0 0 8px var(--theme-accent-glow)" }} />
              <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.8rem", color: "var(--theme-accent)", letterSpacing: "0.15em" }}>
                NEXT COUNCIL MEETING: SCHEDULED
              </span>
            </div>
            <p style={{ margin: 0, fontFamily: "Share Tech Mono, monospace", fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Items approved to the docket will be addressed during this meeting.
            </p>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ textAlign: "center", padding: "0.4rem 0.8rem", background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)" }}>
              <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-accent)" }}>{docketItems.length}</span>
              <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase" }}>On Docket</span>
            </div>
            <div style={{ textAlign: "center", padding: "0.4rem 0.8rem", background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)" }}>
              <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-accent-soft)" }}>{submissionItems.length}</span>
              <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase" }}>In Review</span>
            </div>
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
              {selectedTab === "agenda" ? "The Council docket is currently empty. Submit a proposal or approve items from the queue." : "No matching items located in this queue."}
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
                    <div
                      key={t.id}
                      onClick={() => setFormType(t.id)}
                      style={{
                        background: active ? "rgba(168, 151, 134, 0.18)" : "rgba(0,0,0,0.35)",
                        border: `1px solid ${active ? "var(--theme-accent)" : "var(--theme-border-hot)"}`,
                        padding: "0.8rem 1rem",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: active ? "var(--theme-accent)" : "var(--text-dim)" }}>
                        {t.code}
                      </span>
                      <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.78rem", fontWeight: 700, color: active ? "var(--theme-accent)" : "var(--text-bright)" }}>
                        {t.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSubmitPetition}>
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                    TITLE *
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
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid var(--theme-border-hot)",
                      color: "var(--text)",
                      fontFamily: "inherit",
                      fontSize: "0.9rem"
                    }}
                  />
                </div>

                {/* Specific Fields */}
                {formType === "promotion" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        CANDIDATE *
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
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        NEW RANK *
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
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                  </div>
                )}

                {formType === "disciplinary" && (
                  <div style={{ marginBottom: "1.2rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                          ACCUSED *
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
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text)",
                            fontFamily: "inherit",
                            fontSize: "0.9rem"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                          EVIDENCE (OPTIONAL)
                        </label>
                        <input
                          type="url"
                          value={formData.evidenceUrl}
                          onChange={e => setFormData({ ...formData, evidenceUrl: e.target.value })}
                          placeholder="https://..."
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.8rem",
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text)",
                            fontFamily: "inherit",
                            fontSize: "0.9rem"
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        CHARGES *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.charges}
                        onChange={e => setFormData({ ...formData, charges: e.target.value })}
                        placeholder="e.g., Insubordination during Combat Training"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                  </div>
                )}

                {formType === "kaggath" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        ACCUSER *
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
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        ACCUSED *
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
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                        TERMS *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.kaggathStakes}
                        onChange={e => setFormData({ ...formData, kaggathStakes: e.target.value })}
                        placeholder="e.g., Complete assimilation of the loser's sphere resources and exile"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.8rem",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-border-hot)",
                          color: "var(--text)",
                          fontFamily: "inherit",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--theme-accent)", marginBottom: "0.4rem" }}>
                    DESCRIPTION *
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={formData.body}
                    onChange={e => setFormData({ ...formData, body: e.target.value })}
                    placeholder="Full text of the proposal..."
                    style={{
                      width: "100%",
                      padding: "0.65rem 0.8rem",
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid var(--theme-border-hot)",
                      color: "var(--text)",
                      fontFamily: "inherit",
                      fontSize: "0.88rem",
                      lineHeight: "1.6"
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
        </div>
      )}
    </div>
  );
}
