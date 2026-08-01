"use client";

import { useState, useEffect, useMemo } from "react";
import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";

const QUESTIONS = [
  { id: "all", label: "All Questions (Full View)", type: "all" },
  { id: "strictness", label: "1.1 Strictness of the Order", type: "scale" },
  { id: "progression", label: "1.2 Satisfaction with progression", type: "scale" },
  { id: "eventQuality", label: "1.3 Quality of events", type: "scale" },
  { id: "scheduling", label: "1.4 Scheduling of events", type: "scale" },
  { id: "transparency", label: "1.5 Transparency of leadership", type: "scale" },
  { id: "powerbaseSystem", label: "1.6 Powerbase system effectiveness", type: "scale" },
  { id: "divisionalBalance", label: "1.7 Balance of divisions", type: "scale" },
  { id: "overallCulture", label: "1.8 Overall culture", type: "scale" },
  { id: "sithExperience", label: "2.1 Overall Sith experience", type: "scale" },
  { id: "sithEnjoyMost", label: "2.2 Enjoy most about being a Sith", type: "text" },
  { id: "sithDislikeMost", label: "2.3 Dislike most about being a Sith", type: "text" },
  { id: "sithView", label: "2.4 View of time as a Sith", type: "text" },
  { id: "section2Notes", label: "2.5 Section 2 Notes", type: "text" },
  { id: "favDepartment", label: "3.1 Favourite department", type: "text" },
  { id: "leastFavDepartment", label: "3.2 Least favourite department", type: "text" },
  { id: "divisionalInspections", label: "3.3b Divisional inspections rating", type: "scale" },
  { id: "divisionalEvents", label: "3.4 Divisional events rating", type: "scale" },
  { id: "divisionalExperience", label: "3.6 Divisional experience rating", type: "scale" },
  { id: "internalDivisionalEvents", label: "3.7 Divisional internal events rating", type: "scale" },
  { id: "section3Notes", label: "3.8 Section 3 Notes", type: "text" },
  { id: "improveExperience", label: "4.1 How to improve experience", type: "text" },
  { id: "otherComments", label: "4.2 Other comments", type: "text" },
];

export default function PublicPerceptionResultsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState("all");

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch("/api/public-perception/results");
        const json = await res.json();

        if (!json.ok) {
          throw new Error(json.reason || json.error || "Failed to load results");
        }

        setData(json.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, []);

  const selectedQuestionDef = useMemo(() => {
    return QUESTIONS.find(q => q.id === selectedFilter) || QUESTIONS[0];
  }, [selectedFilter]);

  const scaleStats = useMemo(() => {
    if (selectedQuestionDef.type !== "scale") return null;

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    let totalScore = 0;
    let totalResponses = 0;

    data.forEach(record => {
      const val = record.responses?.[selectedQuestionDef.id];
      if (typeof val === "number" && val >= 1 && val <= 10) {
        counts[val]++;
        totalScore += val;
        totalResponses++;
      }
    });

    return {
      counts,
      totalResponses,
      average: totalResponses > 0 ? (totalScore / totalResponses).toFixed(2) : 0
    };
  }, [data, selectedQuestionDef]);

  return (
    <HolonetFrame title="PERCEPTION RESULTS" subtitle="ADMIN CONSOLE" includeSearchOverlay>
      <div className="codex-shell" style={{ display: "block" }}>
        <article className="codex-article" style={{ minHeight: "60vh" }}>
          <div className="article-header">
            <span className="article-number">RESTRICTED ACCESS</span>
            <h2 className="article-title">Survey Results</h2>
          </div>

          <div className="article-content">
            {loading && <p>Loading databanks...</p>}
            
            {error && (
              <div style={{ padding: "1rem", backgroundColor: "var(--danger-bg, rgba(255,0,0,0.1))", color: "var(--danger-text, #ff6b6b)", marginBottom: "2rem", border: "1px solid #ff0000" }}>
                {error === "SESSION_REQUIRED" ? "Authentication required. Please log in." : error}
              </div>
            )}

            {!loading && !error && data.length === 0 && (
              <p>No responses found in the databanks.</p>
            )}

            {!loading && !error && data.length > 0 && (
              <div>
                <div className="admin-filter-row codex-toolbar" style={{ marginBottom: "2rem", paddingBottom: "1rem" }}>
                  <select 
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="codex-filter-select"
                  >
                    {QUESTIONS.map(q => (
                      <option key={q.id} value={q.id}>{q.label}</option>
                    ))}
                  </select>
                  <span className="resource-editor-status" style={{ color: "var(--text-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
                    Total Responses: {data.length}
                  </span>
                </div>

                {/* Statistics Dashboard for Scale Questions */}
                {scaleStats && scaleStats.totalResponses > 0 && (
                  <div className="regulation" style={{ marginBottom: "3rem", padding: "1.5rem", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-hot)" }}>
                    <h3 className="reg-title" style={{ marginBottom: "1rem" }}>Aggregate Analytics: {selectedQuestionDef.label}</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", marginBottom: "1.5rem" }}>
                      <div>
                        <span style={{ color: "var(--text-dim)", fontSize: "0.85rem", textTransform: "uppercase" }}>Average Score</span>
                        <div style={{ fontSize: "2rem", color: "var(--red-bright)", fontWeight: "bold", fontFamily: "'Share Tech Mono', monospace" }}>{scaleStats.average}</div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-dim)", fontSize: "0.85rem", textTransform: "uppercase" }}>Valid Responses</span>
                        <div style={{ fontSize: "2rem", color: "var(--text-bright)", fontWeight: "bold", fontFamily: "'Share Tech Mono', monospace" }}>{scaleStats.totalResponses}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))", gap: "0.5rem" }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                        const count = scaleStats.counts[num];
                        const pct = scaleStats.totalResponses > 0 ? ((count / scaleStats.totalResponses) * 100).toFixed(1) : 0;
                        return (
                          <div key={num} style={{ background: "rgba(192,0,26,0.05)", border: "1px solid var(--red-dim)", padding: "0.5rem", textAlign: "center" }}>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.25rem" }}>Score {num}</div>
                            <div style={{ fontSize: "1.2rem", color: "var(--text-bright)", fontFamily: "'Share Tech Mono', monospace" }}>{count}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--red-bright)", marginTop: "0.25rem" }}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Full View (Legacy) */}
                {selectedFilter === "all" && (
                  <div>
                    {data.map((record, idx) => (
                      <div key={record.id || idx} className="sub-clause" style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "rgba(0,0,0,0.4)" }}>
                        <div style={{ borderBottom: "1px solid var(--red-dim)", paddingBottom: "0.5rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ color: "var(--red-bright)", margin: 0, fontSize: "1.1rem" }}>
                            User: {record.responses?.robloxUsername || record.user_id || "Unknown"}
                          </h3>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{new Date(record.created_at).toLocaleString()}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                          <div>
                            <h4 style={{ color: "var(--text-bright)", marginBottom: "0.5rem" }}>Section 1: Group-Wide Assessment</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--text-dim)" }}>
                              <li><strong>Strictness:</strong> {record.responses?.strictness}</li>
                              <li><strong>Progression:</strong> {record.responses?.progression}</li>
                              <li><strong>Event Quality:</strong> {record.responses?.eventQuality}</li>
                              <li><strong>Scheduling:</strong> {record.responses?.scheduling}</li>
                              <li><strong>Transparency:</strong> {record.responses?.transparency}</li>
                              <li><strong>Powerbase:</strong> {record.responses?.powerbaseSystem}</li>
                              <li><strong>Divisional Balance:</strong> {record.responses?.divisionalBalance}</li>
                              <li><strong>Overall Culture:</strong> {record.responses?.overallCulture}</li>
                            </ul>
                          </div>

                          <div>
                            <h4 style={{ color: "var(--text-bright)", marginBottom: "0.5rem" }}>Section 2: The Sith Experience</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--text-dim)" }}>
                              <li><strong>Experience Rating:</strong> {record.responses?.sithExperience}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Enjoy Most:</strong> {record.responses?.sithEnjoyMost}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Dislike Most:</strong> {record.responses?.sithDislikeMost}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>View Time as Sith:</strong> {record.responses?.sithView === "Other" ? `Other: ${record.responses?.sithViewOther}` : record.responses?.sithView}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Optional Notes:</strong> {record.responses?.section2Notes || "N/A"}</li>
                            </ul>
                          </div>

                          <div>
                            <h4 style={{ color: "var(--text-bright)", marginBottom: "0.5rem" }}>Section 3: Divisions</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--text-dim)" }}>
                              <li><strong>Favourite Dept:</strong> {record.responses?.favDepartment}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Least Favourite:</strong> {record.responses?.leastFavDepartment}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Inspections:</strong> {record.responses?.attendedInspections ? `Yes (Rating: ${record.responses?.divisionalInspections})` : "No"}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Divisional Events:</strong> {record.responses?.divisionalEvents}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Division Member:</strong> {record.responses?.isDivisionMember ? `Yes (Exp: ${record.responses?.divisionalExperience}, Events: ${record.responses?.internalDivisionalEvents})` : "No"}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Optional Notes:</strong> {record.responses?.section3Notes || "N/A"}</li>
                            </ul>
                          </div>

                          <div>
                            <h4 style={{ color: "var(--text-bright)", marginBottom: "0.5rem" }}>Section 4: Open Feedback</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: "var(--text-dim)" }}>
                              <li><strong>How to Improve:</strong> {record.responses?.improveExperience || "N/A"}</li>
                              <li style={{ marginTop: "0.5rem" }}><strong>Other Comments:</strong> {record.responses?.otherComments || "N/A"}</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Filtered Question View */}
                {selectedFilter !== "all" && (
                  <div className="hub-list">
                    {data.map((record, idx) => {
                      let val = record.responses?.[selectedFilter];
                      if (selectedFilter === "sithView" && val === "Other") {
                        val = `Other: ${record.responses?.sithViewOther || "N/A"}`;
                      }
                      
                      const hasValue = val !== undefined && val !== null && val !== "";
                      if (!hasValue) return null; // Skip if they didn't answer this question

                      return (
                        <article key={record.id || idx} className="hub-row sub-clause" style={{ padding: "1rem", marginBottom: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <strong style={{ color: "var(--red-bright)" }}>{record.responses?.robloxUsername || record.user_id || "Unknown User"}</strong>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{new Date(record.created_at).toLocaleString()}</span>
                          </div>
                          <p style={{ color: "var(--text-bright)", fontSize: "1.05rem", whiteSpace: "pre-wrap" }}>
                            {String(val)}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
      </div>

      <style>{`
        .codex-filter-select {
          background: linear-gradient(135deg, rgba(192, 0, 26, 0.05), transparent), rgba(0, 0, 0, 0.3);
          border: 1px solid var(--border-hot);
          color: var(--text-bright);
          font-family: 'Share Tech Mono', monospace;
          min-width: 250px;
          padding: 8px 12px;
          outline: none;
          cursor: pointer;
        }
        .codex-filter-select:focus {
          border-color: var(--red-bright);
          box-shadow: 0 0 8px var(--red-glow);
        }
        .codex-filter-select option {
          background: #111;
          color: var(--text-bright);
        }
        .admin-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          align-items: center;
        }
      `}</style>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
