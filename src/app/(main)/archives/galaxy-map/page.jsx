import { GalaxyMapExperience } from "../../../../components/GalaxyMapExperience.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { GALAXY_MAP } from "../../../../../modules/data/galaxy-map.js";

export const metadata = holonetMetadata({
  title: "Archives Galaxy Map",
  description: "Hidden interactive galaxy map of the Sith Worlds."
});

export default function ArchivesGalaxyMapPage() {
  return <GalaxyMapExperience map={GALAXY_MAP} />;
}
