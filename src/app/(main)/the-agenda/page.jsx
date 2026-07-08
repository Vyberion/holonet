import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Agenda",
  description: "The Agenda document viewer."
});

export default function TheAgendaPage() {
  return (
    <HolonetFrame title="THE AGENDA" subtitle="SECURE DOCUMENT VIEWER">
      <div className="codex-document document-shell" style={{ marginTop: 0 }}>
        <article className="codex-article handbook-viewer-panel">
          <div className="article-content pdf-terminal">
            <div
              className="pdf-tab-strip"
              role="tablist"
              aria-label="Agenda handbook documents"
              data-pdf-tab-strip
              data-pdf-division="agenda"
            >
              <span className="pdf-loading">Loading handbook registry...</span>
            </div>

            <div className="pdf-toolbar" aria-label="PDF viewer controls">
              <div className="pdf-zoom-controls" aria-label="Zoom controls">
                <button type="button" className="pdf-tool-btn" data-pdf-zoom-out aria-label="Zoom out">-</button>
                <span className="pdf-zoom-readout" data-pdf-zoom-label>100%</span>
                <button type="button" className="pdf-tool-btn" data-pdf-zoom-in aria-label="Zoom in">+</button>
                <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-fit-height>FIT</button>
                <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-fit-width>FILL</button>
              </div>
              <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-open-search>SEARCH</button>
            </div>

            <div className="pdf-box">
              <div className="pdf-pages" data-pdf-pages aria-label="Rendered handbook pages" />
            </div>
          </div>
        </article>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/pdf-tabs.js"]} />
    </HolonetFrame>
  );
}
