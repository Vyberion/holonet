import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";

export default function NexusPage() {
  return (
    <HolonetFrame title="OVERVIEW" subtitle="DIVISION INSPECTIONS" footerNode="KOR-7">
      <section className="nexus-shell" data-nexus-console>
        <div className="hub-hero">
          <div className="hub-identity">
            <div>
              <h2 className="hub-title">Overview</h2>
            </div>
            <div>
              <span className="hub-kicker">Status</span>
              <span className="hub-value">Synchronizing</span>
            </div>
          </div>
          <p className="hub-summary">Loading division reports and inspection scores.</p>
        </div>
        <p className="hub-empty">Loading Overview...</p>
      </section>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/nexus.js"]} />
    </HolonetFrame>
  );
}
