import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";



export default async function HighCommandPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("high-command", slug);
  if (!item || item.routable === false) notFound();

  return <HierarchyDetail item={item} />;
}
