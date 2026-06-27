import { HolonetFrame } from "../../../../components/HolonetFrame.jsx";
import { OldGuardPlayer, OLD_GUARD_INTRO_PLAYBACK_ID } from "../../../../components/OldGuardPlayer.jsx";
import { PageScripts } from "../../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";

const THIS_IS_TSO_TITLE = "THIS IS TSO";

export const metadata = holonetMetadata({
  title: "This is TSO",
  description: ""
});

export default function ThisIsTsoPage() {
  return (
    <HolonetFrame
      title={THIS_IS_TSO_TITLE}
      subtitle="ARCHIVE PLAYBACK"
      footerNode="KOR-7"
    >
      <section className="old-guard-page-shell" aria-label="This is TSO archive playback">
        <div className="old-guard-page-topbar">
          <span>Imperial Transmission</span>
          <span>ARCHIVE PLAYBACK</span>
        </div>
        <OldGuardPlayer
          mode="page"
          playbackId={OLD_GUARD_INTRO_PLAYBACK_ID}
          title={THIS_IS_TSO_TITLE}
        />
      </section>

      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
