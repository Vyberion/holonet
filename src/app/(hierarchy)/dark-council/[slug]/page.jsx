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



export default async function DarkCouncilPage({ params }) {
  const { slug } = await params;

  if (isDivisionSection(slug)) {
    return DivisionSectionPage({ params: divisionParams(slug) });
  }

  const item = getHierarchyItem("dark-council", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} />;
}
