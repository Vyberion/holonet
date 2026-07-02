export const GALAXY_RELEASE_INTRO = {
  enabled: true,
  force: true,
  waitForGalaxyReady: true,
  prompt: {
    kicker: "MANAR'S THE SITH ORDER",
    title: "THE GALAXY",
    action: "CONNECT",
    meta: ["IMPERIAL INTELLIGENCE", "MINISTRY OF LOGISTICS"]
  },
  loadingLines: [
    "Relay aligning",
    "Request received",
    "Transmission initializing"
  ],
  ready: {
    line: "Transmission established",
    status: "Opening Galaxy"
  },
  video: {
    enabled: false,
    player: null,
    skipLabel: "Bypass Transmission",
    skipHidden: true,
    autoBypass: true
  },
  music: {
    id: "galaxy-intro-music",
    src: "/assets/music/galaxy/suspense.mp3",
    preload: "auto",
    loop: true,
    volume: 0.224,
    startAfterLoaderHidden: true,
    fadeInMs: 1200
  }
};

export function GalaxyIntro() {
  const { music } = GALAXY_RELEASE_INTRO;

  return (
    <audio
      id={music.id}
      src={music.src}
      preload={music.preload}
      loop={music.loop}
    />
  );
}
