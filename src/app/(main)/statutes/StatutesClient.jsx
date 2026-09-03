"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { SectionEditor, StatuteMetaEditor } from "../../../components/StatuteEditor.jsx";
import { processStatuteSlugs } from "../../../lib/slugUtils.js";

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

function StatutesPageContent({ initialSlug }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [statutes, setStatutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [canViewDrafts, setCanViewDrafts] = useState(false);
  
  const [editingSectionIndex, setEditingSectionIndex] = useState(null); // null = off, -1 = new, >=0 = index
  const [insertAfterSectionIndex, setInsertAfterSectionIndex] = useState(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const viewingId = searchParams.get("id");
  const viewingStatute = statutes.find(s => s.slug === initialSlug || s.id === viewingId);

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

        const hasDraftViewAccess = hasAccess || 
                                   Object.values(profile?.authorityRoles || {}).some(Boolean) ||
                                   (profile?.divisions?.darkCouncil && profile.divisions.darkCouncil !== "none");
        setCanViewDrafts(!!hasDraftViewAccess);
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
        setStatutes(processStatuteSlugs(data.data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const scrollToElementId = (targetId) => {
    if (!targetId) return;
    const el = document.getElementById(targetId) || document.querySelector(`[id="${targetId}"]`);
    if (el) {
      const header = document.querySelector(".nav-header, header, nav");
      const headerHeight = header ? header.getBoundingClientRect().height : 80;
      const top = el.getBoundingClientRect().top + window.pageYOffset - headerHeight - 25;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!loading && viewingStatute) {
      setTimeout(() => {
        if (window.location.hash) {
          scrollToElementId(window.location.hash.replace(/^#/, ""));
        }
      }, 250);
    }
  }, [loading, viewingStatute]);

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
        setEditingSectionIndex(null);
        setInsertAfterSectionIndex(null);
        setEditingMeta(false);
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
    if (!confirm("Are you sure you want to delete this statute? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/codex/statutes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setEditingSectionIndex(null);
        setInsertAfterSectionIndex(null);
        setEditingMeta(false);
        setIsCreating(false);
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

  const unpublishStatute = async (statute) => {
    if (!confirm(`Are you sure you want to unpublish "${statute.title}"? This will revert it to a draft state.`)) return;
    try {
      const res = await fetch("/api/codex/statutes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...statute, is_published: false })
      });
      const data = await res.json();
      if (data.ok) {
        fetchStatutes();
      } else {
        alert("Failed to unpublish statute: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSection = async (updatedSection) => {
    if (!viewingStatute) return;
    const currentSections = [...(viewingStatute.sections || [])];
    if (editingSectionIndex === -1) {
      if (insertAfterSectionIndex !== null && insertAfterSectionIndex >= 0 && insertAfterSectionIndex < currentSections.length) {
        currentSections.splice(insertAfterSectionIndex + 1, 0, updatedSection);
      } else {
        currentSections.push(updatedSection);
      }
    } else if (editingSectionIndex >= 0) {
      currentSections[editingSectionIndex] = updatedSection;
    }
    await saveStatute({
      ...viewingStatute,
      sections: currentSections
    });
    setInsertAfterSectionIndex(null);
  };

  const handleDeleteSection = async () => {
    if (!viewingStatute || editingSectionIndex < 0) return;
    if (!confirm("Are you sure you want to delete this section block?")) return;
    const currentSections = viewingStatute.sections.filter((_, i) => i !== editingSectionIndex);
    await saveStatute({
      ...viewingStatute,
      sections: currentSections
    });
    setInsertAfterSectionIndex(null);
  };

  const handleSaveMeta = async (metaData) => {
    if (isCreating) {
      await saveStatute({
        ...metaData,
        sections: [],
        is_published: false
      });
    } else if (viewingStatute) {
      await saveStatute({
        ...viewingStatute,
        ...metaData
      });
    }
  };

  useEffect(() => {
    if (!loading && editingSectionIndex === null && !editingMeta && !isCreating) {
      setTimeout(() => {
        window.initHolonetSearch?.();
      }, 100);
    }
  }, [statutes, loading, editingSectionIndex, editingMeta, isCreating, viewingStatute]);

  const renderStatuteGridCard = (statute, isDraft) => {
    const status = "restricted";
    return (
      <div 
        key={statute.id} 
        className="dir-card"
        data-status={status}
        aria-label={`${statute.title} - ${isDraft ? "draft" : "published"}`}
        onClick={() => router.push(`/statutes/${statute.slug}`)}
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
    <HolonetFrame title={viewingStatute ? viewingStatute.title.toUpperCase() : "STATUTES"} subtitle="LEGISLATIVE ARCHIVE" includeSearchOverlay>
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
        .contents-link { transition: color 0.2s ease, text-shadow 0.2s ease; cursor: pointer; }
        .contents-link:hover { color: var(--red-bright); text-shadow: 0 0 5px var(--red-glow); }
      `}</style>
      
      {viewingStatute ? (
        // READER MODE
        <div className="codex-shell">
          <aside className="codex-contents">
            <div className="codex-contents-panel">
              <div className="codex-contents-header">
                <h2 className="codex-contents-title">STATUTE CONTENTS</h2>
              </div>
              <div className="codex-contents-list">
                {viewingStatute.sections?.map((section, sIndex) => (
                  <div key={section.id || sIndex} className="contents-article">
                    <a 
                      className="contents-link" 
                      href={`#section-${sIndex}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const targetId = `section-${sIndex}`;
                        scrollToElementId(targetId);
                        window.history.pushState(null, "", `#${targetId}`);
                      }}
                    >
                      {`${String(sIndex + 1).padStart(2, '0')} | ${section.text || `SECTION ${getRomanNumeral(sIndex + 1)}`}`}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          
          <div className="codex-document" data-library-document="codex">

            <div className="codex-toolbar" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              {canEdit && (
                <div style={{ display: "flex", gap: "1rem" }}>
                  {viewingStatute.is_published === false ? (
                    <button type="button" className="hub-write-btn" onClick={() => publishStatute(viewingStatute)}>PUBLISH</button>
                  ) : (
                    <button type="button" className="hub-write-btn" onClick={() => unpublishStatute(viewingStatute)}>UNPUBLISH</button>
                  )}
                  <button type="button" className="hub-write-btn" onClick={() => setEditingMeta(true)}>EDIT DETAILS</button>
                  <button type="button" className="hub-write-btn" onClick={() => { setInsertAfterSectionIndex(null); setEditingSectionIndex(-1); }}>ADD SECTION</button>
                </div>
              )}
            </div>

            <div className="statute-reader" style={{ marginTop: "2rem" }}>
              {viewingStatute.sections?.map((section, sIndex) => (
                <article key={section.id || sIndex} className="codex-article" id={`section-${sIndex}`}>
                  <div className="article-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div>
                      <span className="article-number">SECTION {getRomanNumeral(sIndex + 1)}</span>
                      <h2 className="article-title">{section.text}</h2>
                    </div>
                    {canEdit && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button 
                          type="button" 
                          className="hub-write-btn" 
                          onClick={() => { setInsertAfterSectionIndex(null); setEditingSectionIndex(sIndex); }}
                          style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                        >
                          EDIT SECTION
                        </button>
                        <button 
                          type="button" 
                          className="hub-write-btn" 
                          onClick={() => { setInsertAfterSectionIndex(sIndex); setEditingSectionIndex(-1); }}
                          style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                        >
                          INSERT SECTION BELOW
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="article-content">
                    {section.clauses?.map((clause, cIndex) => (
                      <div key={clause.id || cIndex} className="regulation" style={{ marginBottom: "1.5rem" }}>
                        <p className="reg-text">
                          <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "0.85em", color: "inherit" }}>({getLetter(cIndex + 1)})</span>
                          {clause.text}
                        </p>
                        
                        {clause.subClauses?.length > 0 && (
                          <div style={{ marginTop: "1rem", paddingLeft: "1.5rem" }}>
                            {clause.subClauses.map((subClause, scIndex) => (
                              <div key={subClause.id || scIndex} className="sub-clause" style={{ marginBottom: "1rem" }}>
                                <p className="reg-text">
                                  <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "0.85em", color: "inherit" }}>{scIndex + 1}.</span>
                                  {subClause.text}
                                </p>

                                {subClause.subSubClauses?.length > 0 && (
                                  <div style={{ paddingLeft: "1.5rem", marginTop: "0.5rem" }}>
                                    {subClause.subSubClauses.map((subSubClause, sscIndex) => (
                                      <div key={subSubClause.id || sscIndex} className="sub-clause" style={{ marginBottom: "0.5rem" }}>
                                        <p className="reg-text">
                                          <span className="reg-title" style={{ textTransform: "none", display: "inline", margin: 0, marginRight: "0.5rem", fontSize: "0.85em", color: "inherit" }}>{getRomanNumeral(sscIndex + 1).toLowerCase()}.</span>
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
            ) : !canViewDrafts ? (
              <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
                <h2 style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", letterSpacing: "0.15em", marginBottom: "1rem" }}>CLEARANCE REQUIRED</h2>
                <p style={{ color: "var(--text-dim)", maxWidth: "520px", margin: "0 auto 2rem" }}>Access to the main legislative statutes index is restricted to authorized Dark Council and High Command personnel.</p>
                <button type="button" className="hub-write-btn" onClick={() => router.push("/codex")}>RETURN TO CODEX</button>
              </div>
            ) : statutes.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p>No statutes found.</p>
                {canEdit && (
                  <button type="button" className="hub-write-btn" style={{ alignSelf: "flex-start" }} onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
                )}
              </div>
            ) : (
              <div className="statutes-list-container">
                {canViewDrafts && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "2rem" }}>
                      <h2 id="drafts" className="codex-section-title" style={{ fontFamily: "Orbitron, monospace", color: "var(--red-bright)", fontSize: "1.2rem", letterSpacing: "0.2em", margin: 0, borderBottom: "none", paddingBottom: 0 }}>DRAFTS</h2>
                      {canEdit && (
                        <button type="button" className="hub-write-btn" onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
                      )}
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

                {canViewDrafts && statutes.filter(s => s.is_published).length > 0 && (
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

      {/* SECTION BLOCK EDITOR */}
      {editingSectionIndex !== null && (
        <SectionEditor 
          section={editingSectionIndex >= 0 ? viewingStatute?.sections?.[editingSectionIndex] : null} 
          sectionIndex={editingSectionIndex >= 0 ? editingSectionIndex : (insertAfterSectionIndex !== null ? insertAfterSectionIndex + 1 : (viewingStatute?.sections?.length || 0))}
          onSave={handleSaveSection}
          onCancel={() => { setEditingSectionIndex(null); setInsertAfterSectionIndex(null); }}
          onDelete={handleDeleteSection}
        />
      )}

      {/* STATUTE META / CREATION EDITOR */}
      {(editingMeta || isCreating) && (
        <StatuteMetaEditor
          initialData={isCreating ? null : viewingStatute}
          onSave={handleSaveMeta}
          onCancel={() => { setEditingMeta(false); setIsCreating(false); }}
          onDelete={isCreating ? null : deleteStatute}
        />
      )}

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/js/search.js"]} />
    </HolonetFrame>
  );
}

export default function StatutesClient({ initialSlug }) {
  return (
    <Suspense fallback={<div>Loading archives...</div>}>
      <StatutesPageContent initialSlug={initialSlug} />
    </Suspense>
  );
}
