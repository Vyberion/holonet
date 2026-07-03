import { GalaxyMapExperience } from "../../../components/GalaxyControlMap.jsx";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { GALAXY_CONTROL_MAP } from "../../../../modules/data/galaxy-control-tessellation.js";

export const metadata = holonetMetadata({
  title: "Galaxy",
  description: "Sectoral control and navigation."
});

export default function GalaxyPage() {
  return (
    <HolonetFrame
      title="GALAXY"
      subtitle="CONTROL MAP"
      showHeader={false}
      footerNode="KOR-7"
      releaseIntro={{ enabled: false, waitForGalaxyReady: true }}
    >
      <GalaxyMapExperience map={GALAXY_CONTROL_MAP} />
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
