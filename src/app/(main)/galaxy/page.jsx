import { GalaxyMapExperience } from "../../../components/GalaxyControlMap.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { GALAXY_CONTROL_MAP } from "../../../../modules/data/galaxy-control-tessellation.js";

export const metadata = holonetMetadata({
  title: "Galaxy",
  description: "Hidden tactical galaxy control map."
});

export default function GalaxyPage() {
  return <GalaxyMapExperience map={GALAXY_CONTROL_MAP} />;
}
