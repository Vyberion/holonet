import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { supabaseRest } from "../../../../../modules/auth/session-store.js";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import Link from "next/link";

function slugifyPowerbase(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function findPowerbaseBySlugOrId(param) {
  const target = String(param || "").trim();
  const targetSlug = slugifyPowerbase(target);

  const powerbases = await supabaseRest("powerbases?select=*,powerbase_members(*)").catch(() => []);
  return powerbases.find(pb => pb.id === target || slugifyPowerbase(pb.name) === targetSlug) || null;
}

export async function generateMetadata({ params }) {
  const { name } = await params;
  const pb = await findPowerbaseBySlugOrId(name);
  if (!pb) return {};

  return holonetMetadata({
    title: pb.name,
    description: pb.description || `Powerbase hub for ${pb.name}.`
  });
}

function romanize(num) {
  return ["I", "II", "III", "IV"][num - 1] || "I";
}

async function getNamesForDiscordIds(discordIds) {
  const ids = Array.from(new Set(discordIds.filter(Boolean)));
  if (!ids.length) return {};
  const map = {};

  // 1. Fetch verification links
  const links = await supabaseRest(`verification_links?discord_user_id=in.(${ids.map(id => encodeURIComponent(id)).join(",")})&select=discord_user_id,roblox_user_id`).catch(() => []);

  const robloxMap = {};
  links.forEach(l => { robloxMap[l.discord_user_id] = l.roblox_user_id; });

  // 2. Fetch Roblox profiles
  const robloxIds = Object.values(robloxMap).filter(Boolean);
  if (robloxIds.length > 0) {
    try {
      const res = await fetch("https://users.roblox.com/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: robloxIds.map(Number), excludeBannedUsers: false })
      });
      if (res.ok) {
        const data = await res.json();
        const robloxUserMap = {};
        (data.data || []).forEach(u => { robloxUserMap[String(u.id)] = u.name || u.displayName; });

        links.forEach(l => {
          if (robloxUserMap[String(l.roblox_user_id)]) {
            map[l.discord_user_id] = robloxUserMap[String(l.roblox_user_id)];
          }
        });
      }
    } catch (e) { }
  }

  // 3. Check clock_shifts for username fallback
  const missingIds = ids.filter(id => !map[id]);
  if (missingIds.length > 0) {
    const shifts = await supabaseRest(`clock_shifts?discord_user_id=in.(${missingIds.map(id => encodeURIComponent(id)).join(",")})&select=discord_user_id,discord_username,roblox_username`).catch(() => []);
    shifts.forEach(s => {
      if (!map[s.discord_user_id]) {
        map[s.discord_user_id] = s.roblox_username || s.discord_username;
      }
    });
  }

  // Fallback to raw ID if unlinked
  ids.forEach(id => {
    if (!map[id]) map[id] = id;
  });

  return map;
}

export default async function PowerbaseDetailPage({ params }) {
  const { name } = await params;

  const pb = await findPowerbaseBySlugOrId(name);
  if (!pb) notFound();

  const wins = Number(pb.kaggath_wins || 0);
  const losses = Number(pb.kaggath_losses || 0);

  const apprentices = pb.powerbase_members || [];
  const memberCount = apprentices.length + 1; // Leader + apprentices

  const allDiscordIds = [pb.leader_id, ...apprentices.map(m => m.user_id || m.discord_user_id)].filter(Boolean);
  const userNames = await getNamesForDiscordIds(allDiscordIds);

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
        {/* Header */}
        <div className="hub-hero">
          <div className="hub-identity">
            <div>
              <span className="hub-kicker">Powerbase Node / KOR-7</span>
              <h2 className="hub-title">{pb.name}</h2>
            </div>
            <div>
              <span className="hub-kicker">Status</span>
              <span className="hub-value">{pb.status || "ACTIVE"}</span>
            </div>
          </div>
          <p className="hub-summary">{pb.description || "No description provided."}</p>

          {/* Status Grid */}
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
              <span className="hub-value" style={pb.is_sudden_death ? { color: "var(--red-bright)" } : {}}>
                Tier {romanize(pb.tier)} {pb.is_sudden_death ? "(SUDDEN DEATH)" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* 1-Page Powerbase Hub Content */}
        <div className="hub-grid hub-grid--single" style={{ marginTop: "2rem" }}>
          <div className="hub-column" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* Roblox Group Link */}
            {pb.roblox_group_id && (
              <section className="hub-panel">
                <h3 className="hub-panel-title">Roblox Group</h3>
                <div className="hub-list">
                  <div className="hub-row">
                    <strong>Official Roblox Group</strong>
                    <div className="hub-card-actions" style={{ marginTop: "0.5rem" }}>
                      <a
                        href={`https://www.roblox.com/groups/${pb.roblox_group_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hub-inline-link"
                      >
                        OPEN GROUP &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Domination Kaggath Record */}
            <section className="hub-panel">
              <h3 className="hub-panel-title">Record</h3>
              <div className="hub-list">
                <div className="hub-row">
                  <strong>Domination Performance</strong>
                  <p style={{ marginTop: "0.5rem", fontSize: "1.1rem" }}>
                    <span style={{ color: "#4caf50", fontWeight: "bold" }}>{wins} Win{wins === 1 ? "" : "s"}</span>
                    {" — "}
                    <span style={{ color: "#ff3b4f", fontWeight: "bold" }}>{losses} Loss{losses === 1 ? "" : "es"}</span>
                  </p>
                </div>
              </div>
            </section>

            {/* Roster Section */}
            <section className="hub-panel">
              <h3 className="hub-panel-title">Roster ({memberCount})</h3>
              <div className="hub-list">
                {/* Leader */}
                <div className="hub-row">
                  <strong>Leader</strong>
                  <span>{userNames[pb.leader_id] || pb.leader_id}</span>
                  <span
                    className="hub-timestamp"
                    style={{
                      color: "#ff1a2d",
                      borderColor: "#ff1a2d",
                      background: "none",
                      fontWeight: "bold",
                      letterSpacing: "0.05em"
                    }}
                  >
                  </span>
                </div>

                {/* Apprentices */}
                {apprentices.map((m, idx) => {
                  const uId = String(m.user_id || m.discord_user_id || "");
                  return (
                    <div key={m.id || idx} className="hub-row">
                      <strong>Apprentice #{idx + 1}</strong>
                      <span>{userNames[uId] || uId}</span>
                      <span
                        className="hub-timestamp"
                        style={{
                          color: "#ff1a2d",
                          borderColor: "#ff1a2d",
                          background: "none",
                          fontWeight: "bold",
                          letterSpacing: "0.05em"
                        }}
                      >
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
        </div>
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
