"use client";

import { useEffect, useRef, useState } from "react";

export function InteractiveMandate({ hero, content }) {
  const containerRef = useRef(null);
  const [scrollData, setScrollData] = useState({ scrollY: 0, vh: 800 });

  useEffect(() => {
    const handleScroll = () => {
      setScrollData({ 
        scrollY: window.scrollY, 
        vh: window.innerHeight 
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    // 1. Mouse Spotlight Effect on Background
    const handleGlobalMouseMove = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('mousemove', handleGlobalMouseMove);

    // 2. Intersection Observer for Scroll Animations
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -50px 0px" });

    const scrollElements = document.querySelectorAll('.animate-on-scroll');
    scrollElements.forEach(el => observer.observe(el));

    // 3. Glow Effect on Hover for Grid Items
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

  const { scrollY, vh } = scrollData;
  
  let heroOpacity = 1;
  let heroScale = 1;
  let contentOpacity = 0;

  // Phase 1: 0 to 100vh -> Hero fades out
  if (scrollY <= vh) {
    heroOpacity = 1 - (scrollY / vh);
    heroScale = 1 + (scrollY / vh) * 0.05;
    contentOpacity = 0;
  } 
  // Phase 2: 100vh to 200vh -> Content fades in
  else if (scrollY <= 2 * vh) {
    heroOpacity = 0;
    heroScale = 1.05;
    contentOpacity = (scrollY - vh) / vh;
  } 
  // Phase 3: > 200vh -> Fully visible, native scrolling resumes
  else {
    heroOpacity = 0;
    heroScale = 1.05;
    contentOpacity = 1;
  }
  const locked = scrollY < 2 * vh;

  return (
    <div ref={containerRef} className="interactive-mandate-wrapper">
      
      {/* 
        SPACER: 200vh of empty scroll room for the two transition phases.
        The browser scrollbar reflects this height, allowing the user to scroll
        while everything on screen stays visually locked via position: fixed.
      */}
      {locked && <div style={{ height: '200vh', width: '100%' }}></div>}

      {/* HERO OVERLAY: Fixed to the viewport, fades out during Phase 1 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 15,
        opacity: heroOpacity,
        transform: `scale(${heroScale})`,
        pointerEvents: heroOpacity > 0.01 ? 'auto' : 'none',
        display: heroOpacity > 0.01 ? 'flex' : 'none',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hero}
      </div>

      {/* CONTENT OVERLAY: Fixed to the viewport, fades in during Phase 2 */}
      {locked && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          opacity: contentOpacity,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          {content}
        </div>
      )}

      {/* 
        STATIC CONTENT: Always in the document flow.
        Hidden while locked (the fixed overlay above shows it instead).
        Visible once unlocked — the user scrolls this natively.
      */}
      <div style={{
        opacity: locked ? 0 : 1,
        pointerEvents: locked ? 'none' : 'auto',
        visibility: locked ? 'hidden' : 'visible',
      }}>
        {content}
      </div>

    </div>
  );
}
