"use client";

import { useEffect, useRef } from "react";

export function SpotifyEmbed({ uri, width = "100%", height = "352" }) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    // Keep a reference to the element we will inject into
    const element = containerRef.current;
    if (!element) return;

    // We need to create a child div because the Spotify API replaces the element we pass it
    const embedTarget = document.createElement('div');
    element.appendChild(embedTarget);

    const initSpotify = (IFrameAPI) => {
      if (!embedTarget || controllerRef.current) return;
      
      IFrameAPI.createController(embedTarget, {
        uri: uri,
        width: width,
        height: height,
        theme: 'dark'
      }, (controller) => {
        controllerRef.current = controller;
        controller.addListener('playback_update', e => {
          if (e.data && typeof e.data.isPaused === 'boolean') {
            if (e.data.isPaused) {
              window.dispatchEvent(new CustomEvent('mandate-spotify-pause'));
            } else {
              window.dispatchEvent(new CustomEvent('mandate-spotify-play'));
            }
          }
        });
      });
    };

    if (window.SpotifyIframeApi) {
      initSpotify(window.SpotifyIframeApi);
    } else {
      const prevCallback = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = (IFrameAPI) => {
        window.SpotifyIframeApi = IFrameAPI;
        if (prevCallback) prevCallback(IFrameAPI);
        initSpotify(IFrameAPI);
      };

      if (!document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]')) {
        const script = document.createElement("script");
        script.src = "https://open.spotify.com/embed/iframe-api/v1";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      } else if (embedTarget.parentNode) {
        embedTarget.parentNode.removeChild(embedTarget);
      }
    };
  }, [uri, width, height]);

  return <div ref={containerRef} style={{ width: width, height: height, borderRadius: "12px", overflow: "hidden" }}></div>;
}
