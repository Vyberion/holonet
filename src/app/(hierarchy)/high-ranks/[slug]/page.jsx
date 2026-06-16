import { notFound } from "next/navigation";
import { getHierarchyGroup, getHierarchyItem } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

export function generateStaticParams() {
  return (getHierarchyGroup("high-ranks")?.items || []).map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("high-ranks", slug);
  if (!item) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.name} progression requirements and information.`
  });
}

export default async function HighRankPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("high-ranks", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
