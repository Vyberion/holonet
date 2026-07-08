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

    const scrollElements = document.querySelectorAll('.animate-on-scroll');
    scrollElements.forEach(el => observer.observe(el));

    // 3D tilt removed by request

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="interactive-mandate-wrapper">
      {children}
    </div>
  );
}
