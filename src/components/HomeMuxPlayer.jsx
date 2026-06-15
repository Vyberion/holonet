"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const PLAYBACK_ID = "zB4z6QMgwgilabiIn00fmdcf62mmk00n4N01XnhNfaqTL00";
const VIDEO_TITLE = "THE OLD GUARD";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = String(rounded % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function HomeMuxPlayer() {
  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return undefined;

    const readDuration = () => {
      const nextDuration = Number(player.duration);
      setDuration(Number.isFinite(nextDuration) && nextDuration > 0 ? nextDuration : 0);
    };

    const readCurrentTime = () => {
      const nextTime = Number(player.currentTime);
      setCurrentTime(Number.isFinite(nextTime) && nextTime > 0 ? nextTime : 0);
    };

    const handlePlay = () => {
      setPaused(false);
      readDuration();
    };

    const handlePause = () => {
      setPaused(true);
      readCurrentTime();
    };

    const handleEnded = () => {
      setPaused(true);
      setCurrentTime(0);
    };

    player.addEventListener("loadedmetadata", readDuration);
    player.addEventListener("durationchange", readDuration);
    player.addEventListener("timeupdate", readCurrentTime);
    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);

    readDuration();
    readCurrentTime();
    setPaused(player.paused !== false);

    return () => {
      player.removeEventListener("loadedmetadata", readDuration);
      player.removeEventListener("durationchange", readDuration);
      player.removeEventListener("timeupdate", readCurrentTime);
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === "undefined" || !window.customElements) {
      return undefined;
    }

    window.customElements
      .whenDefined("mux-player")
      .then(() => {
        if (!cancelled) setPlayerReady(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const playTransmission = async () => {
    const player = playerRef.current;
    if (!player?.play) return;

    try {
      await player.play();
    } catch (error) {
      console.warn("Mux playback could not start:", error);
    }
  };

  const togglePlayback = () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.paused) {
      playTransmission();
      return;
    }

    player.pause?.();
  };

  const handleStartButton = event => {
    event.stopPropagation();
    playTransmission();
  };

  const handleSeek = event => {
    const nextTime = Number(event.target.value);
    if (!Number.isFinite(nextTime)) return;

    setCurrentTime(nextTime);

    if (playerRef.current && duration > 0) {
      playerRef.current.currentTime = nextTime;
    }
  };

  const safeCurrentTime = duration > 0 ? Math.min(currentTime, duration) : 0;
  const progress = duration > 0 ? `${(safeCurrentTime / duration) * 100}%` : "0%";

  return (
    <div className="home-media-mux">
      <Script
        id="mux-player-script"
        src="https://cdn.jsdelivr.net/npm/@mux/mux-player"
        strategy="afterInteractive"
        onReady={() => setPlayerReady(true)}
      />

      <div className="home-media-stage" onClick={togglePlayback}>
        <mux-player
          ref={playerRef}
          class="home-media-player"
          playback-id={PLAYBACK_ID}
          metadata-video-title={VIDEO_TITLE}
          video-title={VIDEO_TITLE}
          accent-color="#4d0000"
          primary-color="#ff0000"
          secondary-color="#050102"
          stream-type="on-demand"
          preload="auto"
          playsinline=""
        />
        <button
          type="button"
          className={`home-media-start-button${paused ? "" : " is-hidden"}`}
          aria-label="Play The Old Guard"
          disabled={!playerReady}
          onClick={handleStartButton}
        >
          <span className="home-media-start-ring" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>

      <div className="home-media-timeline">
        <span className="home-media-timecode">{formatTime(safeCurrentTime)}</span>
        <input
          className="home-media-time-range"
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={safeCurrentTime}
          aria-label="Transmission time selector"
          disabled={!duration}
          onChange={handleSeek}
          style={{ "--timeline-progress": progress }}
        />
        <span className="home-media-timecode">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
