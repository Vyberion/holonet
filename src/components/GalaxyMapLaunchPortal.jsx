"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const INTRO_COMPLETE_KEY = "holonet:intro:v1:complete";
const INTRO_COMPLETE_COOKIE = "holonet_intro_v1_complete";
const INTRO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeIntroCompleteFlag() {
  try {
    localStorage.setItem(INTRO_COMPLETE_KEY, "true");
  } catch (error) {}

  try {
    const secure = window.location?.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${INTRO_COMPLETE_COOKIE}=true; Max-Age=${INTRO_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  } catch (error) {}
}

function isKorribanPanel(panel) {
  if (!panel?.classList?.contains("is-focused")) return false;
  const title = panel.querySelector("h1")?.textContent || "";
  return /korriban|moraband/i.test(title);
}

export function GalaxyMapLaunchPortal({ placeId }) {
  const [panelState, setPanelState] = useState({ target: null, active: false });

  useEffect(() => {
    document.documentElement.classList.add("galaxy-map-active");
    writeIntroCompleteFlag();

    const syncPanel = () => {
      const panel = document.querySelector(".gm-panel");
      const active = isKorribanPanel(panel);
      setPanelState(previous => (
        previous.target === panel && previous.active === active
          ? previous
          : { target: panel, active }
      ));
    };

    syncPanel();

    const observer = new MutationObserver(syncPanel);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      characterData: true,
      subtree: true
    });

    window.addEventListener("pageshow", syncPanel);
    window.addEventListener("visibilitychange", syncPanel);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", syncPanel);
      window.removeEventListener("visibilitychange", syncPanel);
      document.documentElement.classList.remove("galaxy-map-active");
    };
  }, []);

  const href = `roblox://experiences/start?placeId=${placeId}`;

  return (
    <>
      {panelState.target && panelState.active ? createPortal(
        <a className="gm-connect" href={href} aria-label="Launch Korriban in Roblox">
          <span>Play</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </a>,
        panelState.target
      ) : null}
      <style>{STYLES}</style>
    </>
  );
}

const STYLES = `
  html.galaxy-map-active,
  html:has(.gm-root),
  body:has(.gm-root) {
    overscroll-behavior: none;
  }

  html:has(.gm-root) #nav-container {
    inset: 0 0 auto 0;
    position: fixed;
    z-index: 60;
  }

  html:has(.gm-root) .gm-root {
    z-index: 0 !important;
  }

  html:has(.gm-root) .gm-stage {
    --gm-flat-blur: .36px;
  }

  html:has(.gm-root) .gm-stage canvas {
    filter: blur(var(--gm-flat-blur)) saturate(1.02);
    transform: scale(1.001);
    transform-origin: center;
    touch-action: none;
  }

  html:has(.gm-root) .gm-topbar {
    top: clamp(72px, 7vw, 92px) !important;
  }

  html:has(.gm-root) .gm-loading {
    display: none !important;
  }

  .gm-panel.is-focused {
    padding-bottom: 72px !important;
  }

  .gm-connect {
    align-items: center;
    background:
      linear-gradient(90deg, rgba(255, 78, 54, .12), transparent 72%),
      color-mix(in srgb, var(--theme-accent, #ff3b4f) 9%, var(--theme-bg, #050204));
    border: 1px solid var(--theme-accent, #ff3b4f);
    bottom: 14px;
    box-shadow: 0 0 18px rgba(255, 78, 54, .24), inset 0 0 16px rgba(255, 255, 255, .025);
    clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
    color: var(--text, #ffffff);
    display: inline-flex;
    font-family: Orbitron, monospace;
    font-size: .76rem;
    font-weight: 700;
    gap: 9px;
    justify-content: center;
    letter-spacing: .12em;
    min-height: 42px;
    padding: 0 16px;
    position: absolute;
    right: 14px;
    text-decoration: none;
    text-transform: uppercase;
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .gm-connect:hover,
  .gm-connect:focus-visible {
    border-color: #ffb05f;
    box-shadow: 0 0 24px rgba(255, 176, 95, .3), inset 0 0 18px rgba(255, 255, 255, .035);
    outline: none;
    transform: translateY(-1px);
  }

  .gm-connect svg {
    fill: currentColor;
    height: 17px;
    width: 17px;
  }
`;
