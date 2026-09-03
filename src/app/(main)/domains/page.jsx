import React from "react";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { getDivision } from "../../../lib/divisions.js";
import { holonetMetadata } from "../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Specializations",
  description: "The departments and divisions of the Sith Order."
});

const DOMAINS_LIST = [
  {
    id: "highranks",
    name: "High Ranks",
    kicker: "// SPECIALIZED DOMAIN &bull; INSTRUCTOR CADRE",
    hubUrl: "https://instructors.thesithorder.org",
    infoPath: "/high-ranks",
    badge: "[ OPERATIONAL HUB ]",
    tagline: "Overseeing trials, doctrine instruction, and senior rank ascension."
  },
  {
    id: "dhg",
    name: "Dark Honor Guard",
    kicker: "// IMPERIAL GUARD &bull; CITADEL DEFENSE",
    hubUrl: "https://guards.thesithorder.org",
    infoPath: "/guards",
    badge: "[ OPERATIONAL HUB ]",
    tagline: "The sworn personal protectorate of the Emperor and the sanctum."
  },
  {
    id: "reavers",
    name: "The Reavers",
    kicker: "// FRONTIER VANGUARD &bull; COMBAT RECON",
    hubUrl: "https://reavers.thesithorder.org",
    infoPath: "/reavers",
    badge: "[ OPERATIONAL HUB ]",
    tagline: "The razor-edge assault cadre and frontline shock detachment."
  },
  {
    id: "inquisitors",
    name: "The Inquisitors",
    kicker: "// INTERNAL SECURITY &bull; PURGE FORCE",
    hubUrl: "https://inquisitors.thesithorder.org",
    infoPath: "/inquisitors",
    badge: "[ OPERATIONAL HUB ]",
    tagline: "Rooting out treachery, heresy, and dissident sentiment."
  },
  {
    id: "dreadmasters",
    name: "The Dread Masters",
    kicker: "// SORCEROUS CABAL &bull; TERROR CORPS",
    hubUrl: "https://dreads.thesithorder.org",
    infoPath: "/dreads",
    badge: "[ OPERATIONAL HUB ]",
    tagline: "Wielders of phantasmagoric fear, alchemy, and dread powers."
  }
];

export default function DomainsPage() {
  return (
    <HolonetFrame
      title="SPECIALIZATIONS"
      subtitle="BRANCHES & OPERATIONAL HUBS"
      footerNode="DOM-03"
      includeSearchOverlay
      mainClassName="domains-main"
    >
      <div className="registry-main" style={{ maxWidth: "1150px", margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
        
        {/* Terminal Header */}
        <div className="hub-hero" style={{ marginBottom: "2.5rem" }}>
          <div className="hub-identity">
            <div>
              <span className="hub-kicker">// SPECIALIZED IMPERIAL ARMS &bull; SECTORS</span>
              <h1 className="hub-title" style={{ fontFamily: "Cinzel, serif", fontSize: "1.8rem", color: "var(--red-bright)", margin: "0.2rem 0" }}>
                Specializations
              </h1>
              <p style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.85rem", margin: 0 }}>
                Specialized branches operating under autonomous authority and dedicated sub-sites.
              </p>
            </div>
          </div>
        </div>

        {/* Domains Cards Grid */}
        <div className="dir-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {DOMAINS_LIST.map((domain) => {
            const division = getDivision(domain.id);
            const desc = division?.description || domain.tagline;
            const node = division?.node || "DOM-X";

            return (
              <div
                key={domain.id}
                className="dir-card"
                style={{
                  background: "linear-gradient(135deg, rgba(192,0,26,0.06) 0%, transparent 60%), var(--surface)",
                  border: "1px solid var(--border-hot)",
                  padding: "1.4rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))"
                }}
              >
                <div>
                  <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.7rem", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
                    {domain.kicker}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.4rem 0 0.8rem" }}>
                    <h2 style={{ fontFamily: "Cinzel, serif", fontSize: "1.3rem", color: "var(--red-bright)", margin: 0 }}>
                      {domain.name}
                    </h2>
                    <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.68rem", color: "var(--red-bright)", background: "rgba(192,0,26,0.1)", border: "1px solid var(--border-hot)", padding: "0.1rem 0.4rem" }}>
                      {domain.badge}
                    </span>
                  </div>
                  <p style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.82rem", color: "var(--text-bright)", lineHeight: "1.5", marginBottom: "1.2rem" }}>
                    {desc}
                  </p>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "0.8rem", marginBottom: "0.8rem" }}>
                    <span style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      NODE: {node}
                    </span>
                    <a
                      href={domain.infoPath}
                      style={{ fontFamily: "Share Tech Mono, monospace", fontSize: "0.72rem", color: "var(--text-dim)", textDecoration: "underline" }}
                    >
                      View Dossier &rarr;
                    </a>
                  </div>
                  <a
                    href={domain.hubUrl}
                    className="hub-write-btn"
                    style={{
                      display: "block",
                      textAlign: "center",
                      textDecoration: "none",
                      padding: "0.5rem 1rem",
                      fontSize: "0.78rem"
                    }}
                  >
                    ENTER OPERATIONAL HUB &rarr;
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Global Inspections / Reports Quick Access */}
        <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
          <div
            className="dir-card dir-card--overview"
            style={{
              background: "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(192,0,26,0.04) 100%), var(--surface)",
              border: "1px solid var(--border-hot)",
              padding: "1.4rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem"
            }}
          >
            <div>
              <span className="hub-kicker">// AUDIT & REGISTRY MATRIX</span>
              <h3 style={{ fontFamily: "Cinzel, serif", fontSize: "1.2rem", color: "var(--red-bright)", margin: "0.2rem 0" }}>
                Divisional Inspections & Weekly Reports
              </h3>
              <p style={{ color: "var(--text-dim)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.82rem", margin: 0 }}>
                Comprehensive scores, readiness metrics, and combat activity records across all domains.
              </p>
            </div>
            <a
              href="/reports"
              className="hub-write-btn"
              style={{ textDecoration: "none", padding: "0.5rem 1.2rem", fontSize: "0.8rem" }}
            >
              VIEW INSPECTIONS MATRIX &rarr;
            </a>
          </div>
        </div>

      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
