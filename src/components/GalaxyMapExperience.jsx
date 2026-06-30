"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const WIDE_CAMERA = new THREE.Vector3(0, 17.4, 15.6);
const WIDE_TARGET = new THREE.Vector3(0.2, 0, -0.4);
const GALAXY_RADIUS = 11.4;
const GALAXY_BASE_ROTATION_Y = -0.32;
const GALAXY_SPIN_SPEED = 0.026;
const BODY_Y_OFFSET = -0.3;
const ROBLOX_LAUNCH_PREFIX = "roblox:" + "//experiences/start?placeId=";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rnd, min, max) {
  return min + rnd() * (max - min);
}

function visibleBodies(map) {
  return (map.bodies || []).filter(body => !body.hidden);
}

function visibleGalaxyMap(map) {
  return { ...map, bodies: visibleBodies(map) };
}

function bodyById(map, id) {
  return visibleBodies(map).find(body => body.id === id) || null;
}

function vec3(value, fallback = [0, 0, 0]) {
  const next = value || fallback;
  return new THREE.Vector3(next[0], next[1], next[2]);
}

function focusMapPosition(map) {
  return vec3(map.focus?.mapPosition || map.focus?.position);
}

function bodyLocalPosition(body, map) {
  if (map && Number.isFinite(body.localAngleDeg) && Number.isFinite(body.localDistance)) {
    const angle = THREE.MathUtils.degToRad(body.localAngleDeg);
    const origin = focusMapPosition(map);
    const y = (body.localPosition?.[1] ?? body.position?.[1] ?? body.mapPosition?.[1] ?? 0) + BODY_Y_OFFSET;
    return origin.add(new THREE.Vector3(Math.cos(angle) * body.localDistance, y - origin.y, Math.sin(angle) * body.localDistance));
  }
  return vec3(body.localPosition || body.position || body.mapPosition).add(new THREE.Vector3(0, BODY_Y_OFFSET, 0));
}

function colorWithAlpha(hex, alpha) {
  const color = new THREE.Color(hex || "#ffffff");
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function makeFallbackTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeTextureFromCanvas(draw, width = 1024, height = 512) {
  if (typeof document === "undefined") return makeFallbackTexture();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 12;
  texture.needsUpdate = true;
  return texture;
}

function makeGlowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,61,68,.42)") {
  return makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.22, "rgba(255,210,154,.76)");
    gradient.addColorStop(0.48, mid);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, 512, 512);
}

function makePlanetTextures(body) {
  const seed = body.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rnd = seededRandom(seed + 1447);
  const base = body.colors?.surface || "#777777";
  const dark = body.colors?.surfaceDark || "#111111";
  const accent = body.colors?.accent || "#ffffff";
  const map = makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.22, base);
    gradient.addColorStop(0.48, "#120405");
    gradient.addColorStop(0.68, base);
    gradient.addColorStop(0.86, dark);
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 420; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.035, 0.2);
      ctx.fillStyle = rnd() > 0.56 ? accent : dark;
      ctx.fillRect(0, rnd() * height, width, randRange(rnd, 1, body.id === "korriban" ? 20 : 11));
    }
    for (let i = 0; i < 340; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.04, 0.22);
      ctx.fillStyle = rnd() > 0.5 ? colorWithAlpha(accent, 1) : colorWithAlpha(dark, 1);
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, body.id === "korriban" ? 8 : 4, body.id === "korriban" ? 82 : 38), randRange(rnd, 2, body.id === "korriban" ? 24 : 13), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    if (body.id === "korriban") {
      for (let i = 0; i < 90; i += 1) {
        ctx.globalAlpha = randRange(rnd, 0.06, 0.18);
        ctx.strokeStyle = colorWithAlpha("#ffd0a0", 1);
        ctx.lineWidth = randRange(rnd, 0.8, 3.6);
        ctx.beginPath();
        const y = rnd() * height;
        ctx.moveTo(-40, y);
        for (let x = 0; x <= width + 80; x += 72) ctx.lineTo(x, y + Math.sin(x * 0.013 + rnd() * TAU) * randRange(rnd, 3, 18));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, 1536, 768);
  const bumpMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 680; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.03, 0.18);
      ctx.fillStyle = rnd() > 0.5 ? "#fff" : "#111";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 4, 64), randRange(rnd, 2, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  const cloudMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 300; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.014, 0.07);
      ctx.fillStyle = "#ffd9bf";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 18, 118), randRange(rnd, 3, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  return { map, bumpMap, cloudMap };
}

function makeEllipsePoints(radiusX, radiusZ, segments = 240, start = 0, end = TAU) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = start + ((end - start) * i) / segments;
    return new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ);
  });
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}

function makeGalaxyGeometry(count, seed, mode = "stars") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const isCore = mode === "core" || rnd() < 0.11;
    const arm = i % 5;
    const radius = isCore ? Math.pow(rnd(), 1.9) * 1.08 : Math.pow(rnd(), mode === "dust" ? 0.72 : 0.54) * (GALAXY_RADIUS - 1.08) + 1.08;
    const angle = isCore ? rnd() * TAU : (arm / 5) * TAU + radius * 0.7 + randRange(rnd, -0.22 - radius * 0.012, 0.22 + radius * 0.012);
    const spread = mode === "dust" ? 0.34 + radius * 0.035 : 0.08 + radius * 0.014;
    positions[i * 3] = Math.cos(angle) * radius + randRange(rnd, -spread, spread);
    positions[i * 3 + 1] = randRange(rnd, -0.08, 0.08) * (1 + radius * 0.08);
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.78 + randRange(rnd, -spread, spread);
    color.set(isCore ? (rnd() > 0.28 ? "#ffe2a0" : "#ff563f") : rnd() > 0.9 ? "#ff3b4f" : rnd() > 0.62 ? "#ffd58a" : rnd() > 0.32 ? "#f9fbff" : "#9feeff");
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust" ? randRange(rnd, 0.035, 0.12) : randRange(rnd, 0.014, 0.075) * (isCore ? 1.8 : 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1 }) {
  const geometry = useMemo(() => makeGalaxyGeometry(count, seed, mode), [count, seed, mode]);
  const materialRef = useRef(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <points geometry={geometry}>
      <shaderMaterial ref={materialRef} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{ uTime: { value: 0 }, uOpacity: { value: opacity }, uScale: { value: sizeScale } }} vertexShader={`attribute float aSize; uniform float uTime; uniform float uScale; varying vec3 vColor; void main(){ vColor=color; vec3 pos=position; pos.y+=sin(uTime*.24+position.x*1.8+position.z*1.3)*.018; vec4 mvPosition=modelViewMatrix*vec4(pos,1.0); gl_PointSize=aSize*uScale*(440.0/max(6.0,-mvPosition.z)); gl_Position=projectionMatrix*mvPosition; }`} fragmentShader={`uniform float uTime; uniform float uOpacity; varying vec3 vColor; void main(){ vec2 uv=gl_PointCoord*2.0-1.0; float d=length(uv); float core=1.0-smoothstep(0.0,.18,d); float glow=1.0-smoothstep(.12,1.0,d); float twinkle=.75+.25*sin(uTime*1.8+vColor.r*17.0); gl_FragColor=vec4(vColor,(core+glow*.62)*uOpacity*twinkle); }`} />
    </points>
  );
}

function GalacticCore() {
  const glow = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(255,83,45,.58)"), []);
  useEffect(() => () => glow.dispose(), [glow]);
  return <group><sprite position={[0, .06, 0]} scale={[4.2, 4.2, 1]}><spriteMaterial map={glow} color="#ffcf91" transparent opacity={.72} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite><mesh position={[0, .05, 0]}><sphereGeometry args={[.34, 48, 24]} /><meshBasicMaterial color="#ffe1a0" transparent opacity={.94} blending={THREE.AdditiveBlending} /></mesh><Sparkles count={90} scale={[2.4, .9, 2.4]} size={3.6} speed={.35} color="#ffd38a" opacity={.84} /></group>;
}

function PlanetBody({ body, map, selected, hovered, onSelect, onHover, focusMode }) {
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const haloTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", colorWithAlpha(body.colors?.glow || "#ff3b4f", .52)), [body]);
  const textures = useMemo(() => makePlanetTextures(body), [body]);
  const localPosition = useMemo(() => bodyLocalPosition(body, map), [body, map]);
  const visualRadius = body.radius * .82;
  useEffect(() => () => { haloTexture.dispose(); textures.map.dispose(); textures.bumpMap.dispose(); textures.cloudMap.dispose(); }, [haloTexture, textures]);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const targetScale = focusMode ? (selected ? 2.25 : hovered ? 1.52 : 1.14) : .78;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), .09);
    if (planetRef.current) {
      planetRef.current.rotation.y += .0038 + body.radius * .004;
      planetRef.current.rotation.x = Math.sin(clock.elapsedTime * .23 + body.radius * 13) * .07;
    }
    if (cloudsRef.current) cloudsRef.current.rotation.y -= .0018 + body.radius * .004;
    if (scanRef.current) {
      scanRef.current.rotation.z += selected ? .026 : .012;
      scanRef.current.material.opacity = selected ? .62 : hovered ? .42 : focusMode ? .18 : .09;
    }
  });
  const over = event => { event.stopPropagation(); if (body.selectable) onHover(body.id); };
  const out = event => { event.stopPropagation(); if (body.selectable) onHover(null); };
  const click = event => { event.stopPropagation(); if (body.selectable) onSelect(body.id); };
  return <group ref={groupRef} position={localPosition.toArray()} userData={{ bodyId: body.id }}><mesh ref={planetRef} onPointerOver={over} onPointerOut={out} onClick={click}><sphereGeometry args={[visualRadius, 96, 48]} /><meshStandardMaterial map={textures.map} bumpMap={textures.bumpMap} bumpScale={body.id === "korriban" ? .065 : .035} roughness={.84} metalness={.02} emissive={body.colors?.surfaceDark || "#000"} emissiveIntensity={selected ? .2 : .06} /></mesh><mesh ref={cloudsRef} scale={1.018}><sphereGeometry args={[visualRadius * 1.018, 96, 48]} /><meshStandardMaterial map={textures.cloudMap} transparent opacity={.18} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh><mesh scale={1.18}><sphereGeometry args={[visualRadius * 1.16, 96, 36]} /><meshBasicMaterial color={body.colors?.glow || "#fff"} transparent opacity={selected ? .22 : hovered ? .15 : .07} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} /></mesh><sprite scale={[visualRadius * (selected ? 11 : focusMode ? 7 : 4.8), visualRadius * (selected ? 11 : focusMode ? 7 : 4.8), 1]}><spriteMaterial map={haloTexture} color={body.colors?.glow || "#fff"} transparent opacity={selected ? .38 : hovered ? .25 : .11} blending={THREE.AdditiveBlending} depthWrite={false} /></sprite><line ref={scanRef} rotation={[Math.PI / 2, 0, 0]}><LineGeometry points={makeEllipsePoints(visualRadius * 2.45, visualRadius * 2.45, 150)} /><lineBasicMaterial color={selected ? "#ff9a3d" : body.colors?.glow || "#ff3b4f"} transparent opacity={.24} blending={THREE.AdditiveBlending} depthWrite={false} /></line></group>;
}

function LocalSystem({ map, selectedId, hoveredId, onSelect, onHover }) {
  const focusMode = Boolean(selectedId);
  return <group>{visibleBodies(map).map(body => <PlanetBody key={body.id} body={body} map={map} selected={selectedId === body.id} hovered={hoveredId === body.id} onSelect={onSelect} onHover={onHover} focusMode={focusMode} />)}</group>;
}

function CameraRig({ map, selectedId, zoomOutSignal, controlsRef, selectedPositionRef }) {
  const { camera } = useThree();
  const selectedIdRef = useRef(selectedId);
  const zoomSignalRef = useRef(zoomOutSignal);
  const targetCamera = useRef(WIDE_CAMERA.clone());
  const targetControl = useRef(WIDE_TARGET.clone());
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { if (zoomSignalRef.current === zoomOutSignal) return; zoomSignalRef.current = zoomOutSignal; targetCamera.current.copy(WIDE_CAMERA); targetControl.current.copy(WIDE_TARGET); }, [zoomOutSignal]);
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const selectedPosition = selectedIdRef.current ? selectedPositionRef.current : null;
    if (selectedPosition) {
      const outward = selectedPosition.clone().sub(WIDE_TARGET).normalize().multiplyScalar(1.05);
      targetCamera.current.copy(selectedPosition).add(outward).add(new THREE.Vector3(1.15, .92, 1.72));
      targetControl.current.copy(selectedPosition);
      controls.autoRotate = false;
    } else {
      controls.autoRotate = true;
    }
    camera.position.lerp(targetCamera.current, selectedPosition ? .055 : .025);
    controls.target.lerp(targetControl.current, selectedPosition ? .07 : .035);
    controls.update();
  });
  return null;
}

function GalaxyScene({ map, selectedId, hoveredId, onSelect, onHover, zoomOutSignal, quality }) {
  const controlsRef = useRef(null);
  const galaxyRef = useRef(null);
  const localRef = useRef(null);
  const selectedPositionRef = useRef(null);
  const focus = useMemo(() => focusMapPosition(map), [map]);
  const selectedBody = selectedId ? bodyById(map, selectedId) : null;
  useFrame(({ clock }) => {
    const rotationY = GALAXY_BASE_ROTATION_Y + clock.elapsedTime * GALAXY_SPIN_SPEED;
    if (galaxyRef.current) galaxyRef.current.rotation.y = rotationY;
    if (localRef.current) localRef.current.rotation.y = rotationY;
  });
  useFrame(() => {
    if (!selectedId || !localRef.current) { selectedPositionRef.current = null; return; }
    const body = bodyById(map, selectedId);
    if (!body) return;
    const next = selectedPositionRef.current || new THREE.Vector3();
    next.copy(bodyLocalPosition(body, map));
    localRef.current.updateMatrixWorld();
    next.applyMatrix4(localRef.current.matrixWorld);
    selectedPositionRef.current = next;
  });
  return <><color attach="background" args={["#050204"]} /><fogExp2 attach="fog" args={["#090204", .0035]} /><ambientLight intensity={.2} color="#4d1b20" /><directionalLight position={[4.8, 8.2, 5.4]} intensity={3.4} color="#ffd8a8" /><pointLight position={[0, 1.4, 0]} intensity={92} distance={19} color="#ffb168" /><pointLight position={focus.clone().add(new THREE.Vector3(0, 1.2, .8)).toArray()} intensity={72} distance={12} color="#ff3b4f" /><Stars radius={82} depth={42} count={quality === "high" ? 7200 : 3400} factor={5.6} saturation={.62} fade speed={.26} /><Sparkles count={quality === "high" ? 340 : 150} scale={[24, 5.4, 18]} size={1.55} speed={.44} color="#ff9a3d" opacity={.72} /><group ref={galaxyRef} rotation={[-.045, GALAXY_BASE_ROTATION_Y, .02]}><GalaxyParticles mode="stars" count={quality === "high" ? 24500 : 12800} seed={4321} opacity={.88} sizeScale={.92} /><GalaxyParticles mode="dust" count={quality === "high" ? 3600 : 1800} seed={8827} opacity={.055} sizeScale={1.05} /><GalacticCore /></group><group ref={localRef} rotation={[0, GALAXY_BASE_ROTATION_Y, 0]}><LocalSystem map={map} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} /></group><CameraRig map={map} selectedId={selectedId} zoomOutSignal={zoomOutSignal} controlsRef={controlsRef} selectedPositionRef={selectedPositionRef} /><OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={.07} enablePan={false} minDistance={selectedBody ? 1.25 : 4.2} maxDistance={selectedBody ? 9.5 : 34} autoRotate={!selectedBody} autoRotateSpeed={.22} target={WIDE_TARGET} /><EffectComposer multisampling={0}><Bloom intensity={quality === "high" ? .72 : .46} luminanceThreshold={.24} luminanceSmoothing={.22} /><ChromaticAberration offset={quality === "high" ? [.0008, .0004] : [.00035, .00018]} /><Noise opacity={.032} /><Vignette eskil={false} offset={.2} darkness={.58} /></EffectComposer></>;
}

export function GalaxyMapExperience({ map }) {
  const renderedMap = useMemo(() => visibleGalaxyMap(map), [map]);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [zoomOutSignal, setZoomOutSignal] = useState(0);
  const [quality, setQuality] = useState("high");
  const selectableBodies = useMemo(() => visibleBodies(renderedMap).filter(body => body.selectable), [renderedMap]);
  const selectedBody = bodyById(renderedMap, selectedId);
  const panelBody = selectedBody || renderedMap.focus;
  const launchHref = selectedBody?.robloxPlaceId ? `${ROBLOX_LAUNCH_PREFIX}${selectedBody.robloxPlaceId}` : "";
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const compact = window.matchMedia?.("(max-width: 760px)")?.matches;
    const cores = window.navigator?.hardwareConcurrency || 8;
    setQuality(reduced || compact || cores <= 4 ? "balanced" : "high");
  }, []);
  const selectBody = useCallback(id => { const body = bodyById(renderedMap, id); if (body?.selectable) setSelectedId(id); }, [renderedMap]);
  const zoomOut = useCallback(() => { setSelectedId(null); setHoveredId(null); setZoomOutSignal(value => value + 1); }, []);
  return <section className={`gm-root${ready ? " gm-root--ready" : ""}`} aria-label="Hidden Archives Galaxy Map"><div className="gm-stage" aria-hidden="true"><Canvas camera={{ position: WIDE_CAMERA.toArray(), fov: 45, near: .04, far: 160 }} dpr={quality === "high" ? [1, 2] : [1, 1.35]} gl={{ antialias: true, powerPreference: "high-performance", stencil: false }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = .9; gl.outputColorSpace = THREE.SRGBColorSpace; setReady(true); }}><GalaxyScene map={renderedMap} selectedId={selectedId} hoveredId={hoveredId} onSelect={selectBody} onHover={setHoveredId} zoomOutSignal={zoomOutSignal} quality={quality} /></Canvas></div><div className="gm-scan" aria-hidden="true" /><div className="gm-vignette" aria-hidden="true" /><header className="gm-topbar"><button className="gm-back" type="button" aria-label="Zoom out to galaxy view" onClick={zoomOut}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" /><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /></svg></button><div className="gm-lockup"><span>ARCHIVES / DIRECT NODE</span><strong>GALAXY MAP</strong></div></header><aside className={`gm-panel${selectedId ? " is-focused" : ""}`} aria-live="polite"><div className="gm-panel-title">Galaxy Map</div><div className="gm-kicker">{panelBody.region}</div><h1>{panelBody.name}</h1><div className="gm-kind">{panelBody.kind || panelBody.name}</div><p>{panelBody.summary}</p>{launchHref ? <a className="gm-primary" href={launchHref}>Connect</a> : null}<div className="gm-selectors" aria-label="Galaxy bodies">{selectableBodies.map(body => <button className={`gm-selector${selectedId === body.id ? " is-active" : ""}${hoveredId === body.id ? " is-hovered" : ""}`} type="button" aria-pressed={selectedId === body.id} key={body.id} onClick={() => selectBody(body.id)} onPointerEnter={() => setHoveredId(body.id)} onPointerLeave={() => setHoveredId(null)}><span className="gm-selector-dot" style={{ "--body-color": body.colors?.glow || "#ffffff" }} /><span>{body.shortName || body.name}</span></button>)}</div></aside>{!ready ? <div className="gm-loading"><span /><strong>CALIBRATING ARCHIVE MAP</strong></div> : null}<style>{STYLES}</style></section>;
}

const STYLES = `html:has(.gm-root),body:has(.gm-root){background:var(--theme-bg,#050204);overflow:hidden}.gm-root{--gm-panel:color-mix(in srgb,var(--theme-panel,rgba(22,7,12,.84)) 76%,transparent);background:radial-gradient(ellipse 56% 46% at 50% 46%,var(--theme-body-glow-a,rgba(160,0,22,.08)),transparent 66%),linear-gradient(180deg,var(--theme-bg,#050204) 0%,#050204 58%,#000 100%);color:var(--text,#fff);font-family:'Share Tech Mono',monospace;height:100dvh;inset:0;isolation:isolate;overflow:hidden;position:fixed;width:100vw;z-index:0}.gm-root *,.gm-root *::before,.gm-root *::after{box-sizing:border-box;letter-spacing:0}.gm-stage,.gm-stage canvas,.gm-scan,.gm-vignette{inset:0;position:absolute}.gm-stage{z-index:1}.gm-stage canvas{cursor:grab;display:block;height:100%!important;outline:none;width:100%!important}.gm-stage canvas:active{cursor:grabbing}.gm-scan{background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,var(--scanline,rgba(255,210,210,.018)) 2px,var(--scanline,rgba(255,210,210,.018)) 4px),linear-gradient(90deg,var(--theme-wash,rgba(192,0,26,.025)),transparent 18%,transparent 82%,var(--theme-wash,rgba(192,0,26,.025)));mix-blend-mode:screen;opacity:.68;pointer-events:none;z-index:3}.gm-vignette{background:radial-gradient(circle at 52% 48%,transparent 0%,transparent 54%,rgba(0,0,0,.76) 100%),linear-gradient(90deg,rgba(0,0,0,.72),transparent 24%,transparent 76%,rgba(0,0,0,.78));pointer-events:none;z-index:4}.gm-topbar{align-items:center;display:flex;gap:12px;left:clamp(14px,2.2vw,28px);max-width:calc(100vw - 44px);position:absolute;top:clamp(14px,2.2vw,28px);z-index:8}.gm-back{align-items:center;appearance:none;background:linear-gradient(90deg,var(--theme-wash,rgba(192,0,26,.025)),transparent 62%),var(--gm-panel);border:1px solid var(--theme-accent-dim,#7a1a28);box-shadow:0 0 28px var(--theme-accent-glow,rgba(255,59,79,.26)),inset 0 0 24px rgba(255,255,255,.025);clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));color:var(--theme-accent,#ff3b4f);cursor:crosshair;display:inline-flex;height:42px;justify-content:center;padding:0;width:42px}.gm-back svg{fill:none;height:22px;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8;width:22px}.gm-lockup,.gm-panel,.gm-loading{background:linear-gradient(135deg,var(--theme-wash,rgba(192,0,26,.025)),transparent 62%),var(--gm-panel);border:1px solid var(--theme-accent-dim,#7a1a28);box-shadow:0 0 30px var(--theme-accent-glow,rgba(255,59,79,.18)),inset 0 0 34px rgba(255,255,255,.02);clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,9px 100%,0 calc(100% - 9px))}.gm-lockup{display:grid;gap:3px;min-width:min(310px,calc(100vw - 74px));padding:10px 14px}.gm-lockup span,.gm-kicker,.gm-kind{color:var(--text-dim,#fff);font-size:.66rem;text-transform:uppercase}.gm-lockup strong,.gm-panel-title{color:var(--theme-accent,#ff3b4f);font-family:Orbitron,monospace;font-size:.78rem;font-weight:700;text-shadow:0 0 12px var(--theme-accent-glow,rgba(255,59,79,.32));text-transform:uppercase}.gm-panel{bottom:clamp(18px,3vw,32px);max-width:330px;padding:15px;position:absolute;right:clamp(18px,3vw,32px);width:calc(100vw - 36px);z-index:8}.gm-panel.is-focused{max-width:370px}.gm-panel-title{border-bottom:1px solid var(--theme-accent-dim,#7a1a28);margin-bottom:11px;padding-bottom:9px}.gm-panel h1{color:var(--text,#fff);font-family:Cinzel,serif;font-size:1.42rem;line-height:1.1;margin:7px 0 6px;text-shadow:0 0 22px var(--theme-accent-glow,rgba(255,59,79,.24));text-transform:uppercase}.gm-panel p{color:var(--text-dim,#fff);font-size:.82rem;line-height:1.5;margin:12px 0 0}.gm-primary{align-items:center;background:linear-gradient(90deg,color-mix(in srgb,var(--theme-accent,#ff3b4f) 22%,transparent),transparent 84%),color-mix(in srgb,var(--theme-accent,#ff3b4f) 12%,#050204);border:1px solid var(--theme-accent,#ff3b4f);box-shadow:0 0 22px var(--theme-accent-glow,rgba(255,59,79,.32));color:var(--text,#fff);cursor:crosshair;display:flex;font-family:Orbitron,monospace;font-size:.7rem;justify-content:center;margin-top:14px;padding:10px 12px;text-decoration:none;text-transform:uppercase}.gm-selectors{display:grid;gap:7px;margin-top:14px}.gm-selector{align-items:center;appearance:none;background:color-mix(in srgb,var(--theme-bg,#050204) 58%,transparent);border:1px solid var(--theme-accent-dim,#7a1a28);color:var(--text-dim,#fff);cursor:crosshair;display:flex;font:inherit;font-size:.78rem;gap:10px;min-height:36px;padding:8px 10px;text-align:left;text-transform:uppercase;width:100%}.gm-selector-dot{background:var(--body-color);border-radius:999px;box-shadow:0 0 16px var(--body-color);flex:0 0 auto;height:9px;width:9px}.gm-selector:hover,.gm-selector:focus-visible,.gm-selector.is-hovered,.gm-selector.is-active{border-color:var(--theme-accent,#ff3b4f);box-shadow:0 0 22px var(--theme-accent-glow,rgba(255,59,79,.22));color:var(--text,#fff);outline:none}.gm-loading{align-items:center;color:var(--text,#fff);display:flex;gap:12px;left:50%;padding:14px 17px;position:absolute;top:50%;transform:translate(-50%,-50%);z-index:12}.gm-loading span{animation:gm-spin 1.1s linear infinite;border:2px solid var(--theme-accent-dim,#7a1a28);border-radius:999px;border-top-color:var(--theme-accent,#ff3b4f);height:18px;width:18px}.gm-loading strong{font-family:Orbitron,monospace;font-size:.76rem;text-transform:uppercase}@keyframes gm-spin{to{transform:rotate(360deg)}}@media(max-width:760px){.gm-topbar{left:14px;right:14px;top:14px}.gm-lockup{flex:1;min-width:0;width:100%}.gm-panel{bottom:14px;left:14px;max-width:none;padding:14px;right:14px;width:auto}.gm-panel h1{font-size:1.14rem;margin:6px 0}.gm-panel p{font-size:.78rem;line-height:1.42;margin-top:9px}.gm-selectors{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:11px}.gm-selector{font-size:.7rem;min-height:34px;padding:8px}}`;
