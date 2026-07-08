"use client";

import { useEffect, useRef, useState } from "react";

export function InteractiveMandate({ hero, content }) {
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Track scroll progress to drive the transition
    const handleScroll = () => {
      // The distance over which the fade out/in happens
      const transitionDistance = window.innerHeight;
      const scrollY = window.scrollY;
      
      let p = scrollY / transitionDistance;
      if (p < 0) p = 0;
      if (p > 1) p = 1;
      
      setProgress(p);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Trigger once on mount
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
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

  const isTransitioning = progress < 1;

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
        While scrolling the first 100vh, it is fixed (locking it in place while it fades in).
        Once progress === 1, it becomes static, seamlessly handing off into the document flow
        so the user can naturally scroll down the rest of the lengthy page.
      */}
      <div style={{
        position: isTransitioning ? 'fixed' : 'static',
        top: isTransitioning ? 0 : 'auto',
        left: 0,
        right: 0,
        zIndex: 10,
        width: '100%',
        opacity: progress,
        // Optional: slight upward slide-in effect as it fades in
        transform: isTransitioning ? `translateY(${(1 - progress) * 40}px)` : 'none',
      }}>
        {content}
      </div>
    </div>
  );
}
