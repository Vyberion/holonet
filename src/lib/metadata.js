const SITE_NAME = "Sith Holonet";
const DEFAULT_TITLE = "Sith Holonet";
const DEFAULT_DESCRIPTION = "Laws, lore, ranks, records and division resources for Manar's The Sith Order.";
const FAVICON_IMAGE = "/assets/favicon.ico";

export function holonetMetadata({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION } = {}) {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: FAVICON_IMAGE
        }
      ]
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [FAVICON_IMAGE]
    }
  };
}

export const defaultMetadata = holonetMetadata();
