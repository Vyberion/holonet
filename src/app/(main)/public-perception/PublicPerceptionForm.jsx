"use client";

import { useState } from "react";

export function PublicPerceptionForm() {
  const [formData, setFormData] = useState({
    // Section 1
    strictness: 5,
    progression: 5,
    eventQuality: 5,
    scheduling: 5,
    transparency: 5,
    powerbaseSystem: 5,
    divisionalBalance: 5,
    overallCulture: 5,

    // Section 2
    sithExperience: 5,
    sithEnjoyMost: "",
    sithDislikeMost: "",
    sithView: "",
    sithViewOther: "",
    section2Notes: "",

    // Section 3
    favDepartment: "",
    leastFavDepartment: "",
    attendedInspections: false,
    divisionalInspections: 5,
    divisionalEvents: 5,
    isDivisionMember: false,
    divisionalExperience: 5,
    internalDivisionalEvents: 5,
    section3Notes: "",

    // Section 4
    improveExperience: "",
    otherComments: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    let { name, value, type, checked } = e.target;
    if (type === "range") value = Number(value);
    
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const validateForm = () => {
    // Check mandatory fields
    if (!formData.sithEnjoyMost.trim()) return "Please specify what you enjoy most about your time as a Sith (Section 2.2).";
    if (!formData.sithDislikeMost.trim()) return "Please specify what you dislike most about your time as a Sith (Section 2.3).";

    if (!formData.sithView) return "Please specify how you view your time as a Sith (Section 2.4).";
    if (formData.sithView === "Other" && !formData.sithViewOther.trim()) {
      return "Please specify 'Other' for how you view your time as a Sith.";
    }

    if (!formData.favDepartment.trim()) return "Please specify your favourite department and why (Section 3.1).";
    if (!formData.leastFavDepartment.trim()) return "Please specify your least favourite department and why (Section 3.2).";

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/public-perception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error("Failed to submit form. Please try again later.");
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="codex-shell">
        <div className="codex-document" style={{ width: "100%", margin: "0 auto", padding: "2rem" }}>
          <article className="codex-article">
            <div className="article-header">
              <span className="article-number">SUCCESS</span>
              <h2 className="article-title">Transmission Received</h2>
            </div>
            <div className="article-content">
              <p>Your responses have been recorded in the databanks.</p>
              <a href="/" className="btn btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>Return to Holonet</a>
            </div>
          </article>
        </div>
      </div>
    );
  }

  const SliderField = ({ label, name, leftLabel, rightLabel }) => (
    <div className="form-group" style={{ marginBottom: "2.5rem" }}>
      <label style={{ display: "block", marginBottom: "1rem", color: "var(--text-bright)", fontWeight: "bold" }}>
        {label} <span style={{ color: "var(--danger, #ff4444)" }}>*</span>
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "right" }}>{leftLabel || "Poor"}</span>
        <div style={{ display: "flex", justifyContent: "space-between", flex: 1, maxWidth: "700px" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
            <div key={num} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
              <label style={{ fontSize: "0.9rem", color: "var(--text)", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }} htmlFor={`${name}-${num}`}>
                {num}
              </label>
              <input
                type="radio"
                id={`${name}-${num}`}
                name={name}
                value={num}
                checked={Number(formData[name]) === num}
                onChange={() => setFormData(prev => ({ ...prev, [name]: num }))}
                className="sith-radio"
              />
            </div>
          ))}
        </div>
        <span style={{ fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "left" }}>{rightLabel || "Excellent"}</span>
      </div>
    </div>
  );

  const TextField = ({ label, name, required = false, rows = 3, placeholder = "" }) => (
    <div className="form-group" style={{ marginBottom: "1.5rem" }}>
      <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-bright)", fontWeight: "bold" }}>
        {label} {required && <span style={{ color: "var(--danger, #ff4444)" }}>*</span>}
      </label>
      <textarea
        name={name}
        value={formData[name]}
        onChange={handleChange}
        rows={rows}
        placeholder={placeholder}
        style={{ width: "100%", padding: "0.5rem", backgroundColor: "rgba(0,0,0,0.5)", border: "1px solid var(--border-color)", color: "var(--text-color)" }}
      ></textarea>
    </div>
  );

  return (
    <div className="codex-shell" style={{ display: "block" }}>
      <div className="codex-document">
        <article className="codex-article">
          <div className="article-header">
            <span className="article-number">FEEDBACK FORM</span>
            <h2 className="article-title">Public Perception</h2>
          </div>
          <div className="article-content">
            <p style={{ marginBottom: "2rem", color: "var(--text-dim)" }}>
              This form gathers information on the public perception of the Order.
              Fields marked with <span style={{ color: "var(--danger, #ff4444)" }}>*</span> are mandatory.
            </p>

            {error && (
              <div style={{ padding: "1rem", backgroundColor: "var(--danger-bg, rgba(255,0,0,0.1))", color: "var(--danger-text, #ff6b6b)", marginBottom: "2rem", border: "1px solid #ff0000" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* SECTION 1 */}
              <div className="regulation" style={{ marginBottom: "3rem" }}>
                <h3 className="reg-title">Section I: Group-Wide Assessment</h3>

                <SliderField name="strictness" label="1.1 How would you rate the current strictness of the Order?" leftLabel="Not strict enough" rightLabel="Too strict" />
                <SliderField name="progression" label="1.2 How satisfied are you with progression?" leftLabel="Very Dissatisfied" rightLabel="Very Satisfied" />
                <SliderField name="eventQuality" label="1.3 How would you rate the quality of events hosted?" leftLabel="Poor" rightLabel="Excellent" />
                <SliderField name="scheduling" label="1.4 How well does the scheduling of events accommodate you?" leftLabel="Poorly" rightLabel="Excellently" />
                <SliderField name="transparency" label="1.5 How transparent do you feel the leadership has been?" leftLabel="Not transparent" rightLabel="Highly transparent" />
                <SliderField name="powerbaseSystem" label="1.6 How effective is the current Powerbase system?" leftLabel="Ineffective" rightLabel="Highly effective" />
                <SliderField name="divisionalBalance" label="1.7 How balanced do you feel the divisions are?" leftLabel="Unbalanced" rightLabel="Perfectly balanced" />
                <SliderField name="overallCulture" label="1.8 How would you rate the overall culture of the Order?" leftLabel="Poor" rightLabel="Excellent" />
              </div>

              {/* SECTION 2 */}
              <div className="regulation" style={{ marginBottom: "3rem" }}>
                <h3 className="reg-title">Section II: The Sith Experience</h3>

                <SliderField name="sithExperience" label="2.1 How would you rate the overall Sith experience?" />

                <TextField name="sithEnjoyMost" label="2.2 What do you enjoy the most about being a Sith?" required />
                <TextField name="sithDislikeMost" label="2.3 What do you dislike the most about being a Sith?" required />

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-bright)", fontWeight: "bold" }}>
                    2.4 How do you primarily view being a Sith? <span style={{ color: "var(--danger, #ff4444)" }}>*</span>
                  </label>
                  <select
                    name="sithView"
                    value={formData.sithView}
                    onChange={handleChange}
                    style={{ width: "100%", padding: "0.5rem", backgroundColor: "rgba(0,0,0,0.5)", border: "1px solid var(--border-color)", color: "var(--text-color)" }}
                  >
                    <option value="">-- Select an option --</option>
                    <option value="A retirement area / social hub">A retirement area</option>
                    <option value="A bare bones phase you just have to pass through to rank up">A phase you have to pass through</option>
                    <option value="A serious roleplay environment focused on lore and teachings">A serious roleplay environment</option>
                    <option value="A place to mentor others and grow a powerbase">A place to mentor</option>
                    <option value="A competitive environment focused on combat and trials">A competitive environment</option>
                    <option value="Other">Other (Please specify)</option>
                  </select>
                </div>

                {formData.sithView === "Other" && (
                  <TextField name="sithViewOther" label="Please specify your view:" required />
                )}

                <TextField name="section2Notes" label="2.5 Optional Notes" rows={2} />
              </div>

              {/* SECTION 3 */}
              <div className="regulation" style={{ marginBottom: "3rem" }}>
                <h3 className="reg-title">Section III: Divisions</h3>

                <TextField name="favDepartment" label="3.1 What is your favourite department and why?" required />
                <TextField name="leastFavDepartment" label="3.2 What is your least favourite department and why?" required />

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "var(--text-bright)", fontWeight: "bold" }}>
                    <input type="checkbox" name="attendedInspections" checked={formData.attendedInspections} onChange={handleChange} />
                    3.3a Have you attended inspections recently?
                  </label>
                </div>

                {formData.attendedInspections && (
                  <div style={{ marginLeft: "2rem", borderLeft: "2px solid var(--brand)", paddingLeft: "1rem", marginBottom: "1.5rem" }}>
                    <SliderField name="divisionalInspections" label="3.3b How would you rate the divisional inspections?" />
                  </div>
                )}

                <SliderField name="divisionalEvents" label="3.4 How would you rate divisional events in general?" />

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", color: "var(--text-bright)", fontWeight: "bold" }}>
                    <input type="checkbox" name="isDivisionMember" checked={formData.isDivisionMember} onChange={handleChange} />
                    3.5 Are you currently or have you recently been a division member?
                  </label>
                </div>

                {formData.isDivisionMember && (
                  <div style={{ marginLeft: "2rem", borderLeft: "2px solid var(--brand)", paddingLeft: "1rem", marginBottom: "1.5rem" }}>
                    <SliderField name="divisionalExperience" label="3.6 How would you rate your divisional experience?" />
                    <SliderField name="internalDivisionalEvents" label="3.7 How would you rate divisional events?" />
                  </div>
                )}

                <TextField name="section3Notes" label="3.8 Optional Notes" rows={2} />
              </div>

              {/* SECTION 4 */}
              <div className="regulation" style={{ marginBottom: "3rem" }}>
                <h3 className="reg-title">Section IV: Open Feedback</h3>

                <TextField name="improveExperience" label="4.1 What is one thing the Council could do to improve your experience?" rows={4} />
                <TextField name="otherComments" label="4.2 Any other comments?" rows={3} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="sith-submit-btn"
                >
                  {submitting ? "Transmitting..." : "Submit Answers"}
                </button>
              </div>

            </form>
          </div>
        </article>
      </div>

      <style>{`
        .sith-radio {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 0, 0, 0.4);
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          outline: none;
          transition: all 0.2s ease;
          cursor: pointer;
          margin: 0;
        }
        .sith-radio:hover {
          border-color: var(--red-bright, #ff0000);
          box-shadow: 0 0 8px var(--red-glow, rgba(255,0,0,0.5));
        }
        .sith-radio:checked {
          border-color: var(--red-bright, #ff0000);
          background: var(--red-bright, #ff0000);
          box-shadow: 0 0 12px var(--red-glow, rgba(255,0,0,0.6));
          position: relative;
        }
        .sith-radio:checked::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #000;
        }

        .sith-submit-btn {
          appearance: none;
          background: rgba(255, 0, 0, 0.05);
          border: 1px solid var(--theme-accent, var(--red-bright, #ff0000));
          color: var(--theme-accent, var(--red-bright, #ff0000));
          font-family: 'Orbitron', monospace;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          padding: 0.8rem 2.5rem;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .sith-submit-btn:hover:not(:disabled) {
          background: rgba(255, 0, 0, 0.15);
          box-shadow: 0 0 15px var(--theme-accent-glow, var(--red-glow, rgba(255,0,0,0.3)));
          letter-spacing: 0.2em;
        }
        .sith-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
