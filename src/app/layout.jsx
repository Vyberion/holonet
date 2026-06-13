import { Analytics } from "@vercel/analytics/next";
import { defaultMetadata } from "../lib/metadata.js";

import "../../css/style.css";
import "../../css/themes.css";
import "../../css/nav.css";
import "../../css/codex.css";
import "../../css/editor.css";
import "../../css/search.css";
import "../../css/document.css";
import "../../css/registry.css";
import "../../css/hub.css";
import "../../css/nexus-classified.css";
import "../../css/legal.css";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sith-holonet.vercel.app"),
  ...defaultMetadata
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
