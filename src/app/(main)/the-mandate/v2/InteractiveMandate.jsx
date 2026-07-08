"use client";

import { useEffect, useRef } from "react";

export function InteractiveMandate({ children }) {
  const containerRef = useRef(null);

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

    // 3. Glow Effect on Hover for Grid Items & Pillars (No Tilt)
    const glowElements = document.querySelectorAll('.pos-item, .v2-pillar, .v2-quote-box');
    
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

    // 4. Splash Screen Logic
    window.scrollTo(0,0);
    document.body.classList.add('splash-active');
    
    const splashButton = document.querySelector('.v2-splash-button');
    const handleSplashClose = () => {
      document.body.classList.remove('splash-active');
      document.querySelector('.v2-hero')?.classList.add('splash-hidden');
      document.querySelector('.v2-content-wrapper')?.classList.add('content-visible');
      window.scrollTo(0,0);
    };

    if (splashButton) {
      splashButton.addEventListener('click', handleSplashClose);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      observer.disconnect();
      glowElements.forEach(el => {
        el.removeEventListener('mousemove', handleGlowMove);
        el.removeEventListener('mouseleave', handleGlowLeave);
      });
      if (splashButton) {
        splashButton.removeEventListener('click', handleSplashClose);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="interactive-mandate-wrapper">
      {children}
    </div>
  );
}
