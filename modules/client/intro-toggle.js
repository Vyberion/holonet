import { HOLONET_ALTERNATIVE_INTRO_ENABLED } from "../config/intro.js";

if (typeof window !== "undefined" && typeof window.HOLONET_ALTERNATIVE_INTRO_ENABLED === "undefined") {
  window.HOLONET_ALTERNATIVE_INTRO_ENABLED = HOLONET_ALTERNATIVE_INTRO_ENABLED;
}
