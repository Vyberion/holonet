import {
  EMBED_IMAGE_HEIGHT,
  EMBED_IMAGE_WIDTH,
  defaultMetadata,
  embedImageUrl,
  siteUrl
} from "../lib/metadata.js";
import { HolonetAudioController } from "../components/HolonetAudioController.jsx";
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
import "../../css/overrides.css";
import { GlobalPolish } from "../components/GlobalPolish.jsx";

const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

export const metadata = {
  metadataBase: new URL(siteUrl()),
  ...defaultMetadata
};

export default function RootLayout({ children }) {
  const embedImage = embedImageUrl();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta property="og:image" content={embedImage} />
        <meta property="og:image:secure_url" content={embedImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content={String(EMBED_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(EMBED_IMAGE_HEIGHT)} />
        <meta name="twitter:image" content={embedImage} />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="modulepreload" href={PDFJS_MODULE_URL} crossOrigin="anonymous" />
        <link rel="modulepreload" href={PDFJS_WORKER_URL} crossOrigin="anonymous" />
        {criticalPreloadImages.map(src => (
          <link href={src} key={src} rel="preload" as="image" />
        ))}
      </head>
      <body>
        <HolonetAudioController />
        <GlobalPolish />
        {children}
      </body>
    </html>
  );
}
