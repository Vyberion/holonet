"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

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

function insertAt(arr = [], index, item) {
  const list = [...arr];
  if (index === undefined || index === null || index < 0 || index >= list.length) {
    list.push(item);
  } else {
    list.splice(index + 1, 0, item);
  }
  return list;
}

/**
 * SingleSectionEditor: Edits an independent section block (title, clauses, sub-clauses, provisions).
 */
export function SectionEditor({ section, sectionIndex, onSave, onCancel, onDelete }) {
  const [text, setText] = useState(section?.text || "");
  const [clauses, setClauses] = useState(section?.clauses || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const addClause = (afterIndex = null) => {
    const newClause = { id: generateId(), text: "", subClauses: [] };
    setClauses(insertAt(clauses, afterIndex, newClause));
  };

  const updateClause = (cIndex, value) => {
    const updated = [...clauses];
    updated[cIndex].text = value;
    setClauses(updated);
  };

  const removeClause = (cIndex) => {
    if (!window.confirm("Are you sure you want to delete this clause?")) return;
    setClauses(clauses.filter((_, i) => i !== cIndex));
  };

  const addSubClause = (cIndex, afterIndex = null) => {
    const updated = [...clauses];
    if (!updated[cIndex].subClauses) updated[cIndex].subClauses = [];
    const newSubClause = { id: generateId(), text: "", subSubClauses: [] };
    updated[cIndex].subClauses = insertAt(updated[cIndex].subClauses, afterIndex, newSubClause);
    setClauses(updated);
  };

  const updateSubClause = (cIndex, scIndex, value) => {
    const updated = [...clauses];
    updated[cIndex].subClauses[scIndex].text = value;
    setClauses(updated);
  };

  const removeSubClause = (cIndex, scIndex) => {
    const updated = [...clauses];
    updated[cIndex].subClauses.splice(scIndex, 1);
    setClauses(updated);
  };

  const addSubSubClause = (cIndex, scIndex, afterIndex = null) => {
    const updated = [...clauses];
    if (!updated[cIndex].subClauses[scIndex].subSubClauses) {
      updated[cIndex].subClauses[scIndex].subSubClauses = [];
    }
    const newSubSubClause = { id: generateId(), text: "" };
    updated[cIndex].subClauses[scIndex].subSubClauses = insertAt(
      updated[cIndex].subClauses[scIndex].subSubClauses,
      afterIndex,
      newSubSubClause
    );
    setClauses(updated);
  };

  const updateSubSubClause = (cIndex, scIndex, sscIndex, value) => {
    const updated = [...clauses];
    updated[cIndex].subClauses[scIndex].subSubClauses[sscIndex].text = value;
    setClauses(updated);
  };

  const removeSubSubClause = (cIndex, scIndex, sscIndex) => {
    const updated = [...clauses];
    updated[cIndex].subClauses[scIndex].subSubClauses.splice(sscIndex, 1);
    setClauses(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      alert("Section title is required.");
      return;
    }
    setIsSaving(true);
    await onSave({
      id: section?.id || generateId(),
      text,
      clauses
    });
    setIsSaving(false);
  };

  const isNew = sectionIndex === -1 || !section;
  const sectionLabel = isNew ? "NEW SECTION" : `SECTION ${getRomanNumeral(sectionIndex + 1)}`;

  const modalContent = (
    <div id="library-editor-overlay" className="active" style={{ zIndex: 99999 }} onClick={(e) => e.target.id === "library-editor-overlay" && onCancel()}>
      <div className="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="section-editor-title">
        
        <div className="resource-editor-topbar">
          <span className="resource-editor-title" id="section-editor-title">
            EDIT {sectionLabel}
          </span>
          <button type="button" className="resource-editor-close" onClick={onCancel}>CLOSE</button>
        </div>

        <form className="resource-editor-form library-editor-form" id="section-editor-form" onSubmit={handleSave}>
          
          <div className="resource-editor-field">
            <label>Section Title ({sectionLabel})</label>
            <input 
              type="text" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              placeholder="e.g. GENERAL PROVISIONS" 
              required 
            />
          </div>

          <div className="library-entry-stack" style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {clauses.map((clause, cIndex) => (
              <div key={clause.id || cIndex} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "4px" }}>
                <div className="resource-editor-field" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <label style={{ margin: 0 }}>Clause ({getLetter(cIndex + 1)})</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)" }} onClick={() => addClause(cIndex)}>
                        + Insert Clause Below
                      </button>
                      <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeClause(cIndex)}>
                        Remove Clause
                      </button>
                    </div>
                  </div>
                  <textarea 
                    value={clause.text} 
                    onChange={(e) => updateClause(cIndex, e.target.value)} 
                    placeholder="Clause text..." 
                    required 
                    rows={2}
                  />
                </div>

                <div style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {clause.subClauses?.map((subClause, scIndex) => (
                    <div key={subClause.id || scIndex} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div className="resource-editor-field" style={{ marginBottom: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                          <label style={{ margin: 0 }}>Sub-Clause {scIndex + 1}.</label>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)" }} onClick={() => addSubClause(cIndex, scIndex)}>
                              + Insert Sub-Clause Below
                            </button>
                            <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeSubClause(cIndex, scIndex)}>
                              Remove
                            </button>
                          </div>
                        </div>
                        <textarea 
                          value={subClause.text} 
                          onChange={(e) => updateSubClause(cIndex, scIndex, e.target.value)} 
                          placeholder="Sub-clause text..." 
                          required 
                          rows={2}
                        />
                      </div>

                      <div style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {subClause.subSubClauses?.map((subSubClause, sscIndex) => (
                          <div key={subSubClause.id || sscIndex} className="resource-editor-field" style={{ marginBottom: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                              <label style={{ margin: 0 }}>Provision {getRomanNumeral(sscIndex + 1).toLowerCase()}.</label>
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)" }} onClick={() => addSubSubClause(cIndex, scIndex, sscIndex)}>
                                  + Insert Below
                                </button>
                                <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeSubSubClause(cIndex, scIndex, sscIndex)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                            <textarea 
                              value={subSubClause.text} 
                              onChange={(e) => updateSubSubClause(cIndex, scIndex, sscIndex, e.target.value)} 
                              placeholder="Provision text..." 
                              required 
                              rows={2}
                            />
                          </div>
                        ))}
                        {(!subClause.subSubClauses || subClause.subSubClauses.length === 0) && (
                          <button type="button" className="library-inline-btn" onClick={() => addSubSubClause(cIndex, scIndex)}>
                            + ADD PROVISION
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!clause.subClauses || clause.subClauses.length === 0) && (
                    <button type="button" className="library-inline-btn" onClick={() => addSubClause(cIndex)}>
                      + ADD SUB-CLAUSE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="library-editor-buttons" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="library-inline-btn" onClick={() => addClause()}>+ ADD CLAUSE TO END</button>
            {!isNew && onDelete && (
              <button type="button" className="library-inline-btn danger" onClick={onDelete}>DELETE SECTION</button>
            )}
          </div>

        </form>

        <div className="resource-editor-actions">
          <span className="resource-editor-status" data-library-status>{isSaving ? "Saving..." : ""}</span>
          <button type="submit" className="resource-editor-submit" form="section-editor-form" disabled={isSaving}>SAVE SECTION</button>
        </div>

        <div className="resource-editor-footer">
          <span className="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
        </div>

      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}

/**
 * StatuteMetaEditor: Edits the title, summary, or handles creation/deletion of a Statute.
 */
export function StatuteMetaEditor({ initialData, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [summary, setSummary] = useState(initialData?.summary || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }
    setIsSaving(true);
    await onSave({ title, summary });
    setIsSaving(false);
  };

  const modalContent = (
    <div id="library-editor-overlay" className="active" style={{ zIndex: 99999 }} onClick={(e) => e.target.id === "library-editor-overlay" && onCancel()}>
      <div className="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="meta-editor-title">
        
        <div className="resource-editor-topbar">
          <span className="resource-editor-title" id="meta-editor-title">
            {initialData?.id ? "EDIT STATUTE DETAILS" : "WRITE STATUTE"}
          </span>
          <button type="button" className="resource-editor-close" onClick={onCancel}>CLOSE</button>
        </div>

        <form className="resource-editor-form library-editor-form" id="meta-editor-form" onSubmit={handleSave}>
          
          <div className="resource-editor-field">
            <label>Statute Title</label>
            <input 
              name="title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              placeholder="e.g. The Treason Act"
              required 
            />
          </div>

          <div className="resource-editor-field">
            <label>Short Summary</label>
            <textarea 
              name="summary" 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)} 
              placeholder="A brief description of what this statute covers... (shown on the grid card)"
              rows={3}
            />
          </div>

          {initialData?.id && onDelete && (
            <div className="library-editor-buttons" style={{ marginTop: "1rem" }}>
              <button type="button" className="library-inline-btn danger" onClick={() => onDelete(initialData.id)}>DELETE STATUTE</button>
            </div>
          )}

        </form>

        <div className="resource-editor-actions">
          <span className="resource-editor-status" data-library-status>{isSaving ? "Saving..." : ""}</span>
          <button type="submit" className="resource-editor-submit" form="meta-editor-form" disabled={isSaving}>SAVE STATUTE</button>
        </div>

        <div className="resource-editor-footer">
          <span className="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
        </div>

      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}

export const StatuteEditor = SectionEditor;
