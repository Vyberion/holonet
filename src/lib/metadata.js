const SITE_NAME = "Sith Holonet";
const DEFAULT_TITLE = "Sith Holonet";
const DEFAULT_DESCRIPTION = "Laws, lore, ranks, records and division resources for Manar's The Sith Order.";
const FAVICON_ICON = "/assets/favicon.ico";
const EMBED_IMAGE = "/assets/logo.png";

export function holonetMetadata({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  return {
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
      images: [
        {
          url: EMBED_IMAGE,
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
      images: [EMBED_IMAGE]
    }
  };
}

export const defaultMetadata = holonetMetadata();
