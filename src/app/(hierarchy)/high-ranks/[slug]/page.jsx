import { notFound } from "next/navigation";
import { getHierarchyGroup, getHierarchyItem, getRankProgressionNav } from "../../../../../modules/data/hierarchy.js";
import { HierarchyDetail } from "../../hierarchy/HierarchyDetail.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";
import DivisionSectionPage, { generateMetadata as generateDivisionSectionMetadata } from "../../(divisions)/[division]/[section]/page.jsx";

const DIVISION_SECTIONS = new Set(["home", "handbooks", "transmissions"]);

function isDivisionSection(slug) {
  return DIVISION_SECTIONS.has(String(slug || "").toLowerCase());
}

function divisionParams(section) {
  return { division: "high-ranks", section };
}



export default async function HighRankPage({ params }) {
  const { slug } = await params;

  if (isDivisionSection(slug)) {
    return DivisionSectionPage({ params: divisionParams(slug) });
  }

  const item = getHierarchyItem("high-ranks", slug);
  if (!item) notFound();

  return <HierarchyDetail item={item} rankNav={getRankProgressionNav("high-ranks", slug)} />;
}
