import { notFound } from "next/navigation";
import { getHierarchyGroup, getHierarchyItem, getRankProgressionNav } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";



export default async function MiddleRankPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("middle-ranks", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} rankNav={getRankProgressionNav("middle-ranks", slug)} />;
}
