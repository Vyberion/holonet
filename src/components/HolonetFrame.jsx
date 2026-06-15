import { HolonetNav } from "./HolonetNav.jsx";
import { OldGuardPlayer } from "./OldGuardPlayer.jsx";

export function HolonetFrame({
  title,
  subtitle,
  node = "KOR-7 / HORUSET SYSTEM",
  signalLabel = "LIVE",
  signalValue = "||||||||..",
  signalPercent = "82%",
  timestamp = "3958.001 / 00:00:00 GST",
  footerNode = "KOR-7",
  children,
  mainClassName = "",
  includeSearchOverlay = false
}) {
  return (
    <>
      <div id="nav-container">
        <HolonetNav />
      </div>

      <div id="vignette" aria-hidden="true" />
      <div id="rune-field" aria-hidden="true" />
      <div id="holo-grid" aria-hidden="true" />

      <div id="loader" role="status" aria-label="Establishing connection">
        <div className="loader-intro-gate" data-loader-intro-gate>
          <p className="loader-intro-kicker">Imperial Transmission Network</p>
          <button className="loader-establish-button" type="button" data-loader-establish>
            Establish Link
          </button>
          <p className="loader-intro-note">KOR-7 / Release Transmission</p>
        </div>

        <div className="loader-standard" data-loader-standard>
          <div className="loader-ring">
            <svg
              className="loader-logo"
              viewBox="0 0 900 900"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M0,0l140.05,238.551L21.797,215.412l140.306,182.876c-6.092,34.162-6.095,69.198,0,103.359
  L21.797,684.524l118.253-23.14L0,900l238.551-140.049l-23.139,118.252l182.876-140.306c34.184,6.103,69.241,6.104,103.424,0
  l182.877,140.306l-23.14-118.252L900,900L759.951,661.385l118.252,23.14L737.897,501.647c6.094-34.163,6.1-69.196,0-103.359
  l140.306-182.876l-118.252,23.139L900,0L661.449,140.049l23.14-118.316L501.647,162.103c-17.071-3.045-34.356-4.601-51.647-4.603
  c-17.292-0.001-34.576,1.563-51.647,4.603L215.412,21.733l23.139,118.316L0,0z M450,200.454
  c63.887,0.005,127.772,24.35,176.484,73.062c97.424,97.424,97.412,255.557,0,352.969s-255.544,97.361-352.969-0.064
  c-97.425-97.424-97.412-255.557,0-352.969C322.222,224.746,386.114,200.451,450,200.454z M450,274.09
  c-45.034-0.001-90.056,17.124-124.39,51.457c-68.667,68.667-68.676,180.167,0,248.842c68.677,68.676,180.11,68.668,248.778,0
  c68.668-68.666,68.676-180.166,0-248.842C540.051,291.208,495.035,274.093,450,274.09z"
              />
            </svg>
          </div>
          <div className="loader-text">Establishing Link&hellip;</div>
          <div className="loader-bar-wrap">
            <div className="loader-bar" />
          </div>
        </div>

        <div className="loader-link-display" data-loader-link-established>
          <p className="loader-intro-kicker">KOR-7 / Signal Accepted</p>
          <strong>LINK ESTABLISHED</strong>
        </div>

        <div className="loader-intro-video" data-loader-intro-video aria-hidden="true">
          <OldGuardPlayer mode="intro" />
        </div>

        <div className="loader-link-display" data-loader-link-stable>
          <p className="loader-intro-kicker">Transmission Complete</p>
          <strong>LINK STABLE</strong>
        </div>
      </div>

      <div id="app" className={includeSearchOverlay ? 'document-viewer-page' : ''}>
        <header>
          <p className="site-eyebrow">MANAR&apos;S THE SITH ORDER</p>
          <div className="header-rule" />
          <h1 className="site-title">{title}</h1>
          <p className="site-subtitle">{subtitle}</p>
          <div className="header-rule" />
        </header>

        <div className="status-bar" role="status" aria-live="polite">
          <span style={{ color: "var(--text-dim)" }}>
            Node: <span style={{ color: "var(--text-dim)" }}>{node}</span>
          </span>
          <span className="status-signal" style={{ color: "var(--text-dim)" }}>
            <span className="blink">● {signalLabel}</span>&nbsp;&nbsp;Signal:{" "}
            <span id="signal-bars">{signalValue}</span>{" "}
            <span id="signal-percent">{signalPercent}</span>
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            <span id="timestamp">{timestamp}</span>
          </span>
        </div>

        <main className={mainClassName}>{children}</main>

        <footer>
          <p className="footer-glyph" style={{ color: "var(--text-dim)" }}>
            Peace is a lie - There is only passion
          </p>
          <p className="footer-sig" style={{ color: "var(--text-dim)" }}>
            Sith Holonet - Encrypted Transmission - Node {footerNode}
          </p>
          <nav className="footer-links" aria-label="Legal links">
            <a href="/the-serious-stuff/terms-of-service">Terms</a>
            <a href="/the-serious-stuff/privacy-policy">Privacy</a>
          </nav>
        </footer>

        {includeSearchOverlay ? (
          <div id="search-overlay">
            <div id="search-container" />
          </div>
        ) : null}
      </div>
    </>
  );
}
