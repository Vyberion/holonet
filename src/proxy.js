import { NextResponse } from "next/server";
import {
  divisionIdFromRouteSlug,
  divisionIdFromSubdomain,
  divisionLockedPath,
  divisionPublicInfoPath,
  divisionSubdomainForId,
  isPublicInfoDivision
} from "../modules/data/divisions/index.js";

const LOCKED_SECTIONS = new Set([
  "home",
  "handbooks",
  "transmissions",
  "reports",
  "activity",
  "trackers",
  "council-floor"
]);
const APEX_HOSTNAME = "thesithorder.org";
const CANONICAL_HOSTNAME = "www.thesithorder.org";

function requestHostname(request) {
  return String(request.headers.get("host") || request.nextUrl.hostname || "")
    .split(":")[0]
    .toLowerCase();
}

function rootHostname(hostname) {
  const labels = String(hostname || "").split(".").filter(Boolean);
  if (labels.length > 2 && divisionIdFromSubdomain(labels[0])) return labels.slice(1).join(".");
  if (labels.length > 2 && labels[0] === "www") return labels.slice(1).join(".");
  return labels.join(".");
}

function firstPathSegment(pathname) {
  return String(pathname || "/").split("/").filter(Boolean)[0] || "";
}

function subdomainRedirectUrl(request, divisionId, section = "home") {
  const url = request.nextUrl.clone();
  const subdomain = divisionSubdomainForId(divisionId);
  if (!subdomain) return url;

  url.hostname = `${subdomain}.${rootHostname(requestHostname(request))}`;
  url.pathname = divisionLockedPath(section);
  return url;
}

function publicInfoRedirectUrl(request, divisionId) {
  const url = request.nextUrl.clone();
  url.pathname = divisionPublicInfoPath(divisionId) || url.pathname;
  return url;
}

function stripSameDivisionPrefix(pathname, divisionId) {
  const segments = String(pathname || "/").split("/").filter(Boolean);
  if (divisionIdFromRouteSlug(segments[0]) !== divisionId) return pathname || "/";

  const stripped = `/${segments.slice(1).join("/")}`;
  return stripped === "/" ? "/" : stripped.replace(/\/+$/, "");
}

function internalPathForSubdomain(pathname, divisionId) {
  const stripped = stripSameDivisionPrefix(pathname, divisionId);
  const internal = !stripped || stripped === "/" ? "/home" : stripped;
  return internal.replace(/^\/trackers(?=\/|$)/, "/activity");
}

function shouldBypass(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/modules/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|ico|txt|json|pdf|woff2?|ttf|otf)$/i.test(pathname)
  );
}

function wwwRedirectUrl(request) {
  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOSTNAME;
  return url;
}

export function proxy(request) {
  const hostname = requestHostname(request);
  if (hostname === APEX_HOSTNAME) {
    return NextResponse.redirect(wwwRedirectUrl(request), 308);
  }

  const pathname = request.nextUrl.pathname;
  if (shouldBypass(pathname)) return NextResponse.next();

  const hostLabel = hostname.split(".")[0] || "";
  const subdomainDivisionId = divisionIdFromSubdomain(hostLabel);

  if (subdomainDivisionId) {
    const url = request.nextUrl.clone();
    url.pathname = `/${divisionSubdomainForId(subdomainDivisionId)}${internalPathForSubdomain(pathname, subdomainDivisionId)}`;
    return NextResponse.rewrite(url);
  }

  const routeSlug = firstPathSegment(pathname);
  const routeDivisionId = divisionIdFromRouteSlug(routeSlug);
  if (!routeDivisionId) return NextResponse.next();

  const segments = pathname.split("/").filter(Boolean);
  const section = String(segments[1] || "").toLowerCase();

  if (isPublicInfoDivision(routeDivisionId) && (!section || section === "info")) {
    const canonicalPath = divisionPublicInfoPath(routeDivisionId);
    if (canonicalPath && pathname.replace(/\/+$/, "") !== canonicalPath) {
      return NextResponse.redirect(publicInfoRedirectUrl(request, routeDivisionId));
    }

    return NextResponse.next();
  }

  if (!section || LOCKED_SECTIONS.has(section)) {
    return NextResponse.redirect(subdomainRedirectUrl(request, routeDivisionId, section || "home"));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
