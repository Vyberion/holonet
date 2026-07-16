"use client";

import { useEffect, useRef, useState } from "react";
import { OldGuardPlayer } from "../../../components/OldGuardPlayer.jsx";

export function InteractiveMandate({ hero, content, videoPlaybackId }) {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const targetProgressRef = useRef(0);
  const currentProgressRef = useRef(0);
  const rafRef = useRef(null);

  const [introVideoFinished, setIntroVideoFinished] = useState(!videoPlaybackId);
  const introVideoFinishedRef = useRef(!videoPlaybackId);
  const [introVideoStarted, setIntroVideoStarted] = useState(false);
  const audioRef = useRef(null);

  // Sync music fade-in with the 3.5s video fade-out
  useEffect(() => {
    if (introVideoFinished && audioRef.current) {
      const audio = audioRef.current;
      audio.volume = 0;
      audio.play().catch(e => console.warn("Audio autoplay blocked:", e));

      const duration = 3500; // Matches the 3.5s opacity transition
      const steps = 35;
      const stepTime = duration / steps;
      let currentStep = 0;

      const MAX_VOLUME = 0.05;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          audio.volume = MAX_VOLUME;
          clearInterval(timer);
        } else {
          audio.volume = (currentStep / steps) * MAX_VOLUME;
        }
      }, stepTime);

      return () => clearInterval(timer);
    }
  }, [introVideoFinished]);

  // Sync background music with Spotify player
  useEffect(() => {
    const handleSpotifyPlay = () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
    
    const handleSpotifyPause = () => {
      // Only resume background music if the intro video is actually finished
      // and we are intended to be playing
      if (audioRef.current && introVideoFinishedRef.current) {
        audioRef.current.play().catch(e => console.warn("Audio autoplay blocked:", e));
      }
    };

    window.addEventListener('mandate-spotify-play', handleSpotifyPlay);
    window.addEventListener('mandate-spotify-pause', handleSpotifyPause);
    
    return () => {
      window.removeEventListener('mandate-spotify-play', handleSpotifyPlay);
      window.removeEventListener('mandate-spotify-pause', handleSpotifyPause);
    };
  }, []);

  const locked = progress < 1;
  const lockedRef = useRef(locked);
  lockedRef.current = locked; // Keep perfectly synced with every render

  // Animation Loop for buttery smooth easing (Lerp)
  useEffect(() => {
    const loop = () => {
      const target = targetProgressRef.current;
      const current = currentProgressRef.current;

      // If we're close enough, snap to exact target
      if (Math.abs(target - current) < 0.001) {
        if (current !== target) {
          currentProgressRef.current = target;
          setProgress(target);
        }
      } else {
        // Easing function: moves 8% of the distance per frame
        const next = current + (target - current) * 0.08;
        currentProgressRef.current = next;
        setProgress(next);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Lock body scroll and pin to top while transitioning
  useEffect(() => {
    if (locked) {
      document.body.style.setProperty('overflow', 'hidden', 'important');
      window.scrollTo(0, 0);
    } else {
      document.body.style.removeProperty('overflow');
    }
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [locked]);

  // Force scroll to 0 on every render while locked (belt AND suspenders)
  useEffect(() => {
    if (locked) {
      window.scrollTo(0, 0);
    }
  });

  // Wheel events — ALWAYS active, uses ref for latest progress
  useEffect(() => {
    const handleWheel = (e) => {
      const p = targetProgressRef.current;
      const isCurrentlyLocked = currentProgressRef.current < 1;

      // LOCKED: intercept all wheel events, drive target progress
      if (isCurrentlyLocked) {
        e.preventDefault();
        if (!introVideoFinishedRef.current) return; // Block scrolling until video finishes

        let step = e.deltaY / window.innerHeight; // Faster base scroll speed
        if (step < 0) step *= 1.66; // Matches previous absolute upward speed
        let next = p + step;
        if (next < 0) next = 0;
        if (next > 1) next = 1;
        targetProgressRef.current = next;
        window.scrollTo(0, 0);
        return;
      }

      // UNLOCKED: at top of page and scrolling UP → re-enter transition
      if (window.scrollY <= 0 && e.deltaY < 0) {
        e.preventDefault();
        let step = e.deltaY / window.innerHeight;
        step *= 1.66; // Matches previous absolute upward speed
        let next = 1 + step; // step is negative, brings progress below 1
        if (next < 0) next = 0;
        targetProgressRef.current = next;

        // Instantly trigger the locked state to prevent native scroll escaping
        if (currentProgressRef.current === 1) {
          currentProgressRef.current = 0.999;
          setProgress(0.999);
        }
        window.scrollTo(0, 0);
        return;
      }

      // UNLOCKED, not at top: native scroll handles it
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []); // Empty deps — permanent listener, uses refs

  // Touch events — same logic, ALWAYS active
  useEffect(() => {
    let lastTouchY = 0;

    const handleTouchStart = (e) => {
      lastTouchY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const delta = lastTouchY - touchY; // positive = finger swipe up = scroll down
      lastTouchY = touchY;

      const p = targetProgressRef.current;
      const isCurrentlyLocked = currentProgressRef.current < 1;

      if (isCurrentlyLocked) {
        e.preventDefault();
        if (!introVideoFinishedRef.current) return; // Block scrolling until video finishes

        let step = delta / window.innerHeight; // Faster base scroll speed
        if (step < 0) step *= 1.66; // Matches previous absolute upward speed
        let next = p + step;
        if (next < 0) next = 0;
        if (next > 1) next = 1;
        targetProgressRef.current = next;
        window.scrollTo(0, 0);
        return;
      }

      if (window.scrollY <= 0 && delta < 0) {
        e.preventDefault();
        let step = delta / window.innerHeight;
        step *= 1.66; // Matches previous absolute upward speed
        let next = 1 + step;
        if (next < 0) next = 0;
        targetProgressRef.current = next;

        // Instantly trigger the locked state to prevent native scroll escaping
        if (currentProgressRef.current === 1) {
          currentProgressRef.current = 0.999;
          setProgress(0.999);
        }
        window.scrollTo(0, 0);
        return;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Mouse spotlight, IntersectionObserver, glow effects
  useEffect(() => {
    let lastClientX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let lastClientY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    let hoveredGlowElement = null;

    const updateMouseVariables = () => {
      document.documentElement.style.setProperty('--mouse-x', `${lastClientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${lastClientY + window.scrollY}px`);
      
      if (hoveredGlowElement) {
        const rect = hoveredGlowElement.getBoundingClientRect();
        const x = lastClientX - rect.left;
        const y = lastClientY - rect.top;
        const shineX = (x / rect.width) * 100;
        const shineY = (y / rect.height) * 100;
        hoveredGlowElement.style.setProperty('--shine-x', `${shineX}%`);
        hoveredGlowElement.style.setProperty('--shine-y', `${shineY}%`);
      }
    };

    const handleGlobalMouseMove = (e) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      updateMouseVariables();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('scroll', updateMouseVariables, { passive: true });

    const glowElements = document.querySelectorAll('.pos-item, .v2-quote-box');

    const handleGlowMove = (e) => {
      hoveredGlowElement = e.currentTarget;
    };

    const handleGlowLeave = (e) => {
      hoveredGlowElement = null;
      const el = e.currentTarget;
      el.style.setProperty('--shine-x', `50%`);
      el.style.setProperty('--shine-y', `50%`);
    };

    glowElements.forEach(el => {
      el.addEventListener('mousemove', handleGlowMove);
      el.addEventListener('mouseleave', handleGlowLeave);
    });

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('scroll', updateMouseVariables);
      glowElements.forEach(el => {
        el.removeEventListener('mousemove', handleGlowMove);
        el.removeEventListener('mouseleave', handleGlowLeave);
      });
    };
  }, []); // Run once on mount

  // Attach IntersectionObserver ONLY when unlocked to force an immediate scan of elements on screen
  useEffect(() => {
    if (locked) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });

    const scrollElements = document.querySelectorAll('.animate-on-scroll');
    scrollElements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [locked]);

  // Phase 1: progress 0→0.3 — hero fades out (quick)
  // Phase 2: progress 0.3→1.0 — content fades in (locked, no movement)
  let heroOpacity = 1;
  let contentOpacity = 0;

  if (progress <= 0.3) {
    heroOpacity = 1 - (progress / 0.3);
    contentOpacity = 0;
  } else {
    heroOpacity = 0;
    contentOpacity = (progress - 0.3) / 0.7;
  }

  return (
    <div ref={containerRef} className="interactive-mandate-wrapper">
      <audio ref={audioRef} src="/assets/music/galaxy/suspense.mp3" loop />

      {/* INTRO VIDEO OVERLAY — stays on top until finished */}
      {videoPlaybackId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 20,
          opacity: introVideoFinished ? 0 : 1,
          pointerEvents: introVideoFinished ? 'none' : 'auto',
          transition: 'opacity 3.5s ease-out',
          background: '#050102'
        }}>
          <OldGuardPlayer
            mode="intro"
            playbackId={videoPlaybackId}
            onPlay={() => setIntroVideoStarted(true)}
            onEnded={() => {
              introVideoFinishedRef.current = true;
              setIntroVideoFinished(true);
            }}
          />
          <button
            className="loader-intro-skip"
            type="button"
            style={{
              opacity: introVideoStarted ? 1 : 0,
              pointerEvents: introVideoStarted ? 'auto' : 'none',
              zIndex: 100
            }}
            onClick={() => {
              introVideoFinishedRef.current = true;
              setIntroVideoFinished(true);
              const player = containerRef.current?.querySelector("mux-player");
              if (player && typeof player.pause === "function") {
                player.pause();
              }
            }}
          >
            SKIP TRANSMISSION
          </button>
        </div>
      )}

      {/* HERO — fixed overlay, fades out during Phase 1 */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 15,
        opacity: heroOpacity,
        transform: `scale(${1 + (1 - heroOpacity) * 0.05})`,
        pointerEvents: 'none',
        display: heroOpacity > 0.01 ? 'flex' : 'none',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hero}
      </div>

      {/*
        CONTENT — always in the document flow.
        While locked, "scroll-reveal-override" disables all child CSS animations
        so our wrapper opacity is the sole control. Nothing moves.
        When unlocked, the class is removed and normal scroll-reveal resumes.
      */}
      <div
        className={locked ? 'scroll-reveal-override' : ''}
        style={{
          opacity: locked ? contentOpacity : 1,
          pointerEvents: locked ? 'none' : 'auto',
        }}
      >
        {content}
      </div>

    </div>
  );
}
