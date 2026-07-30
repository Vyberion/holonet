"use client";

import React, { useState, useEffect } from "react";
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

export default function StatutesPage() {
  const [statutes, setStatutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  
  const [editingStatute, setEditingStatute] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchStatutes();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/check-access");
      const data = await res.json();
      if (data?.authorized) {
        // Quick check if they might have permission based on their roles
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
    if (!confirm("Are you sure you want to delete this statute?")) return;
    try {
      const res = await fetch(`/api/codex/statutes?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        fetchStatutes();
      } else {
        alert("Failed to delete statute: " + data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!loading && !editingStatute && !isCreating) {
      // Need a small timeout to let React render the DOM first
      setTimeout(() => {
        window.initHolonetSearch?.();
      }, 100);
    }
  }, [statutes, loading, editingStatute, isCreating]);

  return (
    <HolonetFrame title="STATUTES" subtitle="LEGISLATIVE ARCHIVE" includeSearchOverlay>
      <div className="codex-shell" style={{ padding: "2rem" }}>
        
        {editingStatute || isCreating ? (
          <StatuteEditor 
            initialData={editingStatute} 
            onSave={(data) => saveStatute({ ...editingStatute, ...data })}
            onCancel={() => { setEditingStatute(null); setIsCreating(false); }}
          />
        ) : (
          <>
            {canEdit && (
              <div className="codex-toolbar">
                <button type="button" className="hub-write-btn" onClick={() => setIsCreating(true)}>WRITE STATUTE</button>
              </div>
            )}

            {loading ? (
              <p>Loading archives...</p>
            ) : statutes.length === 0 ? (
              <p>No statutes found.</p>
            ) : (
              <div className="statutes-list" style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
                {statutes.map((statute) => (
                  <article key={statute.id} className="codex-article" style={{ background: "rgba(0,0,0,0.3)", padding: "2rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <div className="article-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span className="article-number">ARCHIVE ID: {statute.id.split('-')[0].toUpperCase()}</span>
                        <h2 className="article-title">{statute.title}</h2>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="h-button secondary small" onClick={() => setEditingStatute(statute)}>Edit</button>
                          <button className="h-button danger small" onClick={() => deleteStatute(statute.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                    
                    <div className="article-content" style={{ marginTop: "2rem" }}>
                      {statute.sections?.map((section, sIndex) => (
                        <div key={section.id || sIndex} className="regulation" style={{ marginBottom: "2rem" }}>
                          <h3 className="reg-title" style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "1rem" }}>
                            SECTION {getRomanNumeral(sIndex + 1)}: {section.text}
                          </h3>
                          
                          <div style={{ paddingLeft: "1.5rem" }}>
                            {section.clauses?.map((clause, cIndex) => (
                              <div key={clause.id || cIndex} style={{ marginBottom: "1rem" }}>
                                <p className="reg-text">({getLetter(cIndex + 1)}) {clause.text}</p>
                                
                                <div style={{ paddingLeft: "2rem", marginTop: "0.5rem" }}>
                                  {clause.subClauses?.map((subClause, scIndex) => (
                                    <div key={subClause.id || scIndex} style={{ marginBottom: "0.5rem" }}>
                                      <p className="reg-text">{scIndex + 1}. {subClause.text}</p>
                                      
                                      <div style={{ paddingLeft: "2rem", marginTop: "0.5rem" }}>
                                        {subClause.subSubClauses?.map((subSubClause, sscIndex) => (
                                          <p key={subSubClause.id || sscIndex} className="reg-text">
                                            {getRomanNumeral(sscIndex + 1).toLowerCase()}. {subSubClause.text}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "2rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>
                      Last updated by {statute.updated_by} on {new Date(statute.updated_at).toLocaleDateString()}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/js/search.js"]} />
    </HolonetFrame>
  );
}
