import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { ThemeClass } from "../../../components/ThemeClass.jsx";
import { getHierarchyItem } from "../../../../modules/data/hierarchy.js";
import { getDivisionByRouteSlug } from "../../../lib/divisions.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";

function sectionTitle(section) {
  return {
    home: "Command Hub",
    handbooks: "Handbook Archive",
    transmissions: "Transmissions",
    reports: "Reports",
    trackers: "Tracking",
    "council-floor": "Council Floor"
  }[section] || "Division";
}

function sectionSubtitle(section) {
  return {
    home: "COMMAND DASHBOARD",
    handbooks: "SECURE DOCUMENT VIEWER",
    transmissions: "MESSAGE CHANNEL",
    reports: "REPORTING CHANNEL",
    trackers: "TRACKING CHANNEL",
    "council-floor": "LEGISLATIVE CHANNEL"
  }[section] || "DIVISION NODE";
}

function divisionTitleName(division) {
  return {
    reavers: "Reaver",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitor",
    dreadmasters: "Dread Master",
    highranks: "High Rank",
    darkCouncil: "Dark Council"
  }[division.id] || division.shortName;
}

export default async function DivisionSectionPage({ params }) {
  const routeParams = await params;
  const division = getDivisionByRouteSlug(routeParams.division);
  const section = String(routeParams.section || "").toLowerCase();

  if (!division) notFound();
  if (!["home", "info", "handbooks", "transmissions", "reports", "trackers", "council-floor"].includes(section)) notFound();
  if (section === "council-floor" && division.id !== "darkCouncil") notFound();

  if (section === "info") {
    const hierarchySlug = {
      reavers: "reavers",
      dhg: "dark-honor-guards",
      dreadmasters: "dread-masters",
      inquisitors: "inquisitors"
    }[division.id];

    if (!hierarchySlug) notFound();

    const item = getHierarchyItem("divisions", hierarchySlug);
    if (!item) notFound();

    return <HierarchyDetail item={item} />;
  }

  if (section === "home") {
    return (
      <HolonetFrame
        title={division.shortName.toUpperCase()}
        subtitle={division.subtitle.toUpperCase()}
        footerNode={division.node}
      >
        <ThemeClass theme={division.theme} />
        <div
          className="hub-shell"
          data-division-hub={division.id}
          data-division-title={division.name}
          data-division-subtitle={division.subtitle}
          data-division-node={division.node}
        >
          <p className="hub-empty">Loading command hub...</p>
        </div>

        <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/division-hub.js"]} />
      </HolonetFrame>
    );
  }

  if (section === "handbooks") {
    return (
      <HolonetFrame
        title={`${division.shortName.toUpperCase()} HANDBOOKS`}
        subtitle="SECURE DOCUMENT VIEWER"
        footerNode={division.node}
        includeSearchOverlay
      >
        <ThemeClass theme={division.theme} />
        <div className="codex-document document-shell">
          <article className="codex-article">
            <div className="article-header">
              <span className="article-number">{division.node} / Secure Document Viewer</span>
              <h2 className="article-title">Handbook Archive</h2>
            </div>

            <div className="article-content pdf-terminal">
              <div className="regulation">
                <h3 className="reg-title">Access Notice</h3>
                <p className="reg-text">
                  {division.shortName} divisional documents are restricted to authorized {division.shortName} personnel.
                  Unauthorized access or distribution of these materials is strictly prohibited.
                </p>
              </div>

              <div
                className="pdf-tab-strip"
                role="tablist"
                aria-label={`${division.shortName} handbook documents`}
                data-pdf-tab-strip
                data-pdf-division={division.id}
              >
                <span className="pdf-loading">Loading handbook registry...</span>
              </div>

              <div className="pdf-toolbar" aria-label="PDF viewer controls">
                <div className="pdf-zoom-controls" aria-label="Zoom controls">
                  <button type="button" className="pdf-tool-btn" data-pdf-zoom-out aria-label="Zoom out">-</button>
                  <span className="pdf-zoom-readout" data-pdf-zoom-label>FIT</span>
                  <button type="button" className="pdf-tool-btn" data-pdf-zoom-in aria-label="Zoom in">+</button>
                  <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-fit-height>FIT</button>
                  <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-fit-width>FILL</button>
                </div>
                <button type="button" className="pdf-tool-btn pdf-tool-text" data-pdf-open-search>SEARCH</button>
              </div>

              <div className="pdf-box">
                <div className="pdf-pages" data-pdf-pages aria-label="Rendered handbook pages" />
              </div>
            </div>
          </article>
        </div>

        <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/pdf-tabs.js"]} />
      </HolonetFrame>
    );
  }

  if (section === "council-floor") {
    return (
      <HolonetFrame
        title="COUNCIL FLOOR"
        subtitle="LEGISLATIVE CHANNEL"
        footerNode={division.node}
      >
        <ThemeClass theme={division.theme} />
        <div data-council-floor>
          <p className="hub-empty">Loading council floor...</p>
        </div>

        <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/council-floor.js"]} />
      </HolonetFrame>
    );
  }

  return (
    <HolonetFrame
      title={`${divisionTitleName(division).toUpperCase()} ${sectionTitle(section).toUpperCase()}`}
      subtitle={sectionSubtitle(section)}
      footerNode={division.node}
    >
      <ThemeClass theme={division.theme} />
      <div
        className="hub-shell"
        data-division-section={section}
        data-division={division.id}
        data-division-title={division.name}
        data-section-title={sectionTitle(section)}
        data-division-node={division.node}
      >
        <p className="hub-empty">Loading section...</p>
      </div>

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/division-section.js"]} />
    </HolonetFrame>
  );
}
