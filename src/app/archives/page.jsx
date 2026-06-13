import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Archives",
  description: "Historical records and group archives."
});

export default function ArchivesPage() {
  return (
    <HolonetFrame title="THE ARCHIVES" subtitle="SITH LORE" includeSearchOverlay>
      <div className="codex-shell">
        <aside className="codex-contents" data-library-contents>
          <div className="codex-contents-placeholder">
            <p>Loading contents...</p>
          </div>
        </aside>

        <div className="codex-document" data-library-document="" data-library-key="archives">
          <article className="codex-article">
            <div className="article-header">
              <span className="article-number">KOR-7 / Archive Registry</span>
              <h2 className="article-title">Loading Archives</h2>
            </div>
            <div className="article-content">
              <div className="regulation">
                <p className="reg-text">Archives synchronizing.</p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js", "/modules/client/library-view.js"]} />
    </HolonetFrame>
  );
}
