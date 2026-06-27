import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Reports",
  description: "Divisional weekly and inspection reports."
});

export default function ReportsPage() {
  return (
    <HolonetFrame title="REPORTS" subtitle="DIVISION REPORTS" footerNode="KOR-7" showHeader={false}>
      <section className="nexus-shell" data-nexus-console>
        <div className="hub-hero">
          <div className="hub-identity">
            <div>
              <h2 className="hub-title">Reports</h2>
            </div>
            <div>
              <span className="hub-kicker">Status</span>
              <span className="hub-value">Synchronizing</span>
            </div>
          </div>
          <p className="hub-summary">Loading division reports and inspection scores.</p>
        </div>
        <p className="hub-empty">Loading reports...</p>
      </section>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/nexus.js"]} />
    </HolonetFrame>
  );
}
