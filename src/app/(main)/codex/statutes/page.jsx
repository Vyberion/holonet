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
  }, [statutes, loading, editingStatute, isCreating]);

  const renderStatuteGridCard = (statute, isDraft) => (
    <article 
      key={statute.id} 
      className="codex-article" 
      style={{ 
        background: "rgba(0,0,0,0.3)", 
        padding: "1.5rem", 
        border: "1px solid rgba(255,255,255,0.1)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
      onClick={() => router.push(`${pathname}?id=${statute.id}`)}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--red-bright)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
    >
      <div className="article-header" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span className="article-number" style={{ fontSize: "0.7rem", opacity: 0.7 }}>ARCHIVE ID: {statute.id.split('-')[0].toUpperCase()}</span>
        <h2 className="article-title" style={{ fontSize: "1.2rem", margin: 0, marginBottom: "1rem" }}>{statute.title}</h2>
      </div>

      <div>
        <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
          Published: {new Date(statute.updated_at).toLocaleDateString()}
        </div>

        {canEdit && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
            {isDraft && <button type="button" className="hub-write-btn" onClick={(e) => { e.stopPropagation(); publishStatute(statute); }}>PUBLISH</button>}
            <button type="button" className="hub-write-btn" onClick={(e) => { e.stopPropagation(); setEditingStatute(statute); }}>EDIT</button>
          </div>
        )}
      </div>
    </article>
  );

  return (
    <HolonetFrame title="STATUTES" subtitle="LEGISLATIVE ARCHIVE" includeSearchOverlay>
      <style>{`
        .statutes-toolbar::after { display: none !important; }
        .back-btn:hover { color: var(--red-bright) !important; text-shadow: 0 0 5px var(--red-glow); }
      `}</style>
      
      {viewingStatute ? (
        // READER MODE
        <div className="codex-shell">
          <aside className="codex-contents" data-library-contents>
            <div className="codex-contents-panel">
              <div className="codex-contents-header">
                <h2 className="codex-contents-title">SECTIONS</h2>
              </div>
              <div className="codex-contents-list">
                {viewingStatute.sections?.map((section, sIndex) => (
                  <div key={section.id || sIndex} className="contents-article">
                    <a className="contents-link" href={`#section-${sIndex}`}>SECTION ${getRomanNumeral(sIndex + 1)}</a>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          
          <div className="codex-document" data-library-document="codex">
            <div className="codex-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button 
                type="button" 
                className="back-btn"
                style={{ background: "transparent", border: "none", color: "var(--theme-color)", fontFamily: "Orbitron, monospace", fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
                onClick={() => router.push(pathname)}
              >
                &larr; BACK TO ARCHIVES
              </button>
              {canEdit && (
                <button type="button" className="hub-write-btn" onClick={() => setEditingStatute(viewingStatute)}>EDIT STATUTE</button>
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
                      <div key={clause.id || cIndex} className="regulation">
                        <h3 className="reg-title">REGULATION {getLetter(cIndex + 1).toUpperCase()}</h3>
                        <p className="reg-text">{clause.text}</p>
                        
                        {clause.subClauses?.length > 0 && (
                          <div style={{ marginTop: "1rem" }}>
                            {clause.subClauses.map((subClause, scIndex) => (
                              <div key={subClause.id || scIndex} className="sub-clause">
                                <span className="sub-marker">Sub-Section {toRoman ? toRoman(scIndex + 1) : getRomanNumeral(scIndex + 1)}</span>
                                <p className="reg-text">{subClause.text}</p>

                                {subClause.subSubClauses?.length > 0 && (
                                  <div style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                                    {subClause.subSubClauses.map((subSubClause, sscIndex) => (
                                      <div key={subSubClause.id || sscIndex} className="sub-clause" style={{ marginTop: "0.5rem" }}>
                                        <span className="sub-marker" style={{ fontSize: "0.7rem", opacity: 0.7 }}>Provision {getRomanNumeral(sscIndex + 1).toLowerCase()}</span>
                                        <p className="reg-text" style={{ fontSize: "0.85rem", opacity: 0.9 }}>{subSubClause.text}</p>
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
        <div className="codex-shell">
          <aside className="codex-contents" data-library-contents></aside>
          <div className="codex-document" data-library-document="codex">
            <div className="codex-toolbar statutes-toolbar" style={{ borderBottom: "none", width: "100%", justifyContent: "flex-end" }}>
              {canEdit && (
                <button type="button" className="hub-write-btn" onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
              )}
            </div>

            {loading ? (
              <p>Loading archives...</p>
            ) : statutes.length === 0 ? (
              <p>No statutes found.</p>
            ) : (
              <div className="statutes-list-container">
                {canEdit && statutes.filter(s => !s.is_published).length > 0 && (
                  <>
                    <h2 className="codex-section-title" style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", fontSize: "1.2rem", letterSpacing: "0.2em", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>DRAFTS</h2>
                    <div className="statutes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "2rem", marginBottom: "4rem" }}>
                      {statutes.filter(s => !s.is_published).map((statute) => renderStatuteGridCard(statute, true))}
                    </div>
                  </>
                )}

                {canEdit && statutes.filter(s => s.is_published).length > 0 && (
                  <h2 className="codex-section-title" style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", fontSize: "1.2rem", letterSpacing: "0.2em", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem", marginTop: statutes.filter(s => !s.is_published).length > 0 ? "0" : "0" }}>PUBLISHED</h2>
                )}

                <div className="statutes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "2rem" }}>
                  {statutes.filter(s => s.is_published).map((statute) => renderStatuteGridCard(statute, false))}
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
