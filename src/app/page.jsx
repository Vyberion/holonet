import React from "react";
import { HolonetFrame } from "../components/HolonetFrame.jsx";
import { PageScripts } from "../components/PageScripts.jsx";
import { holonetMetadata } from "../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Holonet",
  description: "Laws, lore, ranks, records, domains and legislative conclaves for Manar's The Sith Order."
});

const PILLARS = [
  {
    href: "/codex",
    title: "The Codex",
    glyph: "I",
    hex: "0x1A  SECT.01",
    category: "Section 01 — Doctrine & Law",
    desc: "Imperial doctrine, statutory articles, and the hierarchical ranks of the Order."
  },
  {
    href: "/archives",
    title: "The Archives",
    glyph: "II",
    hex: "0x2B  SECT.02",
    category: "Section 02 — Chronicles",
    desc: "The unbroken historical timeline, imperial lineages, and ancient Sith history."
  },
  {
    href: "/domains",
    title: "The Domains",
    glyph: "III",
    hex: "0x3C  SECT.03",
    category: "Section 03 — Specialized Arms",
    desc: "Autonomous martial branches, frontline vanguard, purge forces, and operational hubs."
  },
  {
    href: "/powerbases",
    title: "Powerbases",
    glyph: "IV",
    hex: "0x4D  SECT.04",
    category: "Section 04 — Political Factions",
    desc: "Political coalitions and personal spheres of influence led by High Ranks."
  },
  {
    href: "/council",
    title: "The Dark Council",
    glyph: "V",
    hex: "0x5E  SECT.05",
    category: "Section 05 — Conclave",
    desc: "The legislative chamber, Conclave Docket, floor deliberations, and Imperial Decrees."
  }
];

export default function HomePage() {
  return (
    <HolonetFrame
      title="THE HOLONET"
      subtitle="IMPERIAL TRANSMISSION NETWORK"
      footerNode="KOR-7"
      mainClassName="home-main"
    >
      <nav className="nav-grid nav-grid--home" aria-label="Holonet Primary Pillars">
        {PILLARS.map((pillar) => (
          <a key={pillar.href} href={pillar.href} className="nav-card" aria-label={`Enter ${pillar.title}`}>
            <div className="card-inner-border" aria-hidden="true" />
            <div className="card-corners" aria-hidden="true" />
            <div className="card-vline" aria-hidden="true" />
            <div className="card-scan" aria-hidden="true" />
            <div className="card-bg-glyph" aria-hidden="true">{pillar.glyph}</div>
            <div className="card-hex" aria-hidden="true">{pillar.hex}</div>
            <div className="card-data" aria-hidden="true">
              CLEARANCE: UNCLASSIFIED<br />
              DESIGNATION: LEVEL 1<br />
            </div>
            <span className="card-category">{pillar.category}</span>
            <h2 className="card-title">{pillar.title}</h2>
            <p className="card-desc">{pillar.desc}</p>
            <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
          </a>
        ))}
      </nav>

      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track" style={{ color: "var(--text-dim)" }}>
          {Array(2).fill([
            "PEACE IS A LIE, THERE IS ONLY PASSION",
            "✦",
            "THROUGH PASSION, I GAIN STRENGTH",
            "✦",
            "THROUGH STRENGTH, I GAIN POWER",
            "✦",
            "THROUGH POWER, I GAIN VICTORY",
            "✦",
            "THROUGH VICTORY, MY CHAINS ARE BROKEN",
            "✦",
            "THE FORCE SHALL FREE ME",
            "✦"
          ]).flat().map((item, i) => (
            <span key={i} className={item === "✦" ? "sep" : ""}>{item}</span>
          ))}
        </div>
      </div>

      <style>{`
        .nav-grid--home {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          margin: 1.5rem 0 3rem;
        }

        @media (max-width: 860px) {
          .nav-grid--home {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
