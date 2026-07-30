"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { StatuteEditor } from "../../../../components/StatuteEditor.jsx";

function getRomanNumeral(num) {
  const lookup = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
  let roman = "";
  for (let i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}

function getLetter(num) {
  return String.fromCharCode(96 + num); // 1 = a, 2 = b, 3 = c
}

function toRoman(value) {
  const number = Math.max(1, Math.min(3999, Number(value) || 1));
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let remaining = number;
  let result = "";
  numerals.forEach(([amount, glyph]) => {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  });
  return result;
}

function StatutesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [statutes, setStatutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  
  const [editingStatute, setEditingStatute] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const viewingId = searchParams.get("id");
  const viewingStatute = statutes.find(s => s.id === viewingId);

  useEffect(() => {
    fetchStatutes();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/check-access");
      const data = await res.json();
      if (data?.authorized) {
        const profile = data.profile;
        const hasAccess = profile?.isSuperUser || profile?.hasFullAccess || 
                          profile?.authorityRoles?.emperor || 
                          profile?.authorityRoles?.groupOwner || 
                          profile?.authorityRoles?.projectManager;
        setCanEdit(!!hasAccess);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStatutes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/codex/statutes");
      const data = await res.json();
      if (data.ok) {
        setStatutes(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveStatute = async (statuteData) => {
    try {
      const isUpdate = !!statuteData.id;
      const res = await fetch("/api/codex/statutes", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statuteData)
      });
      const data = await res.json();
      if (data.ok) {
        setEditingStatute(null);
        setIsCreating(false);
        fetchStatutes();
      } else {
        alert("Failed to save statute: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteStatute = async (id) => {
    try {
      const res = await fetch(`/api/codex/statutes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setEditingStatute(null);
        if (viewingId === id) {
          router.push(pathname);
        }
        fetchStatutes();
      } else {
        alert("Failed to delete statute: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const publishStatute = async (statute) => {
    if (!confirm(`Are you sure you want to publish "${statute.title}"? The bot will announce this.`)) return;
    try {
      const res = await fetch("/api/codex/statutes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...statute, is_published: true })
      });
      const data = await res.json();
      if (data.ok) {
        fetchStatutes();
      } else {
        alert("Failed to publish statute: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading && !editingStatute && !isCreating) {
      setTimeout(() => {
        window.initHolonetSearch?.();
      }, 100);
    }
  }, [statutes, loading, editingStatute, isCreating, viewingStatute]);

  const renderStatuteGridCard = (statute, isDraft, index) => {
    const status = "restricted";
    return (
      <div 
        key={statute.id} 
        className="dir-card"
        data-status={status}
        aria-label={`${statute.title} - ${isDraft ? "draft" : "published"}`}
        onClick={() => router.push(`${pathname}?id=${statute.id}`)}
        style={{ cursor: "pointer" }}
      >
        <div className="dir-card-frame" aria-hidden="true" />
        <div className="card-vline" aria-hidden="true" />
        <div className="card-scan" aria-hidden="true" />
        <div className="dir-card-top">
          <h2 className="dir-card-title">{statute.title}</h2>
          <span className="dir-card-badge">{isDraft ? "[ DRAFT ]" : "[ PUBLISHED ]"}</span>
        </div>
        <p className="dir-card-desc">{statute.summary || "No summary provided."}</p>
        <div className="dir-card-bottom">
          <span className="dir-card-node">ID: {statute.id.split('-')[0].toUpperCase()}</span>
          <a
            href="#"
            className="dir-card-enter action-btn"
            aria-hidden="true"
            tabIndex={-1}
            onClick={(e) => e.preventDefault()}
          >
            READ STATUTE
          </a>
        </div>
      </div>
    );
  };

  return (
    <HolonetFrame title="STATUTES" subtitle="LEGISLATIVE ARCHIVE" includeSearchOverlay>
      <style>{`
        .back-btn:hover { color: var(--red-bright) !important; text-shadow: 0 0 5px var(--red-glow); }
        .statutes-grid-layout {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        @media (max-width: 1100px) {
          .statutes-grid-layout {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .statutes-grid-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      
      {viewingStatute ? (
        // READER MODE
        <div className="codex-shell" style={{ display: "flex", gap: "2rem" }}>
          <aside className="codex-contents">
            <div className="codex-contents-panel">
              <div className="codex-contents-header">
                <h2 className="codex-contents-title">STATUTE CONTENTS</h2>
              </div>
              <div className="codex-contents-list">
                {viewingStatute.sections?.map((section, sIndex) => (
                  <div key={section.id || sIndex} className="contents-article">
                    <a className="contents-link" href={`#section-${sIndex}`}>{section.text || `SECTION ${getRomanNumeral(sIndex + 1)}`}</a>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          
          <div className="codex-document" data-library-document="codex">
            <div className="codex-toolbar" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              {canEdit && (
                <div style={{ display: "flex", gap: "1rem" }}>
                  {viewingStatute.is_published === false && (
                    <button type="button" className="hub-write-btn" onClick={() => publishStatute(viewingStatute)}>PUBLISH</button>
                  )}
                  <button type="button" className="hub-write-btn" onClick={() => setEditingStatute(viewingStatute)}>EDIT STATUTE</button>
                </div>
              )}
            </div>

            <div className="statute-reader" style={{ marginTop: "2rem" }}>
              {viewingStatute.sections?.map((section, sIndex) => (
                <article key={section.id || sIndex} className="codex-article" id={`section-${sIndex}`}>
                  <div className="article-header">
                    <span className="article-number">SECTION {getRomanNumeral(sIndex + 1)}</span>
                    <h2 className="article-title">{section.text}</h2>
                  </div>
                  
                  <div className="article-content">
                    {section.clauses?.map((clause, cIndex) => (
                      <div key={clause.id || cIndex} className="regulation" style={{ marginBottom: "1.5rem" }}>
                        <p className="reg-text">
                          <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "0.85em" }}>({getLetter(cIndex + 1)})</span>
                          {clause.text}
                        </p>
                        
                        {clause.subClauses?.length > 0 && (
                          <div style={{ marginTop: "1rem", paddingLeft: "1.5rem" }}>
                            {clause.subClauses.map((subClause, scIndex) => (
                              <div key={subClause.id || scIndex} className="sub-clause" style={{ marginBottom: "1rem" }}>
                                <p className="reg-text">
                                  <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "inherit" }}>{scIndex + 1}.</span>
                                  {subClause.text}
                                </p>

                                {subClause.subSubClauses?.length > 0 && (
                                  <div style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
                                    {subClause.subSubClauses.map((subSubClause, sscIndex) => (
                                      <div key={subSubClause.id || sscIndex} className="sub-clause" style={{ marginBottom: "0.5rem" }}>
                                        <p className="reg-text">
                                          <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "inherit" }}>{getRomanNumeral(sscIndex + 1).toLowerCase()}.</span>
                                          {subSubClause.text}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // GRID MODE
        <div className="codex-shell" style={{ display: "block" }}>
          <div className="codex-document" data-library-document="codex">
            {loading ? (
              <p>Loading archives...</p>
            ) : statutes.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p>No statutes found.</p>
                {canEdit && (
                  <button type="button" className="hub-write-btn" style={{ alignSelf: "flex-start" }} onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
                )}
              </div>
            ) : (
              <div className="statutes-list-container">
                {canEdit && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>
                      <h2 id="drafts" className="codex-section-title" style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", fontSize: "1.2rem", letterSpacing: "0.2em", margin: 0, borderBottom: "none", paddingBottom: 0 }}>DRAFTS</h2>
                      <button type="button" className="hub-write-btn" onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
                    </div>
                    {statutes.filter(s => !s.is_published).length > 0 ? (
                      <div className="statutes-grid-layout" style={{ marginBottom: "4rem" }}>
                        {statutes.filter(s => !s.is_published).map((statute, index) => renderStatuteGridCard(statute, true, index))}
                      </div>
                    ) : (
                      <p style={{ color: "var(--text-dim)", fontStyle: "italic", marginBottom: "4rem" }}>No draft statutes.</p>
                    )}
                  </>
                )}

                {canEdit && statutes.filter(s => s.is_published).length > 0 && (
                  <h2 id="published" className="codex-section-title" style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", fontSize: "1.2rem", letterSpacing: "0.2em", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem", marginTop: statutes.filter(s => !s.is_published).length > 0 ? "0" : "0" }}>PUBLISHED</h2>
                )}

                <div className="statutes-grid-layout">
                  {statutes.filter(s => s.is_published).map((statute, index) => renderStatuteGridCard(statute, false, index))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(editingStatute || isCreating) && (
        <StatuteEditor 
          initialData={editingStatute} 
          onSave={(data) => saveStatute({ ...editingStatute, ...data })}
          onCancel={() => { setEditingStatute(null); setIsCreating(false); }}
          onDelete={deleteStatute}
        />
      )}

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/js/search.js"]} />
    </HolonetFrame>
  );
}

export default function StatutesPage() {
  return (
    <Suspense fallback={<div>Loading archives...</div>}>
      <StatutesPageContent />
    </Suspense>
  );
}
