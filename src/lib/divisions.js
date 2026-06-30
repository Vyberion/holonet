import {
  divisionIdFromRouteSlug,
  divisionLockedHref,
  divisionPublicInfoPath,
  divisionPublicSlug,
  divisionSubdomainForId,
  getDivision,
  isPublicInfoDivision
} from "../../modules/data/divisions/index.js";

export function getDivisionByRouteSlug(slug) {
  const key = divisionIdFromRouteSlug(slug);
  if (!key) return null;
  return getDivision(key);
}

export {
  divisionIdFromRouteSlug,
  divisionLockedHref,
  divisionPublicInfoPath,
  divisionPublicSlug,
  divisionSubdomainForId,
  getDivision,
  isPublicInfoDivision
};
