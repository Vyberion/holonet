"use client";

import { useState, useEffect } from "react";
import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";

export default function PublicPerceptionResultsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <HolonetFrame title="PERCEPTION RESULTS" subtitle="ADMIN CONSOLE" includeSearchOverlay>
      <div className="codex-shell">
        <article className="codex-article">
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
                <p style={{ marginBottom: "2rem" }}>Total Responses: {data.length}</p>

                {data.map((record, idx) => (
                  <div key={record.id || idx} style={{ marginBottom: "3rem", padding: "1.5rem", backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)" }}>
                    <h3 style={{ borderBottom: "1px solid var(--brand)", paddingBottom: "0.5rem", marginBottom: "1rem", color: "var(--brand)" }}>
                      Response #{data.length - idx} <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "1rem" }}>{new Date(record.created_at).toLocaleString()}</span>
                    </h3>

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
          </div>
        </article>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
