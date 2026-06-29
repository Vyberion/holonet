"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const WIDE_CAMERA = new THREE.Vector3(0.6, 5.8, 15.8);
const WIDE_TARGET = new THREE.Vector3(1.65, 0.02, -0.8);
const GALAXY_TILT = new THREE.Euler(-0.09, -0.18, 0.035);
const GALAXY_SPIN_SPEED = 0.0024;

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

function makeVector(value) {
  return new THREE.Vector3(value?.[0] || 0, value?.[1] || 0, value?.[2] || 0);
}

function colorWithAlpha(hex, alpha) {
  const color = new THREE.Color(hex || "#ffffff");
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function makeFallbackTexture(color = "#ffffff") {
  const data = new Uint8Array([255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.userData.fallbackColor = color;
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
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makePlanetTextures(body) {
  const seed = body.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rnd = seededRandom(seed + 1447);
  const base = body.colors?.surface || "#777777";
  const dark = body.colors?.surfaceDark || "#111111";
  const glow = body.colors?.glow || "#ffffff";
  const accent = body.colors?.accent || "#ffffff";
  const isRock = body.id === "korriban";

  const map = makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.2, base);
    gradient.addColorStop(0.43, "#120405");
    gradient.addColorStop(0.62, base);
    gradient.addColorStop(0.82, dark);
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 460; i += 1) {
      const y = rnd() * height;
      const h = randRange(rnd, 1, isRock ? 18 : 9);
      ctx.globalAlpha = randRange(rnd, 0.035, 0.18);
      ctx.fillStyle = rnd() > 0.55 ? accent : dark;
      ctx.fillRect(0, y, width, h);
    }

    for (let i = 0; i < 360; i += 1) {
      const x = rnd() * width;
      const y = rnd() * height;
      const rx = randRange(rnd, isRock ? 7 : 4, isRock ? 78 : 42);
      const ry = randRange(rnd, 2, isRock ? 18 : 10);
      ctx.globalAlpha = randRange(rnd, 0.035, 0.22);
      ctx.fillStyle = rnd() > 0.52 ? colorWithAlpha(accent, 1) : colorWithAlpha(dark, 1);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    if (isRock) {
      for (let i = 0; i < 92; i += 1) {
        ctx.globalAlpha = randRange(rnd, 0.06, 0.18);
        ctx.strokeStyle = colorWithAlpha("#ffbb82", 1);
        ctx.lineWidth = randRange(rnd, 0.8, 3.4);
        ctx.beginPath();
        const y = rnd() * height;
        ctx.moveTo(-50, y);
        for (let x = 0; x <= width + 100; x += 60) {
          ctx.lineTo(x, y + Math.sin(x * 0.012 + rnd() * TAU) * randRange(rnd, 3, 18));
        }
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }, 1536, 768);

  const bumpMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.fillStyle = "#777";
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 720; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.03, 0.17);
      ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#111111";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 4, 62), randRange(rnd, 2, 17), rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, 1024, 512);

  const cloudMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 320; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.014, body.id === "khar-shian" ? 0.13 : 0.07);
      ctx.fillStyle = body.id === "khar-shian" ? "#e4fdff" : "#ffd5bd";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 18, 118), randRange(rnd, 3, 21), rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, 1024, 512);

  const nightMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 180; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.05, 0.34);
      ctx.fillStyle = rnd() > 0.62 ? glow : accent;
      ctx.beginPath();
      ctx.arc(rnd() * width, rnd() * height, randRange(rnd, 0.6, 2.2), 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, 1024, 512);

  return { map, bumpMap, cloudMap, nightMap };
}

function makeGlowTexture(seed = 0, inner = "rgba(255,255,255,1)", mid = "rgba(255,70,70,.42)") {
  return makeTextureFromCanvas((ctx, width, height) => {
    const rnd = seededRandom(seed + 17);
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.19, "rgba(255, 216, 158, .74)");
    gradient.addColorStop(0.48, mid);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 28; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.02, 0.08);
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, randRange(rnd, 24, width / 2), 0, TAU);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }, 768, 768);
}

function makeNebulaTexture(seed, colorA, colorB) {
  const rnd = seededRandom(seed);
  return makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 92; i += 1) {
      const x = rnd() * width;
      const y = rnd() * height;
      const radius = randRange(rnd, 70, 260);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colorWithAlpha(rnd() > 0.5 ? colorA : colorB, randRange(rnd, 0.12, 0.32)));
      gradient.addColorStop(0.46, colorWithAlpha(rnd() > 0.5 ? colorA : colorB, randRange(rnd, 0.025, 0.09)));
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = "destination-in";
    const mask = ctx.createRadialGradient(width / 2, height / 2, width * 0.06, width / 2, height / 2, width * 0.58);
    mask.addColorStop(0, "rgba(255,255,255,.9)");
    mask.addColorStop(0.52, "rgba(255,255,255,.5)");
    mask.addColorStop(0.82, "rgba(255,255,255,.1)");
    mask.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }, 1536, 1536);
}

function makeDustLaneTexture(seed) {
  const rnd = seededRandom(seed);
  return makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);

    for (let lane = 0; lane < 10; lane += 1) {
      ctx.globalAlpha = randRange(rnd, 0.04, 0.14);
      ctx.strokeStyle = rnd() > 0.42 ? "#100307" : "#27080b";
      ctx.lineWidth = randRange(rnd, 16, 54);
      ctx.beginPath();
      const baseY = randRange(rnd, height * 0.25, height * 0.75);
      ctx.moveTo(-80, baseY);
      for (let x = -80; x <= width + 120; x += 58) {
        ctx.lineTo(x, baseY + Math.sin(x * randRange(rnd, 0.006, 0.014) + lane) * randRange(rnd, 16, 80));
      }
      ctx.stroke();
    }

    for (let i = 0; i < 240; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.018, 0.08);
      ctx.fillStyle = "#050102";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 8, 70), randRange(rnd, 2, 18), rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }, 1536, 768);
}

function makeGalaxyGeometry(count, seed, mode = "arm") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const arm = i % 6;
    const coreBias = mode === "core" ? 0.28 : mode === "dust" ? 0.5 : 0.62;
    const radius = Math.pow(rnd(), coreBias) * (mode === "core" ? 3.8 : 11.8) + 0.08;
    const curl = radius * (mode === "cluster" ? 0.82 : 0.58);
    const angle = (arm / 6) * TAU + curl + randRange(rnd, -0.42, 0.42);
    const spread = mode === "dust" ? 0.68 : mode === "cluster" ? 0.22 + radius * 0.04 : 0.13 + radius * 0.025;
    const x = Math.cos(angle) * radius * 1.22 + randRange(rnd, -spread, spread);
    const z = Math.sin(angle) * radius * 0.84 + randRange(rnd, -spread, spread);
    const y = randRange(rnd, -0.2, 0.2) * (mode === "dust" ? 2.1 : 1 + radius * 0.08);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const palette = mode === "dust"
      ? (rnd() > 0.7 ? "#8a2b2c" : "#2d0a0e")
      : rnd() > 0.93 ? "#ff463f" : rnd() > 0.72 ? "#ffd58a" : rnd() > 0.37 ? "#fff8e9" : "#8eeaff";

    color.set(palette);
    if (mode !== "dust" && rnd() > 0.91) color.lerp(new THREE.Color("#5b6dff"), 0.34);

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust" ? randRange(rnd, 0.035, 0.11) : mode === "core" ? randRange(rnd, 0.018, 0.075) : randRange(rnd, 0.014, 0.056);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function makeStreakGeometry(count, seed) {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 2 * 3);

  for (let i = 0; i < count; i += 1) {
    const x = randRange(rnd, -18, 18);
    const y = randRange(rnd, -7, 7);
    const z = randRange(rnd, -24, 8);
    const length = randRange(rnd, 0.18, 0.78);
    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x + length * 0.35;
    positions[i * 6 + 4] = y + length * 0.08;
    positions[i * 6 + 5] = z + length;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function makeOrbitPoints(radiusX, radiusZ, segments = 224) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
  }
  return points;
}

function makeRoutePoints(start, end, lift = 1.7) {
  const curve = new THREE.QuadraticBezierCurve3(
    start,
    start.clone().lerp(end, 0.52).add(new THREE.Vector3(0, lift, 0)),
    end
  );
  return curve.getPoints(160);
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <primitive attach="geometry" object={geometry} />;
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1, rotationSpeed = 1 }) {
  const geometry = useMemo(() => makeGalaxyGeometry(count, seed, mode), [count, seed, mode]);
  const materialRef = useRef(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime * rotationSpeed;
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
            pos.y += sin(uTime * 0.18 + position.x * 1.28 + position.z * 0.82) * 0.018;
            pos.xz = mat2(cos(uTime * 0.015), -sin(uTime * 0.015), sin(uTime * 0.015), cos(uTime * 0.015)) * pos.xz;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * uScale * (520.0 / max(4.2, -mvPosition.z));
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
            float glow = 1.0 - smoothstep(0.14, 1.0, d);
            float twinkle = 0.76 + 0.24 * sin(uTime * 1.25 + vColor.r * 18.0 + vColor.g * 11.0);
            gl_FragColor = vec4(vColor, (core + glow * 0.66) * uOpacity * twinkle);
          }
        `}
      />
    </points>
  );
}

function StellarDrift({ quality }) {
  const geometry = useMemo(() => makeStreakGeometry(quality === "high" ? 180 : 82, 9162), [quality]);
  const groupRef = useRef(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.z = (clock.elapsedTime * 0.18) % 2.4;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.04) * 0.035;
  });

  return (
    <lineSegments ref={groupRef} geometry={geometry}>
      <lineBasicMaterial color="#9beeff" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
    </lineSegments>
  );
}

function NebulaField() {
  const red = useMemo(() => makeNebulaTexture(8821, "#ff3846", "#ff9a3d"), []);
  const blue = useMemo(() => makeNebulaTexture(4429, "#76e0ef", "#5b6dff"), []);
  const violet = useMemo(() => makeNebulaTexture(1776, "#b25cff", "#ff385c"), []);
  const dust = useMemo(() => makeDustLaneTexture(6221), []);

  useEffect(() => () => {
    red.dispose();
    blue.dispose();
    violet.dispose();
    dust.dispose();
  }, [red, blue, violet, dust]);

  return (
    <>
      <sprite position={[-4.8, -0.32, -5.4]} scale={[14, 7.6, 1]} rotation={[0.14, 0, -0.24]}>
        <spriteMaterial map={red} color="#ffffff" transparent opacity={0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[4.9, 0.2, 3.6]} scale={[12.4, 7.2, 1]} rotation={[-0.12, 0, 0.24]}>
        <spriteMaterial map={blue} color="#ffffff" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0.2, 0.02, -0.2]} scale={[16, 8.4, 1]} rotation={[0.08, 0, 0.04]}>
        <spriteMaterial map={violet} color="#ffffff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[0.1, -0.08, -0.3]} scale={[16.8, 4.2, 1]} rotation={[0.42, 0.12, -0.17]}>
        <spriteMaterial map={dust} color="#180407" transparent opacity={0.56} depthWrite={false} />
      </sprite>
      <sprite position={[1.8, 0.04, 1.3]} scale={[13.6, 3.3, 1]} rotation={[0.5, -0.12, 0.22]}>
        <spriteMaterial map={dust} color="#080102" transparent opacity={0.42} depthWrite={false} />
      </sprite>
    </>
  );
}

function MicroLabel({ body, selected, hovered, onSelect, onHover }) {
  const labelRef = useRef(null);
  const groupRef = useRef(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useFrame(() => {
    if (!labelRef.current || !groupRef.current) return;
    groupRef.current.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const opacity = selected || hovered ? 1 : THREE.MathUtils.clamp(1.7 - distance / 13.5, 0.14, 0.82);
    const scale = selected || hovered ? 1 : THREE.MathUtils.clamp(1.18 - distance / 38, 0.76, 1);
    labelRef.current.style.opacity = opacity.toFixed(3);
    labelRef.current.style.transform = `scale(${scale.toFixed(3)})`;
  });

  return (
    <Billboard ref={groupRef} position={[0, body.radius * 3, 0]}>
      <Html center distanceFactor={8.5} transform occlude={false}>
        <button
          ref={labelRef}
          type="button"
          className={`gm-world-label${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}`}
          onClick={() => onSelect(body.id)}
          onPointerEnter={() => onHover(body.id)}
          onPointerLeave={() => onHover(null)}
        >
          <span>{body.shortName || body.name}</span>
          <small>{body.grid}</small>
        </button>
      </Html>
    </Billboard>
  );
}

function PlanetReticle({ body, selected, hovered }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const pingRef = useRef(null);
  const active = selected || hovered;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (outerRef.current) {
      outerRef.current.rotation.z = t * (selected ? 0.7 : 0.38);
      outerRef.current.material.opacity = active ? (selected ? 0.62 : 0.44) : 0.18;
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = -t * (selected ? 0.55 : 0.22);
      innerRef.current.material.opacity = active ? (selected ? 0.48 : 0.32) : 0.12;
    }
    if (pingRef.current) {
      const pulse = (Math.sin(t * 4.2) + 1) * 0.5;
      pingRef.current.scale.setScalar(1 + pulse * 0.35);
      pingRef.current.material.opacity = active ? (0.16 + pulse * 0.28) : 0.05;
    }
  });

  return (
    <>
      <line ref={outerRef} rotation={[Math.PI / 2, 0, 0]}>
        <LineGeometry points={makeOrbitPoints(body.radius * 2.55, body.radius * 2.55, 160)} />
        <lineBasicMaterial color={selected ? "#ffcf91" : body.colors?.glow || "#ff3b4f"} transparent opacity={0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <line ref={innerRef} rotation={[Math.PI / 2, 0, 0.82]}>
        <LineGeometry points={makeOrbitPoints(body.radius * 1.9, body.radius * 1.9, 128)} />
        <lineBasicMaterial color={body.colors?.glow || "#ff3b4f"} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <line ref={pingRef} rotation={[Math.PI / 2, 0, 0]}>
        <LineGeometry points={makeOrbitPoints(body.radius * 2.95, body.radius * 2.95, 160)} />
        <lineBasicMaterial color="#ffffff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </>
  );
}

function PlanetBody({ body, selected, hovered, onSelect, onHover }) {
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const nightRef = useRef(null);
  const haloTexture = useMemo(() => makeGlowTexture(body.id.length * 227, "#ffffff", colorWithAlpha(body.colors?.glow || "#ff3b4f", 0.42)), [body]);
  const textures = useMemo(() => makePlanetTextures(body), [body]);

  useEffect(() => () => {
    haloTexture.dispose();
    textures.map.dispose();
    textures.bumpMap.dispose();
    textures.cloudMap.dispose();
    textures.nightMap.dispose();
  }, [haloTexture, textures]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!groupRef.current) return;

    const targetScale = body.selectable ? (selected ? 1.72 : hovered ? 1.31 : 1) : 0.86;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    if (planetRef.current) {
      planetRef.current.rotation.y += 0.0022 + body.radius * 0.004;
      planetRef.current.rotation.x = Math.sin(t * 0.2 + body.radius * 12) * 0.05;
    }
    if (cloudsRef.current) cloudsRef.current.rotation.y -= 0.0012 + body.radius * 0.003;
    if (nightRef.current) nightRef.current.rotation.y += 0.0015;
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
    <group ref={groupRef} position={body.position} userData={{ bodyId: body.id }}>
      <mesh ref={planetRef} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
        <sphereGeometry args={[body.radius, 128, 64]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={body.id === "korriban" ? 0.055 : 0.028}
          roughness={body.id === "khar-shian" ? 0.48 : 0.88}
          metalness={body.id === "khar-shian" ? 0.08 : 0.02}
          emissive={body.colors?.surfaceDark || "#000000"}
          emissiveIntensity={selected ? 0.16 : hovered ? 0.1 : 0.055}
        />
      </mesh>

      <mesh ref={nightRef} scale={1.004}>
        <sphereGeometry args={[body.radius * 1.006, 96, 48]} />
        <meshBasicMaterial
          map={textures.nightMap}
          transparent
          opacity={selected ? 0.2 : 0.11}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.018}>
        <sphereGeometry args={[body.radius * 1.018, 128, 64]} />
        <meshStandardMaterial
          map={textures.cloudMap}
          transparent
          opacity={body.id === "khar-shian" ? 0.34 : 0.18}
          roughness={0.72}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh scale={1.22}>
        <sphereGeometry args={[body.radius * 1.22, 96, 42]} />
        <meshBasicMaterial
          color={body.colors?.glow || "#ffffff"}
          transparent
          opacity={body.selectable ? (selected ? 0.22 : hovered ? 0.16 : 0.085) : 0.045}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      <sprite scale={[body.radius * (selected ? 10.8 : hovered ? 8.2 : 6.3), body.radius * (selected ? 10.8 : hovered ? 8.2 : 6.3), 1]}>
        <spriteMaterial
          map={haloTexture}
          color={body.colors?.glow || "#ffffff"}
          transparent
          opacity={body.selectable ? (selected ? 0.38 : hovered ? 0.27 : 0.13) : 0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <PlanetReticle body={body} selected={selected} hovered={hovered} />

      {body.selectable ? (
        <MicroLabel body={body} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
      ) : null}
    </group>
  );
}

function OrbitTrace({ body, parent }) {
  const lineRef = useRef(null);
  const parentVector = useMemo(() => makeVector(parent.position), [parent]);
  const childVector = useMemo(() => makeVector(body.position), [body]);
  const distance = parentVector.distanceTo(childVector);
  const points = useMemo(() => makeOrbitPoints(distance, distance * 0.52, 224), [distance]);

  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    lineRef.current.rotation.y = clock.elapsedTime * 0.06;
    lineRef.current.material.opacity = 0.22 + Math.sin(clock.elapsedTime * 1.1) * 0.05;
  });

  return (
    <group position={parent.position} rotation={[Math.PI * 0.16, Math.atan2(childVector.x - parentVector.x, childVector.z - parentVector.z), 0]}>
      <line ref={lineRef}>
        <LineGeometry points={points} />
        <lineBasicMaterial color={body.colors?.glow || "#ff3b4f"} transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </group>
  );
}

function RoutePulse({ end }) {
  const pulseRef = useRef(null);
  const secondPulseRef = useRef(null);
  const points = useMemo(() => makeRoutePoints(new THREE.Vector3(0, 0.05, 0), makeVector(end), 1.9), [end]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.065) % 1;
    if (pulseRef.current) {
      pulseRef.current.position.copy(curve.getPointAt(t));
      pulseRef.current.material.opacity = 0.46 + Math.sin(t * TAU) * 0.22;
    }
    if (secondPulseRef.current) {
      const t2 = (t + 0.48) % 1;
      secondPulseRef.current.position.copy(curve.getPointAt(t2));
      secondPulseRef.current.material.opacity = 0.26 + Math.sin(t2 * TAU) * 0.18;
    }
  });

  return (
    <>
      <line>
        <LineGeometry points={points} />
        <lineBasicMaterial color="#ff3b4f" transparent opacity={0.36} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <line>
        <LineGeometry points={points} />
        <lineBasicMaterial color="#ffcf91" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.065, 22, 12]} />
        <meshBasicMaterial color="#ffcf91" transparent opacity={0.72} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={secondPulseRef}>
        <sphereGeometry args={[0.042, 18, 10]} />
        <meshBasicMaterial color="#76e0ef" transparent opacity={0.48} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

function ArchiveReticle({ focus }) {
  const groupRef = useRef(null);
  const glowTexture = useMemo(() => makeGlowTexture(3921, "#ffffff", "rgba(255,52,70,.5)"), []);
  const position = useMemo(() => makeVector(focus.position), [focus]);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.08;
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.4) * 0.14;
  });

  return (
    <group ref={groupRef} position={position}>
      <sprite scale={[focus.radius * 2.9, focus.radius * 2.9, 1]}>
        <spriteMaterial map={glowTexture} color="#ff3b4f" transparent opacity={0.36} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {[0.86, 1.28, 1.78, 2.28].map((scale, index) => (
        <line key={scale} rotation={[Math.PI / 2.35, 0, index * 0.46]}>
          <LineGeometry points={makeOrbitPoints(focus.radius * scale, focus.radius * scale * 0.66, 224)} />
          <lineBasicMaterial color={index === 1 ? "#ffcf91" : "#ff3b4f"} transparent opacity={index === 1 ? 0.54 : 0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
        </line>
      ))}
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
    } else {
      focusTravel.current = false;
      if (controls) controls.autoRotate = false;
    }
  }, [selectedId, controlsRef]);

  useEffect(() => {
    if (zoomSignalRef.current === zoomOutSignal) return;

    zoomSignalRef.current = zoomOutSignal;
    const controls = controlsRef.current;
    const orbitTarget = controls ? controls.target.clone() : WIDE_TARGET.clone();
    const direction = camera.position.clone().sub(orbitTarget);

    if (direction.lengthSq() < 1) direction.copy(WIDE_CAMERA).sub(WIDE_TARGET);

    const distance = Math.max(13.2, Math.min(19.5, direction.length() * 1.85));
    targetCamera.current.copy(orbitTarget).add(direction.normalize().multiplyScalar(distance));
    targetCamera.current.y = Math.max(targetCamera.current.y, orbitTarget.y + 3.6);
    targetControl.current.copy(orbitTarget);
    zoomTravel.current = true;
    focusTravel.current = false;

    if (controls) {
      controls.autoRotate = false;
      controls.enablePan = true;
    }
  }, [camera, controlsRef, zoomOutSignal]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const selectedPosition = selectedIdRef.current ? selectedPositionRef.current : null;

    if (selectedPosition) {
      const body = bodyById(map, selectedIdRef.current);
      const scale = body?.id === "khar-shian" ? 0.78 : 1;
      const outward = selectedPosition.clone().sub(WIDE_TARGET).normalize().multiplyScalar(1.05 * scale);
      targetCamera.current.copy(selectedPosition).add(outward).add(new THREE.Vector3(0.92 * scale, 0.78 * scale, 1.54 * scale));
      targetControl.current.copy(selectedPosition);
      controls.autoRotate = false;
    }

    if (focusTravel.current) {
      camera.position.lerp(targetCamera.current, 0.058);
      controls.target.lerp(targetControl.current, 0.075);

      if (camera.position.distanceTo(targetCamera.current) < 0.035 && controls.target.distanceTo(targetControl.current) < 0.02) {
        focusTravel.current = false;
      }
    }

    if (zoomTravel.current) {
      camera.position.lerp(targetCamera.current, 0.045);

      if (camera.position.distanceTo(targetCamera.current) < 0.055) {
        zoomTravel.current = false;
      }
    }

    controls.update();
  });

  return null;
}

function GalaxyScene({ map, selectedId, hoveredId, onSelect, onHover, zoomOutSignal, quality }) {
  const controlsRef = useRef(null);
  const groupRef = useRef(null);
  const selectedPositionRef = useRef(null);
  const selectedBody = selectedId ? bodyById(map, selectedId) : null;

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.x = GALAXY_TILT.x;
      groupRef.current.rotation.y = GALAXY_TILT.y + clock.elapsedTime * GALAXY_SPIN_SPEED;
      groupRef.current.rotation.z = GALAXY_TILT.z + Math.sin(clock.elapsedTime * 0.07) * 0.012;
    }
  });

  useFrame(() => {
    if (!selectedId || !groupRef.current) {
      selectedPositionRef.current = null;
      return;
    }

    const body = bodyById(map, selectedId);
    if (body) {
      const next = selectedPositionRef.current || new THREE.Vector3();
      next.copy(makeVector(body.position));
      groupRef.current.updateMatrixWorld();
      next.applyMatrix4(groupRef.current.matrixWorld);
      selectedPositionRef.current = next;
    }
  });

  return (
    <>
      <color attach="background" args={["#020103"]} />
      <fogExp2 attach="fog" args={["#050106", 0.012]} />
      <ambientLight intensity={0.18} color="#5a1a20" />
      <hemisphereLight intensity={0.36} color="#ffb878" groundColor="#120206" />
      <directionalLight position={[5.4, 7.2, 4.2]} intensity={3.7} color="#ffd8a8" />
      <pointLight position={[7.2, 1.7, -1.7]} intensity={84} distance={19} color="#ff3b4f" />
      <pointLight position={[3.4, 2.4, 2.8]} intensity={24} distance={22} color="#76e0ef" />
      <pointLight position={[-4.5, 1.3, -4.8]} intensity={18} distance={18} color="#b25cff" />

      <Stars radius={68} depth={36} count={quality === "high" ? 5600 : 2600} factor={5.3} saturation={0.5} fade speed={0.1} />
      <StellarDrift quality={quality} />
      <Sparkles count={quality === "high" ? 210 : 92} scale={[21, 5.5, 15]} size={1.25} speed={0.16} color="#ff9a3d" opacity={0.62} />

      <group ref={groupRef} rotation={GALAXY_TILT}>
        <NebulaField />
        <GalaxyParticles mode="core" count={quality === "high" ? 4200 : 1900} seed={9211} opacity={0.76} sizeScale={1.36} rotationSpeed={0.5} />
        <GalaxyParticles mode="arm" count={quality === "high" ? 17800 : 8400} seed={4321} opacity={0.68} sizeScale={1.16} rotationSpeed={0.42} />
        <GalaxyParticles mode="cluster" count={quality === "high" ? 7600 : 3300} seed={7721} opacity={0.52} sizeScale={1.34} rotationSpeed={0.36} />
        <GalaxyParticles mode="dust" count={quality === "high" ? 6200 : 2700} seed={8827} opacity={0.19} sizeScale={2.05} rotationSpeed={0.3} />

        <RoutePulse end={map.focus.position} />
        <ArchiveReticle focus={map.focus} />

        {(map.bodies || []).map(body => (
          <PlanetBody
            key={body.id}
            body={body}
            selected={selectedId === body.id}
            hovered={hoveredId === body.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}

        {(map.bodies || []).map(body => {
          if (!body.parentId) return null;
          const parent = bodyById(map, body.parentId);
          return parent ? <OrbitTrace key={`${body.id}-orbit`} body={body} parent={parent} /> : null;
        })}
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
        dampingFactor={0.075}
        enablePan
        enableRotate
        enableZoom
        screenSpacePanning={false}
        panSpeed={0.84}
        rotateSpeed={0.54}
        zoomSpeed={0.72}
        minDistance={1.45}
        maxDistance={28}
        autoRotate={false}
        target={WIDE_TARGET}
      />

      <EffectComposer multisampling={quality === "high" ? 4 : 0}>
        <Bloom intensity={quality === "high" ? 0.92 : 0.58} luminanceThreshold={0.12} luminanceSmoothing={0.58} mipmapBlur />
        {selectedBody ? (
          <DepthOfField focusDistance={0.022} focalLength={0.032} bokehScale={quality === "high" ? 0.38 : 0.22} />
        ) : null}
        <ChromaticAberration offset={quality === "high" ? [0.00055, 0.00025] : [0.00028, 0.00014]} />
        <Noise opacity={0.026} premultiply />
        <Vignette eskil={false} offset={0.18} darkness={0.52} />
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
      <div className="gm-stage">
        <Canvas
          camera={{ position: WIDE_CAMERA.toArray(), fov: 47, near: 0.035, far: 160 }}
          dpr={quality === "high" ? [1.35, 2.75] : [1, 1.65]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.96;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            setReady(true);
          }}
          onPointerMissed={() => {
            setSelectedId(null);
            setHoveredId(null);
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
      <div className="gm-holo-sweep" aria-hidden="true" />

      <header className="gm-topbar">
        <button className="gm-back" type="button" aria-label="Zoom out to free camera galaxy view" onClick={zoomOut}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h16" />
            <path d="m8 8-4 4 4 4" />
            <path d="m16 8 4 4-4 4" />
          </svg>
        </button>
        <div className="gm-lockup">
          <span>ARCHIVES / DIRECT NODE</span>
          <strong>R-5 SITH WORLDS</strong>
        </div>
      </header>

      <aside className="gm-panel" aria-live="polite">
        <div className="gm-panel-title">Galactic Archive</div>
        <div className="gm-kicker">{panelBody.grid} / {panelBody.region}</div>
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
              <small>{body.grid}</small>
            </button>
          ))}
        </div>
      </aside>

      <div className="gm-hint" aria-hidden="true">
        <span>DRAG TO ORBIT</span>
        <span>RIGHT DRAG TO PAN</span>
        <span>SCROLL TO RANGE</span>
        <span>{quality.toUpperCase()} RENDER</span>
      </div>

      {!ready ? (
        <div className="gm-loading">
          <span />
          <strong>CALIBRATING GALAXY</strong>
        </div>
      ) : null}

      <style>{STYLES}</style>
    </section>
  );
}

const STYLES = `
  html:has(.gm-root),
  body:has(.gm-root) {
    background: #020103;
    overflow: hidden;
  }

  .gm-root {
    --gm-panel: color-mix(in srgb, var(--theme-panel, rgba(22, 7, 12, .86)) 78%, transparent);
    background:
      radial-gradient(ellipse 62% 50% at 50% 45%, rgba(255, 45, 70, .1), transparent 66%),
      radial-gradient(ellipse 40% 34% at 62% 62%, rgba(90, 126, 255, .06), transparent 70%),
      linear-gradient(180deg, #080206 0%, #030103 62%, #000000 100%);
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
  .gm-vignette,
  .gm-holo-sweep {
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
    image-rendering: auto;
    outline: none;
    width: 100% !important;
  }

  .gm-stage canvas:active {
    cursor: grabbing;
  }

  .gm-scan {
    background:
      repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255, 210, 210, .016) 2px, rgba(255, 210, 210, .016) 4px),
      linear-gradient(90deg, rgba(192, 0, 26, .03), transparent 18%, transparent 82%, rgba(192, 0, 26, .03));
    mix-blend-mode: screen;
    opacity: .66;
    pointer-events: none;
    z-index: 3;
  }

  .gm-vignette {
    background:
      radial-gradient(circle at 54% 45%, transparent 0%, transparent 51%, rgba(0, 0, 0, .66) 100%),
      linear-gradient(90deg, rgba(0, 0, 0, .66), transparent 24%, transparent 76%, rgba(0, 0, 0, .74));
    pointer-events: none;
    z-index: 4;
  }

  .gm-holo-sweep {
    background: linear-gradient(115deg, transparent 0%, transparent 43%, rgba(255, 80, 96, .08) 49%, rgba(255, 216, 160, .08) 50%, transparent 57%, transparent 100%);
    mix-blend-mode: screen;
    opacity: .58;
    pointer-events: none;
    transform: translateX(-120%);
    animation: gm-sweep 8.8s ease-in-out infinite;
    z-index: 5;
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
      linear-gradient(90deg, rgba(255, 52, 70, .08), transparent 64%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 28px rgba(255, 59, 79, .28), inset 0 0 24px rgba(255, 255, 255, .025);
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
    box-shadow: 0 0 36px rgba(255, 59, 79, .38), inset 0 0 28px rgba(255, 255, 255, .04);
    color: #ffcf91;
    outline: none;
    transform: translateY(-1px);
  }

  .gm-lockup,
  .gm-panel,
  .gm-loading,
  .gm-hint {
    background:
      linear-gradient(135deg, rgba(255, 52, 70, .07), transparent 62%),
      var(--gm-panel);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 30px rgba(255, 59, 79, .2), inset 0 0 34px rgba(255, 255, 255, .02);
    clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
    backdrop-filter: blur(14px);
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
  .gm-hint,
  .gm-selector small {
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
    text-shadow: 0 0 14px rgba(255, 59, 79, .38);
  }

  .gm-panel {
    bottom: clamp(18px, 3vw, 32px);
    max-width: 392px;
    padding: 18px;
    position: absolute;
    right: clamp(18px, 3vw, 32px);
    width: calc(100vw - 36px);
    z-index: 8;
  }

  .gm-panel-title {
    border-bottom: 1px solid var(--theme-accent-dim, #7a1a28);
    margin-bottom: 13px;
    padding-bottom: 10px;
  }

  .gm-kicker,
  .gm-kind {
    line-height: 1.45;
  }

  .gm-panel h1 {
    color: var(--text, #ffffff);
    font-family: Cinzel, serif;
    font-size: 1.82rem;
    line-height: 1.08;
    margin: 8px 0 7px;
    text-transform: uppercase;
    text-shadow: 0 0 24px rgba(255, 59, 79, .28);
  }

  .gm-panel p {
    color: var(--text-dim, #ffffff);
    font-size: .9rem;
    line-height: 1.58;
    margin: 14px 0 0;
  }

  .gm-selectors {
    display: grid;
    gap: 8px;
    margin-top: 17px;
  }

  .gm-selector {
    align-items: center;
    appearance: none;
    background:
      linear-gradient(90deg, rgba(255, 52, 70, .04), transparent 76%),
      rgba(10, 2, 5, .68);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    color: var(--text-dim, #ffffff);
    cursor: crosshair;
    display: grid;
    font: inherit;
    font-size: .82rem;
    gap: 4px 10px;
    grid-template-columns: auto 1fr auto;
    min-height: 41px;
    padding: 9px 11px;
    text-align: left;
    text-transform: uppercase;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
    width: 100%;
  }

  .gm-selector-dot {
    background: var(--body-color);
    border-radius: 999px;
    box-shadow: 0 0 16px var(--body-color), 0 0 28px var(--body-color);
    flex: 0 0 auto;
    grid-row: 1 / span 1;
    height: 9px;
    width: 9px;
  }

  .gm-selector small {
    opacity: .72;
  }

  .gm-selector:hover,
  .gm-selector:focus-visible,
  .gm-selector.is-hovered {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 24px rgba(255, 59, 79, .28);
    color: var(--text, #ffffff);
    outline: none;
    transform: translateX(-2px);
  }

  .gm-selector.is-active {
    background:
      linear-gradient(90deg, rgba(255, 52, 70, .16), transparent 78%),
      color-mix(in srgb, var(--theme-accent, #ff3b4f) 11%, #050204);
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: inset 0 0 24px rgba(255, 255, 255, .025), 0 0 30px rgba(255, 59, 79, .3);
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
    background: rgba(8, 1, 4, .72);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    box-shadow: 0 0 18px rgba(255, 59, 79, .24), inset 0 0 18px rgba(255, 255, 255, .025);
    color: var(--text-dim, #ffffff);
    cursor: crosshair;
    display: grid;
    font-family: 'Share Tech Mono', monospace;
    font-size: 10px;
    gap: 1px;
    min-width: 70px;
    padding: 5px 8px;
    text-transform: uppercase;
    transform-origin: center;
    transition: border-color .18s ease, box-shadow .18s ease, color .18s ease;
    white-space: nowrap;
  }

  .gm-world-label small {
    color: #ffcf91;
    font-size: 8px;
    letter-spacing: .08em;
    opacity: .74;
  }

  .gm-world-label.is-selected,
  .gm-world-label.is-hovered,
  .gm-world-label:hover,
  .gm-world-label:focus-visible {
    border-color: var(--theme-accent, #ff3b4f);
    box-shadow: 0 0 22px rgba(255, 59, 79, .34), inset 0 0 20px rgba(255, 255, 255, .04);
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

  @keyframes gm-sweep {
    0%, 52% { transform: translateX(-120%); }
    68%, 100% { transform: translateX(120%); }
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
      font-size: 1.25rem;
      margin: 6px 0;
    }

    .gm-panel p {
      font-size: .8rem;
      line-height: 1.45;
      margin-top: 10px;
    }

    .gm-selectors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }

    .gm-selector {
      font-size: .72rem;
      min-height: 36px;
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
      font-size: 1.08rem;
    }

    .gm-selectors {
      grid-template-columns: 1fr;
    }
  }
`;
