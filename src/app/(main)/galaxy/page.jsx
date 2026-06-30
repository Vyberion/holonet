import { GalaxyControlMap } from "../../../components/GalaxyControlMap.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { GALAXY_CONTROL_MAP } from "../../../../modules/data/galaxy-control-map.js";

export const metadata = holonetMetadata({
  title: "Galaxy",
  description: "Hidden tactical galaxy control map."
});

export default function GalaxyPage() {
  return <GalaxyControlMap map={GALAXY_CONTROL_MAP} />;
}
