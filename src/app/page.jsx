import { HolonetFrame } from "../components/HolonetFrame.jsx";
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
      mainClassName="home-main"
    >
      <nav className="nav-grid nav-grid--home" aria-label="Holonet Sections">
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

        <a href="/archives/cots" className="nav-card nav-card--home-short" aria-label="Enter Champion of The Sith">
          <div className="card-inner-border" aria-hidden="true" />
          <div className="card-corners" aria-hidden="true" />
          <div className="card-vline" aria-hidden="true" />
          <div className="card-scan" aria-hidden="true" />
          <div className="card-bg-glyph" aria-hidden="true">II.I</div>
          <div className="card-hex" aria-hidden="true">0x4D&nbsp;&nbsp;SECT.02.1</div>
          <div className="card-data" aria-hidden="true">
            CLEARANCE: UNCLASSIFIED<br />
            DESIGNATION: LEVEL 1<br />
          </div>
          <span className="card-category">Section 02.1 &mdash; Tournament</span>
          <h2 className="card-title">Champion of The Sith</h2>
          <p className="card-desc">CoTS records.</p>
          <span className="card-enter" aria-hidden="true">Enter &rsaquo;&rsaquo;</span>
        </a>

      </nav>

      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track" style={{ color: "var(--text-dim)" }} />
      </div>

      <style>{`
        .nav-grid--home .nav-card--home-short {
          grid-column: 1 / -1;
          height: clamp(190px, 19vh, 270px);
          min-height: 190px;
        }

        .nav-grid--home .nav-card--home-short .card-bg-glyph {
          font-size: clamp(6.5rem, 8vw, 11rem);
          left: auto;
          right: clamp(54px, 8vw, 130px);
          transform: translateY(-50%);
        }

        .nav-grid--home .nav-card--home-short .card-desc {
          max-width: 34ch;
        }

        @media (max-width: 860px) {
          .nav-grid--home {
            grid-template-columns: 1fr;
          }

          .nav-grid--home .nav-card,
          .nav-grid--home .nav-card--home-short {
            grid-column: auto;
          }

          .nav-grid--home .nav-card--home-short {
            height: 200px;
            min-height: 200px;
          }

          .nav-grid--home .nav-card--home-short .card-bg-glyph {
            left: 50%;
            right: auto;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
