"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { DiscordMarkdown } from "../../../components/DiscordMarkdown.jsx";

const CATEGORIES = [
  { id: "all", label: "ALL EVENTS" },
  { id: "era", label: "ERAS" },
  { id: "emperor", label: "EMPERORS" },
  { id: "major_event", label: "MAJOR EVENTS" },
  { id: "reform", label: "REFORMS" },
  { id: "map", label: "MAPS" },
  { id: "owner", label: "OWNERSHIP" }
];

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

export function parseFlexibleDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const str = raw.trim();
  if (!str) return null;

  // 1. American numeric: M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY, or with dashes (e.g. 9/3/26, 09/03/26, 9/3/2026, 09/03/2026)
  const usNumericMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (usNumericMatch) {
    const month = parseInt(usNumericMatch[1], 10) - 1;
    const day = parseInt(usNumericMatch[2], 10);
    let year = parseInt(usNumericMatch[3], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month, day)).getTime();
    }
  }

  // 2. Day of month year: e.g. "3rd of September 2026", "3 September 2026", "3rd September 2026", "03 September 26"
  const dmyMatch = str.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)(?:,)?\s+(\d{2,4})/i);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthKey = dmyMatch[2].toLowerCase();
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    if (MONTH_MAP[monthKey] !== undefined && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, MONTH_MAP[monthKey], day)).getTime();
    }
  }

  // 3. Month day year: e.g. "September 3rd 2026", "September 3, 2026", "Sep 3 2026", "September 03, 26"
  const mdyMatch = str.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{2,4})/i);
  if (mdyMatch) {
    const monthKey = mdyMatch[1].toLowerCase();
    const day = parseInt(mdyMatch[2], 10);
    let year = parseInt(mdyMatch[3], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    if (MONTH_MAP[monthKey] !== undefined && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, MONTH_MAP[monthKey], day)).getTime();
    }
  }

  // 4. Month year: e.g. "September 2026", "Sep 2026"
  const myMatch = str.match(/^([A-Za-z]+)\s+(\d{2,4})$/i);
  if (myMatch) {
    const monthKey = myMatch[1].toLowerCase();
    let year = parseInt(myMatch[2], 10);
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    if (MONTH_MAP[monthKey] !== undefined) {
      return new Date(Date.UTC(year, MONTH_MAP[monthKey], 1)).getTime();
    }
  }

  // 5. Star Wars / Galactic BTC / ATC era check: e.g. "24 BTC", "1000 BBY", "500 ABY", "12 ATC"
  const btcMatch = str.match(/^(\d+)\s*BTC$/i) || str.match(/^(\d+)\s*BBY$/i);
  if (btcMatch) {
    const num = parseInt(btcMatch[1], 10);
    return -1000000000000000 - num;
  }
  const atcMatch = str.match(/^(\d+)\s*ATC$/i) || str.match(/^(\d+)\s*ABY$/i);
  if (atcMatch) {
    const num = parseInt(atcMatch[1], 10);
    return -1000000000000000 + 1000000 + num;
  }

  // 6. ISO Date check: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day)).getTime();
  }

  // 7. Plain 4-digit year: e.g. "2026"
  const yearMatch = str.match(/^(\d{4})$/);
  if (yearMatch) {
    return new Date(Date.UTC(parseInt(yearMatch[1], 10), 0, 1)).getTime();
  }

  // 8. Native Date.parse fallback
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return null;
}

export function getEntryTimestamp(entry) {
  if (!entry) return 0;
  return (
    parseFlexibleDate(entry.dateLabel) ??
    parseFlexibleDate(entry.startDate) ??
    parseFlexibleDate(entry.endDate) ??
    parseFlexibleDate(entry.createdAt) ??
    0
  );
}

export default function TimelineClient() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeModal, setActiveModal] = useState(null); // 'edit' | null
  const [selectedImage, setSelectedImage] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    category: "major_event",
    dateLabel: "",
    startDate: "",
    endDate: "",
    summary: "",
    body: "",
    imageUrl: "",
    imageAlt: ""
  });

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/timeline");
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries || []);
        setCanEdit(Boolean(data.canEdit));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/check-access");
      const data = await res.json();
      if (data?.authorized) {
        const profile = data.profile;
        const perms = Array.isArray(profile?.permissions) ? profile.permissions : [];
        const hasAdmin = profile?.isSuperUser || profile?.hasFullAccess ||
          profile?.authorityRoles?.emperor ||
          profile?.authorityRoles?.groupOwner ||
          profile?.authorityRoles?.projectManager ||
          (profile?.divisions?.darkCouncil && profile.divisions.darkCouncil !== "none") ||
          perms.includes("doctrine:edit") ||
          perms.includes("codex:edit") ||
          perms.includes("archives:edit") ||
          perms.includes("timeline:edit");
        if (hasAdmin) setCanEdit(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchTimeline();
    checkPermissions();
  }, []);

  const handleOpenNew = () => {
    setFormData({
      id: "",
      title: "",
      category: "major_event",
      dateLabel: "",
      startDate: "",
      endDate: "",
      summary: "",
      body: "",
      imageUrl: "",
      imageAlt: ""
    });
    setActiveModal("edit");
  };

  const handleOpenEdit = (entry, e) => {
    if (e) e.stopPropagation();
    setFormData({
      id: entry.id || "",
      title: entry.title || "",
      category: entry.category || "major_event",
      dateLabel: entry.dateLabel || "",
      startDate: entry.startDate || "",
      endDate: entry.endDate || "",
      summary: entry.summary || "",
      body: entry.body || "",
      imageUrl: entry.imageUrl || "",
      imageAlt: entry.imageAlt || ""
    });
    setActiveModal("edit");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.body.trim()) {
      alert("Title and Event Content are required.");
      return;
    }

    try {
      const res = await fetch("/api/timeline", {
        method: formData.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.ok) {
        setActiveModal(null);
        fetchTimeline();
      } else {
        alert("Failed to save event: " + (data.error || data.reason));
      }
    } catch (err) {
      console.error(err);
      alert("Error saving timeline event");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to permanently purge this historical record?")) return;
    try {
      const res = await fetch(`/api/timeline?id=${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.ok) {
        setActiveModal(null);
        fetchTimeline();
      } else {
        alert("Failed to delete event: " + (data.error || data.reason));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredEntries = entries
    .filter((entry) => {
      if (selectedCategory === "all") return true;
      return (entry.category || "major_event").toLowerCase() === selectedCategory.toLowerCase();
    })
    .sort((a, b) => {
      const timeA = getEntryTimestamp(a);
      const timeB = getEntryTimestamp(b);
      if (timeA !== timeB) return timeA - timeB;
      const orderA = Number.isFinite(Number(a.displayOrder)) ? Number(a.displayOrder) : 0;
      const orderB = Number.isFinite(Number(b.displayOrder)) ? Number(b.displayOrder) : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.id || "").localeCompare(b.id || "");
    });

  return (
    <HolonetFrame
      title="THE TIMELINE"
      subtitle="HISTORICAL CHRONOLOGY"
      footerNode="ARC-01"
      includeSearchOverlay
    >
      <div className="timeline-shell" style={{ width: "100%", margin: "0 auto", padding: "0.5rem 0 4rem" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media (max-width: 860px) {
            .timeline-center-spine {
              left: 20px !important;
              transform: none !important;
            }
            .timeline-spine-dot {
              left: 20px !important;
              transform: translate(-50%, -50%) !important;
            }
            .timeline-branch-row {
              justify-content: flex-end !important;
              padding-left: 45px !important;
              box-sizing: border-box !important;
            }
            .timeline-tree-card {
              width: 100% !important;
              border-left: 3px solid var(--red-bright) !important;
              border-right: 1px solid var(--border) !important;
            }
            .timeline-branch-line {
              left: -45px !important;
              right: auto !important;
              width: 45px !important;
            }
          }
        `}} />
        
        {/* Classification Tag Filter Tabs (Doctrine / Hierarchy Style) */}
        <div className="hierarchy-tabs-shell" style={{ margin: "0.5rem 0 2.5rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div className="hierarchy-tab-strip" role="tablist" aria-label="Chronology classification tags" style={{ flex: 1, minWidth: "280px" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat.id}
                  className={`hierarchy-tab${selectedCategory === cat.id ? " is-active" : ""}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {canEdit && (
              <div style={{ paddingBottom: "4px" }}>
                <button
                  type="button"
                  className="hub-write-btn"
                  onClick={handleOpenNew}
                >
                  + INSCRIBE EVENT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chronological Spine & Event Cards */}
        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Share Tech Mono, monospace", color: "var(--text-dim)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Scanning Imperial Chronology...
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", border: "1px dashed var(--border-hot)", background: "rgba(192,0,26,0.02)" }}>
            <p style={{ fontFamily: "Share Tech Mono, monospace", color: "var(--text-dim)" }}>
              NO HISTORICAL RECORDS FOUND UNDER THIS CLASSIFICATION.
            </p>
          </div>
        ) : (
          <div className="timeline-tree-container" style={{ position: "relative", maxWidth: "1200px", margin: "0 auto", padding: "2rem 0" }}>
            {/* Central Vertical Spine */}
            <div
              className="timeline-center-spine"
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: "2px",
                transform: "translateX(-50%)",
                background: "linear-gradient(180deg, var(--red-bright) 0%, rgba(192,0,26,0.4) 70%, transparent 100%)",
                boxShadow: "0 0 12px var(--red-glow)",
                zIndex: 1
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", position: "relative", zIndex: 2 }}>
              {filteredEntries.map((entry, index) => {
                const isLeft = index % 2 === 0;
                const dateText = entry.dateLabel || [entry.startDate, entry.endDate].filter(Boolean).join(" - ") || "Undated Record";

                return (
                  <div
                    key={entry.id || index}
                    className={`timeline-branch-row ${isLeft ? "is-left" : "is-right"}`}
                    style={{
                      display: "flex",
                      justifyContent: isLeft ? "flex-start" : "flex-end",
                      position: "relative",
                      width: "100%"
                    }}
                  >
                    {/* Node Dot on the Central Spine */}
                    <div
                      className="timeline-spine-dot"
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "1.8rem",
                        transform: "translate(-50%, -50%)",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#0d0b09",
                        border: "2px solid var(--red-bright)",
                        boxShadow: "0 0 10px var(--red-glow)",
                        zIndex: 3
                      }}
                    />

                    {/* Timeline Event Card (Occupies roughly 46% of width on desktop) */}
                    <article
                      className="codex-article timeline-tree-card"
                      style={{
                        width: "calc(50% - 2.5rem)",
                        margin: 0,
                        position: "relative",
                        background: "linear-gradient(135deg, rgba(192,0,26,0.04) 0%, transparent 60%), #14110e",
                        border: "1px solid var(--border)",
                        borderLeft: isLeft ? "3px solid var(--red-bright)" : "1px solid var(--border)",
                        borderRight: !isLeft ? "3px solid var(--red-bright)" : "1px solid var(--border)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                        padding: "1.5rem"
                      }}
                    >
                      {/* Branch Connector Line pointing toward the center spine */}
                      <div
                        className="timeline-branch-line"
                        style={{
                          position: "absolute",
                          top: "1.8rem",
                          [isLeft ? "right" : "left"]: "-2.5rem",
                          width: "2.5rem",
                          height: "1px",
                          background: "linear-gradient(90deg, var(--red-bright), rgba(192,0,26,0.3))",
                          boxShadow: "0 0 6px var(--red-glow)"
                        }}
                      />

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.8rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.8rem", marginBottom: "1rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--red-bright)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                              // {entry.category || "EVENT"}
                            </span>
                            <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-dim)", background: "rgba(0,0,0,0.5)", border: "1px solid var(--border)", padding: "0.1rem 0.45rem" }}>
                              {dateText}
                            </span>
                          </div>
                          <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.25rem", color: "var(--red-bright)", margin: "0.2rem 0 0", textShadow: "0 0 6px rgba(255,0,34,0.4)", letterSpacing: "0.05em" }}>
                            {entry.title}
                          </h2>
                        </div>

                        {canEdit && (
                          <button
                            type="button"
                            className="hub-write-btn"
                            onClick={(e) => handleOpenEdit(entry, e)}
                            style={{ padding: "0.25rem 0.65rem", fontSize: "0.7rem" }}
                          >
                            EDIT
                          </button>
                        )}
                      </div>

                      {entry.summary && (
                        <div style={{ background: "rgba(192,0,26,0.06)", borderLeft: "3px solid var(--red-bright)", padding: "0.8rem 1rem", marginBottom: "1.2rem", fontStyle: "italic", fontSize: "0.88rem", color: "var(--text-bright)" }}>
                          <DiscordMarkdown content={entry.summary} />
                        </div>
                      )}

                      {entry.imageUrl && (
                        <div style={{ margin: "1rem 0", maxWidth: "100%", border: "1px solid var(--border-hot)", overflow: "hidden" }}>
                          <img
                            src={entry.imageUrl}
                            alt={entry.imageAlt || entry.title}
                            style={{ width: "100%", height: "auto", display: "block", cursor: "pointer" }}
                            onClick={() => setSelectedImage(entry.imageUrl)}
                          />
                        </div>
                      )}

                      <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.9rem", lineHeight: "1.65", color: "var(--text-bright)" }}>
                        <DiscordMarkdown content={entry.body} />
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Universal Doctrine-Style Event Editor Modal */}
        {mounted && activeModal === "edit" && createPortal(
          <div className="doctrine-modal-backdrop active" onClick={() => setActiveModal(null)}>
            <div className="doctrine-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ width: "min(780px, calc(100vw - 32px))", maxWidth: "780px", margin: "auto" }}>
              <form onSubmit={handleSave}>
                <div className="codex-modal-header">
                  <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.2rem", color: "var(--red-bright)", margin: 0, letterSpacing: "0.15em", textShadow: "0 0 6px rgba(255,0,34,0.55)" }}>
                    {formData.id ? "EDIT CHRONOLOGICAL RECORD" : "INSCRIBE CHRONOLOGICAL RECORD"}
                  </h2>
                  <button type="button" className="codex-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
                </div>

                <div className="codex-modal-body" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <div>
                    <label className="codex-label">EVENT TITLE</label>
                    <input
                      type="text"
                      className="codex-input"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="E.G. THE SECOND CORONATION OF EMPEROR MANAR"
                      required
                    />
                  </div>

                  <div className="codex-modal-grid-2">
                    <div>
                      <label className="codex-label">CATEGORY</label>
                      <select
                        className="codex-select"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="major_event">Major Event</option>
                        <option value="era">Era</option>
                        <option value="emperor">Emperor</option>
                        <option value="reform">Reform</option>
                        <option value="map">Map</option>
                        <option value="owner">Ownership</option>
                      </select>
                    </div>

                    <div>
                      <label className="codex-label">DATE / ERA LABEL</label>
                      <input
                        type="text"
                        className="codex-input"
                        value={formData.dateLabel}
                        onChange={(e) => setFormData({ ...formData, dateLabel: e.target.value })}
                        placeholder="E.G. 24 BTC or May 2024"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="codex-label">SUMMARY (OVERVIEW PREVIEW)</label>
                    <input
                      type="text"
                      className="codex-input"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="Brief overview of event significance..."
                    />
                  </div>

                  <div>
                    <label className="codex-label">FULL EVENT DETAILS (MARKDOWN)</label>
                    <textarea
                      className="codex-textarea"
                      rows={10}
                      value={formData.body}
                      onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                      placeholder="Describe the historical event in full detail..."
                      required
                    />
                  </div>

                  <div className="codex-modal-grid-2">
                    <div>
                      <label className="codex-label">ARCHIVE IMAGE URL (OPTIONAL)</label>
                      <input
                        type="text"
                        className="codex-input"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <label className="codex-label">IMAGE ALT TEXT</label>
                      <input
                        type="text"
                        className="codex-input"
                        value={formData.imageAlt}
                        onChange={(e) => setFormData({ ...formData, imageAlt: e.target.value })}
                        placeholder="Description of image..."
                      />
                    </div>
                  </div>
                </div>

                <div className="codex-modal-footer">
                  {formData.id && (
                    <button
                      type="button"
                      className="hub-cancel-btn"
                      onClick={() => handleDelete(formData.id)}
                      style={{ marginRight: "auto" }}
                    >
                      PURGE RECORD
                    </button>
                  )}
                  <button type="button" className="hub-cancel-btn" onClick={() => setActiveModal(null)}>
                    CANCEL
                  </button>
                  <button type="submit" className="hub-write-btn">
                    SAVE RECORD
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Image Lightbox */}
        {mounted && selectedImage && createPortal(
          <div className="doctrine-modal-backdrop active" onClick={() => setSelectedImage(null)}>
            <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
              <img src={selectedImage} alt="Enlarged Archive" style={{ maxWidth: "100%", maxHeight: "90vh", border: "1px solid var(--red-bright)" }} />
              <button
                type="button"
                className="codex-modal-close"
                onClick={() => setSelectedImage(null)}
                style={{ position: "absolute", top: "-30px", right: "0", color: "#fff" }}
              >
                &times;
              </button>
            </div>
          </div>,
          document.body
        )}

      </div>
      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
