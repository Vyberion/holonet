"use client";

import React, { useState, useEffect } from "react";
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

export default function TimelineClient() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeModal, setActiveModal] = useState(null); // 'edit' | null
  const [selectedImage, setSelectedImage] = useState(null);

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

  useEffect(() => {
    fetchTimeline();
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

  const filteredEntries = entries.filter((entry) => {
    if (selectedCategory === "all") return true;
    return (entry.category || "major_event").toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <HolonetFrame
      title="THE TIMELINE"
      subtitle="HISTORICAL CHRONOLOGY"
      footerNode="ARC-01"
      includeSearchOverlay
    >
      <div className="timeline-shell" style={{ width: "100%", margin: "0 auto", padding: "0.5rem 0 4rem" }}>
        
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
          <div className="timeline-track" style={{ position: "relative", paddingLeft: "2rem" }}>
            {/* Vertical Glowing Spine */}
            <div
              style={{
                position: "absolute",
                left: "8px",
                top: "10px",
                bottom: "10px",
                width: "2px",
                background: "linear-gradient(180deg, var(--red-bright) 0%, rgba(192,0,26,0.3) 50%, transparent 100%)",
                boxShadow: "0 0 10px var(--red-glow)"
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {filteredEntries.map((entry, index) => {
                const dateText = entry.dateLabel || [entry.startDate, entry.endDate].filter(Boolean).join(" - ") || "Undated Record";

                return (
                  <article
                    key={entry.id || index}
                    className="codex-article"
                    style={{ position: "relative", width: "100%", margin: "0 0 1.5rem 0", boxSizing: "border-box", scrollMarginTop: "100px" }}
                  >
                    {/* Node Dot on the Spine */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-2.35rem",
                        top: "2rem",
                        width: "14px",
                        height: "14px",
                        borderRadius: "50%",
                        background: "var(--surface)",
                        border: "2px solid var(--red-bright)",
                        boxShadow: "0 0 8px var(--red-glow)"
                      }}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.8rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.8rem", marginBottom: "1rem" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "0.3rem" }}>
                          <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.75rem", color: "var(--red-bright)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            // {entry.category || "EVENT"}
                          </span>
                          <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)", background: "rgba(0,0,0,0.5)", border: "1px solid var(--border)", padding: "0.1rem 0.4rem" }}>
                            {dateText}
                          </span>
                        </div>
                        <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.35rem", color: "var(--red-bright)", margin: 0, textShadow: "0 0 6px rgba(255,0,34,0.4)" }}>
                          {entry.title}
                        </h2>
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          className="hub-write-btn"
                          onClick={(e) => handleOpenEdit(entry, e)}
                          style={{ padding: "0.3rem 0.8rem", fontSize: "0.72rem" }}
                        >
                          EDIT RECORD
                        </button>
                      )}
                    </div>

                    {entry.summary && (
                      <div style={{ background: "rgba(192,0,26,0.06)", borderLeft: "3px solid var(--red-bright)", padding: "0.8rem 1rem", marginBottom: "1.2rem", fontStyle: "italic" }}>
                        <DiscordMarkdown content={entry.summary} />
                      </div>
                    )}

                    {entry.imageUrl && (
                      <div style={{ margin: "1rem 0", maxWidth: "600px", border: "1px solid var(--border-hot)", overflow: "hidden" }}>
                        <img
                          src={entry.imageUrl}
                          alt={entry.imageAlt || entry.title}
                          style={{ width: "100%", height: "auto", display: "block", cursor: "pointer" }}
                          onClick={() => setSelectedImage(entry.imageUrl)}
                        />
                      </div>
                    )}

                    <div style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.92rem", lineHeight: "1.65", color: "var(--text-bright)" }}>
                      <DiscordMarkdown content={entry.body} />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Universal Doctrine-Style Event Editor Modal */}
        {activeModal === "edit" && (
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
                      style={{ color: "var(--red-bright)", borderColor: "var(--red-bright)", marginRight: "auto" }}
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
          </div>
        )}

        {/* Image Lightbox */}
        {selectedImage && (
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
          </div>
        )}

      </div>
      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
