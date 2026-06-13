import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Lookup",
  description: "Personnel lookup console."
});

export default function LookupPage() {
  return (
    <HolonetFrame title="LOOKUP" subtitle="PERSONNEL CONSOLE">
      <div className="personnel-shell">
        <section className="personnel-panel">
          <div className="personnel-grid">
            <form className="personnel-form" id="personnel-form">
              <div className="resource-editor-field">
                <label htmlFor="personnel-username">Roblox Username</label>
                <input id="personnel-username" name="username" autoComplete="off" spellCheck="false" required />
              </div>
              <div className="resource-editor-actions">
                <span className="resource-editor-status" id="personnel-status">Idle</span>
                <button type="submit" className="resource-editor-submit">Lookup</button>
              </div>
            </form>
            <div className="personnel-results" id="personnel-results">
              <p className="personnel-empty">Awaiting personnel query.</p>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .personnel-shell {
          --editor-accent: rgba(255, 108, 124, 0.68);
          --editor-accent-dim: rgba(255, 66, 82, 0.3);
          --editor-accent-glow: rgba(255, 0, 34, 0.1);
          --editor-panel: var(--panel);
          --editor-void: var(--void);
          --editor-wash: rgba(255, 66, 82, 0.03);
          max-width: 920px;
          margin: 0 auto;
        }

        .personnel-shell .resource-editor-submit {
          background:
            linear-gradient(135deg, rgba(255, 66, 82, 0.045), transparent),
            rgba(0, 0, 0, 0.22);
          border-color: rgba(255, 66, 82, 0.28);
          box-shadow: 0 0 10px rgba(255, 0, 34, 0.055);
          color: rgba(255, 132, 145, 0.78);
        }

        .personnel-shell .resource-editor-submit:hover,
        .personnel-shell .resource-editor-submit:focus-visible {
          background:
            linear-gradient(90deg, var(--theme-wash) 0%, transparent 50%, var(--theme-wash) 100%),
            rgba(0, 0, 0, 0.32);
          border-color: var(--theme-accent-dim);
          box-shadow:
            0 0 10px var(--theme-accent-glow),
            inset 0 0 14px rgba(192, 0, 26, 0.035);
          color: var(--theme-accent-soft);
          text-shadow: 0 0 6px var(--theme-accent-glow);
        }

        .personnel-shell .resource-editor-actions::before,
        .personnel-shell .resource-editor-field label::before {
          color: rgba(255, 108, 124, 0.62);
          text-shadow: 0 0 6px rgba(255, 0, 34, 0.08);
        }

        .personnel-shell .resource-editor-field label {
          color: rgba(255, 132, 145, 0.62);
        }

        .personnel-shell .resource-editor-actions {
          background: rgba(0, 0, 0, 0.34);
        }

        .personnel-shell .resource-editor-field select,
        .personnel-shell .resource-editor-field select:focus,
        .personnel-shell .resource-editor-field select:active {
          background:
            linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
            var(--panel);
          border-color: rgba(255, 66, 82, 0.24);
        }

        .personnel-shell .resource-editor-submit:focus-visible {
          outline-color: var(--theme-accent-dim);
        }

        .personnel-panel {
          background: var(--panel);
          border: 1px solid var(--border-hot);
          box-shadow: 0 0 28px rgba(192, 0, 26, 0.12), inset 0 0 18px rgba(192, 0, 26, 0.05);
          padding: 24px;
          position: relative;
          overflow: hidden;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }

        .personnel-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, var(--scanline) 2px, var(--scanline) 4px);
          opacity: 0.35;
          pointer-events: none;
        }

        .personnel-grid {
          display: grid;
          gap: 18px;
          position: relative;
          z-index: 1;
        }

        .personnel-form {
          display: grid;
          gap: 14px;
        }

        .personnel-results {
          display: grid;
          gap: 14px;
        }

        .personnel-warning,
        .personnel-block {
          background: rgba(0, 0, 0, 0.36);
          border: 1px solid var(--border);
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
          padding: 16px 18px;
          position: relative;
          overflow: hidden;
        }

        .personnel-warning::before,
        .personnel-block::before {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, var(--scanline) 2px, var(--scanline) 4px);
          opacity: 0.25;
          pointer-events: none;
        }

        .personnel-warning {
          border-color: rgba(255, 183, 77, 0.55);
          box-shadow: 0 0 20px rgba(255, 183, 77, 0.08);
        }

        .personnel-warning-list {
          display: grid;
          gap: 10px;
          position: relative;
          z-index: 1;
        }

        .personnel-warning-item {
          border-left: 2px solid rgba(255, 183, 77, 0.8);
          padding-left: 12px;
        }

        .personnel-warning-item strong,
        .personnel-block-title {
          color: var(--border-hot);
          font-family: 'Orbitron', sans-serif;
          font-size: 0.58rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .personnel-warning-item p {
          color: var(--text);
          margin: 6px 0 0;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.86rem;
        }

        .personnel-block {
          display: grid;
          gap: 12px;
        }

        .personnel-block-title {
          margin: 0;
        }

        .personnel-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 12px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.9rem;
          position: relative;
          z-index: 1;
        }

        .personnel-label {
          color: var(--text-faint);
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .personnel-value {
          color: var(--text);
        }

        .personnel-link {
          color: var(--red-bright);
          text-decoration: none;
        }

        .personnel-empty {
          color: var(--text-dim);
          font-family: 'Share Tech Mono', monospace;
        }
      `}</style>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/personnel.js"]} />
    </HolonetFrame>
  );
}
