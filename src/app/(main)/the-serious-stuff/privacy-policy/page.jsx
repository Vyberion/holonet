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
        <h2>What We Collect</h2>
        <p>
          When you log in with Roblox, the Holonet stores your Roblox user ID, Roblox username,
          Roblox display name and a server-side session record. This is used to keep this browser
          logged in and to check access to restricted resources.
        </p>
        <h2>How Access Is Checked</h2>
        <p>
          Restricted pages check your current Roblox group memberships and ranks. The site does not
          use email verification, passwords or email-based account recovery.
        </p>
        <h2>Cookies And Sessions</h2>
        <p>
          The Holonet uses a secure session cookie to identify your current browser session. Logging
          out deletes that session and clears the cookie for this browser. Sessions also expire
          automatically.
        </p>
        <h2>Content You Submit</h2>
        <p>
          If you have write access, the site may store Codex edits, Archive articles, transmissions,
          reports, handbook records, tracker links and related timestamps. Some submissions may show
          your Roblox username as the author.
        </p>
        <h2>Personnel Lookup</h2>
        <p>
          Staff users may look up a Roblox username to view public Roblox account information used
          for moderation and role checks, such as profile link, account age, friend count, badge
          count and relevant group ranks.
        </p>
        <h2>Analytics</h2>
        <p>
          The site may use Vercel Analytics to understand basic usage and performance. Analytics are
          used for maintenance and improvement, not for selling personal data.
        </p>
        <h2>Data Sharing</h2>
        <p>
          The site is hosted on Vercel and stores site data in Supabase. Roblox is used for identity
          and group-rank checks. Data is not sold.
        </p>
        <h2>Retention</h2>
        <p>
          User records are kept so repeat logins do not create duplicate accounts. Sessions expire
          automatically and may also be removed when you log out. Replaced handbook files may be kept
          briefly before deletion for review and recovery.
        </p>
        <p className="legal-note">Last updated: 6 June 2026.</p>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
