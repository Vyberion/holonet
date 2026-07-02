import { GalaxyMapExperience } from "../../../components/GalaxyControlMap.jsx";
import { HolonetFrame } from "../../../components/HolonetFrame.jsx";
import { PageScripts } from "../../../components/PageScripts.jsx";
import { holonetMetadata } from "../../../lib/metadata.js";
import { GALAXY_CONTROL_MAP } from "../../../../modules/data/galaxy-control-tessellation.js";

const GALAXY_INTRO_SCRIPT = `
(function(){
  var MUSIC_ID = "galaxy-intro-music";

  function requestIntroRun() {
    try {
      var url = new URL(window.location.href);
      if (url.searchParams.get("intro") !== "1") {
        url.searchParams.set("intro", "1");
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch (error) {}
  }

  function setText(selector, text) {
    var element = document.querySelector(selector);
    if (element) element.textContent = text;
  }

  function setIntroCopy() {
    setText(".loader-gate-kicker", "MANAR'S THE SITH ORDER");
    setText(".loader-gate-title", "THE GALAXY");
    setText("[data-loader-establish] span", "CONNECT");
    setText(".loader-gate-meta span:first-child", "IMPERIAL INTELLIGENCE");
    setText(".loader-gate-meta span:last-child", "MINISTRY OF LOGISTICS");

    const loadingLines = document.querySelectorAll(".loader-intro-loading .loader-terminal-line");
    ["Relay aligning", "Request received", "Transmission initializing"].forEach((text, index) => {
      if (loadingLines[index]) loadingLines[index].textContent = text;
    });

    setText(".loader-intro-ready .loader-terminal-line", "Transmission established");
    setText(".loader-intro-ready .loader-terminal-status", "Opening Galaxy");
  }

  function stripVideoIntro(loader) {
    var videoSlot = loader.querySelector("[data-loader-intro-video]");
    if (!videoSlot) return;

    videoSlot.removeAttribute("data-loader-intro-video");
    videoSlot.setAttribute("aria-hidden", "true");
    videoSlot.innerHTML = '<button class="loader-intro-skip" type="button" data-loader-skip-intro hidden aria-hidden="true">Bypass Transmission</button>';
  }

  function armVideoBypass(loader) {
    function bypassVideoPhase() {
      if (loader.dataset.loaderPhase !== "intro-video") return;
      var skipButton = loader.querySelector("[data-loader-skip-intro]");
      if (!skipButton || skipButton.disabled) return;
      skipButton.click();
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(bypassVideoPhase);
      observer.observe(loader, { attributes: true, attributeFilter: ["data-loader-phase"] });
      window.addEventListener("pagehide", function(){ observer.disconnect(); }, { once: true });
    }

    bypassVideoPhase();
  }

  function armMusic() {
    var audio = document.getElementById(MUSIC_ID);
    var button = document.querySelector("[data-loader-establish]");
    if (!audio || !button) return;

    button.addEventListener("click", function(){
      try {
        audio.volume = 0.56;
        audio.currentTime = 0;
        var playAttempt = audio.play();
        if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(function(){});
      } catch (error) {}
    }, { once: true });
  }

  function bootGalaxyIntro() {
    var loader = document.getElementById("loader");
    if (!loader) return;

    window.HOLONET_FORCE_RELEASE_INTRO = true;
    window.HOLONET_ALTERNATIVE_INTRO_ENABLED = true;
    requestIntroRun();
    document.documentElement.classList.add("holonet-release-intro");
    document.documentElement.classList.remove("holonet-standard-loader");

    setIntroCopy();
    stripVideoIntro(loader);
    armVideoBypass(loader);
    armMusic();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGalaxyIntro, { once: true });
  } else {
    bootGalaxyIntro();
  }
})();
`;

export const metadata = holonetMetadata({
  title: "Galaxy",
  description: "Sectoral control and navigation."
});

export default function GalaxyPage() {
  return (
    <HolonetFrame title="GALAXY" subtitle="CONTROL MAP" showHeader={false} footerNode="KOR-7">
      <audio id="galaxy-intro-music" src="/assets/music/galaxy/suspense.mp3" preload="auto" loop />
      <script dangerouslySetInnerHTML={{ __html: GALAXY_INTRO_SCRIPT }} />
      <GalaxyMapExperience map={GALAXY_CONTROL_MAP} />
      <PageScripts scripts={["/js/main.js", "/modules/client/site.js"]} />
    </HolonetFrame>
  );
}
