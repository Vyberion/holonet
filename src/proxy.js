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

function firstHeaderValue(value) {
  return String(value || "").split(",")[0].trim();
}

function requestHostname(request) {
  return String(
    firstHeaderValue(request.headers.get("x-forwarded-host")) ||
    firstHeaderValue(request.headers.get("host")) ||
    request.nextUrl.hostname ||
    ""
  )
    .split(":")[0]
    .toLowerCase();
}

function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

function rootHostname(hostname) {
  const labels = String(hostname || "").split(".").filter(Boolean);
  if (labels.length > 2 && divisionIdFromSubdomain(labels[0])) return labels.slice(1).join(".");
  if (labels.length > 2 && labels[0] === "www") return labels.slice(1).join(".");
  return labels.join(".");
}

function setPublicRedirectHost(url, hostname) {
  const nextUrl = new URL(url.toString());
  nextUrl.hostname = hostname;

  if (!isLocalHostname(hostname)) {
    nextUrl.protocol = "https:";
    nextUrl.port = "";
  }

  return nextUrl;
}

function firstPathSegment(pathname) {
  return String(pathname || "/").split("/").filter(Boolean)[0] || "";
}

function subdomainRedirectUrl(request, divisionId, section = "home") {
  const url = new URL(request.url);
  const subdomain = divisionSubdomainForId(divisionId);
  if (!subdomain) return url;

  const nextUrl = setPublicRedirectHost(url, `${subdomain}.${rootHostname(requestHostname(request))}`);
  nextUrl.pathname = divisionLockedPath(section);
  return nextUrl;
}

function publicInfoRedirectUrl(request, divisionId) {
  const url = new URL(request.url);
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
  return setPublicRedirectHost(new URL(request.url), CANONICAL_HOSTNAME);
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
      return NextResponse.redirect(publicInfoRedirectUrl(request, routeDivisionId), 308);
    }

    return NextResponse.next();
  }

  if (!section || LOCKED_SECTIONS.has(section)) {
    return NextResponse.redirect(subdomainRedirectUrl(request, routeDivisionId, section || "home"), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
