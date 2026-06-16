import { Suspense } from "react";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { hierarchyItems, visibleHierarchyGroups } from "../../../../modules/data/hierarchy.js";
import { holonetMetadata } from "../../../lib/metadata.js";
import { HierarchySection } from "./HierarchyList.jsx";
import { HierarchyTabs } from "./HierarchyTabs.jsx";

export const metadata = holonetMetadata({
  title: "Hierarchy",
  description: "Rank paths, progression and divisional information."
});

export default function HierarchyPage() {
  const groups = visibleHierarchyGroups();
  const items = hierarchyItems();
  const fallback = (
    <div className="hierarchy-main">
      {groups.map(group => (
        <HierarchySection
          group={group}
          items={items.filter(item => item.groupId === group.id)}
          key={group.id}
        />
      ))}
    </div>
  );

  return (
    <HolonetFrame title="RANKS" subtitle="SITH HIERARCHY" footerNode="HRK-03">
      <Suspense fallback={fallback}>
        <HierarchyTabs groups={groups} items={items} />
      </Suspense>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
