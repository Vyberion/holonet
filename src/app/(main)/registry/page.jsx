import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { getDivision } from "../../../lib/divisions.js";
import { holonetMetadata } from "../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Registry",
  description: "Divisional directory."
});

function statusLabel(status) {
  return status === "offline" ? "[ OFFLINE ]" : "[ RESTRICTED ]";
}

function nodeLabel(division) {
  return `NODE: ${division.status === "offline" ? "OFFLINE" : division.node}`;
}

function RegistryCard({ id }) {
  const division = getDivision(id);
  if (!division) return null;

  const isOffline = division.status === "offline";
  const status = isOffline ? "locked" : "restricted";
  return (
    <div
      className={`dir-card${isOffline ? " dir-card--locked" : ""}`}
      data-registry-division={id}
      data-status={status}
      aria-label={`${division.name} - ${isOffline ? "offline" : "restricted"}`}
    >
      <div className="dir-card-frame" aria-hidden="true" />
      <div className="card-vline" aria-hidden="true" />
      <div className="card-scan" aria-hidden="true" />
      <div className="dir-card-top">
        <h2 className="dir-card-title">{division.shortName || division.name}</h2>
        <span className="dir-card-badge">{statusLabel(division.status)}</span>
      </div>
      <p className="dir-card-desc">{division.description}</p>
      <div className="dir-card-bottom">
        <span className="dir-card-node">{nodeLabel(division)}</span>
        <a
          href="#"
          className="dir-card-enter action-btn"
          aria-hidden="true"
          tabIndex={-1}
        >
          {isOffline ? "NODE OFFLINE" : "VERIFYING ACCESS"}
        </a>
      </div>
    </div>
  );
}

function NexusCard() {
  return (
    <div
      className="dir-card dir-card--overview"
      data-status="restricted"
      aria-label="Overview - inspection matrix"
    >
      <div className="dir-card-frame" aria-hidden="true" />
      <div className="card-vline" aria-hidden="true" />
      <div className="card-scan" aria-hidden="true" />
      <div className="dir-card-top">
        <h2 className="dir-card-title">Overview</h2>
        <span className="dir-card-badge">[ INSPECTION ]</span>
      </div>
      <p className="dir-card-desc">Divisional inspection scores and weekly reports.</p>
      <div className="dir-card-bottom">
        <span className="dir-card-node">NODE: NXS-00</span>
        <a href="#" className="dir-card-enter action-btn" aria-hidden="true" tabIndex={-1}>VERIFYING ACCESS</a>
      </div>
    </div>
  );
}

export default function RegistryPage() {
  return (
    <HolonetFrame title="THE REGISTRY" subtitle="RESOURCE DIRECTORY" footerNode="KOR-7">
      <div className="registry-main">
        <section className="registry-section registry-section--overview" aria-labelledby="sec-overview">
          <div className="section-header">
            <span className="section-tag" id="sec-overview">// OVERVIEW</span>
            <div className="section-rule" />
          </div>

          <div className="dir-grid dir-grid--overview">
            <NexusCard />
          </div>
        </section>

        <section className="registry-section" aria-labelledby="sec-internal">
          <div className="section-header">
            <span className="section-tag" id="sec-internal">// DEPARTMENTS</span>
            <div className="section-rule" />
          </div>

          <div className="dir-grid dir-grid--internal">
            <RegistryCard id="darkCouncil" />
            <RegistryCard id="highranks" />
          </div>
        </section>

        <section className="registry-section" aria-labelledby="sec-divisions">
          <div className="section-header">
            <span className="section-tag" id="sec-divisions">// DIVISIONS</span>
            <div className="section-rule" />
          </div>

          <div className="dir-grid dir-grid--divisions">
            <RegistryCard id="reavers" />
            <RegistryCard id="dhg" />
            <RegistryCard id="inquisitors" />
            <RegistryCard id="dreadmasters" />
          </div>
        </section>
      </div>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/registry-directory.js"]} />
    </HolonetFrame>
  );
}
