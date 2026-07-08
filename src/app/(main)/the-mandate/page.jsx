import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import "./mandate.css";

export const metadata = holonetMetadata({
  title: "The Mandate",
  description: "The Mandate document viewer."
});

export default function TheMandatePage() {
  return (
    <HolonetFrame 
      title="The Mandate" 
      subtitle="The Emperor's Will" 
      showHeader={false} 
      showStatusBar={false}
      showNav={false}
      mainClassName="mandate-page-main" 
      includeSearchOverlay={false}
    >
      <div className="mandate-bg"></div>

      <div className="mandate-intro">
        <h1>The Mandate</h1>
      </div>

      <div className="mandate-content">
        <div className="mandate-viewer-container">
          <div className="pdf-viewer-naked">
            <div 
              className="pdf-tab-strip" 
              data-pdf-tab-strip 
              data-pdf-division="mandate"
              data-pdf-initial-zoom="1.5"
              style={{ display: 'none' }}
            >
            </div>

            <div className="pdf-box" style={{ height: "auto", overflow: "visible" }}>
              <div className="pdf-pages" data-pdf-pages aria-label="Rendered handbook pages">
                 <span className="pdf-loading">Initializing Secure Uplink...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/pdf-tabs.js"]} />
    </HolonetFrame>
  );
}
