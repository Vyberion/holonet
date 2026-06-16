"use client";

import { useEffect, useMemo, useState } from "react";
import { HierarchySection } from "./HierarchyList.jsx";

const TABS = [
  { id: "all", label: "All" },
  { id: "divisions", label: "Divisions" },
  { id: "low-ranks", label: "Low Ranks" },
  { id: "middle-ranks", label: "Mid Ranks" },
  { id: "high-ranks", label: "High Ranks" },
  { id: "dark-council", label: "Dark Council" },
  { id: "high-command", label: "High Command" },
  { id: "administration", label: "Administration" }
];

function activeSectionFromSearch(search, groupIds) {
  const params = new URLSearchParams(search);
  const section = params.get("section");
  return section && groupIds.has(section) ? section : "all";
}

export function HierarchyTabs({ groups, items }) {
  const groupIds = useMemo(() => new Set(groups.map(group => group.id)), [groups]);
  const [active, setActive] = useState("all");
  const visibleGroups = active === "all" ? groups : groups.filter(group => group.id === active);
  const tabs = TABS.filter(tab => tab.id === "all" || groupIds.has(tab.id));

  useEffect(() => {
    setActive(activeSectionFromSearch(window.location.search, groupIds));

    function handlePopState() {
      setActive(activeSectionFromSearch(window.location.search, groupIds));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [groupIds]);

  function selectTab(tabId) {
    const nextActive = groupIds.has(tabId) ? tabId : "all";
    const params = new URLSearchParams(window.location.search);

    if (nextActive === "all") {
      params.delete("section");
    } else {
      params.set("section", nextActive);
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.pushState({}, "", nextUrl);
    setActive(nextActive);
  }

  return (
    <>
      <div className="hierarchy-tabs-shell">
        <div className="hierarchy-tab-strip" role="tablist" aria-label="Hierarchy sections">
          {tabs.map(tab => (
            <button
              aria-selected={active === tab.id}
              className={`hierarchy-tab${active === tab.id ? " is-active" : ""}`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hierarchy-main">
        {visibleGroups.map(group => (
          <HierarchySection
            group={group}
            items={items.filter(item => item.groupId === group.id)}
            key={group.id}
          />
        ))}
      </div>
    </>
  );
}
