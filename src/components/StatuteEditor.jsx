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

export function StatuteEditor({ initialData, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [sections, setSections] = useState(initialData?.sections || []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const addSection = () => {
    setSections([...sections, { id: generateId(), text: "", clauses: [] }]);
  };

  const updateSection = (sIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].text = text.toUpperCase();
    setSections(newSections);
  };

  const removeSection = (sIndex) => {
    if (!window.confirm("Are you sure you want to delete this section?")) return;
    setSections(sections.filter((_, i) => i !== sIndex));
  };

  const addClause = (sIndex) => {
    const newSections = [...sections];
    if (!newSections[sIndex].clauses) newSections[sIndex].clauses = [];
    newSections[sIndex].clauses.push({ id: generateId(), text: "", subClauses: [] });
    setSections(newSections);
  };

  const updateClause = (sIndex, cIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].text = text;
    setSections(newSections);
  };

  const removeClause = (sIndex, cIndex) => {
    if (!window.confirm("Are you sure you want to delete this clause?")) return;
    const newSections = [...sections];
    newSections[sIndex].clauses.splice(cIndex, 1);
    setSections(newSections);
  };

  const addSubClause = (sIndex, cIndex) => {
    const newSections = [...sections];
    if (!newSections[sIndex].clauses[cIndex].subClauses) newSections[sIndex].clauses[cIndex].subClauses = [];
    newSections[sIndex].clauses[cIndex].subClauses.push({ id: generateId(), text: "", subSubClauses: [] });
    setSections(newSections);
  };

  const updateSubClause = (sIndex, cIndex, scIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].subClauses[scIndex].text = text;
    setSections(newSections);
  };

  const removeSubClause = (sIndex, cIndex, scIndex) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].subClauses.splice(scIndex, 1);
    setSections(newSections);
  };

  const addSubSubClause = (sIndex, cIndex, scIndex) => {
    const newSections = [...sections];
    if (!newSections[sIndex].clauses[cIndex].subClauses[scIndex].subSubClauses) newSections[sIndex].clauses[cIndex].subClauses[scIndex].subSubClauses = [];
    newSections[sIndex].clauses[cIndex].subClauses[scIndex].subSubClauses.push({ id: generateId(), text: "" });
    setSections(newSections);
  };

  const updateSubSubClause = (sIndex, cIndex, scIndex, sscIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].subClauses[scIndex].subSubClauses[sscIndex].text = text;
    setSections(newSections);
  };

  const removeSubSubClause = (sIndex, cIndex, scIndex, sscIndex) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].subClauses[scIndex].subSubClauses.splice(sscIndex, 1);
    setSections(newSections);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }
    setIsSaving(true);
    await onSave({ title, sections });
    setIsSaving(false);
  };

  const modalContent = (
    <div id="library-editor-overlay" className="active" style={{ zIndex: 99999 }} onClick={(e) => e.target.id === "library-editor-overlay" && onCancel()}>
      <div className="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="library-editor-title">
        
        <div className="resource-editor-topbar">
          <span className="resource-editor-title" id="library-editor-title">
            {initialData ? "EDIT STATUTE" : "WRITE STATUTE"}
          </span>
          <button type="button" className="resource-editor-close" onClick={onCancel}>CLOSE</button>
        </div>

        <form className="resource-editor-form library-editor-form" id="library-editor-form" onSubmit={handleSave}>
          
          <div className="resource-editor-field">
            <label>Statute Title</label>
            <input 
              name="title" 
              value={title} 
              onChange={(e) => setTitle(e.target.value.toUpperCase())} 
              placeholder="e.g. THE TREASON ACT"
              required 
            />
          </div>

          <div className="library-entry-stack">
            {sections.map((section, sIndex) => (
              <section key={section.id} className="library-entry-editor">
                <div className="library-entry-toolbar">
                  <span className="library-entry-title">SECTION {getRomanNumeral(sIndex + 1)}</span>
                  <button type="button" className="library-inline-btn" onClick={() => removeSection(sIndex)}>REMOVE SECTION</button>
                </div>
                
                <div className="resource-editor-field">
                  <label>Section Name</label>
                  <input 
                    type="text" 
                    value={section.text} 
                    onChange={(e) => updateSection(sIndex, e.target.value)} 
                    placeholder="e.g. GENERAL PROVISIONS" 
                    required 
                  />
                </div>

                <div className="library-entry-stack" style={{ paddingLeft: "1rem", marginTop: "1rem", borderLeft: "2px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {section.clauses?.map((clause, cIndex) => (
                    <div key={clause.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <div className="resource-editor-field" style={{ marginBottom: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <label>Clause ({getLetter(cIndex + 1)})</label>
                          <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeClause(sIndex, cIndex)}>Remove</button>
                        </div>
                        <textarea 
                          value={clause.text} 
                          onChange={(e) => updateClause(sIndex, cIndex, e.target.value)} 
                          placeholder="Clause text..." 
                          required 
                          rows={2}
                        />
                      </div>

                      <div style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {clause.subClauses?.map((subClause, scIndex) => (
                          <div key={subClause.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div className="resource-editor-field" style={{ marginBottom: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                <label>Sub-Clause {scIndex + 1}.</label>
                                <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeSubClause(sIndex, cIndex, scIndex)}>Remove</button>
                              </div>
                              <textarea 
                                value={subClause.text} 
                                onChange={(e) => updateSubClause(sIndex, cIndex, scIndex, e.target.value)} 
                                placeholder="Sub-clause text..." 
                                required 
                                rows={2}
                              />
                            </div>

                            <div style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              {subClause.subSubClauses?.map((subSubClause, sscIndex) => (
                                <div key={subSubClause.id} className="resource-editor-field" style={{ marginBottom: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                                    <label>Sub-Sub-Clause {getRomanNumeral(sscIndex + 1).toLowerCase()}.</label>
                                    <button type="button" className="library-inline-btn" style={{ color: "var(--theme-accent)", opacity: 0.7 }} onClick={() => removeSubSubClause(sIndex, cIndex, scIndex, sscIndex)}>Remove</button>
                                  </div>
                                  <textarea 
                                    value={subSubClause.text} 
                                    onChange={(e) => updateSubSubClause(sIndex, cIndex, scIndex, sscIndex, e.target.value)} 
                                    placeholder="Sub-sub-clause text..." 
                                    required 
                                    rows={2}
                                  />
                                </div>
                              ))}
                              <button type="button" className="library-inline-btn" onClick={() => addSubSubClause(sIndex, cIndex, scIndex)}>+ ADD SUB-SUB-CLAUSE</button>
                            </div>
                          </div>
                        ))}
                        <button type="button" className="library-inline-btn" onClick={() => addSubClause(sIndex, cIndex)}>+ ADD SUB-CLAUSE</button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="library-inline-btn" onClick={() => addClause(sIndex)}>+ ADD CLAUSE</button>
                </div>
              </section>
            ))}
          </div>

          <div className="library-editor-buttons">
            <button type="button" className="library-inline-btn" onClick={addSection}>ADD SECTION</button>
            {initialData?.id && onDelete && (
              <button type="button" className="library-inline-btn danger" onClick={() => onDelete(initialData.id)}>DELETE STATUTE</button>
            )}
          </div>

        </form>

        <div className="resource-editor-actions">
          <span className="resource-editor-status" data-library-status>{isSaving ? "Saving..." : ""}</span>
          <button type="submit" className="resource-editor-submit" form="library-editor-form" disabled={isSaving}>SAVE</button>
        </div>

        <div className="resource-editor-footer">
          <span className="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
        </div>

      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
