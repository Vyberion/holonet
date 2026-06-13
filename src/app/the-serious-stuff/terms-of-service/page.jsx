import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";

export default function TermsPage() {
  return (
    <HolonetFrame title="TERMS OF SERVICE" subtitle="ACCESS CONDITIONS">
      <section className="legal-panel">
        <h2>Use Of The Holonet</h2>
        <p>
          The Sith Holonet is a project site for Manar&apos;s Sith Order. It provides laws, archive
          articles, Registry resources and division information for community and roleplay use.
          By using the site, you agree to use it only for that purpose.
        </p>
        <h2>Roblox Login</h2>
        <p>
          Some pages require Roblox login. Access is based on your Roblox account, current group
          memberships and current group ranks. If your ranks change, your access may change as well.
        </p>
        <h2>Restricted Resources</h2>
        <p>
          Restricted Registry pages, division hubs, handbooks, reports, trackers and transmissions
          are only for users with the required clearance. Do not try to bypass access checks,
          impersonate another user, share restricted material outside its intended audience or
          interfere with the site.
        </p>
        <h2>Writing And Uploads</h2>
        <p>
          Users with write access may create or edit Codex entries, Archive articles, transmissions,
          reports and approved handbook uploads. You are responsible for anything submitted through
          your logged-in session. Do not upload malicious files, spam, false records or content that
          breaks Roblox rules or community rules.
        </p>
        <h2>Account Sessions</h2>
        <p>
          Logging in creates a browser session. You can log out from the Account page, which clears
          the current session. You may need to log in again if your session expires or your browser
          clears cookies.
        </p>
        <h2>Personnel Lookup</h2>
        <p>
          Staff lookup tools are provided for moderation, administration and role verification. Do
          not use them to harass users, publish personal information or perform checks unrelated to
          the community.
        </p>
        <h2>Changes And Availability</h2>
        <p>
          Laws, lore, handbooks, guides and Registry information may change over time. The site may
          be updated, reorganized or temporarily unavailable while it is being developed.
        </p>
        <h2>Disclaimer</h2>
        <p>
          This is an unofficial fan/community project and is not affiliated with Roblox Corporation,
          Lucasfilm, Disney or any official Star Wars rights holder.
        </p>
        <p className="legal-note">Last updated: 6 June 2026.</p>
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
