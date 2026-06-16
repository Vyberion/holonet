import { notFound, redirect } from "next/navigation";
import { getDivisionByRouteSlug } from "../../../../lib/divisions.js";

export default async function DivisionRedirectPage({ params }) {
  const routeParams = await params;
  const divisionSlug = String(routeParams.division || "");
  const division = getDivisionByRouteSlug(divisionSlug);

  if (!division) notFound();

  redirect(`/${divisionSlug}/home`);
}
