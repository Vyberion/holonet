import { notFound } from "next/navigation";
import { getHierarchyItem, getVisibleHierarchyGroup } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";
import DivisionSectionPage, { generateMetadata as generateDivisionSectionMetadata } from "../../(divisions)/[division]/[section]/page.jsx";

const DIVISION_SECTIONS = new Set(["home", "info", "transmissions", "reports", "activity", "council-floor"]);

function isDivisionSection(slug) {
  return DIVISION_SECTIONS.has(String(slug || "").toLowerCase());
}

function divisionParams(section) {
  return { division: "dark-council", section };
}

export function generateStaticParams() {
  return (getVisibleHierarchyGroup("dark-council")?.items || []).map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  if (isDivisionSection(slug)) {
    return generateDivisionSectionMetadata({ params: divisionParams(slug) });
  }

  const item = getHierarchyItem("dark-council", slug);
  if (!item) return {};

  return holonetMetadata({
    title: item.name,
    description: `${item.name} information.`
  });
}

export default async function DarkCouncilPage({ params }) {
  const { slug } = await params;

  if (isDivisionSection(slug)) {
    return DivisionSectionPage({ params: divisionParams(slug) });
  }

  const item = getHierarchyItem("dark-council", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
