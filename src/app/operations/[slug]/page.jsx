import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { DiscordMarkdown } from "../../../components/DiscordMarkdown.jsx";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const reports = await supabaseRest(`event_reports?slug=eq.${encodeURIComponent(slug)}`).catch(() => []);
  const report = reports?.[0];

  if (!report) return {};

  return holonetMetadata({
    title: report.title,
    description: report.description
  });
}

export default async function OperationsReportPage({ params }) {
  const { slug } = await params;

  let report = null;
  try {
    const reports = await supabaseRest(`event_reports?slug=eq.${encodeURIComponent(slug)}`);
    report = reports?.[0];
  } catch (err) {
    console.error("Failed to fetch report:", err);
  }

  if (!report) {
    notFound();
  }

  return (
    <HolonetFrame
      title="WAR ROOM"
      subtitle={report.type === 'AFTER_ACTION' ? "AFTER-ACTION REPORT" : "OPERATIONAL BRIEFING"}
      footerNode="OPS-NODE"
      mainClassName="ops-report-main document-viewer-page"
    >
      <div className="document-shell" style={{ margin: "0 auto", padding: "2rem" }}>
        
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/operations" style={{ color: "var(--text-dim)", textDecoration: "none", fontFamily: "'Share Tech Mono', monospace", textTransform: "uppercase" }}>
            &lsaquo;&lsaquo; RETURN TO COMMAND
          </Link>
        </div>

        <article className="ops-report-container">
          <header className="ops-report-header">
            <span className="ops-report-type">{report.type === 'AFTER_ACTION' ? "AFTER-ACTION REPORT" : "BRIEFING"}</span>
            <h1 className="ops-report-title">{report.title}</h1>
            
            <div className="ops-report-grid">
              <div className="ops-data-point">
                <span className="ops-data-label">COMMANDER</span>
                <span className="ops-data-value">{report.commander_name}</span>
              </div>
              <div className="ops-data-point">
                <span className="ops-data-label">LOCATION</span>
                <span className="ops-data-value">{report.location || 'UNKNOWN'}</span>
              </div>
              <div className="ops-data-point">
                <span className="ops-data-label">DATE</span>
                <span className="ops-data-value">
                  {report.event_date 
                    ? new Date(report.event_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'TBD'
                  }
                </span>
              </div>
            </div>
          </header>

          <div className="ops-report-body codex-article">
            <div className="ops-report-content">
              <DiscordMarkdown content={report.details} />
            </div>
          </div>
        </article>

      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
