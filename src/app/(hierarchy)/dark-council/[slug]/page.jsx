import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

export function generateStaticParams() {
  return (getVisibleHierarchyGroup("dark-council")?.items || []).map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("dark-council", slug);
  if (!item) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.name} information.`
  });
}

export default async function DarkCouncilPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("dark-council", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
