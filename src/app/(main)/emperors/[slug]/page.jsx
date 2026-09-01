import { notFound } from "next/navigation";
import { EMPEROR_ARCHIVE_GROUP, emperorArchiveItems, getEmperorArchiveItem } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../../(hierarchy)/hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";



export default async function EmperorArchiveDetailPage({ params }) {
  const { slug } = await params;
  const item = getEmperorArchiveItem(slug);
  if (!item) notFound();

  return <HierarchyDetail item={{ ...item, groupTitle: EMPEROR_ARCHIVE_GROUP.title }} />;
}
