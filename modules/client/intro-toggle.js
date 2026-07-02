import "./galaxy-intro.js";
import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../config/intro.js";

const path = typeof window !== "undefined" ? window.location.pathname : "";
const isGalaxyPage = path === "/galaxy" || path === "/galaxy/";

window.HOLONET_ALTERNATIVE_INTRO_ENABLED = isGalaxyPage
  ? true
  : HOLONET_ALTERNATIVE_INTRO_ENABLED;
