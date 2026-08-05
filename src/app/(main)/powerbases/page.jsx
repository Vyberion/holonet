import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { holonetMetadata } from "../../../lib/metadata.js";
import { PageScripts } from "../../../components/PageScripts.jsx";
import Link from "next/link";

export const metadata = holonetMetadata({
  title: "Powerbases",
  description: "Directory of all official Imperial Powerbases."
});

export const dynamic = "force-dynamic";

function slugifyPowerbase(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function PowerbaseCard({ pb }) {
  const memberCount = (pb.powerbase_members?.length || 0) + 1; // +1 for leader
  const slug = slugifyPowerbase(pb.name) || pb.id;

  return (
    <Link
      href={`/powerbases/${encodeURIComponent(slug)}`}
      className="dir-card"
      data-status="open"
      aria-label={`${pb.name} - Tier ${pb.tier}`}
      style={{ textDecoration: "none", color: "inherit", cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      <div className="dir-card-frame" aria-hidden="true" />
      <div className="card-vline" aria-hidden="true" />
      <div className="card-scan" aria-hidden="true" />
      
      <div className="dir-card-top">
        <h2 className="dir-card-title">{pb.name}</h2>
        <span className="dir-card-badge">PRESTIGE: {pb.prestige}</span>
      </div>

      <p className="dir-card-desc">{pb.description || "No description provided."}</p>

      <div className="dir-card-bottom">
        <span className="dir-card-node">{memberCount} MEMBER{memberCount === 1 ? "" : "S"}</span>
        <span className="dir-card-enter action-btn">
          VIEW POWERBASE &rarr;
        </span>
      </div>
    </Link>
  );
}

export default async function PowerbasesPage() {
  const powerbases = await supabaseRest("powerbases?select=*,powerbase_members(user_id)&status=eq.ACTIVE&order=tier.desc,prestige.desc").catch(() => []);

  const tiers = {
    4: powerbases.filter(p => p.tier === 4),
    3: powerbases.filter(p => p.tier === 3),
    2: powerbases.filter(p => p.tier === 2),
    1: powerbases.filter(p => p.tier === 1),
  };

  return (
    <HolonetFrame
      title="IMPERIAL POWERBASES"
      subtitle="DIRECTORY OF APPROVED ORGANISATIONS"
      node="KOR-7 / HORUSET SYSTEM"
      signalLabel="LIVE"
      signalValue="|||||||||."
      signalPercent="99%"
      footerNode="POWERBASES"
      mainClassName="powerbases-main"
    >
      <div className="registry-main">
        {[4, 3, 2, 1].map(tier => {
          if (tiers[tier].length === 0) return null;

          return (
            <section key={tier} className="registry-section" aria-labelledby={`sec-tier-${tier}`}>
              <div className="section-header">
                <span className="section-tag" id={`sec-tier-${tier}`}>
                  // TIER {tier === 4 ? "IV" : tier === 3 ? "III" : tier === 2 ? "II" : "I"} POWERBASES
                </span>
                <div className="section-rule" />
              </div>

              <div className="dir-grid">
                {tiers[tier].map(pb => (
                  <PowerbaseCard key={pb.id} pb={pb} />
                ))}
              </div>
            </section>
          );
        })}

        {powerbases.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--theme-dim)" }}>
            <p>No active Powerbases found.</p>
          </div>
        )}
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
