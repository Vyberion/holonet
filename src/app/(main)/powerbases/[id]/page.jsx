import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const [pb] = await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  if (!pb) return {};

  return holonetMetadata({
    title: pb.name,
    description: pb.description || `Powerbase hub for ${pb.name}.`
  });
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

export default async function PowerbaseDetailPage({ params }) {
  const { id } = await params;
  
  const [pb] = await supabaseRest(`powerbases?id=eq.${encodeURIComponent(id)}&select=*,powerbase_members(*)`).catch(() => []);
  if (!pb) notFound();

  // Fetch kaggath logs to calculate win-loss record
  const logs = await supabaseRest("powerbase_logs?action=eq.KAGGATH_DOMINATION&select=*").catch(() => []);

  let wins = 0;
  let losses = 0;

  logs.forEach(log => {
    const details = log.details || {};
    if (log.powerbase_id === pb.id || details.challenger_id === pb.id || details.defender_id === pb.id) {
      if (details.winner === pb.name) {
        wins++;
      } else if (details.winner) {
        losses++;
      }
    }
  });

  const apprentices = pb.powerbase_members || [];
  const memberCount = apprentices.length + 1; // Leader + apprentices

  return (
    <HolonetFrame
      title={pb.name.toUpperCase()}
      subtitle="IMPERIAL POWERBASE HUB"
      footerNode="POWERBASE"
      mainClassName="division-main"
      showHeader={false}
      showStatusBar={false}
    >
      <div className="hub-shell" style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Divisional-style Header */}
        <div className="hub-hero">
          <div className="hub-identity">
            <div>
              <span className="hub-kicker">Registry Node / KOR-7</span>
              <h2 className="hub-title">{pb.name}</h2>
            </div>
            <div>
              <span className="hub-kicker">Status</span>
              <span className="hub-value">{pb.status || "ACTIVE"}</span>
            </div>
          </div>
          <p className="hub-summary">{pb.description || "No description provided."}</p>

          {/* Status Grid: Members, Prestige, Tier */}
          <div className="hub-status-grid">
            <div className="hub-status-cell">
              <span className="hub-label">Members</span>
              <span className="hub-value">{memberCount}</span>
            </div>
            <div className="hub-status-cell">
              <span className="hub-label">Prestige</span>
              <span className="hub-value">{pb.prestige}</span>
            </div>
            <div className="hub-status-cell">
              <span className="hub-label">Tier</span>
              <span className="hub-value">Tier {romanize(pb.tier)}</span>
            </div>
          </div>
        </div>

        {/* 1-Page Powerbase Hub Layout */}
        <div className="hub-grid hub-grid--single" style={{ marginTop: "2rem" }}>
          <div className="hub-column" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Roblox Group Link (if available) */}
            {pb.roblox_group_id && (
              <section className="hub-panel">
                <h3 className="hub-panel-title">Roblox Group</h3>
                <div className="hub-list">
                  <div className="hub-row">
                    <strong>Official Roblox Group</strong>
                    <span>Group ID: {pb.roblox_group_id}</span>
                    <div className="hub-card-actions" style={{ marginTop: "0.5rem" }}>
                      <a
                        href={`https://www.roblox.com/groups/${pb.roblox_group_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hub-inline-link"
                      >
                        OPEN GROUP NODE &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Domination Kaggath Record */}
            <section className="hub-panel">
              <h3 className="hub-panel-title">Domination Kaggath Record</h3>
              <div className="hub-list">
                <div className="hub-row">
                  <strong>Domination Performance</strong>
                  <span>Win / Loss Record</span>
                  <p style={{ marginTop: "0.5rem", fontSize: "1.1rem" }}>
                    <span style={{ color: "#4caf50", fontWeight: "bold" }}>{wins} Win{wins === 1 ? "" : "s"}</span>
                    {" — "}
                    <span style={{ color: "#ff3b4f", fontWeight: "bold" }}>{losses} Loss{losses === 1 ? "" : "es"}</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Members Section */}
            <section className="hub-panel">
              <h3 className="hub-panel-title">Roster Members ({memberCount})</h3>
              <div className="hub-list">
                <div className="hub-row">
                  <strong>Leader</strong>
                  <span>Discord ID: {pb.leader_id}</span>
                  <span className="hub-timestamp">POWERBASE LEADER</span>
                </div>

                {apprentices.map((m, idx) => (
                  <div key={m.id || idx} className="hub-row">
                    <strong>Apprentice #{idx + 1}</strong>
                    <span>Discord ID: {m.user_id || m.discord_user_id}</span>
                    <span className="hub-timestamp">APPRENTICE</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
