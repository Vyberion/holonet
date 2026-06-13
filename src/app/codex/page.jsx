import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Codex",
  description: "The supreme law of the Sith Order."
});

export default function CodexPage() {
  return (
    <HolonetFrame title="THE CODEX" subtitle="SUPREME LAW" includeSearchOverlay>
      <div className="codex-shell">
        <aside className="codex-contents" data-library-contents>
          <div className="codex-contents-placeholder">
            <p>Loading contents...</p>
          </div>
        </aside>

        <div className="codex-document" data-library-document="" data-library-key="codex">
          <article className="codex-article">
            <div className="article-header">
              <span className="article-number">KOR-7 / Codex Registry</span>
              <h2 className="article-title">Loading Canon</h2>
            </div>
            <div className="article-content">
              <div className="regulation">
                <h3 className="reg-title">Sync Notice</h3>
                <p className="reg-text">Loading codex.</p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/library-view.js"]} />
    </HolonetFrame>
  );
}
