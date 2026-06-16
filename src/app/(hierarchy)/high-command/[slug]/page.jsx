import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

export function generateStaticParams() {
  return (getVisibleHierarchyGroup("high-command")?.items || [])
    .filter(item => item.routable !== false)
    .map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("high-command", slug);
  if (!item || item.routable === false) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.name} high command record.`
  });
}

export default async function HighCommandPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("high-command", slug);
  if (!item || item.routable === false) notFound();

  return <HierarchyDetail item={item} />;
}
