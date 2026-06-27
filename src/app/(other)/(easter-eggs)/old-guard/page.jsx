import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { OldGuardPlayer } from "../../../../components/OldGuardPlayer.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

const OLD_GUARD_TITLE = "THE OLD GUARD";
const OLD_GUARD_PLAYBACK_ID = "zB4z6QMgwgilabiIn00fmdcf62mmk00n4N01XnhNfaqTL00";

export const metadata = holonetMetadata({
  title: "The Old Guard",
  description: ""
});

export default function OldGuardPage() {
  return (
    <HolonetFrame
      title={OLD_GUARD_TITLE}
      subtitle="ARCHIVE PLAYBACK"
      footerNode="KOR-7"
    >
      <section className="old-guard-page-shell" aria-label="The Old Guard archive playback">
        <div className="old-guard-page-topbar">
          <span>Imperial Transmission</span>
          <span>ARCHIVE PLAYBACK</span>
        </div>
        <OldGuardPlayer
          mode="page"
          playbackId={OLD_GUARD_PLAYBACK_ID}
          title={OLD_GUARD_TITLE}
        />
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
