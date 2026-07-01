import { GalaxyMapExperience } from "../../../components/GalaxyControlMap.jsx";
import { HolonetNav } from "../../../components/HolonetNav.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { GALAXY_CONTROL_MAP } from "../../../../modules/data/galaxy-control-tessellation.js";

export const metadata = holonetMetadata({
  title: "Galaxy",
  description: "Sectoral control and navigation."
});

export default function GalaxyPage() {
  return (
    <>
      <div id="nav-container">
        <HolonetNav />
      </div>
      <GalaxyMapExperience map={GALAXY_CONTROL_MAP} />
    </>
  );
}
