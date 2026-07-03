"use client";

import { useEffect, useRef } from "react";
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

export function HolonetAudioController() {
  const router = useRouter();
  const pathname = usePathname();
  const audioRef = useRef(null);
  const unlockedRef = useRef(false);
  const fadeFrameRef = useRef(null);
  const isGalaxy = pathname === "/galaxy" || pathname?.startsWith("/galaxy/");

  useEffect(() => {
    const audio = new Audio(GALAXY_MUSIC_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      if (fadeFrameRef.current) cancelAnimationFrame(fadeFrameRef.current);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    function unlockAudio() {
      const audio = audioRef.current;
      if (!audio || unlockedRef.current) return;

      audio.volume = 0;
      const markUnlocked = () => {
        unlockedRef.current = true;
        if (isGalaxy) fadeAudio(audio, GALAXY_MUSIC_VOLUME, GALAXY_MUSIC_FADE_MS, fadeFrameRef);
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
  }, [isGalaxy]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !unlockedRef.current) return;

    const targetVolume = isGalaxy ? GALAXY_MUSIC_VOLUME : 0;
    if (audio.paused) {
      const playAttempt = audio.play();
      if (playAttempt?.catch) playAttempt.catch(() => {});
    }
    fadeAudio(audio, targetVolume, GALAXY_MUSIC_FADE_MS, fadeFrameRef);
  }, [isGalaxy]);

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
