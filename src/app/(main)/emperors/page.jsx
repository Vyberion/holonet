import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { EMPEROR_ARCHIVE_GROUP, emperorArchiveItems } from "../../../../../modules/data/hierarchy.js";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { HierarchySection } from "../../../(hierarchy)/hierarchy/HierarchyList.jsx";

export const metadata = holonetMetadata({
  title: "Emperor Archive",
  description: "Archive of Sith Emperors."
});

export default function EmperorArchivePage() {
  const group = { ...EMPEROR_ARCHIVE_GROUP, maxPathRowCards: 3 };
  const items = emperorArchiveItems();

  return (
    <HolonetFrame title="EMPERORS" subtitle="SITH EMPEROR ARCHIVE" footerNode="ARC-02">
      <div className="hierarchy-main">
        <HierarchySection group={group} items={items} />
      </div>
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
