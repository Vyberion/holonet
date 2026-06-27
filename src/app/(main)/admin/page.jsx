import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";

export default function AdminPage() {
  return (
    <HolonetFrame title="ADMIN" subtitle="ADMIN CONSOLE">
      <div data-admin-root className="hub-shell">
        <div className="hub-layout admin-masonry-layout">
          <div className="admin-masonry-column">
            <section className="hub-panel" id="admin-overrides" />
            <section className="hub-panel" id="admin-counts" />
            <section className="hub-panel" id="admin-health" />
          </div>
          <div className="admin-masonry-column">
            <section className="hub-panel" id="admin-activity" />
          </div>
        </div>
      </div>

      <style>{`
        [data-admin-root] {
          --editor-accent: rgba(255, 108, 124, 0.68);
          --editor-accent-dim: rgba(255, 66, 82, 0.3);
          --editor-accent-glow: rgba(255, 0, 34, 0.1);
          --editor-panel: var(--panel);
          --editor-void: var(--void);
          --editor-wash: rgba(255, 66, 82, 0.03);
        }

        [data-admin-root] .hub-layout {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        [data-admin-root] .admin-masonry-column {
          align-content: start;
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        [data-admin-root] #admin-overrides,
        [data-admin-root] #admin-activity,
        [data-admin-root] #admin-counts,
        [data-admin-root] #admin-health {
          min-width: 0;
        }

        [data-admin-root] .resource-editor-submit {
          background:
            linear-gradient(135deg, rgba(255, 66, 82, 0.045), transparent),
            rgba(0, 0, 0, 0.22);
          border-color: rgba(255, 66, 82, 0.28);
          box-shadow: 0 0 10px rgba(255, 0, 34, 0.055);
          color: rgba(255, 132, 145, 0.78);
        }

        [data-admin-root] .resource-editor-submit:hover,
        [data-admin-root] .resource-editor-submit:focus-visible {
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

        [data-admin-root] .resource-editor-submit:focus-visible {
          outline-color: var(--theme-accent-dim);
        }

        [data-admin-root] .resource-editor-actions::before,
        [data-admin-root] .resource-editor-field label::before {
          color: rgba(255, 108, 124, 0.62);
          text-shadow: 0 0 6px rgba(255, 0, 34, 0.08);
        }

        [data-admin-root] .resource-editor-field label {
          color: rgba(255, 132, 145, 0.62);
        }

        [data-admin-root] .resource-editor-actions {
          background: rgba(0, 0, 0, 0.34);
        }

        [data-admin-root] .resource-editor-field select,
        [data-admin-root] .resource-editor-field select:focus,
        [data-admin-root] .resource-editor-field select:active {
          background:
            linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
            var(--panel);
          border-color: rgba(255, 66, 82, 0.24);
        }

        [data-admin-root] .admin-filter-row,
        [data-admin-root] .admin-page-controls {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          padding: 12px 0;
        }

        [data-admin-root] .admin-filter-row select,
        [data-admin-root] .admin-filter-row input {
          background:
            linear-gradient(135deg, rgba(255, 66, 82, 0.035), transparent),
            var(--panel);
          border: 1px solid rgba(255, 66, 82, 0.24);
          color: var(--text);
          font-family: 'Share Tech Mono', monospace;
          min-width: 150px;
          padding: 8px 10px;
        }

        [data-admin-root] .admin-page-controls {
          align-items: center;
          justify-content: flex-end;
        }

        [data-admin-root] .library-inline-btn:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }

        @media (max-width: 820px) {
          [data-admin-root] .hub-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/admin.js"]} />
    </HolonetFrame>
  );
}
