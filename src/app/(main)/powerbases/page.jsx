import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { supabaseRest } from "../../../../modules/auth/session-store.js";
import { holonetMetadata } from "../../../lib/metadata.js";
import Link from "next/link";

export const metadata = holonetMetadata({
  title: "Powerbases",
  description: "Directory of all official Imperial Powerbases."
});

export const revalidate = 60; // Revalidate every 60 seconds

export default async function PowerbasesPage() {
  // Fetch active powerbases with their members
  // We use supabaseRest for backend fetching. 
  // PostgREST syntax for joining members: select=*,powerbase_members(*)
  const powerbases = await supabaseRest("powerbases?select=*,powerbase_members(user_id)&status=eq.ACTIVE&order=tier.desc,prestige.desc").catch(() => []);

  // Organize by tier
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

      {[4, 3, 2, 1].map(tier => {
        if (tiers[tier].length === 0) return null;

        return (
          <div key={tier} style={{ marginBottom: "3rem" }}>
            <h2 className="codex-section-title" style={{ borderBottom: "1px solid var(--theme-dim)", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
              Tier {tier === 4 ? "IV" : tier === 3 ? "III" : tier === 2 ? "II" : "I"}
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
              {tiers[tier].map(pb => (
                <div key={pb.id} className="nav-card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--theme-bright)" }}>{pb.name}</h3>
                    <div style={{ fontSize: "0.875rem", color: "var(--theme-dim)", marginTop: "0.25rem" }}>
                      Prestige: <strong style={{ color: "var(--theme-color)" }}>{pb.prestige}</strong>
                    </div>
                  </div>

                  {pb.description && (
                    <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.4 }}>
                      {pb.description}
                    </p>
                  )}

                  <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--theme-dim)" }}>
                      {pb.powerbase_members?.length || 0} Member{(pb.powerbase_members?.length || 0) === 1 ? "" : "s"}
                    </span>
                    {pb.roblox_group_id && (
                      <a
                        href={`https://www.roblox.com/groups/${pb.roblox_group_id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: "0.85rem", color: "var(--theme-color)", textDecoration: "none" }}
                      >
                        View Group &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {powerbases.length === 0 && (
        <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--theme-dim)" }}>
          <p>No active Powerbases found.</p>
        </div>
      )}
    </HolonetFrame>
  );
}
