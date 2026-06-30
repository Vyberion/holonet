import { notFound, redirect } from "next/navigation";
import {
  divisionLockedHref,
  divisionPublicInfoPath,
  getDivisionByRouteSlug,
  isPublicInfoDivision
} from "../../../../lib/divisions.js";
import DivisionSectionPage from "./[section]/page.jsx";

export default async function DivisionRedirectPage({ params }) {
  const routeParams = await params;
  const divisionSlug = String(routeParams.division || "");
  const division = getDivisionByRouteSlug(divisionSlug);

  if (!division) notFound();

  if (isPublicInfoDivision(division.id)) {
    const canonicalInfoPath = divisionPublicInfoPath(division.id);
    if (canonicalInfoPath && `/${divisionSlug.toLowerCase()}` !== canonicalInfoPath) {
      redirect(canonicalInfoPath);
    }

    return DivisionSectionPage({ params: { division: divisionSlug, section: "info" } });
  }

  redirect(divisionLockedHref(division.id));
}
