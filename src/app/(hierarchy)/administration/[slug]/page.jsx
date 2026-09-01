import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";



export default async function AdministrationPage({ params }) {
  const { slug } = await params;
  const item = getHierarchyItem("administration", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
