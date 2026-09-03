"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DiscordMarkdown } from "../../../../../components/DiscordMarkdown.jsx";

export default function FloorClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("active"); // "active" | "queue" | "records"
  const [activeItemId, setActiveItemId] = useState(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [voteOpinion, setVoteOpinion] = useState("");
  const [sanctionChoice, setSanctionChoice] = useState("demotion");
  const [statusNotice, setStatusNotice] = useState(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState({});

  const toggleHistoryItem = (id) => {
    setExpandedHistoryIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    if (statusNotice) {
      const timer = setTimeout(() => setStatusNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusNotice]);

  const loadData = async () => {
    try {
      const res = await fetch("/api/council-floor?view=floor");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load floor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Live poll for active votes
    return () => clearInterval(interval);
  }, []);

  const permissions = data?.permissions || {};
  const isDarkCouncil = Boolean(permissions.canVote || permissions.isSuperUser);
  const proposals = data?.proposals || [];

  const parseItemContent = (item) => {
    try {
      if (typeof item.body === "string" && item.body.trim().startsWith("{") && item.body.trim().endsWith("}")) {
        return JSON.parse(item.body);
      }
    } catch { }
    return { text: item.body };
  };

  // Open proposals currently on the floor
  const activeFloorItems = useMemo(() => {
    return proposals.filter(p => p.status === "open");
  }, [proposals]);

  // Items queued on docket
  const queuedDocketItems = useMemo(() => {
    return proposals.filter(p => p.status === "docket" || p.storedStatus === "docket");
  }, [proposals]);

  // Concluded votes
  const recordedItems = useMemo(() => {
    return proposals.filter(p => ["passed", "failed", "vetoed", "concluded"].includes(p.status));
  }, [proposals]);

  // Active item selected for detailed view
  const activeItem = useMemo(() => {
    if (activeItemId) {
      const found = proposals.find(p => p.id === activeItemId);
      if (found) return found;
    }
    return activeFloorItems[0] || queuedDocketItems[0] || recordedItems[0] || null;
  }, [activeItemId, proposals, activeFloorItems, queuedDocketItems, recordedItems]);

  const handleCastVote = async (proposalId, voteType) => {
    setSubmittingVote(true);
    setStatusNotice(null);

    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          proposalId,
          vote: voteType,
          comment: voteOpinion || (sanctionChoice ? `Sanction recommendation: ${sanctionChoice}` : "")
        })
      });
      const json = await res.json();
      if (json.ok) {
        setStatusNotice({ type: "success", message: `Vote recorded: ${voteType.toUpperCase()}` });
        setVoteOpinion("");
        loadData();
      } else {
        setStatusNotice({ type: "error", message: json.reason || "Vote registration failed." });
      }
    } catch (err) {
      setStatusNotice({ type: "error", message: "Network transmission failure." });
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleAdjournItem = async (proposalId, finalStatus) => {
    if (!confirm(`Conclude floor deliberation on this item with status: ${finalStatus.toUpperCase()}?`)) return;
    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "veto", proposalId, reason: `Adjourned as ${finalStatus}` })
      });
      const result = await res.json();
      if (result.ok) {
        setStatusNotice({ type: "success", message: "Deliberation concluded and recorded." });
        loadData();
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  const handleOpenItemToFloor = async (proposalId) => {
    try {
      const res = await fetch("/api/council-floor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_floor", proposalId, durationHours: 48 })
      });
      const result = await res.json();
      if (result.ok) {
        setStatusNotice({ type: "success", message: "Item brought to the active Council Floor." });
        setActiveItemId(proposalId);
        setSelectedTab("active");
        loadData();
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  return (
    <div className="council-floor-shell" style={{ maxWidth: "1160px", margin: "0 auto", paddingBottom: "4rem" }}>

      {/* Top Chamber Hero */}
      <div className="hub-hero" style={{ borderBottom: "1px solid var(--theme-border-hot)", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--theme-accent)", letterSpacing: "0.26em", textTransform: "uppercase" }}>
              Registry Node / DC-06
            </span>
            <h1 style={{ fontFamily: "Cinzel, serif", fontSize: "clamp(2rem, 5vw, 3.8rem)", color: "var(--theme-accent)", margin: "0.4rem 0", textShadow: "0 0 20px var(--theme-accent-glow)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              COUNCIL FLOOR
            </h1>
            <p style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.85rem", margin: 0, maxWidth: "680px", lineHeight: "1.65" }}>
              Dark Council voting and legislation.
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Authority
            </span>
            <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.95rem", fontWeight: 700, color: "var(--theme-accent)", textShadow: "0 0 8px var(--theme-accent-glow)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {permissions.role || (isDarkCouncil ? "Dark Councilor" : "Council Observer")}
            </span>
          </div>
        </div>

        {/* Quorum & Active Chamber State Bar */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <span style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: activeFloorItems.length > 0 ? "var(--theme-accent)" : "#555",
              boxShadow: activeFloorItems.length > 0 ? "0 0 10px var(--theme-accent-glow)" : "none"
            }} />
            <div>
              <span style={{ fontFamily: "Orbitron, monospace", fontSize: "0.85rem", color: "var(--theme-accent)", letterSpacing: "0.12em" }}>
                {activeFloorItems.length > 0 ? "● FLOOR ACTIVE" : "○ FLOOR ADJOURNED"}
              </span>
              <p style={{ margin: "0.15rem 0 0", fontFamily: "Share Tech Mono, monospace", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                {activeFloorItems.length > 0
                  ? `${activeFloorItems.length} active motion currently on the Council floor.`
                  : "No active motions currently on the floor."}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <div style={{ textAlign: "center", padding: "0.4rem 0.8rem", background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)" }}>
              <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-accent)" }}>
                {data?.roleSnapshot?.countingEligibleCount || 12}
              </span>
              <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Chamber Seats</span>
            </div>
            <div style={{ textAlign: "center", padding: "0.4rem 0.8rem", background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)" }}>
              <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "1.1rem", fontWeight: 700, color: "var(--theme-accent-soft)" }}>
                {data?.roleSnapshot?.majorityCount || 7}
              </span>
              <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Majority Quorum</span>
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
        <div className="hierarchy-tab-strip" role="tablist" aria-label="Floor Views">
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === "active"}
            className={`hierarchy-tab${selectedTab === "active" ? " is-active" : ""}`}
            onClick={() => setSelectedTab("active")}
          >
            ACTIVE FLOOR ({activeFloorItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === "queue"}
            className={`hierarchy-tab${selectedTab === "queue" ? " is-active" : ""}`}
            onClick={() => setSelectedTab("queue")}
          >
            FLOOR QUEUE ({queuedDocketItems.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={selectedTab === "records"}
            className={`hierarchy-tab${selectedTab === "records" ? " is-active" : ""}`}
            onClick={() => setSelectedTab("records")}
          >
            RECORDED VOTES ({recordedItems.length})
          </button>
        </div>
      </div>

      {/* VIEW: Active Floor Deliberation & Voting */}
      {selectedTab === "active" ? (
        activeFloorItems.length === 0 ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center", border: "1px dashed var(--theme-border-hot)" }}>
            <p style={{ fontFamily: "Orbitron, monospace", fontSize: "1.05rem", fontWeight: 700, color: "var(--theme-accent)", margin: "0 0 0.5rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              The Floor is Currently Adjourned
            </p>
            <p style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.85rem", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto 1.5rem" }}>
              No items are currently active for live voting. Review the Floor Queue to bring a scheduled docket item before the chamber.
            </p>
            {queuedDocketItems.length > 0 && isDarkCouncil && (
              <button
                type="button"
                onClick={() => handleOpenItemToFloor(queuedDocketItems[0].id)}
                style={{
                  background: "rgba(168, 151, 134, 0.2)",
                  border: "1px solid var(--theme-accent)",
                  color: "var(--theme-accent)",
                  padding: "0.5rem 1.2rem",
                  fontFamily: "Orbitron, monospace",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  boxShadow: "0 0 10px var(--theme-accent-glow)"
                }}
              >
                OPEN NEXT ITEM ({queuedDocketItems[0].title.slice(0, 30)}...) →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {activeFloorItems.map(item => {
              const parsed = parseItemContent(item);
              const cat = (parsed.category || item.proposalType || "legislation").toLowerCase();
              const counts = item.counts || { yes: 0, no: 0, abstain: 0 };
              const majority = item.majorityCount || 7;
              const totalVotes = (counts.yes || 0) + (counts.no || 0) + (counts.abstain || 0);
              const passProgress = Math.min(100, Math.round(((counts.yes || 0) / majority) * 100));

              return (
                <div
                  key={item.id}
                  style={{
                    background: "linear-gradient(135deg, rgba(168, 151, 134, 0.08) 0%, transparent 65%), #1c1814",
                    border: "1px solid var(--theme-accent)",
                    boxShadow: "0 0 25px rgba(168, 151, 134, 0.12), inset 0 0 20px rgba(168, 151, 134, 0.03)",
                    padding: "2rem",
                    position: "relative"
                  }}
                >
                  {/* Top Header & Item Categorization */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.2rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
                        <span style={{
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.72rem",
                          color: "var(--theme-accent)",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid var(--theme-accent)",
                          padding: "0.2rem 0.6rem",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase"
                        }}>
                          // {cat}
                        </span>
                        <span style={{
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.7rem",
                          color: "#8affb2",
                          background: "rgba(53, 196, 111, 0.12)",
                          border: "1px solid #35c46f",
                          padding: "0.15rem 0.5rem"
                        }}>
                          ● VOTING IN PROGRESS
                        </span>
                      </div>
                      <h2 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.25rem", fontWeight: 700, color: "var(--theme-accent)", margin: 0, textShadow: "0 0 8px var(--theme-accent-glow)", letterSpacing: "0.05em" }}>
                        {item.title}
                      </h2>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        Sponsor: <strong style={{ color: "var(--theme-accent)" }}>{item.createdByName || "Dark Council"}</strong>
                      </span>
                      <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-faint)" }}>
                        Closes: {item.closesAt ? new Date(item.closesAt).toLocaleString() : "Upon Quorum"}
                      </span>
                    </div>
                  </div>

                  {/* Hearing / Motion Highlight Box */}
                  {cat === "promotion" && parsed.candidate && (
                    <div style={{ display: "flex", gap: "2rem", background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)", padding: "1rem 1.25rem", marginBottom: "1.5rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.9rem" }}>
                      <span>Nominee: <strong style={{ color: "var(--theme-accent)" }}>{parsed.candidate}</strong></span>
                      <span>Target Elevation: <strong style={{ color: "#e3a857" }}>{parsed.targetRank || "Master"}</strong></span>
                    </div>
                  )}

                  {cat === "disciplinary" && parsed.accused && (
                    <div style={{ background: "rgba(255, 82, 82, 0.06)", border: "1px solid rgba(255, 82, 82, 0.3)", padding: "1rem 1.25rem", marginBottom: "1.5rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.88rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "0.5rem" }}>
                        <span>Accused Sith: <strong style={{ color: "#ff8080" }}>{parsed.accused}</strong></span>
                        {parsed.evidenceUrl && <a href={parsed.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--theme-accent)", textDecoration: "underline" }}>Inspect Evidence Log ↗</a>}
                      </div>
                      <p style={{ margin: 0, color: "var(--text-dim)" }}>
                        Charges: <span style={{ color: "var(--text-bright)" }}>{parsed.charges || "Breach of Imperial discipline."}</span>
                      </p>
                    </div>
                  )}

                  {cat === "kaggath" && (
                    <div style={{ background: "rgba(168, 151, 134, 0.08)", border: "1px solid var(--theme-accent)", padding: "1rem 1.25rem", marginBottom: "1.5rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.88rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                        <span style={{ color: "var(--theme-accent)", fontWeight: 700 }}>STAGE 1: AUTHORIZATION OF CONFLICT</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Majority Quorum Required</span>
                      </div>
                      <div style={{ display: "flex", gap: "2rem", alignItems: "center", margin: "0.6rem 0" }}>
                        <span>Challenger: <strong style={{ color: "var(--theme-accent)" }}>{parsed.challenger}</strong></span>
                        <span style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem" }}>// VS //</span>
                        <span>Accused Rival: <strong style={{ color: "#ff8080" }}>{parsed.accused}</strong></span>
                      </div>
                      {parsed.kaggathStakes && <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "0.8rem" }}>Stakes / Terms: {parsed.kaggathStakes}</p>}
                    </div>
                  )}

                  {/* Body Text */}
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "1.2rem", border: "1px solid var(--border)", marginBottom: "1.5rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.9rem", lineHeight: "1.65", color: "var(--text-bright)" }}>
                    <DiscordMarkdown content={parsed.text || item.body} />
                  </div>

                  {/* Quorum Progress Bar */}
                  <div style={{ marginBottom: "1.8rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Share Tech Mono, monospace", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
                      <span style={{ color: "var(--theme-accent)" }}>Majority Threshold: {counts.yes || 0} / {majority} Ayes Required</span>
                      <span style={{ color: "var(--text-dim)" }}>Total Ballots Cast: {totalVotes}</span>
                    </div>
                    <div style={{ height: "10px", background: "rgba(0,0,0,0.6)", border: "1px solid var(--theme-border-hot)", position: "relative", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${passProgress}%`, background: "var(--theme-accent)", boxShadow: "0 0 10px var(--theme-accent-glow)", transition: "width 0.4s" }} />
                    </div>
                  </div>

                  {/* Councilor Voting Console */}
                  {isDarkCouncil && (
                    <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--theme-border-hot)", padding: "1.5rem", marginBottom: "1.5rem" }}>
                      <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "0.8rem", color: "var(--theme-accent)", letterSpacing: "0.15em", marginBottom: "0.8rem" }}>
                        CAST COUNCIL BALLOT
                      </span>

                      {cat === "disciplinary" ? (
                        /* Disciplinary Verdict Choice */
                        <div style={{ marginBottom: "1rem" }}>
                          <label style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.3rem" }}>
                            IF GUILTY, ADVISE SANCTION:
                          </label>
                          <select
                            value={sanctionChoice}
                            onChange={e => setSanctionChoice(e.target.value)}
                            style={{ padding: "0.5rem", background: "#110e0b", border: "1px solid var(--theme-border-hot)", color: "var(--text-bright)", width: "100%", maxWidth: "320px", marginBottom: "1rem" }}
                          >
                            <option value="demotion">Demotion in Rank</option>
                            <option value="probation">Probational Inactivity / Watch</option>
                            <option value="demerits">Official Demerits & Warning</option>
                            <option value="fine">Sphere Resource Fine</option>
                            <option value="exile">Chamber Censure</option>
                          </select>
                        </div>
                      ) : null}

                      <div style={{ marginBottom: "1rem" }}>
                        <textarea
                          rows={2}
                          value={voteOpinion}
                          onChange={e => setVoteOpinion(e.target.value)}
                          placeholder="Optional Council Opinion / Record Statement..."
                          style={{ width: "100%", padding: "0.6rem", background: "#110e0b", border: "1px solid var(--theme-border-hot)", color: "var(--text-bright)", fontFamily: "inherit", fontSize: "0.85rem" }}
                        />
                      </div>

                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={submittingVote}
                          onClick={() => handleCastVote(item.id, cat === "disciplinary" ? "guilty" : "yes")}
                          style={{
                            background: "rgba(168, 151, 134, 0.2)",
                            border: "1px solid var(--theme-accent)",
                            color: "var(--theme-accent)",
                            padding: "0.65rem 1.8rem",
                            fontFamily: "Orbitron, monospace",
                            fontSize: "0.82rem",
                            cursor: submittingVote ? "not-allowed" : "pointer",
                            boxShadow: "0 0 10px var(--theme-accent-glow)"
                          }}
                        >
                          {cat === "disciplinary" ? "GUILTY" : "AYE (APPROVE)"}
                        </button>

                        <button
                          type="button"
                          disabled={submittingVote}
                          onClick={() => handleCastVote(item.id, cat === "disciplinary" ? "not_guilty" : "no")}
                          style={{
                            background: "rgba(192, 0, 26, 0.15)",
                            border: "1px solid #771521",
                            color: "#ff8080",
                            padding: "0.65rem 1.8rem",
                            fontFamily: "Orbitron, monospace",
                            fontSize: "0.82rem",
                            cursor: submittingVote ? "not-allowed" : "pointer"
                          }}
                        >
                          {cat === "disciplinary" ? "NOT GUILTY / DISMISS" : "NAY (REJECT)"}
                        </button>

                        <button
                          type="button"
                          disabled={submittingVote}
                          onClick={() => handleCastVote(item.id, "abstain")}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--theme-border-hot)",
                            color: "var(--text-dim)",
                            padding: "0.65rem 1.4rem",
                            fontFamily: "Orbitron, monospace",
                            fontSize: "0.82rem",
                            cursor: submittingVote ? "not-allowed" : "pointer"
                          }}
                        >
                          ABSTAIN
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Registered Ballots Log */}
                  <div>
                    <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                      Recorded Council Ballots ({item.votes?.length || 0})
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.6rem" }}>
                      {(item.votes || []).map((vote, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "rgba(0,0,0,0.4)",
                            border: "1px solid var(--theme-border-hot)",
                            padding: "0.6rem 0.8rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div>
                            <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-bright)" }}>
                              {vote.voterName || "Councilor"}
                            </span>
                            {vote.comment && <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.68rem", color: "var(--text-dim)", fontStyle: "italic" }}>"{vote.comment.slice(0, 35)}..."</span>}
                          </div>
                          <span style={{
                            fontFamily: "Orbitron, monospace",
                            fontSize: "0.72rem",
                            color: ["yes", "guilty"].includes(vote.vote) ? "var(--theme-accent)" : vote.vote === "abstain" ? "var(--text-dim)" : "#ff8080"
                          }}>
                            {String(vote.vote).toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Adjourn Item Action (High Command) */}
                  {isDarkCouncil && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem", marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                      <button
                        type="button"
                        onClick={() => handleAdjournItem(item.id, "passed")}
                        style={{
                          background: "rgba(168, 151, 134, 0.2)",
                          border: "1px solid var(--theme-accent)",
                          color: "var(--theme-accent)",
                          padding: "0.4rem 1rem",
                          fontSize: "0.75rem",
                          fontFamily: "Orbitron, monospace",
                          cursor: "pointer"
                        }}
                      >
                        CONCLUDE AS RATIFIED
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjournItem(item.id, "failed")}
                        style={{
                          background: "rgba(192, 0, 26, 0.15)",
                          border: "1px solid #771521",
                          color: "#ff8080",
                          padding: "0.4rem 1rem",
                          fontSize: "0.75rem",
                          fontFamily: "Orbitron, monospace",
                          cursor: "pointer"
                        }}
                      >
                        CONCLUDE AS REJECTED
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : selectedTab === "queue" ? (
        /* VIEW: Floor Queue */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {queuedDocketItems.length === 0 ? (
            <div style={{ padding: "3rem 1rem", textAlign: "center", border: "1px dashed var(--theme-border-hot)" }}>
              <p style={{ fontFamily: "Orbitron, monospace", fontSize: "0.95rem", fontWeight: 700, color: "var(--theme-accent)", margin: "0 0 0.5rem", letterSpacing: "0.05em" }}>
                Queue Empty
              </p>
              <p style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
                No docket items are waiting to be brought to the floor. Check the Council Docket to approve proposals.
              </p>
            </div>
          ) : (
            queuedDocketItems.map(item => (
              <div
                key={item.id}
                style={{
                  background: "linear-gradient(135deg, rgba(168, 151, 134, 0.05) 0%, transparent 60%), #1c1814",
                  border: "1px solid var(--theme-border-hot)",
                  padding: "1.2rem 1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem"
                }}
              >
                <div>
                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.68rem", color: "var(--theme-accent)", textTransform: "uppercase" }}>
                    // {item.proposalType}
                  </span>
                  <h3 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-bright)", margin: "0.2rem 0", letterSpacing: "0.03em" }}>
                    {item.title}
                  </h3>
                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Sponsor: {item.createdByName}
                  </span>
                </div>

                {isDarkCouncil && (
                  <button
                    type="button"
                    onClick={() => handleOpenItemToFloor(item.id)}
                    style={{
                      background: "rgba(168, 151, 134, 0.2)",
                      border: "1px solid var(--theme-accent)",
                      color: "var(--theme-accent)",
                      padding: "0.45rem 1.1rem",
                      fontFamily: "Orbitron, monospace",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      boxShadow: "0 0 8px var(--theme-accent-glow)"
                    }}
                  >
                    BRING TO FLOOR →
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* VIEW: Recorded Votes */
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {recordedItems.length === 0 ? (
            <div style={{ padding: "4rem 1rem", textAlign: "center", border: "1px dashed var(--theme-border-hot)" }}>
              <p style={{ fontFamily: "Orbitron, monospace", fontSize: "1.05rem", fontWeight: 700, color: "var(--theme-accent)", margin: "0 0 0.5rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                No Recorded Votes
              </p>
              <p style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.85rem", color: "var(--text-dim)", maxWidth: "500px", margin: "0 auto" }}>
                No past votes or concluded deliberations have been archived yet.
              </p>
            </div>
          ) : (
            recordedItems.map(item => {
              const parsed = parseItemContent(item);
              const cat = (parsed.category || item.proposalType || "legislation").toLowerCase();
              const status = String(item.status || "concluded").toLowerCase();
              const isExpanded = Boolean(expandedHistoryIds[item.id]);

              const typeBadge = {
                legislation: { label: "LEGISLATION", color: "var(--theme-accent)" },
                promotion: { label: "PROMOTION", color: "#e3a857" },
                disciplinary: { label: "TRIBUNAL", color: "#ff5252" },
                kaggath: { label: "KAGGATH", color: "#c0ab98" }
              }[cat] || { label: "PROPOSAL", color: "var(--theme-accent)" };

              const outcomeBadge = status === "passed" ? {
                label: "PASSED / CODIFIED",
                bg: "rgba(53, 196, 111, 0.15)",
                color: "#8affb2",
                border: "#35c46f"
              } : status === "vetoed" ? {
                label: "VETOED BY HIGH COMMAND",
                bg: "rgba(227, 168, 87, 0.15)",
                color: "#ffd180",
                border: "#e3a857"
              } : {
                label: "FAILED / REJECTED",
                bg: "rgba(192, 0, 26, 0.2)",
                color: "#ff8080",
                border: "#ff4d4d"
              };

              return (
                <div
                  key={item.id}
                  style={{
                    background: "linear-gradient(135deg, rgba(168, 151, 134, 0.05) 0%, transparent 60%), #1c1814",
                    border: `1px solid ${outcomeBadge.border}44`,
                    borderLeft: `4px solid ${outcomeBadge.border}`,
                    position: "relative",
                    transition: "border-color 0.2s"
                  }}
                >
                  {/* Collapsed Header Bar (Clickable) */}
                  <div
                    onClick={() => toggleHistoryItem(item.id)}
                    style={{
                      padding: "1.2rem 1.4rem",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.8rem",
                      background: isExpanded ? "rgba(0,0,0,0.3)" : "transparent"
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                        <span style={{
                          fontFamily: "Share Tech Mono, monospace",
                          fontSize: "0.68rem",
                          color: typeBadge.color,
                          background: "rgba(0,0,0,0.5)",
                          border: `1px solid ${typeBadge.color}`,
                          padding: "0.15rem 0.5rem",
                          letterSpacing: "0.1em"
                        }}>
                          // {typeBadge.label}
                        </span>
                        <span style={{
                          fontFamily: "Orbitron, monospace",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: outcomeBadge.color,
                          background: outcomeBadge.bg,
                          border: `1px solid ${outcomeBadge.border}`,
                          padding: "0.15rem 0.55rem",
                          letterSpacing: "0.08em"
                        }}>
                          {outcomeBadge.label}
                        </span>
                      </div>
                      <h3 style={{ fontFamily: "Orbitron, monospace", fontSize: "1.05rem", fontWeight: 700, color: "var(--theme-accent)", margin: 0, letterSpacing: "0.03em" }}>
                        {item.title}
                      </h3>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "right", fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem" }}>
                        <span style={{ display: "block", color: "var(--text-dim)" }}>
                          Ayes: <strong style={{ color: "#8affb2" }}>{item.counts?.yes || 0}</strong> &bull; Nays: <strong style={{ color: "#ff8080" }}>{item.counts?.no || 0}</strong>
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
                          {item.closesAt ? new Date(item.closesAt).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "")}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: "Orbitron, monospace",
                        fontSize: "0.9rem",
                        color: "var(--theme-accent)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s"
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Expanded Body Panel (Like Codex Article) */}
                  {isExpanded && (
                    <div style={{ padding: "0 1.4rem 1.4rem", borderTop: "1px solid var(--border)", marginTop: "0.4rem", paddingTop: "1.2rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        <span>Author / Sponsor: <strong style={{ color: "var(--text-bright)" }}>{item.createdByName || "Councilor"}</strong></span>
                        {item.majorityCount > 0 && <span>Quorum Required: <strong style={{ color: "var(--theme-accent)" }}>{item.majorityCount} Ayes</strong></span>}
                      </div>

                      {/* Specific Highlights */}
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

                      <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.88rem", lineHeight: "1.65", color: "var(--text-bright)", background: "rgba(0,0,0,0.25)", padding: "1rem", border: "1px solid var(--border)", marginBottom: "1rem" }}>
                        <DiscordMarkdown content={parsed.text || item.body} />
                      </div>

                      {/* Veto Notation */}
                      {item.vetoedBy && (
                        <div style={{ background: "rgba(227, 168, 87, 0.08)", border: "1px solid rgba(227, 168, 87, 0.3)", padding: "0.6rem 1rem", marginBottom: "1rem", fontFamily: "Share Tech Mono, monospace", fontSize: "0.8rem", color: "#ffd180" }}>
                          <strong>VETO NOTATION:</strong> Vetoed by {item.vetoedByName || item.vetoedBy}{item.vetoReason ? ` — "${item.vetoReason}"` : ""}
                        </div>
                      )}

                      {/* Individual Councilor Votes */}
                      {item.votes && item.votes.length > 0 && (
                        <div>
                          <span style={{ display: "block", fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                            Recorded Council Ballots ({item.votes.length})
                          </span>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
                            {item.votes.map((vote, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: "rgba(0,0,0,0.4)",
                                  border: "1px solid var(--theme-border-hot)",
                                  padding: "0.5rem 0.75rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}
                              >
                                <div>
                                  <span style={{ display: "block", fontFamily: "Orbitron, monospace", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-bright)" }}>
                                    {vote.voterName || "Councilor"}
                                  </span>
                                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.65rem", color: "var(--text-dim)" }}>
                                    {vote.voterRank || vote.voterRole || "Seat"}
                                  </span>
                                </div>
                                <span style={{
                                  fontFamily: "Orbitron, monospace",
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  color: vote.vote === "yes" ? "#8affb2" : vote.vote === "no" ? "#ff8080" : "var(--text-dim)",
                                  padding: "0.15rem 0.45rem",
                                  background: vote.vote === "yes" ? "rgba(53, 196, 111, 0.15)" : vote.vote === "no" ? "rgba(192, 0, 26, 0.2)" : "rgba(168, 151, 134, 0.1)",
                                  border: `1px solid ${vote.vote === "yes" ? "#35c46f" : vote.vote === "no" ? "#ff4d4d" : "var(--theme-border-hot)"}`
                                }}>
                                  {String(vote.vote).toUpperCase()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
