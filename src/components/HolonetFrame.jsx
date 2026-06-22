import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../../modules/config/intro.js";
import { HolonetNav } from "./HolonetNav.jsx";
import { OldGuardPlayer } from "./OldGuardPlayer.jsx";

const alternativeIntroEnabled = HOLONET_ALTERNATIVE_INTRO_ENABLED;
const alternativeIntroEnabledScriptValue = alternativeIntroEnabled ? "true" : "false";
const themeClasses = ["theme-reavers", "theme-dhg", "theme-dreadmasters", "theme-inquisitors", "theme-highranks", "theme-dark-council"];

function initialThemeScriptValue(theme) {
  return JSON.stringify(themeClasses.includes(theme) ? theme : "");
}

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
  includeSearchOverlay = false,
  theme = ""
}) {
  return (
    <>
      <div id="vignette" aria-hidden="true" />
      <div id="rune-field" aria-hidden="true" />
      <div id="holo-grid" aria-hidden="true" />

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var alternativeIntroEnabled=${alternativeIntroEnabledScriptValue};var initialTheme=${initialThemeScriptValue(theme)};var themeClasses=${JSON.stringify(themeClasses)};try{if(initialTheme&&document.body){themeClasses.forEach(function(className){document.body.classList.remove(className);});document.body.classList.add(initialTheme);}window.HOLONET_ALTERNATIVE_INTRO_ENABLED=alternativeIntroEnabled;if(!alternativeIntroEnabled){localStorage.setItem("holonet:intro:v1:complete","true");}var q=new URLSearchParams(window.location.search);var intro=alternativeIntroEnabled&&(q.get("intro")==="1"||localStorage.getItem("holonet:intro:v1:complete")!=="true");document.documentElement.style.setProperty("--loader-progress","0%");document.documentElement.classList.add(intro?"holonet-release-intro":"holonet-standard-loader");}catch(e){document.documentElement.classList.add(alternativeIntroEnabled?"holonet-release-intro":"holonet-standard-loader");}})();`
        }}
      />

      <div id="loader" role="status" aria-label="Establishing connection">
        <div className="loader-intro-prompt" data-loader-intro-prompt>
          <section className="loader-terminal-panel loader-terminal-panel--prompt loader-holonet-gate" aria-labelledby="loader-intro-command">
            <div className="loader-terminal-topbar">
              <span>KOR-7</span>
              <span>THE HOLONET</span>
            </div>
            <div className="loader-terminal-body loader-gate-body">
              <div className="loader-gate-copy">
                <p className="loader-gate-kicker">MANAR&apos;S THE SITH ORDER</p>
                <h2 id="loader-intro-command" className="loader-gate-title">THE NEW HOLONET</h2>
              </div>
              <button className="loader-terminal-button loader-terminal-button--gate" type="button" data-loader-establish>
                <span>Establish Link</span>
              </button>
              <div className="loader-gate-meta" aria-hidden="true">
                <span>MADE BY: VYBERON</span>
                <span>WITH HELP FROM: THE OLD GUARD</span>
              </div>
            </div>
          </section>
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

        <div className="loader-intro-loading" data-loader-intro-loading>
          <section className="loader-terminal-panel loader-terminal-panel--transit">
            <div className="loader-terminal-topbar">
              <span>KOR-7</span>
              <span>THE HOLONET</span>
            </div>
            <div className="loader-terminal-body">
              <p className="loader-terminal-line">Relay aligning</p>
              <p className="loader-terminal-line">Request received</p>
              <p className="loader-terminal-line">Transmission initializing</p>
              <div className="loader-terminal-progress" aria-hidden="true">
                <span />
              </div>
            </div>
          </section>
        </div>

        <div className="loader-intro-ready" data-loader-intro-ready>
          <section className="loader-terminal-panel loader-terminal-panel--ready">
            <div className="loader-terminal-topbar">
              <span>KOR-7</span>
              <span>THE HOLONET</span>
            </div>
            <div className="loader-terminal-body">
              <p className="loader-terminal-line">Relay aligned</p>
              <p className="loader-terminal-status">Transmitting</p>
            </div>
          </section>
        </div>

        <div className="loader-intro-video" data-loader-intro-video aria-hidden="true">
          {alternativeIntroEnabled ? <OldGuardPlayer mode="intro" /> : null}
          <button className="loader-intro-skip" type="button" data-loader-skip-intro>
            Skip Transmission
          </button>
        </div>

        <div className="loader-crt-reveal" aria-hidden="true">
          <span />
        </div>
      </div>

      <div id="app" className={includeSearchOverlay ? 'document-viewer-page' : ''}>
        <div id="nav-container">
          <HolonetNav />
        </div>

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
