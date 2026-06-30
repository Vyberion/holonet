import { GalaxyMapExperience } from "../../../../components/GalaxyMapExperience.jsx";
import { GalaxyMapLaunchPortal } from "../../../../components/GalaxyMapLaunchPortal.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { GALAXY_MAP, visibleGalaxyBodies } from "../../../../../modules/data/galaxy-map.js";

export const metadata = holonetMetadata({
  title: "Galactic Map",
  description: "Interactive galaxy map."
});

export default function ArchivesGalaxyMapPage() {
  const visibleMap = {
    ...GALAXY_MAP,
    bodies: visibleGalaxyBodies(GALAXY_MAP)
  };

  return (
    <>
      <GalaxyMapExperience map={visibleMap} />
      <GalaxyMapLaunchPortal placeId={1177256329} />
    </>
  );
}
