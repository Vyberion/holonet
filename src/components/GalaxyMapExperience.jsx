"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const TAU = Math.PI * 2;
const WIDE_CAMERA = new THREE.Vector3(0, 5.4, 14.6);
const WIDE_TARGET = new THREE.Vector3(1.25, 0.04, -0.54);
const GALAXY_TILT = new THREE.Euler(-0.1, -0.2, 0.02);

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
  return new THREE.Vector3(value[0], value[1], value[2]);
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

function makePlanetTextures(body) {
  const seed = body.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const rnd = seededRandom(seed + 1447);
  const base = body.colors?.surface || "#777777";
  const dark = body.colors?.surfaceDark || "#111111";
  const accent = body.colors?.accent || "#ffffff";

  const map = makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, dark);
    gradient.addColorStop(0.28, base);
    gradient.addColorStop(0.54, dark);
    gradient.addColorStop(0.74, base);
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < 260; i += 1) {
      const y = rnd() * height;
      const h = randRange(rnd, 1, body.id === "korriban" ? 20 : 10);
      ctx.globalAlpha = randRange(rnd, 0.045, 0.2);
      ctx.fillStyle = rnd() > 0.55 ? accent : dark;
      ctx.fillRect(0, y, width, h);
    }

    for (let i = 0; i < 190; i += 1) {
      const x = rnd() * width;
      const y = rnd() * height;
      const rx = randRange(rnd, body.id === "korriban" ? 8 : 4, body.id === "korriban" ? 72 : 34);
      const ry = randRange(rnd, 2, body.id === "korriban" ? 22 : 12);
      ctx.globalAlpha = randRange(rnd, 0.04, 0.22);
      ctx.fillStyle = rnd() > 0.48 ? colorWithAlpha(accent, 1) : colorWithAlpha(dark, 1);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    if (body.id === "korriban") {
      for (let i = 0; i < 56; i += 1) {
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
    for (let i = 0; i < 420; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.035, 0.17);
      ctx.fillStyle = rnd() > 0.5 ? "#fff" : "#111";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 5, 58), randRange(rnd, 2, 18), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  const cloudMap = makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 210; i += 1) {
      ctx.globalAlpha = randRange(rnd, 0.018, body.id === "khar-shian" ? 0.1 : 0.055);
      ctx.fillStyle = body.id === "khar-shian" ? "#dffcff" : "#ffd6bd";
      ctx.beginPath();
      ctx.ellipse(rnd() * width, rnd() * height, randRange(rnd, 18, 95), randRange(rnd, 3, 18), rnd() * TAU, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });

  return { map, bumpMap, cloudMap };
}

function makeGlowTexture() {
  return makeTextureFromCanvas((ctx, width, height) => {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.18, "rgba(255, 210, 170, .8)");
    gradient.addColorStop(0.46, "rgba(255, 52, 60, .32)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }, 512, 512);
}

function makeNebulaTexture(seed, colorA, colorB) {
  const rnd = seededRandom(seed);
  return makeTextureFromCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < 58; i += 1) {
      const x = rnd() * width;
      const y = rnd() * height;
      const radius = randRange(rnd, 64, 210);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, colorWithAlpha(rnd() > 0.5 ? colorA : colorB, randRange(rnd, 0.09, 0.24)));
      gradient.addColorStop(0.48, colorWithAlpha(rnd() > 0.5 ? colorA : colorB, randRange(rnd, 0.018, 0.07)));
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = "destination-in";
    const mask = ctx.createRadialGradient(width / 2, height / 2, width * 0.05, width / 2, height / 2, width * 0.55);
    mask.addColorStop(0, "rgba(255, 255, 255, .9)");
    mask.addColorStop(0.56, "rgba(255, 255, 255, .46)");
    mask.addColorStop(0.82, "rgba(255, 255, 255, .08)");
    mask.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = mask;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  }, 1024, 1024);
}

function makeGalaxyGeometry(count, seed, mode = "arm") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const arm = i % 5;
    const radius = Math.pow(rnd(), mode === "dust" ? 0.48 : 0.62) * 10.5 + 0.12;
    const curl = radius * 0.58;
    const angle = (arm / 5) * TAU + curl + randRange(rnd, -0.35, 0.35);
    const spread = mode === "dust" ? 0.55 : 0.16 + radius * 0.028;
    const x = Math.cos(angle) * radius * 1.18 + randRange(rnd, -spread, spread);
    const z = Math.sin(angle) * radius * 0.82 + randRange(rnd, -spread, spread);
    const y = randRange(rnd, -0.22, 0.22) * (mode === "dust" ? 1.7 : 1 + radius * 0.08);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const palette = rnd() > 0.9 ? "#ff463f" : rnd() > 0.65 ? "#ffd58a" : rnd() > 0.36 ? "#fff8e9" : "#8eeaff";
    color.set(palette).lerp(new THREE.Color("#5b6dff"), rnd() > 0.92 ? 0.25 : 0);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = mode === "dust" ? randRange(rnd, 0.025, 0.085) : randRange(rnd, 0.01, 0.045);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function makeOrbitPoints(radiusX, radiusZ, segments = 192) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
  }
  return points;
}

function makeRoutePoints(start, end, lift = 1.5) {
  const curve = new THREE.QuadraticBezierCurve3(
    start,
    start.clone().lerp(end, 0.52).add(new THREE.Vector3(0, lift, 0)),
    end
  );
  return curve.getPoints(120);
}

function LineGeometry({ points }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <primitive attach="geometry" object={geometry} />;
}

function GalaxyParticles({ mode, count, seed, opacity, sizeScale = 1 }) {
  const geometry = useMemo(() => makeGalaxyGeometry(count, seed, mode), [count, seed, mode]);
  const materialRef = useRef(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
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
            pos.y += sin(uTime * 0.28 + position.x * 1.7 + position.z) * 0.015;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = aSize * uScale * (360.0 / max(5.0, -mvPosition.z));
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
            float core = 1.0 - smoothstep(0.0, 0.2, d);
            float glow = 1.0 - smoothstep(0.1, 1.0, d);
            float twinkle = 0.78 + 0.22 * sin(uTime * 1.9 + vColor.r * 18.0);
            gl_FragColor = vec4(vColor, (core + glow * 0.58) * uOpacity * twinkle);
          }
        `}
      />
    </points>
  );
}

function NebulaField() {
  const red = useMemo(() => makeNebulaTexture(8821, "#ff3846", "#ff9a3d"), []);
  const blue = useMemo(() => makeNebulaTexture(4429, "#76e0ef", "#5b6dff"), []);

  useEffect(() => () => {
    red.dispose();
    blue.dispose();
  }, [red, blue]);

  return (
    <>
      <sprite position={[-3.8, -0.26, -4.8]} scale={[11, 6.4, 1]} rotation={[0.2, 0, -0.18]}>
        <spriteMaterial map={red} color="#ffffff" transparent opacity={0.24} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite position={[3.8, 0.16, 2.8]} scale={[9.2, 5.8, 1]} rotation={[-0.1, 0, 0.22]}>
        <spriteMaterial map={blue} color="#ffffff" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

function PlanetBody({ body, selected, hovered, onSelect, onHover }) {
  const groupRef = useRef(null);
  const planetRef = useRef(null);
  const cloudsRef = useRef(null);
  const scanRef = useRef(null);
  const haloTexture = useMemo(() => makeGlowTexture(), []);
  const textures = useMemo(() => makePlanetTextures(body), [body]);

  useEffect(() => () => {
    haloTexture.dispose();
    textures.map.dispose();
    textures.bumpMap.dispose();
    textures.cloudMap.dispose();
  }, [haloTexture, textures]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!groupRef.current) return;
    const targetScale = body.selectable ? (selected ? 1.72 : hovered ? 1.34 : 1) : 0.88;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    if (planetRef.current) {
      planetRef.current.rotation.y += 0.0028 + body.radius * 0.006;
      planetRef.current.rotation.x = Math.sin(t * 0.23 + body.radius * 13) * 0.07;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y -= 0.0015 + body.radius * 0.004;
    }
    if (scanRef.current) {
      const pulse = 0.5 + Math.sin(t * 3.2) * 0.5;
      scanRef.current.rotation.z += selected ? 0.023 : 0.011;
      scanRef.current.material.opacity = (selected ? 0.58 : hovered ? 0.42 : 0.2) + pulse * (selected ? 0.22 : 0.1);
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
    <group ref={groupRef} position={body.position} userData={{ bodyId: body.id }}>
      <mesh ref={planetRef} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
        <sphereGeometry args={[body.radius, 96, 48]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={body.id === "korriban" ? 0.045 : 0.025}
          roughness={body.id === "khar-shian" ? 0.52 : 0.86}
          metalness={body.id === "khar-shian" ? 0.08 : 0.02}
          emissive={body.colors?.surfaceDark || "#000000"}
          emissiveIntensity={selected ? 0.18 : 0.065}
        />
      </mesh>

      <mesh ref={cloudsRef} scale={1.012}>
        <sphereGeometry args={[body.radius * 1.014, 96, 48]} />
        <meshStandardMaterial
          map={textures.cloudMap}
          transparent
          opacity={body.id === "khar-shian" ? 0.32 : 0.17}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh scale={1.15}>
        <sphereGeometry args={[body.radius * 1.16, 96, 36]} />
        <meshBasicMaterial
          color={body.colors?.glow || "#ffffff"}
          transparent
          opacity={body.selectable ? (selected ? 0.19 : hovered ? 0.14 : 0.075) : 0.04}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      <sprite scale={[body.radius * (selected ? 9 : 6), body.radius * (selected ? 9 : 6), 1]}>
        <spriteMaterial
          map={haloTexture}
          color={body.colors?.glow || "#ffffff"}
          transparent
          opacity={body.selectable ? (selected ? 0.34 : hovered ? 0.24 : 0.12) : 0.04}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      <line ref={scanRef} rotation={[Math.PI / 2, 0, 0]}>
        <LineGeometry points={makeOrbitPoints(body.radius * 2.25, body.radius * 2.25, 128)} />
        <lineBasicMaterial
          color={selected ? "#ff9a3d" : body.colors?.glow || "#ff3b4f"}
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {body.selectable ? (
        <Billboard position={[0, body.radius * 2.9, 0]}>
          <Html center distanceFactor={8} transform occlude={false}>
            <button
              type="button"
              className={`gm-world-label${selected ? " is-selected" : ""}${hovered ? " is-hovered" : ""}`}
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

function OrbitTrace({ body, parent }) {
  const lineRef = useRef(null);
  const parentVector = useMemo(() => makeVector(parent.position), [parent]);
  const childVector = useMemo(() => makeVector(body.position), [body]);
  const distance = parentVector.distanceTo(childVector);
  const points = useMemo(() => makeOrbitPoints(distance, distance * 0.52, 192), [distance]);

  useFrame(() => {
    if (lineRef.current) lineRef.current.rotation.y += 0.0035;
  });

  return (
    <group position={parent.position} rotation={[Math.PI * 0.16, Math.atan2(childVector.x - parentVector.x, childVector.z - parentVector.z), 0]}>
      <line ref={lineRef}>
        <LineGeometry points={points} />
        <lineBasicMaterial color="#ff3b4f" transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </group>
  );
}

function RoutePulse({ end }) {
  const pulseRef = useRef(null);
  const points = useMemo(() => makeRoutePoints(new THREE.Vector3(0, 0.1, 0), makeVector(end), 1.85), [end]);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = (clock.elapsedTime * 0.1) % 1;
    pulseRef.current.position.copy(curve.getPointAt(t));
    pulseRef.current.material.opacity = 0.4 + Math.sin(t * TAU) * 0.24;
  });

  return (
    <>
      <line>
        <LineGeometry points={points} />
        <lineBasicMaterial color="#ff3b4f" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.055, 18, 10]} />
        <meshBasicMaterial color="#ffcf91" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
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
      if (controls) controls.autoRotate = true;
    }
  }, [map, selectedId, controlsRef, selectedPositionRef]);

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
      const scale = body?.id === "khar-shian" ? 0.76 : 0.98;
      const outward = selectedPosition.clone().sub(WIDE_TARGET).normalize().multiplyScalar(0.92 * scale);
      targetCamera.current.copy(selectedPosition).add(outward).add(new THREE.Vector3(0.86 * scale, 0.74 * scale, 1.5 * scale));
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
  const groupRef = useRef(null);
  const selectedPositionRef = useRef(null);
  const focusPosition = useMemo(() => makeVector(map.focus.position), [map]);
  const glowTexture = useMemo(() => makeGlowTexture(), []);
  const selectable = selectedId ? bodyById(map, selectedId) : null;

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = GALAXY_TILT.y + clock.elapsedTime * 0.018;
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
      <color attach="background" args={["#050204"]} />
      <fogExp2 attach="fog" args={["#080205", 0.018]} />
      <ambientLight intensity={0.22} color="#4d1b20" />
      <directionalLight position={[5, 7, 4]} intensity={3.2} color="#ffd8a8" />
      <pointLight position={[7.2, 1.7, -1.7]} intensity={68} distance={18} color="#ff3b4f" />
      <pointLight position={[3.4, 2.4, 2.8]} intensity={18} distance={20} color="#76e0ef" />

      <Stars radius={52} depth={28} count={quality === "high" ? 3600 : 1900} factor={4.5} saturation={0.45} fade speed={0.28} />
      <Sparkles count={quality === "high" ? 130 : 64} scale={[18, 4, 13]} size={1.1} speed={0.35} color="#ff9a3d" opacity={0.55} />

      <group ref={groupRef} rotation={GALAXY_TILT}>
        <NebulaField />
        <GalaxyParticles mode="arm" count={quality === "high" ? 11800 : 6200} seed={4321} opacity={0.58} sizeScale={1.05} />
        <GalaxyParticles mode="dust" count={quality === "high" ? 4200 : 2200} seed={8827} opacity={0.13} sizeScale={1.8} />
        <RoutePulse end={map.focus.position} />

        <sprite position={map.focus.position} scale={[2.8, 2.8, 1]}>
          <spriteMaterial map={glowTexture} color="#ff3b4f" transparent opacity={0.34} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>

        {[map.focus.radius * 0.85, map.focus.radius * 1.36, map.focus.radius * 1.86].map((radius, index) => (
          <line key={radius} position={map.focus.position} rotation={[Math.PI / 2.35, 0, index * 0.34]}>
            <LineGeometry points={makeOrbitPoints(radius, radius * 0.66, 192)} />
            <lineBasicMaterial color={index === 1 ? "#ff9a3d" : "#ff3b4f"} transparent opacity={index === 1 ? 0.46 : 0.24} blending={THREE.AdditiveBlending} depthWrite={false} />
          </line>
        ))}

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
        dampingFactor={0.07}
        enablePan={false}
        minDistance={2.4}
        maxDistance={24}
        autoRotate={!selectable}
        autoRotateSpeed={0.32}
        target={WIDE_TARGET}
      />
      <EffectComposer multisampling={0}>
        <Bloom intensity={quality === "high" ? 0.74 : 0.46} luminanceThreshold={0.18} luminanceSmoothing={0.62} mipmapBlur />
        <DepthOfField focusDistance={selectable ? 0.018 : 0.032} focalLength={selectable ? 0.075 : 0.045} bokehScale={quality === "high" ? 2.2 : 1.2} />
        <ChromaticAberration offset={quality === "high" ? [0.0009, 0.00045] : [0.00045, 0.0002]} />
        <Noise opacity={0.035} />
        <Vignette eskil={false} offset={0.24} darkness={0.62} />
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
          camera={{ position: WIDE_CAMERA.toArray(), fov: 48, near: 0.04, far: 130 }}
          dpr={quality === "high" ? [1, 2] : [1, 1.35]}
          gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.82;
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
          <strong>R-5 SITH WORLDS</strong>
        </div>
      </header>

      <aside className="gm-panel" aria-live="polite">
        <div className="gm-panel-title">Galaxy Map</div>
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
            </button>
          ))}
        </div>
      </aside>

      <div className="gm-hint" aria-hidden="true">
        <span>DRAG TO ORBIT</span>
        <span>SCROLL TO RANGE</span>
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
    --gm-panel: color-mix(in srgb, var(--theme-panel, rgba(22, 7, 12, .84)) 82%, transparent);
    background:
      radial-gradient(ellipse 60% 48% at 50% 46%, var(--theme-body-glow-a, rgba(160, 0, 22, .08)), transparent 66%),
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
    opacity: .78;
    pointer-events: none;
    z-index: 3;
  }

  .gm-vignette {
    background:
      radial-gradient(circle at 54% 45%, transparent 0%, transparent 45%, rgba(0, 0, 0, .72) 100%),
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
    max-width: 380px;
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
    font-size: 1.72rem;
    line-height: 1.1;
    margin: 8px 0 7px;
    text-transform: uppercase;
    text-shadow: 0 0 22px var(--theme-accent-glow, rgba(255, 59, 79, .24));
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
    background: color-mix(in srgb, var(--theme-bg, #050204) 58%, transparent);
    border: 1px solid var(--theme-accent-dim, #7a1a28);
    color: var(--text-dim, #ffffff);
    cursor: crosshair;
    display: flex;
    font: inherit;
    font-size: .82rem;
    gap: 10px;
    min-height: 39px;
    padding: 9px 11px;
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
