import { HolonetFrame } from "../../components/HolonetFrame.jsx";
import { OldGuardPlayer } from "../../components/OldGuardPlayer.jsx";
import { PageScripts } from "../../components/PageScripts.jsx";
import { holonetMetadata } from "../../lib/metadata.js";

export const metadata = holonetMetadata({
  title: "The Old Guard",
  description: "Archive playback for The Old Guard transmission."
});

export default function OldGuardPage() {
  return (
    <HolonetFrame
      title="THE OLD GUARD"
      subtitle="ARCHIVE PLAYBACK"
      footerNode="KOR-7"
    >
      <section className="old-guard-page-shell" aria-label="The Old Guard archive playback">
        <div className="old-guard-page-topbar">
          <span>Imperial Transmission</span>
          <span>ARCHIVE PLAYBACK</span>
        </div>
        <OldGuardPlayer mode="page" />
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
