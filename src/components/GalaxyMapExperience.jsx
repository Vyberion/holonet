"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TAU = Math.PI * 2;
const IDLE_CAMERA = [0, 4.6, 13.8];
const IDLE_TARGET = [0.9, 0.04, -0.38];

const POINT_VERT = `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying float vPhase;
  varying vec3 vColor;
  uniform float uTime;
  uniform float uScale;

  void main() {
    vPhase = aPhase;
    vColor = aColor;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale * (92.0 / max(7.5, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const POINT_FRAG = `
  varying float vPhase;
  varying vec3 vColor;
  uniform float uTime;
  uniform float uOpacity;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.16, d);
    float glow = 1.0 - smoothstep(0.14, 1.0, d);
    float twinkle = 0.72 + 0.28 * sin(uTime * 2.4 + vPhase);
    float alpha = (core + glow * 0.62) * uOpacity * twinkle;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

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

function colorToRgb(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  const bigint = parseInt(value.length === 3 ? value.split("").map(char => char + char).join("") : value, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255
  };
}

function mixColor(left, right, amount) {
  return {
    r: left.r + (right.r - left.r) * amount,
    g: left.g + (right.g - left.g) * amount,
    b: left.b + (right.b - left.b) * amount
  };
}

function bodyById(map, id) {
  return (map.bodies || []).find(body => body.id === id) || null;
}

function makeGlowTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.22, "rgba(124, 224, 239, .72)");
  gradient.addColorStop(0.5, "rgba(255, 63, 54, .28)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLabelTexture(THREE, text, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, .42)";
  ctx.fillRect(72, 39, 368, 48);
  ctx.strokeStyle = "rgba(118, 224, 239, .28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(72.5, 39.5, 367, 47);
  ctx.font = "700 30px 'Share Tech Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 18;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.fillText(String(text || "").toUpperCase(), 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function setVec3(array, index, x, y, z) {
  array[index * 3] = x;
  array[index * 3 + 1] = y;
  array[index * 3 + 2] = z;
}

function makeGalaxyPointCloud(THREE, count, seed, mode = "disk") {
  const rnd = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const cool = colorToRgb("#8be8ff");
  const warm = colorToRgb("#f1c56d");
  const pale = colorToRgb("#f6f8ff");
  const ember = colorToRgb("#ff5a4f");
  const blue = colorToRgb("#4d6dff");

  for (let i = 0; i < count; i += 1) {
    if (mode === "sky") {
      const theta = rnd() * TAU;
      const phi = Math.acos(2 * rnd() - 1);
      const radius = randRange(rnd, 30, 56);
      setVec3(
        positions,
        i,
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius
      );
      const skyColor = mixColor(pale, rnd() > 0.84 ? cool : blue, randRange(rnd, 0.06, 0.38));
      setVec3(colors, i, skyColor.r, skyColor.g, skyColor.b);
      sizes[i] = randRange(rnd, 0.6, 1.7);
      phases[i] = rnd() * TAU;
      continue;
    }

    const arm = i % 5;
    const radius = Math.pow(rnd(), 0.58) * 9.2 + 0.18;
    const drift = randRange(rnd, -0.34, 0.34);
    const angle = (arm / 5) * TAU + radius * 0.53 + drift;
    const width = 0.14 + radius * 0.024;
    const x = Math.cos(angle) * radius * 1.12 + randRange(rnd, -width, width);
    const z = Math.sin(angle) * radius * 0.82 + randRange(rnd, -width, width);
    const y = randRange(rnd, -0.1, 0.1) * (1 + radius * 0.08);
    setVec3(positions, i, x, y, z);

    const palette = rnd() > 0.82 ? ember : rnd() > 0.58 ? cool : rnd() > 0.34 ? warm : pale;
    const color = mixColor(palette, blue, rnd() > 0.92 ? 0.2 : 0);
    setVec3(colors, i, color.r, color.g, color.b);
    sizes[i] = mode === "dust" ? randRange(rnd, 1.8, 5.6) : randRange(rnd, 0.34, 1.75);
    phases[i] = rnd() * TAU;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: mode === "dust" ? 0.055 : mode === "sky" ? 0.3 : 0.48 },
      uScale: { value: mode === "dust" ? 0.72 : mode === "sky" ? 0.92 : 0.78 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

function makeEllipseLine(THREE, radiusX, radiusZ, color, opacity, segments = 192) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * TAU;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, 0, Math.sin(angle) * radiusZ));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Line(geometry, material);
}

function makeArcLine(THREE, start, end, lift, color, opacity) {
  const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, lift, 0));
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const line = new THREE.Line(geometry, material);
  line.userData.curve = curve;
  return line;
}

function makeBodyTexture(THREE, body) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const surface = body.colors?.surface || "#888888";
  const dark = body.colors?.surfaceDark || "#111111";
  const accent = body.colors?.accent || "#ffffff";
  const rnd = seededRandom(body.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) + 810);

  const gradient = ctx.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(0.42, surface);
  gradient.addColorStop(0.72, dark);
  gradient.addColorStop(1, accent);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 110; i += 1) {
    const y = rnd() * 256;
    const h = randRange(rnd, 1, 10);
    ctx.globalAlpha = randRange(rnd, 0.04, 0.18);
    ctx.fillStyle = rnd() > 0.62 ? accent : dark;
    ctx.fillRect(0, y, 512, h);
  }

  for (let i = 0; i < 70; i += 1) {
    ctx.globalAlpha = randRange(rnd, 0.05, 0.18);
    ctx.fillStyle = rnd() > 0.52 ? "#ffffff" : dark;
    ctx.beginPath();
    ctx.ellipse(rnd() * 512, rnd() * 256, randRange(rnd, 5, 34), randRange(rnd, 2, 12), rnd() * Math.PI, 0, TAU);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function GalaxyMapExperience({ map }) {
  const mountRef = useRef(null);
  const frameRef = useRef(null);
  const threeRef = useRef({});
  const selectedIdRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const selectableBodies = useMemo(
    () => (map.bodies || []).filter(body => body.selectable),
    [map]
  );
  const selectedBody = bodyById(map, selectedId);
  const panelBody = selectedBody || map.focus;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    hoveredIdRef.current = hoveredId;
  }, [hoveredId]);

  const selectBody = useCallback(id => {
    const body = bodyById(map, id);
    if (!body?.selectable) return;
    selectedIdRef.current = id;
    setSelectedId(id);
  }, [map]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver = null;
    let onResize = null;
    let onPointerMove = null;
    let onPointerLeave = null;
    let onClick = null;

    const mount = mountRef.current;
    if (!mount) return undefined;

    async function init() {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
        const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
        const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
        const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
        if (cancelled) return;

        const getSize = () => {
          const rect = mount.getBoundingClientRect();
          return {
            width: Math.max(1, Math.floor(rect.width || window.innerWidth || 1)),
            height: Math.max(1, Math.floor(rect.height || window.innerHeight || 1))
          };
        };

        const size = getSize();
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(size.width, size.height, false);
        renderer.setClearColor(0x020104, 1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.76;
        if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
          renderer.outputColorSpace = THREE.SRGBColorSpace;
        }
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020104, 0.018);

        const camera = new THREE.PerspectiveCamera(48, size.width / size.height, 0.04, 130);
        camera.position.set(...IDLE_CAMERA);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.enablePan = false;
        controls.minDistance = 3.2;
        controls.maxDistance = 22;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.24;
        controls.target.set(...IDLE_TARGET);
        controls.update();

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.56, 0.58, 0.2);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());

        const disposables = [];
        const register = item => {
          if (!item) return item;
          if (item.geometry) disposables.push(item.geometry);
          const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
          materials.forEach(material => {
            disposables.push(material);
            ["map", "alphaMap", "bumpMap", "roughnessMap", "emissiveMap"].forEach(key => {
              if (material[key]) disposables.push(material[key]);
            });
          });
          return item;
        };

        const glowTexture = makeGlowTexture(THREE);
        disposables.push(glowTexture);

        const galaxyGroup = new THREE.Group();
        galaxyGroup.rotation.y = -0.18;
        scene.add(galaxyGroup);

        const sky = register(makeGalaxyPointCloud(THREE, 1800, 2112, "sky"));
        scene.add(sky);

        const disk = register(makeGalaxyPointCloud(THREE, 7600, 4321, "disk"));
        const dust = register(makeGalaxyPointCloud(THREE, 1900, 6157, "dust"));
        dust.scale.set(1.04, 1, 1.04);
        galaxyGroup.add(disk, dust);

        [1.8, 3.2, 4.8, 6.4, 8.1, 9.6].forEach((radius, index) => {
          const ring = register(makeEllipseLine(THREE, radius * 1.12, radius * 0.82, index % 2 ? 0x385d75 : 0x7d2232, 0.11));
          ring.userData.spin = index % 2 ? -0.00045 : 0.00035;
          galaxyGroup.add(ring);
        });

        for (let i = 0; i < 18; i += 1) {
          const angle = (i / 18) * TAU;
          const points = [
            new THREE.Vector3(Math.cos(angle) * 0.48, 0, Math.sin(angle) * 0.36),
            new THREE.Vector3(Math.cos(angle) * 10.8, 0, Math.sin(angle) * 7.9)
          ];
          const spoke = register(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
              color: i % 3 === 0 ? 0x6dd4e4 : 0x7b1c2b,
              transparent: true,
              opacity: i % 3 === 0 ? 0.12 : 0.075,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          ));
          galaxyGroup.add(spoke);
        }

        const core = new THREE.Group();
        const coreGlow = register(new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xf4c66a,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })));
        coreGlow.scale.set(2.8, 2.8, 1);
        const coreBall = register(new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 32, 16),
          new THREE.MeshBasicMaterial({ color: 0xffdf8a, transparent: true, opacity: 0.88 })
        ));
        core.add(coreGlow, coreBall);
        galaxyGroup.add(core);

        const focusPosition = new THREE.Vector3(...map.focus.position);
        const focusGroup = new THREE.Group();
        focusGroup.position.copy(focusPosition);
        galaxyGroup.add(focusGroup);

        const focusGlow = register(new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xff3d35,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })));
        focusGlow.scale.set(2.8, 2.8, 1);
        focusGroup.add(focusGlow);

        const focusRings = [map.focus.radius, map.focus.radius * 1.34, map.focus.radius * 1.76].map((radius, index) => {
          const ring = register(makeEllipseLine(THREE, radius, radius * 0.66, index === 1 ? 0x76e0ef : 0xff473f, index === 1 ? 0.36 : 0.28, 160));
          ring.userData.spin = index % 2 ? -0.0022 : 0.0016;
          focusGroup.add(ring);
          return ring;
        });

        const arcs = [];
        const arcEnds = [
          focusPosition.clone(),
          focusPosition.clone().add(new THREE.Vector3(-0.32, 0.1, 0.22)),
          focusPosition.clone().add(new THREE.Vector3(0.2, -0.04, -0.3))
        ];
        arcEnds.forEach((end, index) => {
          const line = register(makeArcLine(THREE, new THREE.Vector3(0, 0.08, 0), end, 1.4 + index * 0.34, index === 1 ? 0x76e0ef : 0xff443b, index === 1 ? 0.42 : 0.34));
          arcs.push(line);
          galaxyGroup.add(line);
        });

        const arcPulses = arcs.map((arc, index) => {
          const pulse = register(new THREE.Mesh(
            new THREE.SphereGeometry(index === 1 ? 0.035 : 0.045, 16, 8),
            new THREE.MeshBasicMaterial({
              color: index === 1 ? 0x76e0ef : 0xffdf8a,
              transparent: true,
              opacity: 0.86,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          ));
          pulse.userData = { curve: arc.userData.curve, offset: index * 0.28 };
          galaxyGroup.add(pulse);
          return pulse;
        });

        const bodyObjects = new Map();
        const hitTargets = [];
        const parentLines = [];

        (map.bodies || []).forEach((body, index) => {
          const bodyGroup = new THREE.Group();
          bodyGroup.position.set(...body.position);
          bodyGroup.userData.baseScale = body.selectable ? 1 : 0.82;
          bodyGroup.userData.currentScale = bodyGroup.userData.baseScale;
          galaxyGroup.add(bodyGroup);

          const texture = makeBodyTexture(THREE, body);
          disposables.push(texture);
          const planetMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            color: body.colors?.surface || "#888888",
            roughness: body.id === "khar-shian" ? 0.62 : 0.86,
            metalness: body.id === "khar-shian" ? 0.08 : 0.02,
            emissive: body.colors?.surfaceDark || "#000000",
            emissiveIntensity: body.selectable ? 0.13 : 0.04
          });
          const planet = register(new THREE.Mesh(
            new THREE.SphereGeometry(body.radius, 48, 24),
            planetMaterial
          ));
          planet.userData.rotationSpeed = 0.003 + index * 0.0012;
          bodyGroup.add(planet);

          const atmosphere = register(new THREE.Mesh(
            new THREE.SphereGeometry(body.radius * 1.22, 48, 20),
            new THREE.MeshBasicMaterial({
              color: body.colors?.glow || "#ffffff",
              transparent: true,
              opacity: body.selectable ? 0.18 : 0.055,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.BackSide
            })
          ));
          bodyGroup.add(atmosphere);

          const marker = register(makeEllipseLine(THREE, body.radius * 2.15, body.radius * 2.15, body.selectable ? 0x76e0ef : 0x84636c, body.selectable ? 0.5 : 0.16, 96));
          marker.rotation.x = Math.PI * 0.5;
          marker.userData.baseOpacity = marker.material.opacity;
          marker.userData.spin = body.selectable ? 0.015 : 0.006;
          bodyGroup.add(marker);

          const halo = register(new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture,
            color: body.colors?.glow || "#ffffff",
            transparent: true,
            opacity: body.selectable ? 0.18 : 0.052,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })));
          halo.scale.set(body.radius * 5.6, body.radius * 5.6, 1);
          bodyGroup.add(halo);

          let label = null;
          if (body.selectable) {
            const labelTexture = makeLabelTexture(THREE, body.shortName || body.name, body.colors?.glow || "#ffffff");
            disposables.push(labelTexture);
            label = register(new THREE.Sprite(new THREE.SpriteMaterial({
              map: labelTexture,
              transparent: true,
              opacity: 0.88,
              depthWrite: false
            })));
            label.position.set(0, body.radius * 2.85, 0);
            label.scale.set(1.06, 0.27, 1);
            bodyGroup.add(label);
          }

          let hit = null;
          if (body.selectable) {
            hit = new THREE.Mesh(
              new THREE.SphereGeometry(body.radius * 2.2, 24, 12),
              new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
            );
            hit.userData.bodyId = body.id;
            hit.userData.selectable = true;
            bodyGroup.add(hit);
            hitTargets.push(hit);
            register(hit);
          }

          bodyObjects.set(body.id, {
            body,
            group: bodyGroup,
            planet,
            atmosphere,
            marker,
            halo,
            label,
            hit
          });
        });

        (map.bodies || []).forEach(body => {
          if (!body.parentId) return;
          const parent = bodyById(map, body.parentId);
          if (!parent) return;
          const line = register(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(...parent.position),
              new THREE.Vector3(...body.position)
            ]),
            new THREE.LineBasicMaterial({
              color: 0x76e0ef,
              transparent: true,
              opacity: 0.28,
              blending: THREE.AdditiveBlending,
              depthWrite: false
            })
          ));
          parentLines.push(line);
          galaxyGroup.add(line);

          const parentVector = new THREE.Vector3(...parent.position);
          const moonVector = new THREE.Vector3(...body.position);
          const orbit = register(makeEllipseLine(THREE, parentVector.distanceTo(moonVector), parentVector.distanceTo(moonVector) * 0.52, 0x76e0ef, 0.22, 128));
          orbit.position.copy(parentVector);
          orbit.rotation.y = Math.atan2(moonVector.x - parentVector.x, moonVector.z - parentVector.z);
          orbit.rotation.x = Math.PI * 0.16;
          orbit.userData.spin = 0.0032;
          galaxyGroup.add(orbit);
          parentLines.push(orbit);
        });

        const ambient = new THREE.AmbientLight(0x223348, 0.6);
        scene.add(ambient);
        const keyLight = new THREE.DirectionalLight(0xffe3b8, 2.8);
        keyLight.position.set(3.4, 6.2, 5.8);
        scene.add(keyLight);
        const rimLight = new THREE.PointLight(0x76e0ef, 34, 22, 1.8);
        rimLight.position.copy(focusPosition).add(new THREE.Vector3(0.2, 1.1, 1.6));
        scene.add(rimLight);
        const redLight = new THREE.PointLight(0xff342e, 28, 18, 2);
        redLight.position.copy(focusPosition).add(new THREE.Vector3(-0.7, 0.7, -0.6));
        scene.add(redLight);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        const findHit = event => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
          raycaster.setFromCamera(pointer, camera);
          const [hit] = raycaster.intersectObjects(hitTargets, false);
          return hit?.object?.userData?.bodyId || null;
        };

        onPointerMove = event => {
          const nextId = findHit(event);
          if (hoveredIdRef.current !== nextId) {
            hoveredIdRef.current = nextId;
            setHoveredId(nextId);
          }
          renderer.domElement.style.cursor = nextId ? "pointer" : "grab";
        };

        onPointerLeave = () => {
          hoveredIdRef.current = null;
          setHoveredId(null);
          renderer.domElement.style.cursor = "grab";
        };

        onClick = event => {
          const nextId = findHit(event);
          if (nextId) selectBody(nextId);
        };

        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerleave", onPointerLeave);
        renderer.domElement.addEventListener("click", onClick);

        onResize = () => {
          const next = getSize();
          renderer.setSize(next.width, next.height, false);
          composer.setSize(next.width, next.height);
          bloom.resolution.set(next.width, next.height);
          camera.aspect = next.width / next.height;
          camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", onResize);
        if ("ResizeObserver" in window) {
          resizeObserver = new ResizeObserver(onResize);
          resizeObserver.observe(mount);
        }

        threeRef.current = {
          THREE,
          ready: true,
          renderer,
          composer,
          scene,
          camera,
          controls,
          bloom,
          disk,
          dust,
          sky,
          galaxyGroup,
          focusGlow,
          focusRings,
          arcs,
          arcPulses,
          bodyObjects,
          parentLines,
          disposables,
          idleCamera: new THREE.Vector3(...IDLE_CAMERA),
          idleTarget: new THREE.Vector3(...IDLE_TARGET),
          targetCamera: new THREE.Vector3(...IDLE_CAMERA),
          targetControl: new THREE.Vector3(...IDLE_TARGET),
          t: 0
        };

        setReady(true);

        function tick() {
          frameRef.current = requestAnimationFrame(tick);
          const r = threeRef.current;
          if (!r.ready) return;
          r.t += 0.016;
          const time = r.t;
          const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;

          r.disk.material.uniforms.uTime.value = time;
          r.dust.material.uniforms.uTime.value = time * 0.7;
          r.sky.material.uniforms.uTime.value = time * 0.45;
          r.galaxyGroup.rotation.y += 0.00055;
          r.focusGlow.material.opacity = 0.16 + pulse * 0.1;
          r.focusRings.forEach((ring, index) => {
            ring.rotation.y += ring.userData.spin;
            ring.rotation.z += ring.userData.spin * 0.62;
            ring.material.opacity = (index === 1 ? 0.28 : 0.2) + pulse * 0.13;
          });
          r.parentLines.forEach(item => {
            item.rotation.y += item.userData.spin || 0;
            if (item.material?.opacity !== undefined) {
              item.material.opacity = Math.max(0.1, item.material.opacity * 0.992 + (0.18 + pulse * 0.1) * 0.008);
            }
          });
          r.arcPulses.forEach(pulseMesh => {
            const curve = pulseMesh.userData.curve;
            const t = (time * 0.14 + pulseMesh.userData.offset) % 1;
            if (curve) pulseMesh.position.copy(curve.getPointAt(t));
            pulseMesh.material.opacity = 0.42 + Math.sin((t + time) * TAU) * 0.24;
          });

          let selectedObject = null;
          const activeId = selectedIdRef.current;
          const hoverId = hoveredIdRef.current;
          r.bodyObjects.forEach((object, id) => {
            const selected = id === activeId;
            const hovered = id === hoverId;
            const targetScale = object.group.userData.baseScale * (selected ? 1.55 : hovered ? 1.28 : 1);
            object.group.userData.currentScale += (targetScale - object.group.userData.currentScale) * 0.12;
            object.group.scale.setScalar(object.group.userData.currentScale);
            object.planet.rotation.y += object.planet.userData.rotationSpeed;
            object.planet.rotation.x = Math.sin(time * 0.28 + object.body.radius * 10) * 0.08;
            object.marker.rotation.z += object.marker.userData.spin;
            object.marker.material.opacity = object.marker.userData.baseOpacity * (selected ? 1.8 : hovered ? 1.35 : 1) * (0.82 + pulse * 0.32);
            object.atmosphere.material.opacity = (object.body.selectable ? 0.14 : 0.045) * (selected ? 2.2 : hovered ? 1.6 : 1) * (0.82 + pulse * 0.38);
            object.halo.material.opacity = (object.body.selectable ? 0.16 : 0.046) * (selected ? 2.4 : hovered ? 1.7 : 1);
            if (object.label) {
              object.label.material.opacity = selected || hovered ? 1 : 0.74;
              object.label.position.y = object.body.radius * (selected ? 3.25 : 2.85);
            }
            if (selected) selectedObject = object;
          });

          if (selectedObject) {
            const selectedWorld = new THREE.Vector3();
            selectedObject.group.getWorldPosition(selectedWorld);
            const scale = selectedObject.body.id === "khar-shian" ? 0.74 : 0.95;
            const outward = selectedWorld.clone().normalize().multiplyScalar(0.92 * scale);
            r.targetCamera.copy(selectedWorld).add(outward).add(new THREE.Vector3(0.88 * scale, 0.78 * scale, 1.44 * scale));
            r.targetControl.copy(selectedWorld);
            r.controls.autoRotate = false;
          } else {
            r.targetCamera.copy(r.idleCamera);
            r.targetControl.copy(r.idleTarget);
            r.controls.autoRotate = true;
          }

          r.camera.position.lerp(r.targetCamera, selectedObject ? 0.038 : 0.025);
          r.controls.target.lerp(r.targetControl, selectedObject ? 0.055 : 0.026);
          r.controls.update();
          r.bloom.strength = 0.48 + pulse * 0.14 + (selectedObject ? 0.16 : 0);
          r.composer.render();
        }

        tick();
      } catch (error) {
        console.error("Galaxy map failed to initialise:", error);
        if (!cancelled) setLoadError(error?.message || "Galaxy map failed to initialise");
      }
    }

    init();

    return () => {
      cancelled = true;
      setReady(false);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (onResize) window.removeEventListener("resize", onResize);
      if (resizeObserver) resizeObserver.disconnect();
      const r = threeRef.current;
      if (r.renderer?.domElement) {
        if (onPointerMove) r.renderer.domElement.removeEventListener("pointermove", onPointerMove);
        if (onPointerLeave) r.renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
        if (onClick) r.renderer.domElement.removeEventListener("click", onClick);
      }
      r.controls?.dispose?.();
      r.composer?.dispose?.();
      r.renderer?.dispose?.();
      if (r.renderer?.domElement && mount.contains(r.renderer.domElement)) mount.removeChild(r.renderer.domElement);
      r.disposables?.forEach(item => item?.dispose?.());
      threeRef.current = {};
    };
  }, [map, selectBody]);

  return (
    <section className={`gm-root${ready ? " gm-root--ready" : ""}`} aria-label="Hidden Archives Galaxy Map">
      <div className="gm-stage" ref={mountRef} aria-hidden="true" />
      <div className="gm-scan" aria-hidden="true" />
      <div className="gm-vignette" aria-hidden="true" />

      <header className="gm-topbar">
        <a className="gm-back" href="/archives" aria-label="Back to archives">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
            <path d="M9 12h11" />
          </svg>
        </a>
        <div className="gm-lockup">
          <span>ARCHIVES</span>
          <strong>R-5 SITH WORLDS</strong>
        </div>
      </header>

      <aside className="gm-panel" aria-live="polite">
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
            >
              <span className="gm-selector-dot" style={{ "--body-color": body.colors?.glow || "#ffffff" }} />
              <span>{body.shortName || body.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {!ready && !loadError ? (
        <div className="gm-loading">
          <span />
          <strong>CALIBRATING ARCHIVE MAP</strong>
        </div>
      ) : null}
      {loadError ? <div className="gm-error">GALAXY MAP RENDER FAILURE<br />{loadError}</div> : null}

      <style>{STYLES}</style>
    </section>
  );
}

const STYLES = `
  html:has(.gm-root),
  body:has(.gm-root) {
    background: #020104;
    overflow: hidden;
  }

  .gm-root {
    background:
      radial-gradient(circle at 72% 40%, rgba(118, 224, 239, .11), transparent 30%),
      radial-gradient(circle at 36% 62%, rgba(255, 70, 58, .14), transparent 34%),
      linear-gradient(180deg, #020104 0%, #030611 52%, #000000 100%);
    color: #f8fbff;
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
    width: 100% !important;
  }

  .gm-stage canvas:active {
    cursor: grabbing;
  }

  .gm-scan {
    background:
      repeating-linear-gradient(0deg, rgba(118, 224, 239, .025) 0, rgba(118, 224, 239, .025) 1px, transparent 1px, transparent 4px),
      linear-gradient(90deg, rgba(255, 62, 54, .08), transparent 18%, transparent 82%, rgba(118, 224, 239, .08));
    mix-blend-mode: screen;
    opacity: .32;
    pointer-events: none;
    z-index: 3;
  }

  .gm-vignette {
    background:
      radial-gradient(circle at 54% 45%, transparent 0%, transparent 48%, rgba(0, 0, 0, .78) 100%),
      linear-gradient(90deg, rgba(0, 0, 0, .68), transparent 22%, transparent 76%, rgba(0, 0, 0, .78));
    pointer-events: none;
    z-index: 4;
  }

  .gm-topbar {
    align-items: center;
    display: flex;
    gap: 12px;
    left: 22px;
    max-width: calc(100vw - 44px);
    position: absolute;
    top: 22px;
    z-index: 8;
  }

  .gm-back {
    align-items: center;
    background: rgba(1, 7, 12, .62);
    border: 1px solid rgba(118, 224, 239, .36);
    border-radius: 8px;
    box-shadow: 0 0 34px rgba(118, 224, 239, .12), inset 0 0 22px rgba(118, 224, 239, .06);
    color: #dffbff;
    display: inline-flex;
    height: 42px;
    justify-content: center;
    text-decoration: none;
    transition: border-color .18s ease, box-shadow .18s ease, color .18s ease, transform .18s ease;
    width: 42px;
  }

  .gm-back svg {
    fill: none;
    height: 22px;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
    width: 22px;
  }

  .gm-back:hover,
  .gm-back:focus-visible {
    border-color: rgba(255, 210, 123, .78);
    box-shadow: 0 0 44px rgba(255, 210, 123, .2), inset 0 0 24px rgba(118, 224, 239, .1);
    color: #ffe7a8;
    outline: none;
    transform: translateY(-1px);
  }

  .gm-lockup {
    background: linear-gradient(90deg, rgba(255, 64, 55, .16), rgba(118, 224, 239, .08)), rgba(1, 7, 12, .58);
    border: 1px solid rgba(255, 81, 68, .28);
    border-radius: 8px;
    box-shadow: inset 0 0 30px rgba(255, 64, 55, .045);
    display: grid;
    gap: 2px;
    min-width: 186px;
    padding: 9px 13px;
  }

  .gm-lockup span,
  .gm-kicker,
  .gm-kind {
    color: #8defff;
    font-size: .7rem;
  }

  .gm-lockup strong {
    color: #fff6de;
    font-size: .88rem;
    font-weight: 700;
  }

  .gm-panel {
    background:
      linear-gradient(135deg, rgba(255, 71, 61, .1), transparent 42%),
      linear-gradient(180deg, rgba(5, 12, 19, .86), rgba(2, 3, 8, .78));
    border: 1px solid rgba(118, 224, 239, .28);
    border-radius: 8px;
    bottom: 28px;
    box-shadow:
      0 28px 80px rgba(0, 0, 0, .48),
      0 0 60px rgba(118, 224, 239, .09),
      inset 0 0 36px rgba(255, 73, 61, .05);
    max-width: 360px;
    padding: 20px;
    position: absolute;
    right: 28px;
    width: calc(100vw - 56px);
    z-index: 8;
  }

  .gm-kicker,
  .gm-kind {
    color: #8defff;
    line-height: 1.4;
  }

  .gm-panel h1 {
    color: #fff7e4;
    font-family: Cinzel, serif;
    font-size: 1.72rem;
    line-height: 1.1;
    margin: 8px 0 7px;
  }

  .gm-panel p {
    color: rgba(248, 251, 255, .82);
    font-size: .92rem;
    line-height: 1.55;
    margin: 14px 0 0;
  }

  .gm-selectors {
    display: grid;
    gap: 8px;
    margin-top: 17px;
  }

  .gm-selector {
    align-items: center;
    background: rgba(0, 0, 0, .28);
    border: 1px solid rgba(118, 224, 239, .2);
    border-radius: 8px;
    color: #dffbff;
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: .9rem;
    gap: 10px;
    min-height: 40px;
    padding: 9px 11px;
    text-align: left;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, color .18s ease;
    width: 100%;
  }

  .gm-selector-dot {
    background: var(--body-color);
    border-radius: 999px;
    box-shadow: 0 0 16px var(--body-color);
    flex: 0 0 auto;
    height: 10px;
    width: 10px;
  }

  .gm-selector:hover,
  .gm-selector:focus-visible,
  .gm-selector.is-hovered {
    border-color: rgba(255, 220, 145, .6);
    box-shadow: 0 0 28px rgba(255, 210, 123, .12);
    color: #fff2cc;
    outline: none;
  }

  .gm-selector.is-active {
    background: linear-gradient(90deg, rgba(255, 74, 60, .18), rgba(118, 224, 239, .08));
    border-color: rgba(118, 224, 239, .58);
    box-shadow: inset 0 0 24px rgba(118, 224, 239, .08), 0 0 30px rgba(118, 224, 239, .12);
    color: #ffffff;
  }

  .gm-loading,
  .gm-error {
    left: 50%;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 12;
  }

  .gm-loading {
    align-items: center;
    background: rgba(0, 0, 0, .54);
    border: 1px solid rgba(118, 224, 239, .3);
    border-radius: 8px;
    color: #dffbff;
    display: flex;
    gap: 12px;
    padding: 14px 17px;
  }

  .gm-loading span {
    animation: gm-spin 1.1s linear infinite;
    border: 2px solid rgba(118, 224, 239, .22);
    border-top-color: #ffe2a0;
    border-radius: 999px;
    height: 18px;
    width: 18px;
  }

  .gm-loading strong {
    font-size: .82rem;
  }

  @keyframes gm-spin {
    to { transform: rotate(360deg); }
  }

  .gm-error {
    background: rgba(14, 0, 5, .86);
    border: 1px solid rgba(255, 74, 60, .48);
    border-radius: 8px;
    box-shadow: 0 0 60px rgba(255, 74, 60, .18);
    color: #ffd5ce;
    line-height: 1.5;
    max-width: min(620px, calc(100vw - 40px));
    padding: 22px;
    text-align: center;
  }

  @media (max-width: 760px) {
    .gm-topbar {
      left: 14px;
      right: 14px;
      top: 14px;
    }

    .gm-lockup {
      min-width: 0;
      width: 100%;
    }

    .gm-panel {
      bottom: 14px;
      left: 14px;
      max-width: none;
      padding: 15px;
      right: 14px;
      width: auto;
    }

    .gm-panel h1 {
      font-size: 1.34rem;
      margin: 6px 0;
    }

    .gm-panel p {
      font-size: .84rem;
      line-height: 1.45;
      margin-top: 10px;
    }

    .gm-selectors {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }

    .gm-selector {
      font-size: .8rem;
      min-height: 38px;
      padding: 8px;
    }
  }

  @media (max-width: 420px) {
    .gm-lockup span,
    .gm-kicker,
    .gm-kind {
      font-size: .62rem;
    }

    .gm-lockup strong {
      font-size: .76rem;
    }

    .gm-panel h1 {
      font-size: 1.16rem;
    }

    .gm-selectors {
      grid-template-columns: 1fr;
    }
  }
`;
