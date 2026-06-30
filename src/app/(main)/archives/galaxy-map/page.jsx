import { GalaxyMapExperience } from "../../../../components/GalaxyMapExperience.jsx";
import { GalaxyMapLaunchPortal } from "../../../../components/GalaxyMapLaunchPortal.jsx";
import { holonetMetadata } from "../../../../lib/metadata.js";
import { GALAXY_MAP, visibleGalaxyBodies } from "../../../../../modules/data/galaxy-map.js";

export const metadata = holonetMetadata({
  title: "Galactic Map",
  description: "Interactive galaxy map."
});

const KORRIBAN_SELECTED_RADIUS = 0.34;

function galaxyMapBodies() {
  return visibleGalaxyBodies(GALAXY_MAP).map(body => (
    body.id === "korriban"
      ? { ...body, radius: KORRIBAN_SELECTED_RADIUS }
      : body
  ));
}

export default function ArchivesGalaxyMapPage() {
  const visibleMap = {
    ...GALAXY_MAP,
    bodies: galaxyMapBodies()
  };

  return (
    <>
      <GalaxyMapExperience map={visibleMap} />
      <GalaxyMapLaunchPortal placeId={1177256329} />
    </>
  );
}
