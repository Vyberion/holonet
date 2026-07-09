"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const GALAXY_MUSIC_SRC = "/assets/music/galaxy/suspense.mp3";
const GALAXY_MUSIC_VOLUME = 0.224;
const GALAXY_MUSIC_FADE_MS = 1200;

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function fadeAudio(audio, targetVolume, duration, frameRef) {
  if (frameRef.current) cancelAnimationFrame(frameRef.current);

  const fromVolume = clampVolume(audio.volume);
  const safeTargetVolume = clampVolume(targetVolume);
  const startedAt = performance.now();
  const fadeDuration = Math.max(0, Number(duration) || 0);

  function frame(now) {
    const progress = fadeDuration ? Math.min(1, (now - startedAt) / fadeDuration) : 1;
    audio.volume = clampVolume(fromVolume + (safeTargetVolume - fromVolume) * progress);
    if (progress < 1) {
      frameRef.current = requestAnimationFrame(frame);
    } else {
      frameRef.current = null;
    }
  }

  frameRef.current = requestAnimationFrame(frame);
}

function loaderIsHidden() {
  const loader = document.getElementById("loader");
  return !loader || loader.style.display === "none" || window.__holonetLoaderHidden === true;
}

export function HolonetAudioController() {
  const router = useRouter();
  const pathname = usePathname();
  const audioRef = useRef(null);
  const unlockedRef = useRef(false);
  const fadeFrameRef = useRef(null);
  const isGalaxy = pathname === "/galaxy" || pathname?.startsWith("/galaxy/");
  const isGalaxyRef = useRef(isGalaxy);
  isGalaxyRef.current = isGalaxy;

  const syncAudioTarget = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !unlockedRef.current) return;

    const targetVolume = isGalaxyRef.current && loaderIsHidden() ? GALAXY_MUSIC_VOLUME : 0;
    
    if (targetVolume === 0) {
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);
      audio.pause();
    } else {
      if (audio.paused) {
        const playAttempt = audio.play();
        if (playAttempt?.catch) playAttempt.catch(() => {});
      }
      fadeAudio(audio, targetVolume, GALAXY_MUSIC_FADE_MS, fadeFrameRef);
    }
  }, []);

  // Nuclear fallback to aggressively enforce silence on non-galaxy pages
  useEffect(() => {
    const nuclearInterval = setInterval(() => {
      if (audioRef.current && !isGalaxyRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    }, 100);
    return () => clearInterval(nuclearInterval);
  }, []);

  useEffect(() => {
    const audio = new Audio(GALAXY_MUSIC_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;

    try {
      const saved = parseFloat(sessionStorage.getItem("galaxy-music-time"));
      if (Number.isFinite(saved) && saved > 0) audio.currentTime = saved;
    } catch {}

    audioRef.current = audio;

    const saveInterval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        try { sessionStorage.setItem("galaxy-music-time", String(audioRef.current.currentTime)); } catch {}
      }
    }, 2000);

    return () => {
      clearInterval(saveInterval);
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);
      try { sessionStorage.setItem("galaxy-music-time", String(audio.currentTime)); } catch {}
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    function unlockAudio() {
      const audio = audioRef.current;
      if (!audio || unlockedRef.current) return;
      
      // CRITICAL: Never attempt to unlock or touch the audio element unless we are ACTUALLY on the galaxy page.
      // iOS can act unpredictably if we call play() and then try to pause() it immediately.
      if (!isGalaxyRef.current) return;

      unlockedRef.current = true;
      audio.volume = 0; // Prepare for fade-in
      
      const markUnlocked = () => {
        syncAudioTarget();
      };

      try {
        const playAttempt = audio.play();
        if (playAttempt?.then) {
          playAttempt.then(markUnlocked).catch(() => {
            unlockedRef.current = false;
          });
        } else {
          markUnlocked();
        }
      } catch {
        unlockedRef.current = false;
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [syncAudioTarget]);

  useEffect(() => {
    syncAudioTarget();
    window.addEventListener("holonet:loader-hidden", syncAudioTarget);
    return () => window.removeEventListener("holonet:loader-hidden", syncAudioTarget);
  }, [syncAudioTarget, pathname]);

  useEffect(() => {
    function handleInternalLinkClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;

      event.preventDefault();
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }

    document.addEventListener("click", handleInternalLinkClick);
    return () => document.removeEventListener("click", handleInternalLinkClick);
  }, [router]);

  return null;
}
