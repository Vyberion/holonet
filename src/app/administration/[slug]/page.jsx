import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";

export function generateStaticParams() {
  return (getVisibleHierarchyGroup("administration")?.items || []).map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("administration", slug);
  if (!item) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.name} administration record.`
  });
}

export default async function AdministrationPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("administration", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
