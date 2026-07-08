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

  return (
    <div 
      ref={containerRef} 
      className="interactive-mandate-wrapper" 
      // This padding creates the 200vh of scrollable space needed for the 2-phase transition.
      // Because the child is `sticky`, scrolling through this padding visually locks the screen.
      style={{ paddingBottom: '200vh' }}
    >
      
      {/* 
        This container naturally sticks to the top of the viewport for exactly the duration 
        of the padding (200vh), preventing any jitter or bouncing natively. 
      */}
      <div style={{ position: 'sticky', top: 0 }}>
        
        {/* Hero Layer */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          zIndex: 5,
          opacity: heroOpacity,
          transform: `scale(${heroScale})`,
          pointerEvents: heroOpacity > 0 ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {hero}
        </div>

        {/* Content Layer */}
        <div style={{
          position: 'relative', // Relative so it defines the height of the sticky container
          zIndex: 10,
          width: '100%',
          opacity: contentOpacity,
          pointerEvents: contentOpacity > 0 ? 'auto' : 'none',
        }}>
          {content}
        </div>

      </div>
    </div>
  );
}
