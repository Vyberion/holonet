"use client";

import React, { useState } from "react";

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

export function StatuteEditor({ initialData, onSave, onCancel }) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [sections, setSections] = useState(initialData?.sections || []);

  const addSection = () => {
    setSections([...sections, { id: generateId(), text: "", clauses: [] }]);
  };

  const updateSection = (sIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].text = text.toUpperCase();
    setSections(newSections);
  };

  const removeSection = (sIndex) => {
    setSections(sections.filter((_, i) => i !== sIndex));
  };

  const addClause = (sIndex) => {
    const newSections = [...sections];
    newSections[sIndex].clauses.push({ id: generateId(), text: "", subClauses: [] });
    setSections(newSections);
  };

  const updateClause = (sIndex, cIndex, text) => {
    const newSections = [...sections];
    newSections[sIndex].clauses[cIndex].text = text;
    setSections(newSections);
  };

  const removeClause = (sIndex, cIndex) => {
    const newSections = [...sections];
    newSections[sIndex].clauses.splice(cIndex, 1);
    setSections(newSections);
  };

  const addSubClause = (sIndex, cIndex) => {
    const newSections = [...sections];
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

  const handleSave = () => {
    onSave({ title, sections });
  };

  return (
    <div className="statute-editor">
      <div className="editor-header" style={{ marginBottom: "2rem" }}>
        <input
          className="editor-title-input"
          type="text"
          placeholder="STATUTE TITLE"
          value={title}
          onChange={(e) => setTitle(e.target.value.toUpperCase())}
          style={{ width: "100%", fontSize: "2rem", padding: "1rem", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "inherit", marginBottom: "1rem" }}
        />
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="h-button" onClick={handleSave}>Save Statute</button>
          <button className="h-button secondary" onClick={onCancel}>Cancel</button>
        </div>
      </div>

      <div className="editor-body">
        {sections.map((section, sIndex) => (
          <div key={section.id} className="editor-section" style={{ borderLeft: "2px solid #555", paddingLeft: "1rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
              <strong style={{ fontSize: "1.2rem", flexShrink: 0 }}>SECTION {getRomanNumeral(sIndex + 1)}:</strong>
              <input
                type="text"
                placeholder="Section Name"
                value={section.text}
                onChange={(e) => updateSection(sIndex, e.target.value)}
                style={{ flexGrow: 1, padding: "0.5rem", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "inherit", textTransform: "uppercase" }}
              />
              <button className="h-button danger small" onClick={() => removeSection(sIndex)}>X</button>
            </div>
            
            <div style={{ marginLeft: "1.5rem", marginTop: "1rem" }}>
              {section.clauses?.map((clause, cIndex) => (
                <div key={clause.id} className="editor-clause" style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                    <span style={{ minWidth: "2rem", display: "inline-block" }}>({getLetter(cIndex + 1)})</span>
                    <textarea
                      placeholder="Clause text"
                      value={clause.text}
                      onChange={(e) => updateClause(sIndex, cIndex, e.target.value)}
                      style={{ flexGrow: 1, padding: "0.5rem", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "inherit", minHeight: "40px", resize: "vertical" }}
                    />
                    <button className="h-button danger small" onClick={() => removeClause(sIndex, cIndex)}>X</button>
                  </div>

                  <div style={{ marginLeft: "2.5rem" }}>
                    {clause.subClauses?.map((subClause, scIndex) => (
                      <div key={subClause.id} className="editor-subclause" style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                          <span style={{ minWidth: "1.5rem", display: "inline-block" }}>{scIndex + 1}.</span>
                          <textarea
                            placeholder="Sub-clause text"
                            value={subClause.text}
                            onChange={(e) => updateSubClause(sIndex, cIndex, scIndex, e.target.value)}
                            style={{ flexGrow: 1, padding: "0.5rem", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "inherit", minHeight: "40px", resize: "vertical" }}
                          />
                          <button className="h-button danger small" onClick={() => removeSubClause(sIndex, cIndex, scIndex)}>X</button>
                        </div>

                        <div style={{ marginLeft: "2.5rem" }}>
                          {subClause.subSubClauses?.map((subSubClause, sscIndex) => (
                            <div key={subSubClause.id} className="editor-subsubclause" style={{ marginBottom: "0.5rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                <span style={{ minWidth: "1.5rem", display: "inline-block" }}>{getRomanNumeral(sscIndex + 1).toLowerCase()}.</span>
                                <textarea
                                  placeholder="Sub-sub-clause text"
                                  value={subSubClause.text}
                                  onChange={(e) => updateSubSubClause(sIndex, cIndex, scIndex, sscIndex, e.target.value)}
                                  style={{ flexGrow: 1, padding: "0.5rem", background: "transparent", border: "1px solid rgba(255, 255, 255, 0.2)", color: "inherit", minHeight: "40px", resize: "vertical" }}
                                />
                                <button className="h-button danger small" onClick={() => removeSubSubClause(sIndex, cIndex, scIndex, sscIndex)}>X</button>
                              </div>
                            </div>
                          ))}
                          <button className="h-button secondary small" style={{ marginTop: "0.5rem" }} onClick={() => addSubSubClause(sIndex, cIndex, scIndex)}>+ Sub-Sub-Clause</button>
                        </div>
                      </div>
                    ))}
                    <button className="h-button secondary small" style={{ marginTop: "0.5rem" }} onClick={() => addSubClause(sIndex, cIndex)}>+ Sub-Clause</button>
                  </div>
                </div>
              ))}
              <button className="h-button secondary small" style={{ marginTop: "0.5rem" }} onClick={() => addClause(sIndex)}>+ Clause</button>
            </div>
          </div>
        ))}
        
        <button className="h-button" style={{ marginTop: "1rem" }} onClick={addSection}>+ Add Section</button>
      </div>
    </div>
  );
}
