"use client";

import { useEffect, useRef, useState } from "react";

export function InteractiveMandate({ hero, content }) {
  const containerRef = useRef(null);
  const [scrollData, setScrollData] = useState({ progress: 0, scrollY: 0, vh: 800 });

  useEffect(() => {
    // Track scroll progress to drive the transition
    const handleScroll = () => {
      const vh = window.innerHeight;
      const scrollY = window.scrollY;
      
      let p = scrollY / vh;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      
      setScrollData({ progress: p, scrollY, vh });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    // Trigger once on mount
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

  const { progress, scrollY, vh } = scrollData;
  const isTransitioning = progress < 1;

  // When transitioning, we compensate for the native scroll by translating the element UP
  // by exactly the amount it natively scrolled DOWN, keeping it visually glued to the viewport.
  const contentTransform = isTransitioning 
    ? `translateY(${scrollY - vh + (1 - progress) * 40}px)` 
    : 'none';

  return (
    <div ref={containerRef} className="interactive-mandate-wrapper">
      {/* 
        This spacer gives the document physical height so the user can scroll down 
        to trigger the transition BEFORE the real content begins taking up space.
      */}
      <div style={{ height: '100vh', width: '100%' }}></div>

      {/* The Hero splash screen - fixed to the viewport, fading and shrinking out */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        opacity: 1 - progress,
        transform: `scale(${1 - progress * 0.05})`,
        pointerEvents: isTransitioning ? 'auto' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {hero}
      </div>

      {/* 
        The Main Content Container
        It natively sits directly under the 100vh spacer.
        While transitioning, we apply a mathematical transform to visually pin it to the viewport
        while allowing the body to scroll normally. Once progress = 1, transform is removed and it flows naturally.
      */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        opacity: progress,
        transform: contentTransform,
        pointerEvents: isTransitioning ? 'none' : 'auto',
      }}>
        {content}
      </div>
    </div>
  );
}
