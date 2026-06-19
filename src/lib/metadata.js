const SITE_NAME = "Sith Holonet";
const DEFAULT_TITLE = "Sith Holonet";
const DEFAULT_DESCRIPTION = "Laws, lore, ranks, records and division resources for Manar's The Sith Order.";
const FAVICON_ICON = "/assets/favicon.ico";
const EMBED_IMAGE = "/assets/logo.png";
const EMBED_IMAGE_VERSION = "2";

export function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  const absoluteUrl = url.startsWith("http") ? url : `https://${url}`;
  return absoluteUrl.replace(/\/+$/, "");
}

function versionedAssetUrl(path, version) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${version}`;
}

function absoluteAssetUrl(path) {
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalisedPath}`;
}

export function holonetMetadata({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  const embedImage = absoluteAssetUrl(versionedAssetUrl(EMBED_IMAGE, EMBED_IMAGE_VERSION));

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    icons: {
      icon: FAVICON_ICON,
      shortcut: FAVICON_ICON,
      apple: EMBED_IMAGE
    },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: embedImage,
          width: 150,
          height: 150,
          type: "image/png",
          alt: SITE_NAME
        }
      ]
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [embedImage]
    }
  };
}

export const defaultMetadata = holonetMetadata();