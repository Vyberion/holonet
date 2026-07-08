"use client";

import { useEffect, useRef, useState } from "react";

export function InteractiveMandate({ hero, content }) {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const locked = progress < 1;

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
      const p = progressRef.current;

      // LOCKED: intercept all wheel events, drive progress
      if (p < 1) {
        e.preventDefault();
        const step = e.deltaY / (window.innerHeight * 1.5);
        let next = p + step;
        if (next < 0) next = 0;
        if (next > 1) next = 1;
        progressRef.current = next;
        setProgress(next);
        window.scrollTo(0, 0);
        return;
      }

      // UNLOCKED: at top of page and scrolling UP → re-enter transition
      if (window.scrollY <= 0 && e.deltaY < 0) {
        e.preventDefault();
        const step = e.deltaY / (window.innerHeight * 1.5);
        let next = 1 + step; // step is negative, brings progress below 1
        if (next < 0) next = 0;
        progressRef.current = next;
        setProgress(next);
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
      const p = progressRef.current;

      if (p < 1) {
        e.preventDefault();
        const step = delta / (window.innerHeight * 1.5);
        let next = p + step;
        if (next < 0) next = 0;
        if (next > 1) next = 1;
        progressRef.current = next;
        setProgress(next);
        window.scrollTo(0, 0);
        return;
      }

      if (window.scrollY <= 0 && delta < 0) {
        e.preventDefault();
        const step = delta / (window.innerHeight * 1.5);
        let next = 1 + step;
        if (next < 0) next = 0;
        progressRef.current = next;
        setProgress(next);
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
    const handleGlobalMouseMove = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });

    const scrollElements = document.querySelectorAll('.animate-on-scroll');
    scrollElements.forEach(el => observer.observe(el));

    const glowElements = document.querySelectorAll('.pos-item, .v2-quote-box');

    const handleGlowMove = (e) => {
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const shineX = (x / rect.width) * 100;
      const shineY = (y / rect.height) * 100;
      el.style.setProperty('--shine-x', `${shineX}%`);
      el.style.setProperty('--shine-y', `${shineY}%`);
    };

    const handleGlowLeave = (e) => {
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
      observer.disconnect();
      glowElements.forEach(el => {
        el.removeEventListener('mousemove', handleGlowMove);
        el.removeEventListener('mouseleave', handleGlowLeave);
      });
    };
  }, []);

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
