import { Analytics } from "@vercel/analytics/next";

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
  title: "Sith Holonet",
  description: "Manar's Sith Order - Laws, lore and divisional records."
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
