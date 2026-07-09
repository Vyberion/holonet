"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const OLD_GUARD_PLAYBACK_ID = "zB4z6QMgwgilabiIn00fmdcf62mmk00n4N01XnhNfaqTL00";
export const OLD_GUARD_INTRO_PLAYBACK_ID = "5B00WSZwcoH023XoGAE94RSxu5Pu3GFn9TCqIuNM1x73E";
const OLD_GUARD_TITLE = "THE OLD GUARD";
const MUX_PLAYER_SCRIPT = "https://cdn.jsdelivr.net/npm/@mux/mux-player";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";

  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = String(rounded % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function muxThumbnailUrl(playbackId) {
  return `https://image.mux.com/${playbackId}/thumbnail.png?width=214&height=121&time=0`;
}

export function OldGuardPlayer({ mode = "page", playbackId: explicitPlaybackId = "", title = OLD_GUARD_TITLE, hideControls = false, fillScreen = false, onPlay, onEnded }) {
  const playerRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const isIntro = mode === "intro";
  const playbackId = explicitPlaybackId || (isIntro ? OLD_GUARD_INTRO_PLAYBACK_ID : OLD_GUARD_PLAYBACK_ID);
  const thumbnailUrl = muxThumbnailUrl(playbackId);

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
      if (onPlay) onPlay();
    };

    const handlePause = () => {
      setPaused(true);
      readCurrentTime();
    };

    const handleEnded = () => {
      setPaused(true);
      setCurrentTime(0);
      if (onEnded) onEnded();
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
  }, [isIntro]);

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
    if (!player || isIntro) return;

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

  if (mode === "intro") {
    return (
      <div className="old-guard-player old-guard-player--intro" data-old-guard-intro-player="">
        <Script
          src={MUX_PLAYER_SCRIPT}
          strategy="afterInteractive"
          onReady={() => setPlayerReady(true)}
        />
        <div className="old-guard-stage" onClick={togglePlayback} style={{ height: '100%', width: '100%', border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <mux-player
            ref={playerRef}
            class="old-guard-mux old-guard-mux--intro"
            playback-id={playbackId}
            poster={thumbnailUrl}
            metadata-video-title={title}
            video-title={title}
            accent-color="#4d0000"
            primary-color="#ff0000"
            secondary-color="#050102"
            stream-type="on-demand"
            preload="auto"
            playsinline=""
            nohotkeys=""
            disable-tracking
            data-player-ready={playerReady ? "true" : "false"}
            style={{ "--controls": "none", objectFit: "cover" }}
          />
          <button
            type="button"
            className={`old-guard-start-button${paused ? "" : " is-hidden"}`}
            aria-label={`Play ${title}`}
            disabled={!playerReady}
            onClick={handleStartButton}
          >
            <span className="old-guard-start-ring" aria-hidden="true">
              <span />
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`old-guard-player old-guard-player--page${fillScreen ? " old-guard-player--fill" : ""}${hideControls ? " old-guard-player--no-controls" : ""}`}>
      <Script
        src={MUX_PLAYER_SCRIPT}
        strategy="afterInteractive"
        onReady={() => setPlayerReady(true)}
      />

      <div className="old-guard-stage" onClick={togglePlayback}>
        <mux-player
          ref={playerRef}
          class="old-guard-mux old-guard-mux--page"
          playback-id={playbackId}
          poster={thumbnailUrl}
          metadata-video-title={title}
          video-title={title}
          accent-color="#4d0000"
          primary-color="#ff0000"
          secondary-color="#050102"
          stream-type="on-demand"
          preload="auto"
          disable-tracking
          playsinline=""
        />
        <button
          type="button"
          className={`old-guard-start-button${paused ? "" : " is-hidden"}`}
          aria-label={`Play ${title}`}
          disabled={!playerReady}
          onClick={handleStartButton}
        >
          <span className="old-guard-start-ring" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>

      {!hideControls && (
        <div className="old-guard-timeline">
          <span className="old-guard-timecode">{formatTime(safeCurrentTime)}</span>
          <input
            className="old-guard-time-range"
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
          <span className="old-guard-timecode">{formatTime(duration)}</span>
        </div>
      )}
    </div>
  );
}
