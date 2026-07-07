import { notFound } from "next/navigation";
import { HolonetFrame } from "../../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../../components/PageScripts.jsx";
import { ThemeClass } from "../../../../../components/ThemeClass.jsx";
import { getHierarchyItem } from "../../../../../../modules/data/hierarchy.js";
import { getDivisionByRouteSlug } from "../../../../../lib/divisions.js";
import { holonetMetadata } from "../../../../../lib/metadata.js";
import { HierarchyDetail } from "../../../hierarchy/HierarchyDetail.jsx";

function normalizeSection(section) {
  return String(section || "").toLowerCase();
}

function sectionTitle(section) {
  return {
    home: "Command Hub",
    handbooks: "Handbook Archive",
    transmissions: "Transmissions",
    reports: "Reports",
    activity: "Activity",
    "council-floor": "Council Floor"
  }[section] || "Division";
}

function sectionSubtitle(section) {
  return {
    home: "COMMAND DASHBOARD",
    handbooks: "SECURE DOCUMENT VIEWER",
    transmissions: "MESSAGE CHANNEL",
    reports: "REPORTING CHANNEL",
    activity: "ACTIVITY CHANNEL",
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

function divisionSingularName(division) {
  return {
    reavers: "Reaver",
    dhg: "Dark Honor Guard",
    inquisitors: "Inquisitor",
    dreadmasters: "Dread Master",
    highranks: "High Rank",
    darkCouncil: "Dark Council"
  }[division.id] || division.shortName;
}

export async function generateMetadata({ params }) {
  const routeParams = await params;
  const division = getDivisionByRouteSlug(routeParams.division);
  const section = normalizeSection(routeParams.section);

  if (!division) return {};
  if (!["home", "info", "handbooks", "transmissions", "reports", "activity", "council-floor"].includes(section)) return {};
  if (section === "council-floor" && division.id !== "darkCouncil") return {};

  const singularName = divisionSingularName(division);

  if (section === "info") {
    const hierarchySlug = {
      reavers: "reavers",
      dhg: "dark-honor-guards",
      dreadmasters: "dread-masters",
      inquisitors: "inquisitors"
    }[division.id];
    const item = hierarchySlug ? getHierarchyItem("divisions", hierarchySlug) : null;

    return holonetMetadata({
      title: item?.name || singularName,
      description: `${singularName} requirements and divisional information.`
    });
  }

  if (section === "council-floor") {
    return holonetMetadata({
      title: "Council Floor",
      description: "Dark Council legislative floor."
    });
  }

  const descriptions = {
    home: `${singularName} dashboard.`,
    handbooks: `${singularName} handbook and guide archive.`,
    transmissions: `${singularName} transmission console.`,
    reports: `${singularName} reporting console.`,
    activity: `${singularName} activity console.`
  };

  const titles = {
    home: singularName,
    handbooks: `${singularName} Handbooks`,
    transmissions: `${singularName} Transmissions`,
    reports: `${singularName} Reports`,
    activity: `${singularName} Activity`
  };

  return holonetMetadata({
    title: titles[section] || singularName,
    description: descriptions[section] || `${singularName} dashboard.`
  });
}

export default async function DivisionSectionPage({ params }) {
  const routeParams = await params;
  const division = getDivisionByRouteSlug(routeParams.division);
  const section = normalizeSection(routeParams.section);

  if (!division) notFound();
  if (!["home", "info", "handbooks", "transmissions", "reports", "activity", "council-floor"].includes(section)) notFound();
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

    return <HierarchyDetail item={{ ...item, theme: division.theme }} />;
  }

  if (section === "home") {
    return (
      <HolonetFrame
        title={division.shortName.toUpperCase()}
        subtitle={division.subtitle.toUpperCase()}
        footerNode={division.node}
        mainClassName="division-main"
        showHeader={false}
        showStatusBar={false}
        theme={division.theme}
      >
        <ThemeClass theme={division.theme} />
        <div
          className="hub-shell"
          data-division-hub={division.id}
          data-division-title={division.name}
          data-division-subtitle={division.subtitle}
          data-division-node={division.node}
        />

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
        mainClassName="division-main"
        showHeader={false}
        showStatusBar={false}
        theme={division.theme}
      >
        <ThemeClass theme={division.theme} />
        <div className="hub-shell">
          <div className="hub-hero">
            <div className="hub-identity">
              <div>
                <span className="hub-kicker">Registry Node / {division.node}</span>
                <h2 className="hub-title">{divisionTitleName(division)} Handbooks</h2>
              </div>
              <div>
                <span className="hub-kicker">Division</span>
                <span className="hub-value">{division.shortName || division.name}</span>
              </div>
            </div>
            <p className="hub-summary">{divisionSingularName(division)} handbook and guide archive.</p>
          </div>
        </div>
        <div className="codex-document document-shell" style={{ marginTop: 0 }}>
          <article className="codex-article handbook-viewer-panel">
            <div className="article-content pdf-terminal">
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
                  <span className="pdf-zoom-readout" data-pdf-zoom-label>100%</span>
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
        mainClassName="division-main"
        showHeader={false}
        showStatusBar={false}
        theme={division.theme}
      >
        <ThemeClass theme={division.theme} />
        <div data-council-floor />

        <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/council-floor.js"]} />
      </HolonetFrame>
    );
  }

  return (
    <HolonetFrame
      title={`${divisionTitleName(division).toUpperCase()} ${sectionTitle(section).toUpperCase()}`}
      subtitle={sectionSubtitle(section)}
      footerNode={division.node}
      mainClassName="division-main"
      showHeader={false}
      showStatusBar={false}
      theme={division.theme}
    >
      <ThemeClass theme={division.theme} />
      <div
        className="hub-shell"
        data-division-section={section}
        data-division={division.id}
        data-division-title={division.name}
        data-section-title={`${divisionTitleName(division)} ${sectionTitle(section)}`}
        data-division-node={division.node}
      />

      <PageScripts guarded scripts={["/js/main.js", "/modules/client/site.js"]} moduleScripts={["/modules/client/division-section.js"]} />
    </HolonetFrame>
  );
}
