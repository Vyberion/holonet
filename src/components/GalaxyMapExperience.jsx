"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const WIDE_CAMERA = new THREE.Vector3(0, 17.4, 15.6);
const WIDE_TARGET = new THREE.Vector3(0.2, 0, -0.4);
const GALAXY_RADIUS = 11.4;
const CORE_RADIUS = 1.08;

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

function bodyById(map, id) {
  return (map.bodies || []).find(body => body.id === id) || null;
}

function vec3(value, fallback = [0, 0, 0]) {
  const next = value || fallback;
  return new THREE.Vector3(next[0], next[1], next[2]);
}

function bodyLocalPosition(body) {
  return vec3(body.localPosition || body.position || body.mapPosition);
}

function focusMapPosition(map) {
  return vec3(map.focus?.mapPosition || map.focus?.position);
}

function colorWithAlpha(hex, alpha) {
  const color = new THREE.Color(hex || "#ffffff");
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function makeTextureFromCanvas(draw, width = 1024, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeGlowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,61,68,.42)") {
  return makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.22, "rgba(255, 210, 154, .76)");
    gradient.addColorStop(0.48, mid);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
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
    gradient.addColorStop(0.26, base);
    gradient.addColorStop(0.54, dark);
    gradient.addColorStop(0.78, base);
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 300; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.045, 0.2);
      ctx.fillStyle = rnd() > 0.56 ? accent : dark;
      ctx.fillRect(0, rnd() * height, width, randRange(rnd, 1, body.id === "korriban" ? 22 : 11));
    }

    for (let i = 0; i < 240; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.04, 0.22);
      ctx.fillStyle = rnd() > 0.5 ? colorWithAlpha(accent, 1) : colorWithAlpha(dark, 1);
      ctx.beginPath();
      ctx.ellipse(
        rnd() * width,
        rnd() * height,
        randRange(rnd, body.id === "korriban" ? 8 : 4, body.id === "korriban" ? 82 : 38),
        randRange(rnd, 2, body.id === "korriban" ? 24 : 13),
        rnd() * TAU,
        0,
        TAU
      );
      ctx.fill();
    }

    if (body.id === "korriban") {
      for (let i = 0; i < 70; i += 1) {
        ctx.globalAlpha = randRange(rnd, 0.07, 0.18);
        ctx.strokeStyle = colorWithAlpha("#ffd0a0", 1);
        ctx.lineWidth = randRange(rnd, 1, 4);
        ctx.beginPath();
        const y = rnd() * height;
        ctx.moveTo(-40, y);
        for (let x = 0; x <= width + 80; x += 80) {
          ctx.lineTo(x, y + Math.sin(x * 0.015 + rnd() * TAU) * randRange(rnd, 3, 18));
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  });

  const bumpMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 520; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.035, 0.18);
      ctx.fillStyle = rnd() > 0.5 ? "#fff" : "#111";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 4, 64), randRange(rnd, 2, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  const cloudMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 260; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.016, body.id === "khar-shian" ? 0.12 : 0.065);
      ctx.fillStyle = body.id === "khar-shian" ? "#e5fbff" : "#ffd9bf";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 18, 110), randRange(rnd, 3, 20), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return { map, bumpMap, cloudMap };
}

function makeLineGeometry(points) {
  return new THREE.BufferGeometry().setFromPoints(points);
}

function makeEllipsePoints(radiusX, radiusZ, segments = 240, start = 0, end = TAU) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = start + ((end - start) * i) / segments;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
  }
  return points;
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => makeLineGeometry(points), [points]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive attach="geometry" object={geometry} />;
}

function TubeGeometry({ points, radius = 0.026 }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, Math.max(64, points.length * 2), radius, 8, false);
  }, [points, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <primitive attach="geometry" object={geometry} />;
}

function makeSpiralArmPoints(arm, radiusStart = 1.1, radiusEnd = GALAXY_RADIUS, segments = 96, offset = 0) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const radius = radiusStart + (radiusEnd - radiusStart) * t;
    const angle = (arm / 5) * TAU + radius * 0.7 + offset;
    const widthWave = Math.sin(t * Math.PI) * 0.18;
    points.push(new THREE.Vector3(
      Math.cos(angle) * (radius + widthWave),
      0.032 + Math.sin(t * TAU + arm) * 0.018,
      Math.sin(angle) * (radius + widthWave) * 0.78
    ));
  }
  return points;
}

function SpiralArmRibbons() {
  const arms = useMemo(() => {
    const rows = [];
    for (let arm = 0; arm < 5; arm += 1) {
      rows.push({
        key: `glow-${arm}`,
        points: makeSpiralArmPoints(arm, 1.16, 10.95, 110, 0),
        color: arm % 2 ? "#ff3b4f" : "#ffd08c",
        opacity: arm % 2 ? 0.16 : 0.12,
        radius: arm % 2 ? 0.026 : 0.022
      });
      rows.push({
        key: `dust-${arm}`,
        points: makeSpiralArmPoints(arm, 1.6, 10.55, 92, -0.18),
        color: "#7c1020",
        opacity: 0.11,
        radius: 0.018
      });
    }
    return rows;
  }, []);

  return (
    <group>
      {arms.map(arm => (
        <mesh key={arm.key}>
          <TubeGeometry points={arm.points} radius={arm.radius} />
          <meshBasicMaterial color={arm.color} transparent opacity={arm.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function makeSpiralGalaxyGeometry(count, seed, mode = "stars") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const isCore = mode === "core" || rnd() < 0.11;
    const arm = i % 5;
    const radius = isCore
      ? Math.pow(rnd(), 1.9) * CORE_RADIUS
      : Math.pow(rnd(), mode === "dust" ? 0.72 : 0.54) * (GALAXY_RADIUS - CORE_RADIUS) + CORE_RADIUS;
    const sweep = radius * 0.7;
    const armAngle = (arm / 5) * TAU + sweep;
    const jitter = isCore ? randRange(rnd, -TAU, TAU) : randRange(rnd, -0.22 - radius * 0.012, 0.22 + radius * 0.012);
    const angle = isCore ? rnd() * TAU : armAngle + jitter;
    const flatten = 0.78;
    const spread = mode === "dust" ? 0.34 + radius * 0.035 : 0.08 + radius * 0.014;
    const x = Math.cos(angle) * radius + randRange(rnd, -spread, spread);
    const z = Math.sin(angle) * radius * flatten + randRange(rnd, -spread, spread);
    const y = randRange(rnd, -0.08, 0.08) * (1 + radius * 0.08);
    const rimFade = Math.min(1, radius / GALAXY_RADIUS);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const palette = isCore
      ? (rnd() > 0.28 ? "#ffe2a0" : "#ff563f")
      : rnd() > 0.9 ? "#ff3b4f" : rnd() > 0.62 ? "#ffd58a" : rnd() > 0.32 ? "#f9fbff" : "#9feeff";
    color.set(palette);
    if (!isCore && rnd() > 0.88) color.lerp(new THREE.Color("#526cff"), 0.22);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust"
      ? randRange(rnd, 0.035, 0.12) * (1.2 - rimFade * 0.22)
      : randRange(rnd, 0.014, 0.075) * (isCore ? 1.8 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1 }) {
  const geometry = useMemo(() => makeSpiralGalaxyGeometry(count, seed, mode), [count, seed, mode]);
  const materialRef = useRef(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: opacity },
          uScale: { value: sizeScale }
        }}
        vertexShader={`
          attribute float aSize;
          uniform float uTime;
          uniform float uScale;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec3 pos = position;
            float breath = sin(uTime * 0.24 + position.x * 1.8 + position.z * 1.3) * 0.018;
            pos.y += breath;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * uScale * (440.0 / max(6.0, -mvPosition.z));
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uOpacity;
          varying vec3 vColor;
          void main() {
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            float d = length(uv);
            float core = 1.0 - smoothstep(0.0, 0.18, d);
            float glow = 1.0 - smoothstep(0.12, 1.0, d);
            float twinkle = 0.75 + 0.25 * sin(uTime * 1.8 + vColor.r * 17.0);
            gl_FragColor = vec4(vColor, (core + glow * 0.62) * uOpacity * twinkle);
          }
        `}
      />
    </points>
  );
}

function HyperspaceStreaks({ count = 54 }) {
  const streaks = useMemo(() => {
    const rnd = seededRandom(7091);
    return Array.from({ length: count }, (_, index) => {
      const angle = randRange(rnd, 0, TAU);
      const radius = randRange(rnd, 2.2, GALAXY_RADIUS * 1.06);
      const center = new THREE.Vector3(Math.cos(angle) * radius, randRange(rnd, 0.08, 0.32), Math.sin(angle) * radius * 0.78);
      const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).normalize();
      const length = randRange(rnd, 0.34, 1.15);
      return {
        key: index,
        phase: randRange(rnd, 0, TAU),
        speed: randRange(rnd, 1.4, 3.2),
        points: [
          center.clone().add(tangent.clone().multiplyScalar(-length * 0.5)),
          center,
          center.clone().add(tangent.clone().multiplyScalar(length * 0.5))
        ],
        color: rnd() > 0.62 ? "#76e0ef" : rnd() > 0.34 ? "#ffd08c" : "#ff3b4f",
        opacity: randRange(rnd, 0.24, 0.58)
      };
    });
  }, [count]);
  const groupRef = useRef(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, index) => {
      const streak = streaks[index];
      child.material.opacity = streak.opacity * (0.45 + Math.sin(clock.elapsedTime * streak.speed + streak.phase) * 0.35 + 0.35);
    });
  });

  return (
    <group ref={groupRef}>
      {streaks.map(streak => (
        <line key={streak.key}>
          <LineGeometry points={streak.points} />
          <lineBasicMaterial color={streak.color} transparent opacity={streak.opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
    </group>
  );
}

function GalacticCore() {
  const glow = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(255,83,45,.58)"), []);
  useEffect(() => () => glow.dispose(), [glow]);

  return (
    <group>
      <sprite position={[0, 0.06, 0]} scale={[4.2, 4.2, 1]}>
        <spriteMaterial map={glow} color="#ffcf91" transparent opacity={0.72} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.34, 48, 24]} />
        <meshBasicMaterial color="#ffe1a0" transparent opacity={0.94} blending={THREE.AdditiveBlending} />
      </mesh>
      <Sparkles count={90} scale={[2.4, 0.9, 2.4]} size={3.6} speed={0.35} color="#ffd38a" opacity={0.84} />
    </group>
  );
}

function SectorGrid() {
  const radialLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * TAU;
      lines.push([
        new THREE.Vector3(Math.cos(angle) * CORE_RADIUS, 0.018, Math.sin(angle) * CORE_RADIUS * 0.78),
        new THREE.Vector3(Math.cos(angle) * GALAXY_RADIUS, 0.018, Math.sin(angle) * GALAXY_RADIUS * 0.78)
      ]);
    }
    return lines;
  }, []);

  return (
    <group>
      {[2.4, 4.5, 6.8, 9.2, 11.25].map((radius, index) => (
        <line key={radius} position={[0, 0.02 + index * 0.002, 0]}>
          <LineGeometry points={makeEllipsePoints(radius, radius * 0.78, 260)} />
          <lineBasicMaterial color={index === 4 ? "#ff3b4f" : "#7a1a28"} transparent opacity={index === 4 ? 0.26 : 0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
      {radialLines.map((points, index) => (
        <line key={index}>
          <LineGeometry points={points} />
          <lineBasicMaterial color={index % 3 === 0 ? "#ff3b4f" : "#5f1b25"} transparent opacity={index % 3 === 0 ? 0.16 : 0.075} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
    </group>
  );
}

function PlanetBody({ body, selected, hovered, onSelect, onHover, focusMode }) {
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const haloTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", colorWithAlpha(body.colors?.glow || "#ff3b4f", 0.52)), [body]);
  const textures = useMemo(() => makePlanetTextures(body), [body]);
  const localPosition = useMemo(() => bodyLocalPosition(body), [body]);

  useEffect(() => () => {
    haloTexture.dispose();
    textures.map.dispose();
    textures.bumpMap.dispose();
    textures.cloudMap.dispose();
  }, [haloTexture, textures]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!groupRef.current) return;
    const overviewScale = body.selectable ? 0.78 : 0.58;
    const targetScale = focusMode ? (selected ? 2.25 : hovered ? 1.52 : 1.14) : overviewScale;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.09);
    if (planetRef.current) {
      planetRef.current.rotation.y += 0.0038 + body.radius * 0.004;
      planetRef.current.rotation.x = Math.sin(t * 0.23 + body.radius * 13) * 0.07;
    }
    if (cloudsRef.current) cloudsRef.current.rotation.y -= 0.0018 + body.radius * 0.004;
    if (scanRef.current) {
      const pulse = 0.5 + Math.sin(t * 3.2) * 0.5;
      scanRef.current.rotation.z += selected ? 0.026 : 0.012;
      scanRef.current.material.opacity = (selected ? 0.62 : hovered ? 0.42 : focusMode ? 0.18 : 0.09) + pulse * (selected ? 0.2 : 0.08);
    }
  });

  const handlePointerOver = event => {
    event.stopPropagation();
    if (body.selectable) onHover(body.id);
  };
  const handlePointerOut = event => {
    event.stopPropagation();
    if (body.selectable) onHover(null);
  };
  const handleClick = event => {
    event.stopPropagation();
    if (body.selectable) onSelect(body.id);
  };

  return (
    <group ref={groupRef} position={localPosition.toArray()} userData={{ bodyId: body.id }}>
      <mesh ref={planetRef} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
        <sphereGeometry args={[body.radius, 96, 48]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={body.id === "korriban" ? 0.065 : 0.035}
          roughness={body.id === "khar-shian" ? 0.48 : 0.84}
          metalness={body.id === "khar-shian" ? 0.08 : 0.02}
          emissive={body.colors?.surfaceDark || "#000000"}
          emissiveIntensity={selected ? 0.2 : 0.06}
        />
      </mesh>
      <mesh ref={cloudsRef} scale={1.018}>
        <sphereGeometry args={[body.radius * 1.018, 96, 48]} />
        <meshStandardMaterial map={textures.cloudMap} transparent opacity={body.id === "khar-shian" ? 0.34 : 0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh scale={1.18}>
        <sphereGeometry args={[body.radius * 1.16, 96, 36]} />
        <meshBasicMaterial color={body.colors?.glow || "#ffffff"} transparent opacity={body.selectable ? (selected ? 0.22 : hovered ? 0.15 : 0.07) : 0.035} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
      </mesh>
      <sprite scale={[body.radius * (selected ? 11 : focusMode ? 7 : 4.8), body.radius * (selected ? 11 : focusMode ? 7 : 4.8), 1]}>
        <spriteMaterial map={haloTexture} color={body.colors?.glow || "#ffffff"} transparent opacity={body.selectable ? (selected ? 0.38 : hovered ? 0.25 : 0.11) : 0.04} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <line ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <LineGeometry points={makeEllipsePoints(body.radius * 2.45, body.radius * 2.45, 150)} />
        <lineBasicMaterial color={selected ? "#ff9a3d" : body.colors?.glow || "#ff3b4f"} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      {body.selectable && !focusMode ? (
        <Billboard position={[0, body.radius * (focusMode ? 3.15 : 2.7), 0]}>
          <Html center distanceFactor={focusMode ? 34 : 18} transform occlude={false}>
            <button
              type="button"
              className={`gm-world-label${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}${focusMode ? " is-focus" : ""}${focusMode && !selected && !hovered ? " is-muted" : ""}`}
              onClick={() => onSelect(body.id)}
              onPointerEnter={() => onHover(body.id)}
              onPointerLeave={() => onHover(null)}
            >
              {body.shortName || body.name}
            </button>
          </Html>
        </Billboard>
      ) : null}
    </group>
  );
}

function OrbitTrace({ body, parent, focusMode }) {
  const lineRef = useRef(null);
  const parentVector = useMemo(() => bodyLocalPosition(parent), [parent]);
  const childVector = useMemo(() => bodyLocalPosition(body), [body]);
  const distance = parentVector.distanceTo(childVector);
  const points = useMemo(() => makeEllipsePoints(distance, distance * 0.52, 220), [distance]);

  useFrame(() => {
    if (lineRef.current) lineRef.current.rotation.y += focusMode ? 0.004 : 0.0018;
  });

  return (
    <group position={parentVector.toArray()} rotation={[Math.PI * 0.16, Math.atan2(childVector.x - parentVector.x, childVector.z - parentVector.z), 0]}>
      <line ref={lineRef}>
        <LineGeometry points={points} />
        <lineBasicMaterial color="#76e0ef" transparent opacity={focusMode ? 0.36 : 0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </group>
  );
}

function LocalSystem({ map, selectedId, hoveredId, onSelect, onHover }) {
  const focusMode = Boolean(selectedId);

  return (
    <group>
      {(map.bodies || []).map(body => (
        <PlanetBody
          key={body.id}
          body={body}
          selected={selectedId === body.id}
          hovered={hoveredId === body.id}
          onSelect={onSelect}
          onHover={onHover}
          focusMode={focusMode}
        />
      ))}
      {(map.bodies || []).map(body => {
        if (!body.parentId) return null;
        const parent = bodyById(map, body.parentId);
        return parent ? <OrbitTrace key={`${body.id}-orbit`} body={body} parent={parent} focusMode={focusMode} /> : null;
      })}
    </group>
  );
}

function CameraRig({ map, selectedId, zoomOutSignal, controlsRef, selectedPositionRef }) {
  const { camera } = useThree();
  const selectedIdRef = useRef(selectedId);
  const zoomSignalRef = useRef(zoomOutSignal);
  const focusTravel = useRef(false);
  const zoomTravel = useRef(false);
  const targetCamera = useRef(WIDE_CAMERA.clone());
  const targetControl = useRef(WIDE_TARGET.clone());

  useEffect(() => {
    selectedIdRef.current = selectedId;
    const controls = controlsRef.current;
    if (selectedId) {
      focusTravel.current = true;
      zoomTravel.current = false;
      if (controls) controls.autoRotate = false;
    } else if (controls) {
      controls.autoRotate = true;
    }
  }, [selectedId, controlsRef]);

  useEffect(() => {
    if (zoomSignalRef.current === zoomOutSignal) return;
    zoomSignalRef.current = zoomOutSignal;
    targetCamera.current.copy(WIDE_CAMERA);
    targetControl.current.copy(WIDE_TARGET);
    zoomTravel.current = true;
    focusTravel.current = false;
  }, [zoomOutSignal]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const selectedPosition = selectedIdRef.current ? selectedPositionRef.current : null;

    if (selectedPosition) {
      const body = bodyById(map, selectedIdRef.current);
      const scale = body?.id === "khar-shian" ? 0.78 : 1;
      const outward = selectedPosition.clone().sub(WIDE_TARGET).normalize().multiplyScalar(1.05 * scale);
      targetCamera.current.copy(selectedPosition).add(outward).add(new THREE.Vector3(1.15 * scale, 0.92 * scale, 1.72 * scale));
      targetControl.current.copy(selectedPosition);
      controls.autoRotate = false;
    }

    if (focusTravel.current || zoomTravel.current) {
      camera.position.lerp(targetCamera.current, focusTravel.current ? 0.055 : 0.045);
      controls.target.lerp(targetControl.current, focusTravel.current ? 0.07 : 0.055);
      const cameraDone = camera.position.distanceTo(targetCamera.current) < 0.035;
      const targetDone = controls.target.distanceTo(targetControl.current) < 0.02;
      if (cameraDone && targetDone) {
        focusTravel.current = false;
        zoomTravel.current = false;
      }
    }

    controls.update();
  });

  return null;
}

function GalaxyScene({ map, selectedId, hoveredId, onSelect, onHover, zoomOutSignal, quality }) {
  const controlsRef = useRef(null);
  const localRef = useRef(null);
  const selectedPositionRef = useRef(null);
  const focus = useMemo(() => focusMapPosition(map), [map]);
  const selectable = selectedId ? bodyById(map, selectedId) : null;

  useFrame(({ clock }) => {
    if (localRef.current) {
      localRef.current.rotation.y = selectedId ? Math.sin(clock.elapsedTime * 0.15) * 0.04 : clock.elapsedTime * 0.026;
    }
  });

  useFrame(() => {
    if (!selectedId || !localRef.current) {
      selectedPositionRef.current = null;
      return;
    }
    const body = bodyById(map, selectedId);
    if (!body) return;
    const next = selectedPositionRef.current || new THREE.Vector3();
    next.copy(bodyLocalPosition(body));
    localRef.current.updateMatrixWorld();
    next.applyMatrix4(localRef.current.matrixWorld);
    selectedPositionRef.current = next;
  });

  return (
    <>
      <color attach="background" args={["#050204"]} />
      <fogExp2 attach="fog" args={["#090204", 0.0035]} />
      <ambientLight intensity={0.2} color="#4d1b20" />
      <directionalLight position={[4.8, 8.2, 5.4]} intensity={3.4} color="#ffd8a8" />
      <pointLight position={[0, 1.4, 0]} intensity={92} distance={19} color="#ffb168" />
      <pointLight position={focus.clone().add(new THREE.Vector3(0, 1.2, 0.8)).toArray()} intensity={72} distance={12} color="#ff3b4f" />
      <pointLight position={[5.2, 3, 4]} intensity={22} distance={22} color="#76e0ef" />

      <Stars radius={82} depth={42} count={quality === "high" ? 7200 : 3400} factor={5.6} saturation={0.62} fade speed={0.26} />
      <Sparkles count={quality === "high" ? 340 : 150} scale={[24, 5.4, 18]} size={1.55} speed={0.44} color="#ff9a3d" opacity={0.72} />

      <group rotation={[-0.045, -0.32, 0.02]}>
        <SectorGrid />
        <SpiralArmRibbons />
        <GalaxyParticles mode="stars" count={quality === "high" ? 24500 : 12800} seed={4321} opacity={0.88} sizeScale={0.92} />
        <GalaxyParticles mode="dust" count={quality === "high" ? 3600 : 1800} seed={8827} opacity={0.055} sizeScale={1.05} />
        <HyperspaceStreaks count={quality === "high" ? 72 : 34} />
        <GalacticCore />
      </group>

      <group ref={localRef} rotation={[0, -0.32, 0]}>
        <LocalSystem map={map} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} />
      </group>

      <CameraRig
        map={map}
        selectedId={selectedId}
        zoomOutSignal={zoomOutSignal}
        controlsRef={controlsRef}
        selectedPositionRef={selectedPositionRef}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        enablePan={false}
        minDistance={4.2}
        maxDistance={34}
        autoRotate={!selectable}
        autoRotateSpeed={0.22}
        target={WIDE_TARGET}
      />
      <EffectComposer multisampling={0}>
        <Bloom intensity={quality === "high" ? 0.72 : 0.46} luminanceThreshold={0.24} luminanceSmoothing={0.22} />
        <ChromaticAberration offset={quality === "high" ? [0.0008, 0.0004] : [0.00035, 0.00018]} />
        <Noise opacity={0.032} />
        <Vignette eskil={false} offset={0.2} darkness={0.58} />
      </EffectComposer>
    </>
  );
}

export function GalaxyMapExperience({ map }) {
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [zoomOutSignal, setZoomOutSignal] = useState(0);
  const [quality, setQuality] = useState("high");

  const selectableBodies = useMemo(() => (map.bodies || []).filter(body => body.selectable), [map]);
  const selectedBody = bodyById(map, selectedId);
  const panelBody = selectedBody || map.focus;

  useEffect(() => {
    const isReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const isCompact = window.matchMedia?.("(max-width: 760px)")?.matches;
    const cores = window.navigator?.hardwareConcurrency || 8;
    setQuality(isReducedMotion || isCompact || cores <= 4 ? "balanced" : "high");
  }, []);

  const selectBody = useCallback(id => {
    const body = bodyById(map, id);
    if (!body?.selectable) return;
    setSelectedId(id);
  }, [map]);

  const zoomOut = useCallback(() => {
    setSelectedId(null);
    setHoveredId(null);
    setZoomOutSignal(value => value + 1);
  }, []);

  return (
    <section className={`gm-root${ready ? " gm-root--ready" : ""}`} aria-label="Hidden Archives Galaxy Map">
      <div className="gm-stage" aria-hidden="true">
        <Canvas
          camera={{ position: WIDE_CAMERA.toArray(), fov: 45, near: 0.04, far: 160 }}
          dpr={quality === "high" ? [1, 2] : [1, 1.35]}
          gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.9;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            setReady(true);
          }}
        >
          <GalaxyScene
            map={map}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={selectBody}
            onHover={setHoveredId}
            zoomOutSignal={zoomOutSignal}
            quality={quality}
          />
        </Canvas>
      </div>

      <div className="gm-scan" aria-hidden="true" />
      <div className="gm-vignette" aria-hidden="true" />

      <header className="gm-topbar">
        <button className="gm-back" type="button" aria-label="Zoom out to galaxy view" onClick={zoomOut}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h16" />
            <path d="m8 8-4 4 4 4" />
            <path d="m16 8 4 4-4 4" />
          </svg>
        </button>
        <div className="gm-lockup">
          <span>ARCHIVES / DIRECT NODE</span>
          <strong>GALAXY MAP</strong>
        </div>
      </header>

      <aside className={`gm-panel${selectedId ? " is-focused" : ""}`} aria-live="polite">
        <div className="gm-panel-title">Galaxy Map</div>
        <div className="gm-kicker">{panelBody.region}</div>
        <h1>{panelBody.name}</h1>
        <div className="gm-kind">{panelBody.kind || panelBody.name}</div>
        <p>{panelBody.summary}</p>
        <div className="gm-selectors" aria-label="Galaxy bodies">
          {selectableBodies.map(body => (
            <button
              className={`gm-selector${selectedId === body.id ? " is-active" : ""}${hoveredId === body.id ? " is-hovered" : ""}`}
              type="button"
              aria-pressed={selectedId === body.id}
              key={body.id}
              onClick={() => selectBody(body.id)}
              onPointerEnter={() => setHoveredId(body.id)}
              onPointerLeave={() => setHoveredId(null)}
            >
              <span className="gm-selector-dot" style={{ "--body-color": body.colors?.glow || "#ffffff" }} />
              <span>{body.shortName || body.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="gm-hint" aria-hidden="true">
        <span>FULL GALAXY OVERVIEW</span>
        <span>DIRECT ARCHIVE NODE</span>
        <span>{quality.toUpperCase()} RENDER</span>
      </div>

      {!ready ? (
        <div className="gm-loading">
          <span />
          <strong>CALIBRATING ARCHIVE MAP</strong>
        </div>
      ) : null}

      <style>{STYLES}</style>
    </section>
  );
}

const STYLES = `
  html:has(.gm-root),
  body:has(.gm-root) {
    background: var(--theme-bg, #050204);
    overflow: hidden;
  }

  .gm-root {
    --gm-panel: color-mix(in srgb, var(--theme-panel, rgba(22, 7, 12, .84)) 76%, transparent);
    background:
      radial-gradient(ellipse 56% 46% at 50% 46%, var(--theme-body-glow-a, rgba(160, 0, 22, .08)), transparent 66%),
      linear-gradient(180deg, var(--theme-bg, #050204) 0%, #050204 58%, #000000 100%);
    color: var(--text, #ffffff);
    font-family: 'Share Tech Mono', monospace;
    height: 100dvh;
    inset: 0;
    isolation: isolate;
    overflow: hidden;
    position: fixed;
    width: 100vw;
    z-index: 0;
  }

  .gm-root *,
  .gm-root *::before,
  .gm-root *::after {
    box-sizing: border-box;
    letter-spacing: 0;
  }

  .gm-stage,
  .gm-stage canvas,
  .gm-scan,
  .gm-vignette {
    inset: 0;
    position: absolute;
  }

  .gm-stage {
    z-index: 1;
  }

  .gm-stage canvas {
    cursor: grab;
    display: block;
    height: 100% !important;
    outline: none;
    width: 100% !important;
  }

  .gm-stage canvas:active {
    cursor: grabbing;
  }

  .gm-scan {
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 2px, var(--scanline, rgba(255, 210, 210, .018)) 2px, var(--scanline, rgba(255, 210, 210, .018)) 4px),
      linear-gradient(90deg, var(--theme-wash, rgba(192, 0, 26, .025)), transparent 18%, transparent 82%, var(--theme-wash, rgba(192, 0, 26, .025)));
    mix-blend-mode: screen;
    opacity: .68;
    pointer-events: none;
    z-index: 3;
  }

  .gm-vignette {
    background:
      radial-gradient(circle at 52% 48%, transparent 0%, transparent 54%, rgba(0, 0, 0, .76) 100%),
      linear-gradient(90deg, rgba(0, 0, 0, .72), transparent 24%, transparent 76%, rgba(0, 0, 0, .78));
    pointer-events: none;
    z-index: 4;
  }

  .gm-topbar {
    align-items: center;
    display: flex;
    gap: 12px;
    left: clamp(14px, 2.2vw, 28px);
    max-width: calc(100vw - 44px);
    position: absolute;
    top: clamp(14px, 2.2vw, 28px);
    z-index: 8;
  }

  .gm-back {
    align-items: center;
    appearance: none;
    background:
      linear-gradient(90deg, var(--theme-wash, rgba(192, 0, 26, .025)), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 28px var(--theme-accent-glow, rgba(255, 59, 79, .26)), inset 0 0 24px rgba(255, 255, 255, .025);
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
    color: var(--theme-accent, #ff3b4f);
    cursor: crosshair;
    display: inline-flex;
    height: 42px;
    justify-content: center;
    padding: 0;
    transition: border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
    width: 42px;
  }

  .gm-back svg {
    fill: none;
    height: 22px;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.8;
    width: 22px;
  }

  .gm-back:hover,
  .gm-back:focus-visible {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 34px var(--theme-accent-glow, rgba(255, 59, 79, .32)), inset 0 0 28px rgba(255, 255, 255, .04);
    color: var(--theme-accent-soft, #d1243a);
    outline: none;
    transform: translateY(-1px);
  }

  .gm-lockup,
  .gm-panel,
  .gm-loading,
  .gm-hint {
    background:
      linear-gradient(135deg, var(--theme-wash, rgba(192, 0, 26, .025)), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 30px var(--theme-accent-glow, rgba(255, 59, 79, .18)), inset 0 0 34px rgba(255, 255, 255, .02);
    clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
  }

  .gm-lockup {
    display: grid;
    gap: 3px;
    min-width: min(310px, calc(100vw - 74px));
    padding: 10px 14px;
  }

  .gm-lockup span,
  .gm-kicker,
  .gm-kind,
  .gm-hint {
    color: var(--text-dim, #ffffff);
    font-size: .66rem;
    text-transform: uppercase;
  }

  .gm-lockup strong,
  .gm-panel-title {
    color: var(--theme-accent, #ff3b4f);
    font-family: Orbitron, monospace;
    font-size: .78rem;
    font-weight: 700;
    text-transform: uppercase;
    text-shadow: 0 0 12px var(--theme-accent-glow, rgba(255, 59, 79, .32));
  }

  .gm-panel {
    bottom: clamp(18px, 3vw, 32px);
    max-width: 330px;
    padding: 15px;
    position: absolute;
    right: clamp(18px, 3vw, 32px);
    width: calc(100vw - 36px);
    z-index: 8;
  }

  .gm-panel.is-focused {
    max-width: 370px;
  }

  .gm-panel-title {
    border-bottom: 1px solid var(--theme-accent-dim, #7a1a28);
    margin-bottom: 11px;
    padding-bottom: 9px;
  }

  .gm-kicker,
  .gm-kind {
    line-height: 1.45;
  }

  .gm-panel h1 {
    color: var(--text, #ffffff);
    font-family: Cinzel, serif;
    font-size: 1.42rem;
    line-height: 1.1;
    margin: 7px 0 6px;
    text-transform: uppercase;
    text-shadow: 0 0 22px var(--theme-accent-glow, rgba(255, 59, 79, .24));
  }

  .gm-panel p {
    color: var(--text-dim, #ffffff);
    font-size: .82rem;
    line-height: 1.5;
    margin: 12px 0 0;
  }

  .gm-selectors {
    display: grid;
    gap: 7px;
    margin-top: 14px;
  }

  .gm-selector {
    align-items: center;
    appearance: none;
    background: color-mix(in srgb, var(--theme-bg, #050204) 58%, transparent);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    color: var(--text-dim, #ffffff);
    cursor: crosshair;
    display: flex;
    font: inherit;
    font-size: .78rem;
    gap: 10px;
    min-height: 36px;
    padding: 8px 10px;
    text-align: left;
    text-transform: uppercase;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease;
    width: 100%;
  }

  .gm-selector-dot {
    background: var(--body-color);
    border-radius: 999px;
    box-shadow: 0 0 16px var(--body-color);
    flex: 0 0 auto;
    height: 9px;
    width: 9px;
  }

  .gm-selector:hover,
  .gm-selector:focus-visible,
  .gm-selector.is-hovered {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 22px var(--theme-accent-glow, rgba(255, 59, 79, .22));
    color: var(--text, #ffffff);
    outline: none;
  }

  .gm-selector.is-active {
    background:
      linear-gradient(90deg, var(--theme-wash, rgba(192, 0, 26, .025)), transparent 78%),
      color-mix(in srgb, var(--theme-accent, #ff3b4f) 9%, var(--theme-bg, #050204));
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: inset 0 0 24px rgba(255, 255, 255, .025), 0 0 26px var(--theme-accent-glow, rgba(255, 59, 79, .24));
    color: var(--text, #ffffff);
  }

  .gm-hint {
    bottom: clamp(18px, 3vw, 32px);
    color: var(--text-faint, #ffffff);
    display: flex;
    gap: 14px;
    left: clamp(18px, 3vw, 32px);
    padding: 10px 13px;
    position: absolute;
    z-index: 8;
  }

  .gm-hint span {
    white-space: nowrap;
  }

  .gm-world-label {
    appearance: none;
    background: rgba(10, 2, 5, .76);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 16px var(--theme-accent-glow, rgba(255, 59, 79, .22));
    color: var(--text-dim, #ffffff);
    cursor: crosshair;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    padding: 5px 8px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .gm-world-label.is-focus {
    font-size: 11px;
  }

  .gm-world-label.is-muted {
    opacity: .34;
  }

  .gm-world-label.is-selected,
  .gm-world-label.is-hovered,
  .gm-world-label:hover,
  .gm-world-label:focus-visible {
    border-color: var(--theme-accent, #ff3b4f);
    color: var(--text, #ffffff);
    outline: none;
  }

  .gm-loading {
    align-items: center;
    color: var(--text, #ffffff);
    display: flex;
    gap: 12px;
    left: 50%;
    padding: 14px 17px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 12;
  }

  .gm-loading span {
    animation: gm-spin 1.1s linear infinite;
    border: 2px solid var(--theme-accent-dim, #7a1a28);
    border-top-color: var(--theme-accent, #ff3b4f);
    border-radius: 999px;
    height: 18px;
    width: 18px;
  }

  .gm-loading strong {
    font-family: Orbitron, monospace;
    font-size: .76rem;
    text-transform: uppercase;
  }

  @keyframes gm-spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 760px) {
    .gm-topbar {
      left: 14px;
      right: 14px;
      top: 14px;
    }

    .gm-lockup {
      flex: 1;
      min-width: 0;
      width: 100%;
    }

    .gm-panel {
      bottom: 14px;
      left: 14px;
      max-width: none;
      padding: 14px;
      right: 14px;
      width: auto;
    }

    .gm-panel h1 {
      font-size: 1.14rem;
      margin: 6px 0;
    }

    .gm-panel p {
      font-size: .78rem;
      line-height: 1.42;
      margin-top: 9px;
    }

    .gm-selectors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 11px;
    }

    .gm-selector {
      font-size: .7rem;
      min-height: 34px;
      padding: 8px;
    }

    .gm-hint {
      display: none;
    }
  }

  @media (max-width: 420px) {
    .gm-lockup span,
    .gm-kicker,
    .gm-kind {
      font-size: .58rem;
    }

    .gm-lockup strong,
    .gm-panel-title {
      font-size: .68rem;
    }

    .gm-panel h1 {
      font-size: 1.02rem;
    }

    .gm-selectors {
      grid-template-columns: 1fr;
    }
  }
`;
