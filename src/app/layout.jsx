import { Analytics } from "@vercel/analytics/next";
import { defaultMetadata } from "../lib/metadata.js";
import { criticalPreloadImages } from "../lib/preload-images.js";

import "../../css/style.css";
import "../../css/themes.css";
import "../../css/nav.css";
import "../../css/codex.css";
import "../../css/search.css";
import "../../css/document.css";
import "../../css/registry.css";
import "../../css/hub.css";
import "../../css/legal.css";
import "../../css/editor.css";
import "../../css/preview-crt-fix.css";

function siteUrl() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";

  return url.startsWith("http") ? url : `https://${url}`;
}

export const metadata = {
  metadataBase: new URL(siteUrl()),
  ...defaultMetadata
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {criticalPreloadImages.map(src => (
          <link href={src} key={src} rel="preload" as="image" />
        ))}
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
