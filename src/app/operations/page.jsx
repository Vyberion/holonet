import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";
import { supabaseRest } from "../../../modules/auth/session-store.js";
import Link from "next/link";

export const metadata = holonetMetadata({
  title: "War Room",
  description: "Operational briefings and after-action reports."
});

export default async function OperationsPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab === 'after_action' ? 'AFTER_ACTION' : 'BRIEFING';
  
  let reports = [];
  try {
    reports = await supabaseRest(`event_reports?status=eq.PUBLISHED&type=eq.${tab}&order=event_date.desc.nullslast`).catch(() => []);
  } catch (err) {
    console.error("Failed to fetch event reports:", err);
  }

  return (
    <HolonetFrame
      title="WAR ROOM"
      subtitle="OPERATIONAL ARCHIVE"
      footerNode="OPS-NODE"
      mainClassName="operations-main"
    >
      <div className="document-shell" style={{ margin: "0 auto", padding: "2rem" }}>
        
        <header className="ops-header">
          <div className="ops-title-group">
            <h2 style={{ margin: 0, color: "var(--division-accent, var(--red-bright))", fontFamily: "'Orbitron', sans-serif" }}>OPERATIONS</h2>
            <span className="ops-subtitle">COMMAND AND CONTROL</span>
          </div>
          
          <div className="ops-tabs">
            <Link href="?tab=briefings" className={`ops-tab ${tab === 'BRIEFING' ? 'active' : ''}`}>
              ACTIVE BRIEFINGS
            </Link>
            <Link href="?tab=after_action" className={`ops-tab ${tab === 'AFTER_ACTION' ? 'active' : ''}`}>
              AFTER-ACTION REPORTS
            </Link>
          </div>
        </header>

        {reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-dim)", fontFamily: "'Share Tech Mono', monospace" }}>
            [ NO {tab === 'BRIEFING' ? 'ACTIVE BRIEFINGS' : 'REPORTS'} FOUND ]
          </div>
        ) : (
          <div className="ops-list">
            {reports.map((report) => (
              <Link href={`/operations/${report.slug}`} key={report.id} className="ops-item">
                <div className="ops-date">
                  {report.event_date 
                    ? new Date(report.event_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'TBD'
                  }
                </div>
                
                <div className="ops-details">
                  <h3 className="ops-item-title">{report.title}</h3>
                  <p className="ops-desc">{report.description}</p>
                </div>
                
                <div className="ops-meta">
                  <div style={{ color: "var(--text-faint)" }}>CMDR: {report.commander_name}</div>
                  {report.location && <div style={{ marginTop: '4px' }}>LOC: {report.location}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
