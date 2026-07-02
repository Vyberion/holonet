import "./galaxy-intro.js";
import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../config/intro.js";

const path = typeof window !== "undefined" ? window.location.pathname : "";
const isGalaxyPage = path === "/galaxy" || path === "/galaxy/";
const loadGalaxyIntro = () => import("./galaxy-intro.js");

if (isGalaxyPage) {
  window.HOLONET_FORCE_RELEASE_INTRO = true;
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = true;
  await loadGalaxyIntro();
} else {
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = HOLONET_ALTERNATIVE_INTRO_ENABLED;
}
