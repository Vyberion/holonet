import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { hierarchyItems, visibleHierarchyGroups } from "../../../../modules/data/hierarchy.js";
import { holonetMetadata } from "../../../lib/metadata.js";
import { HierarchyTabs } from "./HierarchyTabs.jsx";

export const metadata = holonetMetadata({
  title: "Hierarchy",
  description: "Rank paths, progression and divisional information."
});

export default function HierarchyPage() {
  const groups = visibleHierarchyGroups();
  const items = hierarchyItems();

  return (
    <HolonetFrame title="RANKS" subtitle="SITH HIERARCHY" footerNode="HRK-03">
      <HierarchyTabs groups={groups} items={items} />
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
