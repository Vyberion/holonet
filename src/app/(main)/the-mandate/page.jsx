import Link from "next/link";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import "./mandate.css";

export const metadata = holonetMetadata({
  title: "The Mandate",
  description: "The Mandate document viewer."
});

export default function TheMandatePage() {
  return (
    <div className="mandate-wrapper">
      <div className="mandate-bg"></div>
      <div className="mandate-particles"></div>

      <div className="mandate-intro">
        <h1>The Mandate</h1>
      </div>

      <div className="mandate-content">
        <Link href="/" className="mandate-back-btn">
          <span>&larr;</span> Return
        </Link>
        <div className="mandate-viewer-container">
          <article className="codex-article handbook-viewer-panel">
            <div className="article-content pdf-terminal">
              <div
                className="pdf-tab-strip"
                role="tablist"
                aria-label="Mandate handbook documents"
                data-pdf-tab-strip
                data-pdf-division="mandate"
              >
                <span className="pdf-loading">Initializing Secure Uplink...</span>
              </div>

              <div className="pdf-toolbar" aria-label="PDF viewer controls">
                <div className="pdf-zoom-controls" aria-label="Zoom controls" style={{ display: 'flex', alignItems: 'center' }}>
                  <button type="button" className="pdf-tool-btn" data-pdf-zoom-out aria-label="Zoom out">-</button>
                  <span className="pdf-zoom-readout" data-pdf-zoom-label>100%</span>
                  <button type="button" className="pdf-tool-btn" data-pdf-zoom-in aria-label="Zoom in">+</button>
                  <button type="button" className="pdf-tool-btn pdf-tool-text" style={{ marginLeft: '10px' }} data-pdf-fit-height>FIT</button>
                  <button type="button" className="pdf-tool-btn pdf-tool-text" style={{ marginLeft: '10px' }} data-pdf-fit-width>FILL</button>
                </div>
                <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-open-search>SEARCH</button>
              </div>

              <div className="pdf-box">
                <div className="pdf-pages" data-pdf-pages aria-label="Rendered handbook pages" />
              </div>
            </div>
          </article>
        </div>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/pdf-tabs.js"]} />
    </div>
  );
}
