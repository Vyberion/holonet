const SITE_NAME = "Sith Holonet";
const DEFAULT_TITLE = "Sith Holonet";
const DEFAULT_DESCRIPTION = "Laws, lore, ranks, records and division resources for Manar's The Sith Order.";
export const FAVICON_ICON = "/assets/favicon.ico";
export const EMBED_IMAGE = "/assets/logo.png";
const EMBED_IMAGE_VERSION = "3";
export const EMBED_IMAGE_WIDTH = 150;
export const EMBED_IMAGE_HEIGHT = 150;

export function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.VERCEL_URL ||
    "https://holonet.vercel.app";

  const absoluteUrl = url.startsWith("http") ? url : `https://${url}`;
  return absoluteUrl.replace(/\/+$/, "");
}

export function versionedAssetUrl(path, version = EMBED_IMAGE_VERSION) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${version}`;
}

export function absoluteAssetUrl(path) {
  const normalisedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalisedPath}`;
}

export function embedImageUrl() {
  return absoluteAssetUrl(versionedAssetUrl(EMBED_IMAGE));
}

export function holonetMetadata({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  const embedImage = embedImageUrl();

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
          secureUrl: embedImage,
          width: EMBED_IMAGE_WIDTH,
          height: EMBED_IMAGE_HEIGHT,
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
