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
import "../../css/crt.css";
import "../../css/loader-overlays.css";

const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const MOBILE_NAV_FULL_BLEED_CSS = `
@media (max-width: 700px) {
  .site-nav {
    left: 0 !important;
    right: 0 !important;
    width: 100vw !important;
    max-width: none !important;
  }

  .site-nav .nav-inner {
    left: 0 !important;
    right: auto !important;
    width: 100vw !important;
    max-width: none !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .site-nav .nav-toggle {
    left: max(8px, env(safe-area-inset-left)) !important;
  }

  .site-nav .nav-left {
    left: calc(max(8px, env(safe-area-inset-left)) + 42px) !important;
  }

  .site-nav .nav-right {
    right: max(8px, env(safe-area-inset-right)) !important;
  }

  .site-nav .nav-center,
  .site-nav .nav-links,
  .site-nav .nav-item,
  .site-nav .nav-item--dropdown,
  .site-nav .nav-split {
    width: 100vw !important;
    max-width: none !important;
  }

  .site-nav .nav-links {
    left: 0 !important;
    right: auto !important;
  }

  .site-nav .nav-dropdown-menu {
    width: 100vw !important;
    max-width: none !important;
  }
}
`;

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
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="modulepreload" href={PDFJS_MODULE_URL} crossOrigin="anonymous" />
        <link rel="modulepreload" href={PDFJS_WORKER_URL} crossOrigin="anonymous" />
        {criticalPreloadImages.map(src => (
          <link href={src} key={src} rel="preload" as="image" />
        ))}
        <style dangerouslySetInnerHTML={{ __html: MOBILE_NAV_FULL_BLEED_CSS }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
