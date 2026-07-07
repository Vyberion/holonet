import { notFound, redirect } from "next/navigation";
import {
  divisionLockedHref,
  divisionPublicInfoPath,
  getDivisionByRouteSlug,
  isPublicInfoDivision
} from "../../../../lib/divisions.js";
import DivisionSectionPage from "./[section]/page.jsx";

export default async function DivisionRedirectPage({ params }) {
  const divisionSlug = String(params.division || "");
  const division = getDivisionByRouteSlug(divisionSlug);
  if (!division) notFound();
  // Directly render the home section
  return DivisionSectionPage({ params: { division: divisionSlug, section: "home" } });
}
