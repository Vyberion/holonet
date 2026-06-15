import { HolonetFrame } from "../components/HolonetFrame.jsx";
import { HomeMuxPlayer } from "../components/HomeMuxPlayer.jsx";
import { PageScripts } from "../components/PageScripts.jsx";
import { holonetMetadata } from "../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Holonet",
  description: "Laws, lore, ranks, records and division resources for Manar's The Sith Order."
});

export default function HomePage() {
  return (
    <HolonetFrame
      title="THE HOLONET"
      subtitle="IMPERIAL TRANSMISSION NETWORK"
      footerNode="KOR-7"
    >


      <nav className="nav-grid" aria-label="Holonet Sections">
        <a href="/codex" className="nav-card" aria-label="Enter The Codex">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">I</div>
          <div className="card-hex" aria-hidden="true">0x1A&nbsp;&nbsp;SECT.01</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 01 &mdash; Doctrine</span>
          <h2 className="card-title">The Codex</h2>
          <p className="card-desc">Supreme law.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

        <a href="/archives" className="nav-card" aria-label="Enter The Archives">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">II</div>
          <div className="card-hex" aria-hidden="true">0x2B&nbsp;&nbsp;SECT.02</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 02 &mdash; Records</span>
          <h2 className="card-title">The Archives</h2>
          <p className="card-desc">Sith lore.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

        <a href="/hierarchy" className="nav-card" aria-label="Enter The Hierarchy">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">III</div>
          <div className="card-hex" aria-hidden="true">0x3C&nbsp;&nbsp;SECT.03</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 03 &mdash; Ranks</span>
          <h2 className="card-title">Hierarchy</h2>
          <p className="card-desc">Sith ranks.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>
      </nav>

      <section className="home-media-shell" aria-labelledby="home-media-title">
        <div className="home-media-topbar">
          <span className="home-media-kicker">Imperial Transmission</span>
          <span className="home-media-signal">ARCHIVE PLAYBACK</span>
        </div>
        <div className="home-media-frame">
          <HomeMuxPlayer />
        </div>
        <div className="home-media-caption">
          <h2 id="home-media-title">The Old Guard</h2>
        </div>
      </section>

      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track" style={{ color: "var(--text-dim)" }} />
      </div>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
