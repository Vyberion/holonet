"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function activeSection(searchParams, groupIds) {
  const section = searchParams.get("section");
  return section && groupIds.has(section) ? section : "all";
}

export function HierarchyTabs({ groups, items }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groupIds = useMemo(() => new Set(groups.map(group => group.id)), [groups]);
  const active = activeSection(searchParams, groupIds);
  const visibleGroups = active === "all" ? groups : groups.filter(group => group.id === active);
  const tabs = TABS.filter(tab => tab.id === "all" || groupIds.has(tab.id));

  function selectTab(tabId) {
    const params = new URLSearchParams(searchParams.toString());

    if (tabId === "all") {
      params.delete("section");
    } else {
      params.set("section", tabId);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
