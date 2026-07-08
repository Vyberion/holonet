"use client";

import { useEffect, useRef, useState } from "react";

export function InteractiveMandate({ hero, content }) {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  const locked = progress < 1;

  // Lock body scroll during the transition
  useEffect(() => {
    if (locked) {
      document.body.style.setProperty('overflow', 'hidden', 'important');
      window.scrollTo(0, 0);
    } else {
      document.body.style.removeProperty('overflow');
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [locked]);

  // Wheel events drive progress while locked
  useEffect(() => {
    if (!locked) return;

    const handleWheel = (e) => {
      e.preventDefault();
      // ~1.5 screen-heights of total wheel travel for the full transition
      const step = e.deltaY / (window.innerHeight * 1.5);
      let p = progressRef.current + step;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      progressRef.current = p;
      setProgress(p);
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [locked]);

  // Touch events for mobile
  useEffect(() => {
    if (!locked) return;
    let lastTouchY = 0;

    const handleTouchStart = (e) => {
      lastTouchY = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      const touchY = e.touches[0].clientY;
      const delta = lastTouchY - touchY; // positive = finger swipe up = scroll down
      lastTouchY = touchY;
      const step = delta / (window.innerHeight * 1.5);
      let p = progressRef.current + step;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      progressRef.current = p;
      setProgress(p);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [locked]);

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

  // Phase 1: progress 0→0.3 — hero fades out (quick, less scrolling)
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
        so that our wrapper opacity is the sole control. Nothing moves.
        When unlocked, the class is removed and normal scroll-reveal behaviour resumes.
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
