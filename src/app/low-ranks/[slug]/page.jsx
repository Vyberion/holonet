import { notFound } from "next/navigation";
import { getHierarchyGroup, getHierarchyItem } from "../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";

export function generateStaticParams() {
  return (getHierarchyGroup("low-ranks")?.items || []).map(item => ({ slug: item.slug }));
}

export default async function LowRankPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("low-ranks", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
