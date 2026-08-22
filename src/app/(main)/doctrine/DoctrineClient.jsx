"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";

const SECTIONS = [
  "HOLONET",
  "DOMINION",
  "OPERATIONS",
  "LOCATIONS"
];

function normalizeSection(raw) {
  if (!raw) return SECTIONS[0];
  const s = String(raw).toUpperCase().trim();
  if (s.includes("HOLONET") || s.includes("IDENTITY") || s.includes("AUTHENTICATION") || s === "HOLONET") {
    return "HOLONET";
  }
  if (s.includes("DOMINION") || s.includes("POWERBASE") || s.includes("KAGGATH") || s === "DOMINION") {
    return "DOMINION";
  }
  if (s.includes("OPERATION") || s.includes("DEPLOYMENT") || s.includes("ASCENSION") || s.includes("TRIAL") || s.includes("COMBAT") || s === "OPERATIONS") {
    return "OPERATIONS";
  }
  if (s.includes("LOCATION") || s.includes("TERRITORY") || s.includes("STRONGHOLD") || s.includes("SECTOR") || s === "LOCATIONS") {
    return "LOCATIONS";
  }
  return SECTIONS.includes(raw) ? raw : SECTIONS[0];
}

const TAGS = [
  "AUTHENTICATION",
  "ACADEMY",
  "COMMAND",
  "DEPLOYMENTS",
  "POWERBASE",
  "DUTY",
  "PROCEDURE"
];

export default function DoctrineClient() {
  const router = useRouter();
  const [directives, setDirectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [activeModal, setActiveModal] = useState(null); // 'view' | 'edit' | null
  const [currentDirective, setCurrentDirective] = useState(null);

  const [formData, setFormData] = useState({
    id: "",
    title: "",
    section: SECTIONS[0],
    tag: TAGS[0],
    summary: "",
    content: "",
    is_published: true
  });

  useEffect(() => {
    fetchDirectives();
    checkPermissions();
  }, []);

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
          perms.includes("codex:edit");
        setCanEdit(!!hasAdmin);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDirectives = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctrine");
      const data = await res.json();
      if (data.ok) {
        setDirectives(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setFormData({
      id: "",
      title: "",
      section: SECTIONS[0],
      tag: TAGS[0],
      summary: "",
      content: "",
      is_published: true
    });
    setActiveModal("edit");
  };

  const handleOpenEdit = (directive, e) => {
    if (e) e.stopPropagation();
    setFormData({
      id: directive.id,
      title: directive.title,
      section: directive.section,
      tag: directive.tag,
      summary: directive.summary || "",
      content: directive.content || "",
      is_published: directive.is_published !== false
    });
    setActiveModal("edit");
  };

  const handleOpenView = (directive) => {
    setCurrentDirective(directive);
    setActiveModal("view");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Title and Directive Content are required.");
      return;
    }

    const isUpdate = !!formData.id;
    try {
      const res = await fetch("/api/doctrine", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.ok) {
        setActiveModal(null);
        fetchDirectives();
      } else {
        alert("Failed to save directive: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to purge this Imperial directive?")) return;
    try {
      const res = await fetch(`/api/doctrine?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setActiveModal(null);
        fetchDirectives();
      } else {
        alert("Failed to delete directive: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDirectives = directives.filter(d => {
    return selectedTag === "ALL" || d.tag === selectedTag;
  });

  return (
    <HolonetFrame activePage="doctrine" title="DOCTRINE" subtitle="IMPERIAL GUIDANCE" includeSearchOverlay>
      <link rel="stylesheet" href="/css/codex.css" />
      <div className="doctrine-shell" style={{ width: "100%", maxWidth: "1600px", margin: "0 auto", padding: "0 1rem 3rem" }}>

        {/* Top Control Bar: Tag Filters Left, Global Search & Action Buttons Right */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "1.2rem", marginBottom: "2rem" }}>

          {/* Tag Filter Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)", letterSpacing: "0.15em", marginRight: "0.4rem" }}>CLASSIFICATION:</span>
            <button
              type="button"
              className={`tag-chip ${selectedTag === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedTag("ALL")}
            >
              ALL
            </button>
            {TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Search Codex & New Directive Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <button
              type="button"
              className="hub-cancel-btn"
              onClick={() => window.initHolonetSearch?.()}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>SEARCH CODEX</span>
            </button>

            {canEdit && (
              <button
                type="button"
                className="hub-write-btn"
                onClick={handleOpenNew}
              >
                + NEW DIRECTIVE
              </button>
            )}
          </div>

        </div>

        {/* Trello-Style Multi-Column Grid Board (Zero Horizontal Scroll, Multi-Column Wrapping) */}
        {loading ? (
          <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
            <p style={{ fontFamily: "Share Tech Mono, monospace", color: "var(--text-dim)", letterSpacing: "0.15em", textTransform: "uppercase" }}>Loading Imperial Guidance Directives...</p>
          </div>
        ) : (
          <div className="trello-board-grid">
            {SECTIONS.map((sectionTitle, sIndex) => {
              const sectionItems = filteredDirectives.filter(d => normalizeSection(d.section) === sectionTitle);

              return (
                <div key={sectionTitle} className="trello-column">
                  <div className="trello-column-header">
                    <span className="trello-column-num">0{sIndex + 1}</span>
                    <h2 className="trello-column-title">{sectionTitle}</h2>
                    <span className="trello-column-count">[{sectionItems.length}]</span>
                  </div>

                  <div className="trello-column-cards">
                    {sectionItems.length === 0 ? (
                      <div className="trello-empty-card">
                        <span>NO DIRECTIVES RECORDED IN THIS SECTION</span>
                      </div>
                    ) : (
                      sectionItems.map((directive) => (
                        <div
                          key={directive.id}
                          className="trello-card"
                          onClick={() => handleOpenView(directive)}
                        >
                          <div className="trello-card-top">
                            <span className="trello-card-tag">{directive.tag || "GENERAL"}</span>
                            {canEdit && (
                              <button
                                type="button"
                                className="trello-card-edit-btn"
                                onClick={(e) => handleOpenEdit(directive, e)}
                                title="Edit Directive"
                              >
                                EDIT
                              </button>
                            )}
                          </div>
                          <h3 className="trello-card-title">{directive.title}</h3>
                          {directive.summary && (
                            <p className="trello-card-summary">{directive.summary}</p>
                          )}
                          <div className="trello-card-footer">
                            <span>VIEW DIRECTIVE &rarr;</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal View Detail Overlay */}
        {activeModal === "view" && currentDirective && (
          <div className="codex-modal-backdrop" onClick={() => setActiveModal(null)}>
            <div className="codex-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px" }}>
              <div className="codex-modal-header">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span className="trello-card-tag">{currentDirective.tag || "GENERAL"}</span>
                  <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.4rem", color: "var(--red-bright)", margin: 0, textShadow: "0 0 6px rgba(255,0,34,0.55), 0 0 20px rgba(255,0,34,0.35)" }}>{currentDirective.title}</h2>
                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--text-dim)" }}>{normalizeSection(currentDirective.section)}</span>
                </div>
                <button type="button" className="codex-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
              </div>

              <div className="codex-modal-body" style={{ padding: "1.5rem", color: "var(--text-bright)", lineHeight: "1.7" }}>
                {currentDirective.summary && (
                  <div style={{ background: "rgba(192,0,26,0.08)", borderLeft: "3px solid var(--red-bright)", padding: "1rem", marginBottom: "1.5rem", fontStyle: "italic", boxShadow: "inset 0 0 12px rgba(192,0,26,0.03)" }}>
                    {currentDirective.summary}
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "'Share Tech Mono', monospace", fontSize: "0.95rem", lineHeight: "1.6" }}>
                  {currentDirective.content}
                </div>
              </div>

              <div className="codex-modal-footer">
                {canEdit && (
                  <button type="button" className="hub-write-btn" onClick={() => handleOpenEdit(currentDirective)}>
                    EDIT DIRECTIVE
                  </button>
                )}
                <button type="button" className="hub-cancel-btn" onClick={() => setActiveModal(null)}>
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tailored Codex-Style Edit/Create Modal Overlay */}
        {activeModal === "edit" && (
          <div className="codex-modal-backdrop" onClick={() => setActiveModal(null)}>
            <div className="codex-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "750px" }}>
              <form onSubmit={handleSave}>
                <div className="codex-modal-header">
                  <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.2rem", color: "var(--red-bright)", margin: 0, letterSpacing: "0.15em", textShadow: "0 0 6px rgba(255,0,34,0.55), 0 0 20px rgba(255,0,34,0.35)" }}>
                    {formData.id ? "EDIT IMPERIAL DIRECTIVE" : "CREATE IMPERIAL DIRECTIVE"}
                  </h2>
                  <button type="button" className="codex-modal-close" onClick={() => setActiveModal(null)}>&times;</button>
                </div>

                <div className="codex-modal-body" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                  <div>
                    <label className="codex-label">DIRECTIVE TITLE</label>
                    <input
                      type="text"
                      className="codex-input"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="E.G. COMMUNICATIONS SERVER BINDING PROTOCOL"
                      required
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <label className="codex-label">SECTION ASSIGNMENT</label>
                      <select
                        className="codex-select"
                        value={formData.section}
                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      >
                        {SECTIONS.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="codex-label">TAG CLASSIFICATION</label>
                      <select
                        className="codex-select"
                        value={formData.tag}
                        onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                      >
                        {TAGS.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="codex-label">BRIEFING SUMMARY (CARD PREVIEW)</label>
                    <input
                      type="text"
                      className="codex-input"
                      value={formData.summary}
                      onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                      placeholder="Short 1-2 sentence high-level summary..."
                    />
                  </div>

                  <div>
                    <label className="codex-label">FULL DIRECTIVE CONTENT (IN-UNIVERSE TEXT)</label>
                    <textarea
                      className="codex-textarea"
                      rows={10}
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Write full in-universe directive using official Imperial terminology..."
                      required
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="checkbox"
                      id="is_published"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    />
                    <label htmlFor="is_published" className="codex-label" style={{ margin: 0, cursor: "pointer" }}>
                      PUBLISH DIRECTIVE TO HOLONET DOCTRINE BOARD
                    </label>
                  </div>
                </div>

                <div className="codex-modal-footer">
                  {formData.id && (
                    <button
                      type="button"
                      className="hub-cancel-btn"
                      style={{ color: "var(--red-bright)", borderColor: "var(--red-bright)", marginRight: "auto", textShadow: "0 0 6px var(--red-glow)" }}
                      onClick={() => handleDelete(formData.id)}
                    >
                      PURGE DIRECTIVE
                    </button>
                  )}
                  <button type="button" className="hub-cancel-btn" onClick={() => setActiveModal(null)}>
                    CANCEL
                  </button>
                  <button type="submit" className="hub-write-btn">
                    SAVE DIRECTIVE
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Load core scripts for loader dismissal & global Codex search modal */}
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/js/search.js"]} />

      <style jsx>{`
        .tag-chip {
          background: linear-gradient(135deg, rgba(192,0,26,0.08), transparent);
          border: 1px solid var(--border-hot);
          color: var(--text-dim);
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.72rem;
          padding: 0.35rem 0.75rem;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: all 0.3s ease;
          clip-path: polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px));
        }
        .tag-chip:hover, .tag-chip.active {
          border-color: var(--red-bright);
          color: var(--red-bright);
          background: rgba(192,0,26,0.15);
          box-shadow: 0 0 12px var(--red-glow), 0 0 2px rgba(0,200,255,0.08);
          text-shadow: 0 0 6px var(--red-glow);
        }

        .trello-board-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          width: 100%;
          align-items: start;
        }

        .trello-column {
          background: linear-gradient(135deg, rgba(192,0,26,0.05) 0%, transparent 60%);
          border: 1px solid var(--border-hot);
          padding: 1.2rem;
          position: relative;
          box-shadow:
            0 0 30px rgba(192,0,26,0.06),
            0 0 80px rgba(192,0,26,0.03),
            inset 0 0 40px rgba(192,0,26,0.03);
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          transition: box-shadow 0.4s;
        }

        .trello-column:hover {
          box-shadow:
            0 0 40px rgba(192,0,26,0.10),
            0 0 100px rgba(192,0,26,0.05),
            inset 0 0 40px rgba(192,0,26,0.04);
        }

        .trello-column::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid var(--border);
          pointer-events: none;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          opacity: 0.5;
        }

        .trello-column-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 0.8rem;
          margin-bottom: 1rem;
          position: relative;
        }
        .trello-column-header::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--red-dim) 15%, var(--red-bright) 50%, var(--red-dim) 85%, transparent);
          box-shadow: 0 0 10px var(--red-glow), 0 0 2px rgba(0,200,255,0.1);
          opacity: 0.6;
        }
        .trello-column-num {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.8rem;
          color: var(--red-bright);
          text-shadow: 0 0 6px var(--red-glow);
          animation: flicker 8s steps(1) infinite;
        }
        .trello-column-title {
          font-family: 'Cinzel', serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--red-bright);
          letter-spacing: 0.1em;
          margin: 0;
          flex: 1;
          text-shadow:
            0 0 6px rgba(255,0,34,0.55),
            0 0 20px rgba(255,0,34,0.35),
            0 0 50px rgba(192,0,26,0.2);
          transition: text-shadow 0.3s;
        }
        .trello-column:hover .trello-column-title {
          text-shadow:
            0 0 4px rgba(255,0,34,0.5),
            0 0 20px var(--red-bright),
            0 0 50px var(--red),
            0 0 100px var(--red-glow);
        }
        .trello-column-count {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.75rem;
          color: var(--text-dim);
        }

        .trello-column-cards {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .trello-empty-card {
          padding: 2rem 1rem;
          text-align: center;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.72rem;
          color: var(--text-dim);
          border: 1px dashed var(--border-hot);
          background: rgba(192,0,26,0.03);
        }

        .trello-card {
          background: linear-gradient(135deg, rgba(192,0,26,0.05) 0%, transparent 60%);
          border: 1px solid var(--border-hot);
          padding: 1.1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          box-shadow:
            0 0 20px rgba(192,0,26,0.04),
            inset 0 0 20px rgba(192,0,26,0.02);
        }
        .trello-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid var(--border);
          pointer-events: none;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          opacity: 0.5;
        }
        .trello-card:hover {
          border-color: var(--red-bright);
          transform: translateY(-2px);
          box-shadow:
            0 0 30px rgba(192,0,26,0.12),
            0 0 80px rgba(192,0,26,0.06),
            inset 0 0 30px rgba(192,0,26,0.05);
        }

        .trello-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }
        .trello-card-tag {
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.65rem;
          color: var(--red-bright);
          background: rgba(192,0,26,0.12);
          padding: 0.2rem 0.5rem;
          letter-spacing: 0.1em;
          border-left: 2px solid var(--red-bright);
          text-shadow: 0 0 4px var(--red-glow);
        }
        .trello-card-edit-btn {
          background: none;
          border: none;
          color: var(--text-dim);
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.65rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .trello-card-edit-btn:hover {
          color: var(--red-bright);
          text-shadow: 0 0 8px var(--red-glow);
        }

        .trello-card-title {
          font-family: 'Cinzel', serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-bright);
          margin: 0 0 0.5rem;
          letter-spacing: 0.08em;
          line-height: 1.3;
          transition: color 0.3s, text-shadow 0.3s;
        }
        .trello-card:hover .trello-card-title {
          color: var(--red-bright);
          text-shadow:
            0 0 6px rgba(255,0,34,0.4),
            0 0 18px var(--red-glow);
        }

        .trello-card-summary {
          font-size: 0.8rem;
          color: var(--text-dim);
          line-height: 1.5;
          margin: 0 0 0.8rem;
          font-family: 'Share Tech Mono', monospace;
        }

        .trello-card-footer {
          display: flex;
          justify-content: flex-end;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.7rem;
          color: var(--red);
          letter-spacing: 0.1em;
          text-shadow: 0 0 6px var(--red-glow);
          transition: color 0.3s, text-shadow 0.3s;
        }
        .trello-card:hover .trello-card-footer {
          color: var(--red-bright);
          text-shadow: 0 0 10px var(--red-glow);
        }

        /* Codex-style Modal Styling */
        .codex-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(6px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }

        .codex-modal-dialog {
          background: linear-gradient(135deg, rgba(192,0,26,0.05) 0%, transparent 60%), var(--surface);
          border: 1px solid var(--red-bright);
          box-shadow:
            0 0 40px rgba(192,0,26,0.15),
            0 0 100px rgba(192,0,26,0.06),
            inset 0 0 40px rgba(192,0,26,0.03);
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
        }

        .codex-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 1.2rem 1.5rem;
          border-bottom: 1px solid var(--border);
          position: relative;
        }
        .codex-modal-header::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--red-dim) 15%, var(--red-bright) 50%, var(--red-dim) 85%, transparent);
          box-shadow: 0 0 10px var(--red-glow);
          opacity: 0.6;
        }

        .codex-modal-close {
          background: none;
          border: none;
          color: var(--text-dim);
          font-size: 1.6rem;
          cursor: pointer;
          line-height: 1;
          transition: all 0.2s;
        }
        .codex-modal-close:hover {
          color: var(--red-bright);
          text-shadow: 0 0 10px var(--red-glow);
        }

        .codex-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.2rem 1.5rem;
          border-top: 1px solid var(--border);
          position: relative;
        }
        .codex-modal-footer::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--red-dim) 15%, var(--red-bright) 50%, var(--red-dim) 85%, transparent);
          box-shadow: 0 0 10px var(--red-glow);
          opacity: 0.4;
        }

        .codex-label {
          display: block;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.72rem;
          color: var(--text-dim);
          letter-spacing: 0.15em;
          margin-bottom: 0.4rem;
        }

        .codex-input, .codex-select, .codex-textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-hot);
          color: var(--text-bright);
          padding: 0.6rem 0.8rem;
          font-family: inherit;
          font-size: 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .codex-input:focus, .codex-select:focus, .codex-textarea:focus {
          border-color: var(--red-bright);
          box-shadow: 0 0 8px var(--red-glow);
          outline: none;
        }

        .hub-cancel-btn {
          background: transparent;
          border: 1px solid var(--border-hot);
          color: var(--text-dim);
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          padding: 0.5rem 1.2rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .hub-cancel-btn:hover {
          border-color: var(--red-bright);
          color: var(--red-bright);
          box-shadow: 0 0 8px var(--red-glow);
        }

        .hub-write-btn {
          background: rgba(192,0,26,0.12);
          border: 1px solid var(--red-bright);
          color: var(--red-bright);
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          padding: 0.5rem 1.2rem;
          cursor: pointer;
          text-shadow: 0 0 6px var(--red-glow);
          transition: all 0.2s ease;
        }
        .hub-write-btn:hover {
          background: var(--red-bright);
          color: #fff;
          box-shadow: 0 0 20px var(--red-glow), 0 0 4px rgba(0,200,255,0.1);
          text-shadow: none;
        }
      `}</style>
    </HolonetFrame>
  );
}
