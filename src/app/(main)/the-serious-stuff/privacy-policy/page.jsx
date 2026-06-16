import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "Privacy Policy",
  description: "How the Holonet stores your data."
});

export default function PrivacyPage() {
  return (
    <HolonetFrame title="PRIVACY POLICY" subtitle="DATA HANDLING">
      <section className="legal-panel">
        <h2>Privacy Policy</h2>
        <p>The Holonet uses Roblox login sessions, access checks, submitted site content and basic analytics for site operation.</p>
        <p>Stored records are used for clearance, moderation, maintenance and recovery. Data is not sold.</p>
        <p className="legal-note">Last updated: 6 June 2026.</p>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
