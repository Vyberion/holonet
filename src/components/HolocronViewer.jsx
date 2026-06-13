'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { nodes, edges } from '../../modules/data/archives-2.js'

const PHASE = {
  IDLE: 'idle',
  BURST: 'burst',
  CONSTELLATION: 'constellation',
  ARTICLE: 'article',
}

const POINT_VERT = `
  attribute float aSize;
  attribute float aPhase;
  varying float vPhase;
  uniform float uTime;

  void main() {
    vPhase = aPhase;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / max(0.35, -mvPos.z));
    gl_Position = projectionMatrix * mvPos;
  }
`

const POINT_FRAG = `
  varying float vPhase;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    float core = 1.0 - smoothstep(0.0, 0.18, d);
    float glow = 1.0 - smoothstep(0.06, 1.0, d);
    float flicker = 0.72 + 0.28 * sin(uTime * 3.5 + vPhase);
    vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vPhase));
    float alpha = (core + glow * 0.6) * uOpacity * flicker;
    gl_FragColor = vec4(col, alpha);
  }
`

const SEAM_VERT = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SEAM_FRAG = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;

  void main() {
    float pulse = 0.62 + 0.38 * sin(uTime * 3.1);
    float scan = 0.75 + 0.25 * sin((vUv.x + vUv.y) * 34.0 - uTime * 2.0);
    float border = smoothstep(0.0, 0.14, vUv.x) * smoothstep(0.0, 0.14, vUv.y) * smoothstep(0.0, 0.14, 1.0 - vUv.x);
    vec3 deepRed = vec3(0.8, 0.0, 0.02);
    gl_FragColor = vec4(deepRed, uOpacity * pulse * scan * border);
  }
`

const SHOCK_VERT = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SHOCK_FRAG = `
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uOpacity;

  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float band = smoothstep(uProgress - 0.08, uProgress - 0.02, r) * (1.0 - smoothstep(uProgress, uProgress + 0.04, r));
    float inner = (1.0 - smoothstep(0.0, max(0.025, uProgress - 0.08), r)) * 0.08;
    gl_FragColor = vec4(0.85, 0.0, 0.03, (band * 1.35 + inner) * uOpacity);
  }
`

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function spherePoint(radius) {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  return {
    x: Math.sin(phi) * Math.cos(theta) * radius,
    y: Math.sin(phi) * Math.sin(theta) * radius,
    z: Math.cos(phi) * radius,
  }
}

function setBufferPoint(array, index, point) {
  array[index * 3] = point.x
  array[index * 3 + 1] = point.y
  array[index * 3 + 2] = point.z
}

function makeCircleTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.15, 'rgba(240,16,52,.85)')
  grad.addColorStop(0.45, 'rgba(80,0,16,.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  return canvas
}

function seededRand(seed) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function drawScratchLine(ctx, rnd, size, mode, alphaBoost = 1) {
  const x = rnd() * size
  const y = rnd() * size
  const angle = rnd() * Math.PI * 2
  const length = 12 + rnd() * rnd() * 310
  const width = 0.35 + rnd() * 2.1
  const curve = (rnd() - 0.5) * 28
  const x2 = x + Math.cos(angle) * length
  const y2 = y + Math.sin(angle) * length
  const mx = (x + x2) * 0.5 + Math.cos(angle + Math.PI * 0.5) * curve
  const my = (y + y2) * 0.5 + Math.sin(angle + Math.PI * 0.5) * curve
  const hot = rnd() > 0.925

  if (mode === 'color') {
    ctx.strokeStyle = hot
      ? `rgba(${110 + rnd() * 70}, ${4 + rnd() * 12}, ${10 + rnd() * 18}, ${0.08 * alphaBoost})`
      : `rgba(${76 + rnd() * 88}, ${74 + rnd() * 82}, ${70 + rnd() * 70}, ${(0.03 + rnd() * 0.2) * alphaBoost})`
  } else if (mode === 'roughness') {
    const g = 130 + rnd() * 120
    ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, ${(0.09 + rnd() * 0.26) * alphaBoost})`
  } else {
    const g = rnd() > 0.5 ? 54 + rnd() * 44 : 160 + rnd() * 66
    ctx.strokeStyle = `rgba(${g}, ${g}, ${g}, ${(0.12 + rnd() * 0.24) * alphaBoost})`
  }

  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(mx, my, x2, y2)
  ctx.stroke()
}

function makeWearCanvas(THREE, seed, mode = 'color', size = 1024, repeat = 2.8) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const rnd = seededRand(seed)

  if (mode === 'color') {
    const grad = ctx.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, '#020203')
    grad.addColorStop(0.28, '#0d0e10')
    grad.addColorStop(0.54, '#030304')
    grad.addColorStop(0.78, '#151619')
    grad.addColorStop(1, '#040405')
    ctx.fillStyle = grad
  } else if (mode === 'roughness') {
    ctx.fillStyle = '#8b8b8b'
  } else {
    ctx.fillStyle = '#808080'
  }
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 520; i += 1) {
    const x = rnd() * size
    const y = rnd() * size
    const radius = 2 + rnd() * rnd() * 24
    if (mode === 'color') ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + rnd() * 0.22})`
    else if (mode === 'roughness') ctx.fillStyle = `rgba(230, 230, 230, ${0.04 + rnd() * 0.18})`
    else ctx.fillStyle = `rgba(${58 + rnd() * 26}, ${58 + rnd() * 26}, ${58 + rnd() * 26}, ${0.05 + rnd() * 0.18})`
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  for (let i = 0; i < 2600; i += 1) drawScratchLine(ctx, rnd, size, mode, 1)

  for (let i = 0; i < 190; i += 1) {
    const x = rnd() * size
    const y = rnd() * size
    const w = 18 + rnd() * 170
    const h = 1 + rnd() * 5
    const angle = rnd() * Math.PI * 2
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    if (mode === 'color') {
      ctx.fillStyle = rnd() > 0.72 ? 'rgba(110, 0, 14, .13)' : 'rgba(180, 180, 165, .12)'
    } else if (mode === 'roughness') {
      ctx.fillStyle = 'rgba(245, 245, 245, .25)'
    } else {
      ctx.fillStyle = 'rgba(35, 35, 35, .28)'
    }
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h)
    ctx.restore()
  }

  for (let i = 0; i < 120; i += 1) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 12 + rnd() * 88
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    if (mode === 'color') {
      grad.addColorStop(0, 'rgba(65,0,9,.18)')
      grad.addColorStop(0.55, 'rgba(22,0,3,.09)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
    } else if (mode === 'roughness') {
      grad.addColorStop(0, 'rgba(210,210,210,.16)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
    } else {
      grad.addColorStop(0, 'rgba(72,72,72,.14)')
      grad.addColorStop(1, 'rgba(128,128,128,0)')
    }
    ctx.fillStyle = grad
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.needsUpdate = true
  texture.anisotropy = 8
  if (mode === 'color' && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeProceduralWearPack(THREE) {
  return {
    body: {
      color: makeWearCanvas(THREE, 4101, 'color', 1024, 1.6),
      roughness: makeWearCanvas(THREE, 4102, 'roughness', 1024, 1.6),
      bump: makeWearCanvas(THREE, 4103, 'bump', 1024, 1.6),
    },
    plates: {
      color: makeWearCanvas(THREE, 5201, 'color', 1024, 2.4),
      roughness: makeWearCanvas(THREE, 5202, 'roughness', 1024, 2.4),
      bump: makeWearCanvas(THREE, 5203, 'bump', 1024, 2.4),
    },
    edges: {
      color: makeWearCanvas(THREE, 6301, 'color', 1024, 3.2),
      roughness: makeWearCanvas(THREE, 6302, 'roughness', 1024, 3.2),
      bump: makeWearCanvas(THREE, 6303, 'bump', 1024, 3.2),
    },
  }
}

function applyWearMaps(material, pack, options = {}) {
  if (!material || !pack) return material
  material.map = pack.color
  material.roughnessMap = pack.roughness
  material.bumpMap = pack.bump
  material.bumpScale = options.bumpScale ?? 0.04
  if (typeof options.roughness === 'number') material.roughness = options.roughness
  material.needsUpdate = true
  return material
}


function makePyramidData(THREE) {
  const top = new THREE.Vector3(0, 1.54, 0)
  const baseY = -0.96
  const baseRadius = 1.54
  const b0 = new THREE.Vector3(0, baseY, baseRadius)
  const b1 = new THREE.Vector3(-baseRadius * 0.8660254, baseY, -baseRadius * 0.5)
  const b2 = new THREE.Vector3(baseRadius * 0.8660254, baseY, -baseRadius * 0.5)
  const faces = [
    [top, b0, b1],
    [top, b1, b2],
    [top, b2, b0],
    [b0, b2, b1],
  ]
  const edges = [
    [top, b0], [top, b1], [top, b2],
    [b0, b1], [b1, b2], [b2, b0],
  ]

  const positions = []
  faces.forEach(face => {
    face.forEach(v => positions.push(v.x, v.y, v.z))
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0.5, 1, 0, 0, 1, 0,
    0.5, 1, 0, 0, 1, 0,
    0.5, 1, 0, 0, 1, 0,
    0.5, 1, 0, 0, 1, 0,
  ], 2))
  geometry.computeVertexNormals()

  return { geometry, faces, edges, top, baseY, baseRadius }
}

function createCylinderBetween(THREE, start, end, radius, material, segments = 6) {
  const direction = new THREE.Vector3().subVectors(end, start)
  const length = direction.length()
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  return mesh
}
function makeEdgeRail(THREE, start, end, faceNormalA, faceNormalB, width, depth, material) {
  const edgeVec = new THREE.Vector3().subVectors(end, start)
  const edgeDir = edgeVec.clone().normalize()
  const outward = new THREE.Vector3().addVectors(faceNormalA, faceNormalB).normalize()
  const lateral = new THREE.Vector3().crossVectors(edgeDir, outward).normalize()
  const hw = width * 0.5
  const cs = [
    new THREE.Vector3().addScaledVector(lateral, -hw),
    new THREE.Vector3().addScaledVector(lateral, hw),
    new THREE.Vector3().addScaledVector(lateral, hw * 0.42).addScaledVector(outward, depth),
    new THREE.Vector3().addScaledVector(lateral, -hw * 0.42).addScaledVector(outward, depth),
  ]
  const verts = []
  const uvs = []
  const indices = []
  const pts = [start.clone(), end.clone()]
  const csEdges = [[0,1],[1,2],[2,3],[3,0]]
  csEdges.forEach(([a, b]) => {
    const base = verts.length / 3
    pts.forEach((p, pi) => {
      verts.push(p.x+cs[a].x, p.y+cs[a].y, p.z+cs[a].z)
      verts.push(p.x+cs[b].x, p.y+cs[b].y, p.z+cs[b].z)
      uvs.push(pi, 0, pi, 1)
    })
    indices.push(base, base+2, base+1, base+1, base+2, base+3)
  })
  ;[0,1].forEach(pi => {
    const p = pts[pi]
    const base = verts.length / 3
    cs.forEach(c => { verts.push(p.x+c.x, p.y+c.y, p.z+c.z); uvs.push(0.5,0.5) })
    if (pi===0) { indices.push(base,base+2,base+1,base,base+3,base+2) }
    else { indices.push(base,base+1,base+2,base,base+2,base+3) }
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  return mesh
}

function makeLine(THREE, points, material, closed = false) {
  const list = closed ? [...points, points[0]] : points
  const geometry = new THREE.BufferGeometry().setFromPoints(list)
  return new THREE.Line(geometry, material)
}

function insetFace(THREE, face, scale, offset) {
  const [a, b, c] = face
  const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3)
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
  return [a, b, c].map(p => new THREE.Vector3().copy(center).add(new THREE.Vector3().subVectors(p, center).multiplyScalar(scale)).addScaledVector(normal, offset))
}

function addTriangleMesh(THREE, group, points, material) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(p => [p.x, p.y, p.z]), 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0, 1, 0], 2))
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  group.add(mesh)
  return mesh
}

function faceFrameVectors(THREE, face) {
  const normal = new THREE.Vector3().subVectors(face[1], face[0]).cross(new THREE.Vector3().subVectors(face[2], face[0])).normalize()
  const center = new THREE.Vector3().add(face[0]).add(face[1]).add(face[2]).multiplyScalar(1 / 3)
  const u = new THREE.Vector3().subVectors(face[1], face[0]).normalize()
  const v = new THREE.Vector3().crossVectors(normal, u).normalize()
  return { normal, center, u, v }
}

function addTriPanelGrid(THREE, group, face, material, register, depth = 0.02) {
  const rings = [0.94, 0.87, 0.79, 0.71, 0.63, 0.55, 0.47, 0.39, 0.31]
  rings.forEach((scale, idx) => {
    const tri = insetFace(THREE, face, scale, depth + idx * 0.0015)
    const line = register(makeLine(THREE, tri, material, true))
    group.add(line)
  })
}

function addGlyphCluster(THREE, group, face, materials, register, seed) {
  const { normal, center, u, v } = faceFrameVectors(THREE, face)
  for (let i = 0; i < 56; i += 1) {
    const base = center.clone()
      .addScaledVector(u, rand(-0.42, 0.42))
      .addScaledVector(v, rand(-0.33, 0.33))
      .addScaledVector(normal, 0.028)
    const s = rand(0.025, 0.07)
    const angle = rand(0, Math.PI * 2) + seed * 0.4
    const p0 = base.clone().addScaledVector(u, Math.cos(angle) * s).addScaledVector(v, Math.sin(angle) * s)
    const p1 = base.clone().addScaledVector(u, Math.cos(angle + 1.8) * s * 0.55).addScaledVector(v, Math.sin(angle + 1.8) * s * 0.55)
    const p2 = base.clone().addScaledVector(u, Math.cos(angle + 3.1) * s * 0.9).addScaledVector(v, Math.sin(angle + 3.1) * s * 0.9)
    const glyph = register(makeLine(THREE, [p0, p1, p2], i % 4 === 0 ? materials.hotLineDim : materials.etchedLine, false))
    group.add(glyph)
  }
}

function addVentArray(THREE, group, face, materials, register, count = 7) {
  const { normal, center, u, v } = faceFrameVectors(THREE, face)
  for (let i = 0; i < count; i += 1) {
    const rowOffset = -0.18 + i * 0.06
    const start = center.clone().addScaledVector(v, rowOffset).addScaledVector(u, -0.18).addScaledVector(normal, 0.022)
    const end = start.clone().addScaledVector(u, 0.11)
    const vent = register(makeLine(THREE, [start, end], i % 2 ? materials.notchLine : materials.hotLineDim, false))
    group.add(vent)
  }
}

function addTriCircuitFans(THREE, group, face, materials, register) {
  const { normal, center } = faceFrameVectors(THREE, face)
  for (let i = 0; i < 72; i += 1) {
    const side = i % 3
    const scale = rand(0.34, 0.9)
    const tri = insetFace(THREE, face, scale, 0.028)
    const p1 = tri[side].clone().lerp(tri[(side + 1) % 3], rand(0.08, 0.88)).addScaledVector(normal, 0.01)
    const p2 = p1.clone().lerp(center, rand(0.06, 0.24)).addScaledVector(normal, 0.016)
    const p3 = p2.clone().addScaledVector(normal, 0.005).lerp(tri[(side + 2) % 3], rand(0.02, 0.12))
    const circuit = register(makeLine(THREE, [p1, p2, p3], i % 5 === 0 ? materials.hotLine : materials.etchedLine, false))
    group.add(circuit)
  }
}


function triMix(a, b, c, wa, wb, wc) {
  return a.clone().multiplyScalar(wa).add(b.clone().multiplyScalar(wb)).add(c.clone().multiplyScalar(wc))
}

function subdivideFace(face, steps = 4) {
  const [a, b, c] = face
  const tris = []
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps - i; j += 1) {
      const k = steps - i - j
      const p0 = triMix(a, b, c, i / steps, j / steps, k / steps)
      const p1 = triMix(a, b, c, (i + 1) / steps, j / steps, (k - 1) / steps)
      const p2 = triMix(a, b, c, i / steps, (j + 1) / steps, (k - 1) / steps)
      tris.push([p0, p1, p2])
      if (j < steps - i - 1) {
        const p3 = triMix(a, b, c, (i + 1) / steps, (j + 1) / steps, (k - 2) / steps)
        tris.push([p1, p3, p2])
      }
    }
  }
  return tris
}

function addSurfaceRelief(THREE, group, faces, materials, register) {
  const reliefMeshes = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)
    const miniTris = subdivideFace(face, 8)
    miniTris.forEach((tri, idx) => {
      const centroid = tri[0].clone().add(tri[1]).add(tri[2]).multiplyScalar(1 / 3)
      const local = centroid.clone().sub(center)
      const reach = local.length()
      if (reach < 0.28 || reach > 1.06) return
      if ((idx + faceIndex) % 5 === 0) return

      const scale = 0.76 + (((idx * 7 + faceIndex * 11) % 5) * 0.05)
      const inset = tri.map(p => centroid.clone().add(p.clone().sub(centroid).multiplyScalar(scale)).addScaledVector(normal, 0.018 + ((idx + faceIndex) % 3) * 0.008))
      const depth = 0.01 + (((idx + faceIndex * 3) % 4) * 0.006)
      const mat = ((idx + faceIndex) % 3 === 0) ? materials.microPlateDark : (((idx + faceIndex) % 2 === 0) ? materials.microPlate : materials.microPlate2)
      const mesh = addBeveledTrianglePlate(THREE, group, inset, normal, mat, register, depth)
      mesh.userData = { relief: true, faceIndex, baseOpacity: mat.opacity ?? 1 }
      reliefMeshes.push(mesh)

      if ((idx + faceIndex) % 2 === 0) {
        const seam = register(makeLine(THREE, inset.map(p => p.clone().addScaledVector(normal, 0.002)), ((idx + faceIndex) % 4 === 0) ? materials.hotLineDim : materials.etchedLine, true))
        group.add(seam)
      }
    })

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const offsetU = -0.34 + col * 0.18 + (row % 2) * 0.03
        const offsetV = -0.2 + row * 0.17
        const pos = center.clone().addScaledVector(u, offsetU).addScaledVector(v, offsetV).addScaledVector(normal, 0.05)
        if (pos.distanceTo(center) < 0.34) continue
        const block = register(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.035), (row + col) % 2 ? materials.microPlateDark : materials.microPlate))
        block.position.copy(pos)
        block.lookAt(pos.clone().add(normal))
        block.rotateZ(Math.PI / 2)
        block.rotateY((col - 1.5) * 0.18)
        group.add(block)
        reliefMeshes.push(block)
      }
    }

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 + faceIndex * 0.17
      const root = center.clone().addScaledVector(u, Math.cos(angle) * 0.5).addScaledVector(v, Math.sin(angle) * 0.34).addScaledVector(normal, 0.048)
      const a = root.clone().addScaledVector(u, 0.018)
      const b = root.clone().addScaledVector(u, -0.018)
      const c = root.clone().addScaledVector(v, 0.038)
      const ventPlate = addBeveledTrianglePlate(THREE, group, [a, b, c], normal, i % 2 ? materials.microPlateDark : materials.microPlate2, register, 0.012)
      reliefMeshes.push(ventPlate)
    }
  })
  return reliefMeshes
}


function addFaceDetails(THREE, group, faces, materials, register) {
  faces.forEach((face, faceIndex) => {
    const isBottom = faceIndex === 3
    const { normal, center, u, v } = faceFrameVectors(THREE, face)

    addTriPanelGrid(THREE, group, face, materials.etchedLine, register, isBottom ? 0.012 : 0.014)

    if (isBottom) {
      const socketOuter = insetFace(THREE, face, 0.44, 0.02)
      const socketInner = insetFace(THREE, face, 0.25, 0.03)
      addTriangleMesh(THREE, group, socketOuter, materials.darkPlate)
      const socketRim = register(makeLine(THREE, socketOuter, materials.notchLine, true))
      const socketSeal = register(makeLine(THREE, socketInner, materials.hotLineDim, true))
      group.add(socketRim)
      group.add(socketSeal)

      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2
        const p1 = center.clone().addScaledVector(u, Math.cos(angle) * 0.2).addScaledVector(v, Math.sin(angle) * 0.2).addScaledVector(normal, 0.024)
        const p2 = center.clone().addScaledVector(u, Math.cos(angle) * 0.32).addScaledVector(v, Math.sin(angle) * 0.32).addScaledVector(normal, 0.024)
        const rune = register(makeLine(THREE, [p1, p2], i % 3 === 0 ? materials.hotLineDim : materials.etchedLine, false))
        group.add(rune)
      }
      return
    }
    const shellA = insetFace(THREE, face, 0.96, 0.002)
    const shellB = insetFace(THREE, face, 0.88, 0.018)
    const shellC = insetFace(THREE, face, 0.78, 0.010)
    const shellD = insetFace(THREE, face, 0.68, 0.026)
    const shellE = insetFace(THREE, face, 0.57, 0.015)
    const shellF = insetFace(THREE, face, 0.46, 0.032)
    addTriangleMesh(THREE, group, shellA, materials.darkPlate)
    addTriangleMesh(THREE, group, shellB, materials.plateFrame)
    addTriangleMesh(THREE, group, shellC, materials.darkPlateDeep)
    addTriangleMesh(THREE, group, shellD, materials.raisedPlate)
    addTriangleMesh(THREE, group, shellE, materials.darkPlate)
    addTriangleMesh(THREE, group, shellF, materials.plateFrame)
    ;[shellA, shellB, shellC, shellD, shellE, shellF].forEach((shell, si) => {
      const lineMat = si % 2 === 0 ? materials.etchedLine : materials.notchLine
      const edgeLine = register(makeLine(THREE, shell, lineMat, true))
      group.add(edgeLine)
    })

    const lensOuter = insetFace(THREE, face, 0.245, 0.033)
    const lensMid = insetFace(THREE, face, 0.19, 0.036)
    const lensInner = insetFace(THREE, face, 0.118, 0.042)
    const lens = addTriangleMesh(THREE, group, lensOuter, materials.lens)
    lens.userData.baseOpacity = materials.lens.opacity
    addTriangleMesh(THREE, group, lensMid, materials.lensHousing)
    const lensLine = register(makeLine(THREE, lensInner, materials.hotLine, true))
    group.add(lensLine)

    const slitA = center.clone().addScaledVector(u, -0.11).addScaledVector(normal, 0.045)
    const slitB = center.clone().addScaledVector(u, 0.11).addScaledVector(normal, 0.045)
    const slit = register(makeLine(THREE, [slitA, slitB], materials.hotLine, false))
    group.add(slit)

    const radialScales = [0.76, 0.62, 0.48, 0.36]
    radialScales.forEach((scale, i) => {
      const tri = insetFace(THREE, face, scale, 0.031 + i * 0.002)
      for (let side = 0; side < 3; side += 1) {
        const point = tri[side].clone().lerp(center, 0.22)
        const branch = register(makeLine(THREE, [tri[side], point], i % 2 ? materials.etchedLine : materials.hotLineDim, false))
        group.add(branch)
      }
    })

    addVentArray(THREE, group, face, materials, register, 16)

    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2 + faceIndex * 0.35
      const origin = center.clone()
        .addScaledVector(u, Math.cos(angle) * rand(0.14, 0.46))
        .addScaledVector(v, Math.sin(angle) * rand(0.12, 0.34))
        .addScaledVector(normal, 0.035)
      const end = origin.clone()
        .addScaledVector(u, Math.cos(angle + 0.88) * rand(0.03, 0.12))
        .addScaledVector(v, Math.sin(angle + 0.88) * rand(0.03, 0.12))
      const rune = register(makeLine(THREE, [origin, end], i % 4 === 0 ? materials.hotLine : materials.notchLine, false))
      group.add(rune)
    }

    for (let i = 0; i < 3; i += 1) {
      const tri = insetFace(THREE, face, 0.54 - i * 0.07, 0.028 + i * 0.003)
      const a = tri[0].clone().lerp(tri[1], 0.5)
      const b = tri[1].clone().lerp(tri[2], 0.5)
      const c = tri[2].clone().lerp(tri[0], 0.5)
      const ribA = register(makeLine(THREE, [a, center.clone().addScaledVector(normal, 0.03)], materials.etchedLine, false))
      const ribB = register(makeLine(THREE, [b, center.clone().addScaledVector(normal, 0.03)], materials.etchedLine, false))
      const ribC = register(makeLine(THREE, [c, center.clone().addScaledVector(normal, 0.03)], materials.etchedLine, false))
      group.add(ribA)
      group.add(ribB)
      group.add(ribC)
    }
  })
}

function facePoint(center, u, v, normal, x, y, z = 0.09) {
  return center.clone()
    .addScaledVector(u, x)
    .addScaledVector(v, y)
    .addScaledVector(normal, z)
}

function addFaceLine2D(THREE, group, center, u, v, normal, points, material, register, closed = false, z = 0.098) {
  const worldPoints = points.map(([x, y]) => facePoint(center, u, v, normal, x, y, z))
  const line = register(makeLine(THREE, worldPoints, material, closed))
  group.add(line)
  return line
}

function addFaceBox(THREE, group, center, u, v, normal, x, y, w, h, d, material, register, z = 0.105) {
  const mesh = register(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material))

  mesh.position.copy(facePoint(center, u, v, normal, x, y, z))

  const basis = new THREE.Matrix4().makeBasis(
    u.clone().normalize(),
    v.clone().normalize(),
    normal.clone().normalize()
  )

  mesh.quaternion.setFromRotationMatrix(basis)
  group.add(mesh)
  return mesh
}

function addFaceBolt(THREE, group, center, u, v, normal, x, y, radius, material, register, z = 0.116) {
  const bolt = register(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.82, 0.018, 10),
    material
  ))

  bolt.position.copy(facePoint(center, u, v, normal, x, y, z))
  bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize())

  group.add(bolt)
  return bolt
}

function addStructuredDeviceFaceDetails(THREE, group, faces, materials, register) {
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)
    ;[0.91, 0.78, 0.65, 0.52, 0.39].forEach((scale, i) => {
      const tri = insetFace(THREE, face, scale, 0.074 + i * 0.001)
      group.add(register(makeLine(THREE, tri, i % 2 === 0 ? materials.notchLine : materials.hotLineDim, true)))
    })
    const coreOuter = insetFace(THREE, face, 0.31, 0.076)
    const coreInner = insetFace(THREE, face, 0.19, 0.078)
    group.add(register(makeLine(THREE, coreOuter, materials.notchLine, true)))
    group.add(register(makeLine(THREE, coreInner, materials.hotLine, true)))
    const railOuter = insetFace(THREE, face, 0.78, 0.076)
    const railInner = insetFace(THREE, face, 0.34, 0.078)
    for (let side = 0; side < 3; side += 1) {
      const a = railOuter[side].clone().lerp(railOuter[(side + 1) % 3], 0.5)
      const b = railInner[side].clone().lerp(railInner[(side + 1) % 3], 0.5)
      group.add(register(makeLine(THREE, [a, b], side % 2 ? materials.etchedLine : materials.hotLineDim, false)))
    }
    for (let i = 0; i < 7; i += 1) {
      const y = -0.3 + i * 0.035
      addFaceLine2D(THREE, group, center, u, v, normal, [[-0.52, y], [-0.34, y]], i % 2 ? materials.notchLine : materials.hotLineDim, register)
      addFaceLine2D(THREE, group, center, u, v, normal, [[ 0.34, y], [ 0.52, y]], i % 2 ? materials.notchLine : materials.hotLineDim, register)
    }
    const circuitRows = [
      [[-0.48,  0.02], [-0.34,  0.02], [-0.27,  0.12], [-0.12,  0.12]],
      [[ 0.48,  0.02], [ 0.34,  0.02], [ 0.27,  0.12], [ 0.12,  0.12]],
      [[-0.22, -0.48], [-0.22, -0.34], [-0.1,  -0.27]],
      [[ 0.22, -0.48], [ 0.22, -0.34], [ 0.1,  -0.27]],
      [[-0.34,  0.34], [-0.18,  0.28], [-0.08,  0.2]],
      [[ 0.34,  0.34], [ 0.18,  0.28], [ 0.08,  0.2]],
    ]
    circuitRows.forEach((path, i) => {
      addFaceLine2D(THREE, group, center, u, v, normal, path, i % 3 === 0 ? materials.hotLineDim : materials.etchedLine, register)
    })
  })
}

function makeTriPrismGeometry(THREE, points, normal, depth = 0.035) {
  const front = points.map(p => p.clone())
  const back = points.map(p => p.clone().addScaledVector(normal, -depth))
  const vertices = [
    front[0], front[1], front[2],
    back[2], back[1], back[0],
    front[0], back[0], back[1], front[0], back[1], front[1],
    front[1], back[1], back[2], front[1], back[2], front[2],
    front[2], back[2], back[0], front[2], back[0], front[0],
  ]
  const uv = [
    0.5, 1, 0, 0, 1, 0,
    1, 0, 0, 0, 0.5, 1,
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1,
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1,
    0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(p => [p.x, p.y, p.z]), 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.computeVertexNormals()
  return geometry
}

function addBeveledTrianglePlate(THREE, group, points, normal, material, register, depth = 0.035) {
  const mesh = register(new THREE.Mesh(makeTriPrismGeometry(THREE, points, normal, depth), material))
  mesh.userData.baseOpacity = material.opacity ?? 1
  group.add(mesh)
  return mesh
}

function addBeveledFaceArmor(THREE, group, faces, materials, register) {
  const beveledArmor = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center } = faceFrameVectors(THREE, face)
    const armorScales = [0.915, 0.735, 0.555, 0.375]
    armorScales.forEach((scale, layer) => {
      const tri = insetFace(THREE, face, scale, 0.038 + layer * 0.01)
      const mat = layer % 2 === 0 ? materials.beveledArmor : materials.beveledArmorDark
      const plate = addBeveledTrianglePlate(THREE, group, tri, normal, mat, register, 0.028 + layer * 0.006)
      plate.userData = {
        armor: true,
        faceIndex,
        layer,
        baseCenter: center.clone(),
        openDir: normal.clone(),
        baseOpacity: mat.opacity ?? 1,
      }
      beveledArmor.push(plate)
    })
  })
  return beveledArmor
}

function addRotatingFaceLocks(THREE, group, faces, materials, register) {
  const locks = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center } = faceFrameVectors(THREE, face)
    const lockGroup = new THREE.Group()
    lockGroup.position.copy(center).addScaledVector(normal, 0.092)
    lockGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    lockGroup.userData = {
      base: lockGroup.position.clone(),
      normal: normal.clone(),
      speed: faceIndex % 2 ? -0.009 : 0.011,
      openLift: 0.09 + faceIndex * 0.015,
    }

    const ringSpecs = [
      [0.215, 0.008, materials.lockHot],
      [0.285, 0.006, materials.lockCold],
      [0.365, 0.005, materials.lockHotDim],
    ]

    ringSpecs.forEach(([radius, tube, mat], ringIndex) => {
      const ring = register(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 96), mat))
      ring.userData = {
        baseOpacity: mat.opacity ?? 1,
        ringIndex,
        speed: (ringIndex % 2 ? -1 : 1) * (0.012 + ringIndex * 0.004),
      }
      lockGroup.add(ring)
    })

    for (let i = 0; i < 18; i += 1) {
      const tooth = register(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.014), i % 3 === 0 ? materials.lockHotDim : materials.lockCold))
      const angle = (i / 18) * Math.PI * 2
      tooth.position.set(Math.cos(angle) * 0.325, Math.sin(angle) * 0.325, 0.014)
      tooth.rotation.z = angle
      tooth.userData = { baseOpacity: tooth.material.opacity ?? 1 }
      lockGroup.add(tooth)
    }

    for (let i = 0; i < 9; i += 1) {
      const blade = register(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.01), materials.lockHotDim))
      const angle = (i / 9) * Math.PI * 2 + 0.15
      blade.position.set(Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0.02)
      blade.rotation.z = angle
      blade.userData = { baseOpacity: blade.material.opacity ?? 1 }
      lockGroup.add(blade)
    }

    group.add(lockGroup)
    locks.push(lockGroup)
  })
  return locks
}

function addSeparationFaces(THREE, group, faces, materials, register) {
  const panels = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)
    const panelGroup = new THREE.Group()
    panelGroup.position.copy(center)
    panelGroup.userData = {
      base: center.clone(),
      normal: normal.clone(),
      axisA: u.clone(),
      axisB: v.clone(),
      tilt: (faceIndex - 1) * 0.11,
      spin: faceIndex % 2 ? -0.008 : 0.008,
    }

    const triOuter = insetFace(THREE, face, 0.965, 0.064).map(p => p.clone().sub(center))
    const triInner = insetFace(THREE, face, 0.76, 0.083).map(p => p.clone().sub(center))
    const localNormal = normal.clone()

    const outerMesh = register(new THREE.Mesh(makeTriPrismGeometry(THREE, triOuter, localNormal, 0.05), materials.separationShell))
    outerMesh.userData = { baseOpacity: materials.separationShell.opacity ?? 1 }
    panelGroup.add(outerMesh)

    const innerMesh = register(new THREE.Mesh(makeTriPrismGeometry(THREE, triInner, localNormal, 0.035), materials.separationInset))
    innerMesh.userData = { baseOpacity: materials.separationInset.opacity ?? 1 }
    panelGroup.add(innerMesh)

    const lineMat = faceIndex % 2 ? materials.hotLineDim : materials.etchedLine
    ;[0.82, 0.68, 0.53, 0.39].forEach((scale, i) => {
      const ring = insetFace(THREE, face, scale, 0.102 + i * 0.003).map(p => p.clone().sub(center))
      const line = register(makeLine(THREE, ring, i % 2 ? materials.hotLineDim : lineMat, true))
      panelGroup.add(line)
    })

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2
      const p1 = new THREE.Vector3()
        .addScaledVector(u, Math.cos(angle) * 0.18)
        .addScaledVector(v, Math.sin(angle) * 0.18)
        .addScaledVector(localNormal, 0.112)
      const p2 = new THREE.Vector3()
        .addScaledVector(u, Math.cos(angle + 0.4) * 0.44)
        .addScaledVector(v, Math.sin(angle + 0.4) * 0.36)
        .addScaledVector(localNormal, 0.112)
      const rune = register(makeLine(THREE, [p1, p2], i % 3 === 0 ? materials.hotLine : materials.notchLine, false))
      panelGroup.add(rune)
    }

    group.add(panelGroup)
    panels.push(panelGroup)
  })
  return panels
}

function addFloatingTriangularShards(THREE, group, materials, register) {
  const shards = []
  for (let i = 0; i < 78; i += 1) {
    const mat = i % 4 === 0 ? materials.shardHot : materials.shardDark
    const shardGroup = new THREE.Group()
    const size = rand(0.045, 0.13)
    const h = size * rand(0.85, 1.45)
    const pts = [
      new THREE.Vector3(0, h, 0),
      new THREE.Vector3(-size, -h * 0.55, 0),
      new THREE.Vector3(size, -h * 0.55, 0),
    ]
    const normal = new THREE.Vector3(0, 0, 1)
    const mesh = register(new THREE.Mesh(makeTriPrismGeometry(THREE, pts, normal, rand(0.012, 0.034)), mat))
    mesh.userData = { baseOpacity: mat.opacity ?? 1 }
    shardGroup.add(mesh)

    const edge = register(makeLine(THREE, pts.map(p => p.clone().addScaledVector(normal, 0.012)), i % 3 === 0 ? materials.hotLineDim : materials.etchedLine, true))
    shardGroup.add(edge)

    shardGroup.userData = {
      angle: rand(0, Math.PI * 2),
      y: rand(-0.85, 0.95),
      radius: rand(1.5, 2.75),
      speed: rand(0.002, 0.008) * (i % 2 ? 1 : -1),
      bob: rand(0.015, 0.07),
      phase: rand(0, Math.PI * 2),
      spinX: rand(-0.018, 0.018),
      spinY: rand(-0.018, 0.018),
      spinZ: rand(-0.018, 0.018),
      baseScale: rand(0.6, 1.25),
    }

    shardGroup.scale.setScalar(0.001)
    group.add(shardGroup)
    shards.push(shardGroup)
  }
  return shards
}

function addBrutalRuneHalo(THREE, group, materials, register) {
  const runes = []
  for (let i = 0; i < 84; i += 1) {
    const mat = i % 5 === 0 ? materials.hotLine : materials.hotLineDim
    const s = rand(0.06, 0.18)
    const jag = [
      new THREE.Vector3(-s * 0.7, -s, 0),
      new THREE.Vector3(s * 0.18, -s * 0.45, 0),
      new THREE.Vector3(-s * 0.05, s * 0.05, 0),
      new THREE.Vector3(s * 0.78, s * 0.16, 0),
      new THREE.Vector3(s * 0.2, s, 0),
      new THREE.Vector3(-s, s * 0.35, 0),
    ]
    const rune = register(makeLine(THREE, jag, mat, false))
    rune.userData = {
      angle: (i / 84) * Math.PI * 2,
      radius: rand(2.35, 3.1),
      y: rand(-1.05, 1.05),
      speed: rand(0.002, 0.006) * (i % 2 ? 1 : -1),
      baseOpacity: mat.opacity ?? 1,
    }
    group.add(rune)
    runes.push(rune)
  }
  return runes
}


function addEdgeNotches(THREE, group, pyramidEdges, materials, register) {
  pyramidEdges.forEach(([start, end], edgeIndex) => {
    const dir = new THREE.Vector3().subVectors(end, start).normalize()
    const radial = new THREE.Vector3().copy(start).add(end).multiplyScalar(0.5).normalize()
    const side = new THREE.Vector3().crossVectors(dir, radial).normalize().multiplyScalar(0.062)

    for (let i = 1; i < 32; i += 1) {
      if (i % 7 === 0) continue
      const t = i / 32
      const mid = new THREE.Vector3().copy(start).lerp(end, t)
      const a = mid.clone().add(side)
      const b = mid.clone().addScaledVector(side, -1)
      const notch = register(makeLine(THREE, [a, b], edgeIndex % 2 ? materials.notchLine : materials.etchedLine, false))
      group.add(notch)

      const n1 = mid.clone().addScaledVector(side, 0.45)
      const n2 = n1.clone().addScaledVector(dir, rand(-0.06, 0.06)).addScaledVector(radial, 0.03)
      const micro = register(makeLine(THREE, [n1, n2], materials.hotLineDim, false))
      group.add(micro)
    }
  })
}

function addEdgeSleeves(THREE, group, pyramidEdges, materials, register) {
  pyramidEdges.forEach(([start, end], edgeIndex) => {
    const dir = new THREE.Vector3().subVectors(end, start)
    const len = dir.length()
    const step = len / 13
    const unit = dir.clone().normalize()
    for (let i = 1; i < 13; i += 1) {
      const mid = start.clone().addScaledVector(unit, i * step)
      const w = edgeIndex < 3 ? 0.068 : 0.08
      const mesh = register(new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, w), materials.bandSleeve))
      mesh.position.copy(mid)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit)
      mesh.rotation.y += edgeIndex * 0.52 + i * 0.08
      group.add(mesh)
    }
  })
}

function addCornerBraces(THREE, group, vertices, materials, register) {
  vertices.forEach((point, i) => {
    const outDir = point.clone().normalize()
    const capR = i === 0 ? 0.088 : 0.072
    const cap = register(new THREE.Mesh(
      new THREE.CylinderGeometry(capR, capR * 1.18, 0.018, 6),
      materials.cornerMat
    ))
    cap.position.copy(point).addScaledVector(outDir, 0.008)
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outDir)
    cap.userData = { base: point.clone(), isCornerCap: true }
    group.add(cap)
    const inner = register(new THREE.Mesh(
      new THREE.CylinderGeometry(capR * 0.58, capR * 0.58, 0.013, 6),
      materials.microPlateDark
    ))
    inner.position.copy(point).addScaledVector(outDir, 0.016)
    inner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outDir)
    group.add(inner)

    const ring = register(new THREE.Mesh(
      new THREE.TorusGeometry(i === 0 ? 0.1 : 0.082, 0.008, 5, 36),
      materials.cornerRing
    ))
    ring.position.copy(point)
    ring.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI))
    ring.userData = {
      base: point.clone(),
      sx: rand(-0.01, 0.01),
      sy: rand(-0.01, 0.01),
      sz: rand(-0.01, 0.01),
      corner: true,
    }
    group.add(ring)
  })
}

function addBaseMechanism(THREE, group, pyramid, materials, register) {
  const underside = pyramid.faces[3]
  const { normal, center, u, v } = faceFrameVectors(THREE, underside)
  const moving = []

  const socketOuter = register(new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.55, 0.11, 3), materials.baseSocket))
  socketOuter.position.copy(center).addScaledVector(normal, 0.028)
  socketOuter.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().negate())
  socketOuter.rotation.y = Math.PI / 6
  socketOuter.userData = { spin: 0.0014, baseEmissive: socketOuter.material.emissiveIntensity ?? 0.1 }
  group.add(socketOuter)
  moving.push(socketOuter)

  const socketInner = register(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 0.16, 18), materials.baseCore))
  socketInner.position.copy(center).addScaledVector(normal, 0.105)
  socketInner.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().negate())
  socketInner.userData = { spin: -0.0032, baseEmissive: socketInner.material.emissiveIntensity ?? 0.7 }
  group.add(socketInner)
  moving.push(socketInner)

  const ringSpecs = [
    [0.82, 0.012, materials.grooveHotDim, 0.0012],
    [0.62, 0.01, materials.lockCold, -0.0018],
    [0.46, 0.008, materials.grooveHot, 0.0026],
    [0.22, 0.006, materials.lockHotDim, -0.004],
  ]
  ringSpecs.forEach(([radius, tube, mat, spin], i) => {
    const ring = register(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 7, 132), mat))
    ring.position.copy(center).addScaledVector(normal, 0.118 + i * 0.008)
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    ring.userData = { spin, baseOpacity: mat.opacity ?? 1, baseEmissive: mat.emissiveIntensity ?? 0 }
    group.add(ring)
    moving.push(ring)
  })

  for (let i = 0; i < 36; i += 1) {
    const angle = (i / 36) * Math.PI * 2
    const radius = i % 2 ? 0.74 : 0.58
    const p = center.clone().addScaledVector(u, Math.cos(angle) * radius).addScaledVector(v, Math.sin(angle) * radius).addScaledVector(normal, 0.126)
    const tooth = register(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.05), i % 3 === 0 ? materials.grooveHotDim : materials.baseClaw))
    tooth.position.copy(p)
    tooth.lookAt(center)
    tooth.rotateX(Math.PI * 0.5)
    tooth.rotateZ(angle)
    tooth.userData = { baseOpacity: tooth.material.opacity ?? 1 }
    group.add(tooth)
  }

  for (let arm = 0; arm < 3; arm += 1) {
    const angle = (arm / 3) * Math.PI * 2
    const tangent = u.clone().multiplyScalar(-Math.sin(angle)).add(v.clone().multiplyScalar(Math.cos(angle))).normalize()
    const radial = u.clone().multiplyScalar(Math.cos(angle)).add(v.clone().multiplyScalar(Math.sin(angle))).normalize()
    const root = center.clone().addScaledVector(radial, 0.28).addScaledVector(normal, 0.13)
    const tip = center.clone().addScaledVector(radial, 0.72).addScaledVector(normal, 0.075)

    const railA = createCylinderBetween(THREE, root.clone().addScaledVector(tangent, 0.035), tip.clone().addScaledVector(tangent, 0.035), 0.012, materials.baseClaw, 5)
    const railB = createCylinderBetween(THREE, root.clone().addScaledVector(tangent, -0.035), tip.clone().addScaledVector(tangent, -0.035), 0.012, materials.baseClaw, 5)
    register(railA); register(railB)
    group.add(railA); group.add(railB)

    const piston = createCylinderBetween(THREE, root.clone().addScaledVector(normal, 0.028), tip.clone().addScaledVector(normal, 0.012), 0.018, arm % 2 ? materials.lockCold : materials.baseSocket, 8)
    register(piston)
    piston.userData = { spin: 0.0008 * (arm % 2 ? -1 : 1), baseEmissive: piston.material.emissiveIntensity ?? 0.1 }
    group.add(piston)
    moving.push(piston)

    for (let clawIndex = 0; clawIndex < 5; clawIndex += 1) {
      const t = clawIndex / 4
      const p = root.clone().lerp(tip, t).addScaledVector(tangent, (clawIndex % 2 ? 1 : -1) * 0.075).addScaledVector(normal, 0.045)
      const claw = register(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.16), clawIndex % 2 ? materials.baseClaw : materials.microPlateDark))
      claw.position.copy(p)
      claw.lookAt(center)
      claw.rotateX(Math.PI * 0.5)
      claw.rotateY((clawIndex - 2) * 0.18)
      group.add(claw)
    }
  }

  for (let i = 0; i < 21; i += 1) {
    const angle = (i / 21) * Math.PI * 2
    const r1 = 0.18 + (i % 5) * 0.11
    const r2 = r1 + 0.11 + (i % 3) * 0.035
    const p1 = center.clone().addScaledVector(u, Math.cos(angle) * r1).addScaledVector(v, Math.sin(angle) * r1).addScaledVector(normal, 0.15)
    const p2 = center.clone().addScaledVector(u, Math.cos(angle + 0.28) * r2).addScaledVector(v, Math.sin(angle + 0.28) * r2).addScaledVector(normal, 0.15)
    const conduit = createCylinderBetween(THREE, p1, p2, i % 4 === 0 ? 0.006 : 0.004, i % 4 === 0 ? materials.grooveHotDim : materials.notchRod, 5)
    conduit.userData = { baseOpacity: conduit.material.opacity ?? 1 }
    register(conduit)
    group.add(conduit)
  }

  return moving
}

function faceBarycentricPoint(THREE, face, margin = 0.1) {
  const [a, b, c] = face
  const r1 = Math.sqrt(Math.random())
  const r2 = Math.random()
  const wa = 1 - r1
  const wb = r1 * (1 - r2)
  const wc = r1 * r2
  const center = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3)
  return triMix(a, b, c, wa, wb, wc).lerp(center, margin)
}

function createGrooveBetween(THREE, group, start, end, normal, materials, register, hot = false, radius = 0.012) {
  const shadow = createCylinderBetween(THREE, start.clone().addScaledVector(normal, 0.002), end.clone().addScaledVector(normal, 0.002), radius, materials.grooveShadow, 4)
  shadow.userData = { carvedGroove: true }
  register(shadow)
  group.add(shadow)
  const objects = [shadow]
  if (hot) {
    const core = createCylinderBetween(THREE, start.clone().addScaledVector(normal, 0.006), end.clone().addScaledVector(normal, 0.006), Math.max(0.0025, radius * 0.28), materials.grooveHot, 6)
    core.userData = { carvedGroove: true, hot: true, baseOpacity: materials.grooveHot.opacity ?? 1 }
    register(core)
    group.add(core)
    objects.push(core)
  }
  return objects
}

function addCarvedGrooveSystems(THREE, group, faces, materials, register) {
  const grooves = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)
    const scales = [0.91, 0.835, 0.765, 0.68, 0.585, 0.49, 0.395, 0.305]
    scales.forEach((scale, ringIndex) => {
      const tri = insetFace(THREE, face, scale, 0.003 + ringIndex * 0.0008)
      for (let side = 0; side < 3; side += 1) {
        const a = tri[side].clone().lerp(tri[(side + 1) % 3], 0.03)
        const b = tri[side].clone().lerp(tri[(side + 1) % 3], 0.97)
        grooves.push(...createGrooveBetween(THREE, group, a, b, normal, materials, register, (ringIndex + side + faceIndex) % 3 === 0, ringIndex < 2 ? 0.009 : 0.006))
      }
    })

    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2 + faceIndex * 0.23
      const root = center.clone().addScaledVector(u, Math.cos(angle) * 0.12).addScaledVector(v, Math.sin(angle) * 0.09).addScaledVector(normal, 0.004)
      const elbow = center.clone().addScaledVector(u, Math.cos(angle + 0.34) * rand(0.34, 0.63)).addScaledVector(v, Math.sin(angle + 0.34) * rand(0.22, 0.42)).addScaledVector(normal, 0.005)
      const tip = elbow.clone().addScaledVector(u, Math.cos(angle + 1.57) * rand(0.045, 0.12)).addScaledVector(v, Math.sin(angle + 1.57) * rand(0.045, 0.12)).addScaledVector(normal, 0.001)
      grooves.push(...createGrooveBetween(THREE, group, root, elbow, normal, materials, register, i % 5 === 0, 0.005))
      grooves.push(...createGrooveBetween(THREE, group, elbow, tip, normal, materials, register, i % 7 === 0, 0.003))
    }

    for (let track = 0; track < 9; track += 1) {
      const linePoints = []
      const baseAngle = (track / 9) * Math.PI * 2 + faceIndex * 0.31
      for (let step = 0; step < 5; step += 1) {
        const rad = 0.24 + step * 0.12
        linePoints.push(center.clone()
          .addScaledVector(u, Math.cos(baseAngle + step * 0.52) * rad)
          .addScaledVector(v, Math.sin(baseAngle + step * 0.52) * rad * 0.72)
          .addScaledVector(normal, 0.004 + step * 0.0005))
      }
      for (let i = 0; i < linePoints.length - 1; i += 1) {
        grooves.push(...createGrooveBetween(THREE, group, linePoints[i], linePoints[i + 1], normal, materials, register, (track + i) % 4 === 0, 0.004))
      }
    }
  })
  return grooves
}

function makeRuneStroke(THREE, origin, u, v, normal, scale, variant = 0) {
  const shapes = [
    [[-0.4, -0.5], [0.18, -0.18], [-0.14, 0.1], [0.42, 0.5]],
    [[-0.38, 0.5], [0.05, 0.22], [-0.28, -0.1], [0.36, -0.48], [0.18, 0.18]],
    [[0, -0.52], [0.34, -0.18], [0.03, 0.02], [0.42, 0.38], [-0.36, 0.48]],
    [[-0.44, -0.28], [0.38, -0.44], [0.08, 0.02], [0.36, 0.45], [-0.2, 0.16]],
    [[-0.3, -0.5], [-0.05, -0.05], [-0.46, 0.28], [0.16, 0.12], [0.46, 0.5]],
  ]
  return shapes[variant % shapes.length].map(([x, y]) => origin.clone().addScaledVector(u, x * scale).addScaledVector(v, y * scale).addScaledVector(normal, 0.002))
}

function addDenseRuneEngraving(THREE, group, faces, materials, register) {
  const runes = []
  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)

    for (let ring = 0; ring < 5; ring += 1) {
      const tri = insetFace(THREE, face, 0.81 - ring * 0.105, 0.103 + ring * 0.003)
      for (let side = 0; side < 3; side += 1) {
        const a = tri[side]
        const b = tri[(side + 1) % 3]
        const sideDir = b.clone().sub(a).normalize()
        const count = 9 - ring
        for (let i = 1; i < count; i += 1) {
          const base = a.clone().lerp(b, i / count).addScaledVector(normal, 0.003)
          const localU = sideDir
          const localV = new THREE.Vector3().crossVectors(normal, localU).normalize()
          const points = makeRuneStroke(THREE, base, localU, localV, normal, 0.035 - ring * 0.002, i + side + faceIndex)
          const mat = (i + ring + side) % 6 === 0 ? materials.grooveHotDimLine : materials.runeEtch
          const rune = register(makeLine(THREE, points, mat, false))
          rune.userData = { denseRune: true, baseOpacity: mat.opacity ?? 1 }
          group.add(rune)
          runes.push(rune)
        }
      }
    }

    for (let i = 0; i < 88; i += 1) {
      const base = faceBarycentricPoint(THREE, face, rand(0.16, 0.36)).addScaledVector(normal, 0.108 + (i % 5) * 0.001)
      const angle = rand(0, Math.PI * 2)
      const localU = u.clone().multiplyScalar(Math.cos(angle)).add(v.clone().multiplyScalar(Math.sin(angle))).normalize()
      const localV = new THREE.Vector3().crossVectors(normal, localU).normalize()
      const points = makeRuneStroke(THREE, base, localU, localV, normal, rand(0.018, 0.045), i + faceIndex)
      const mat = i % 9 === 0 ? materials.grooveHotDimLine : (i % 3 === 0 ? materials.notchLine : materials.runeEtch)
      const rune = register(makeLine(THREE, points, mat, false))
      rune.userData = { denseRune: true, baseOpacity: mat.opacity ?? 1 }
      group.add(rune)
      runes.push(rune)
    }
  })
  return runes
}

function addBrutalEdgeSegmentation(THREE, group, pyramidEdges, materials, register) {
  const segments = []
  pyramidEdges.forEach(([start, end], edgeIndex) => {
    const edge = new THREE.Vector3().subVectors(end, start)
    const len = edge.length()
    const unit = edge.clone().normalize()
    const outward = start.clone().add(end).multiplyScalar(0.5).normalize()
    const side = new THREE.Vector3().crossVectors(unit, outward).normalize()
    const count = 18
    for (let i = 0; i < count; i += 1) {
      const aT = (i + 0.08) / count
      const bT = (i + 0.77) / count
      const a = start.clone().lerp(end, aT).addScaledVector(outward, 0.035 + (i % 3) * 0.006)
      const b = start.clone().lerp(end, bT).addScaledVector(outward, 0.035 + (i % 3) * 0.006)
      const radius = edgeIndex < 3 ? 0.062 + (i % 2) * 0.012 : 0.072 + (i % 2) * 0.014
      const slab = createCylinderBetween(THREE, a, b, radius, i % 4 === 0 ? materials.bandSleeveHeavy : materials.bandSleeve, 4)
      slab.rotation.y += (i % 2 ? 0.35 : -0.18) + edgeIndex * 0.07
      slab.userData = { brutalEdge: true, baseEmissive: slab.material.emissiveIntensity ?? 0.05 }
      register(slab)
      group.add(slab)
      segments.push(slab)

      if (i % 2 === 0) {
        const toothPos = a.clone().lerp(b, 0.5).addScaledVector(side, i % 4 === 0 ? 0.075 : -0.075).addScaledVector(outward, 0.02)
        const tooth = register(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.14), materials.edgeTooth))
        tooth.position.copy(toothPos)
        tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit)
        tooth.rotateX((i % 3 - 1) * 0.24)
        tooth.userData = { brutalEdge: true, baseEmissive: tooth.material.emissiveIntensity ?? 0.04 }
        group.add(tooth)
        segments.push(tooth)
      }
    }
  })
  return segments
}

function addCropPatchNeonLines(THREE, group, faces, materials, register) {
  const created = []

  function addLocalLine(center, u, v, normal, points, material, closed = false, lift = 0.068) {
    const worldPoints = points.map(([x, y]) => (
      center.clone()
        .addScaledVector(u, x)
        .addScaledVector(v, y)
        .addScaledVector(normal, lift)
    ))

    const line = register(makeLine(THREE, worldPoints, material, closed))
    line.userData.baseOpacity = material.opacity ?? 1
    group.add(line)
    created.push(line)
    return line
  }

  function addLocalCircle(center, u, v, normal, x, y, radius, material, segments = 48, lift = 0.071) {
    const points = []

    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2
      points.push([
        x + Math.cos(a) * radius,
        y + Math.sin(a) * radius,
      ])
    }

    return addLocalLine(center, u, v, normal, points, material, true, lift)
  }

  faces.slice(0, 3).forEach((face, faceIndex) => {
    const { normal, center, u, v } = faceFrameVectors(THREE, face)
    ;[0.9, 0.78, 0.66, 0.54, 0.42, 0.3].forEach((scale, i) => {
      const tri = insetFace(THREE, face, scale, 0.07 + i * 0.0015)
      const line = register(makeLine(
        THREE,
        tri,
        i % 2 === 0 ? materials.hotLineDim : materials.hotLine,
        true
      ))

      line.userData.baseOpacity = line.material.opacity ?? 1
      group.add(line)
      created.push(line)
    })
    addLocalCircle(center, u, v, normal, 0, -0.03, 0.18, materials.hotLine, 60)
    addLocalCircle(center, u, v, normal, 0, -0.03, 0.285, materials.hotLineDim, 72)
    addLocalCircle(center, u, v, normal, -0.32, -0.2, 0.075, materials.hotLineDim, 36)
    addLocalCircle(center, u, v, normal, 0.32, -0.2, 0.075, materials.hotLineDim, 36)
    addLocalCircle(center, u, v, normal, 0, 0.32, 0.075, materials.hotLineDim, 36)
    const paths = [
      [[0, 0.32], [0, 0.15], [-0.09, 0.04], [-0.18, -0.03]],
      [[0, 0.32], [0, 0.15], [0.09, 0.04], [0.18, -0.03]],

      [[-0.32, -0.2], [-0.18, -0.2], [-0.1, -0.1], [-0.02, -0.03]],
      [[0.32, -0.2], [0.18, -0.2], [0.1, -0.1], [0.02, -0.03]],

      [[-0.5, 0.02], [-0.34, 0.02], [-0.25, 0.13], [-0.12, 0.13]],
      [[0.5, 0.02], [0.34, 0.02], [0.25, 0.13], [0.12, 0.13]],

      [[-0.2, -0.47], [-0.2, -0.34], [-0.11, -0.26], [-0.02, -0.18]],
      [[0.2, -0.47], [0.2, -0.34], [0.11, -0.26], [0.02, -0.18]],
    ]

    paths.forEach((path, i) => {
      addLocalLine(
        center,
        u,
        v,
        normal,
        path,
        i % 3 === 0 ? materials.hotLine : materials.hotLineDim,
        false,
        0.073
      )
    })
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 0.38 + ring * 0.13
      const count = 12 + ring * 6

      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + faceIndex * 0.18
        const x = Math.cos(a) * radius
        const y = Math.sin(a) * radius * 0.72
        const dx = Math.cos(a + Math.PI * 0.5) * 0.035
        const dy = Math.sin(a + Math.PI * 0.5) * 0.035

        addLocalLine(
          center,
          u,
          v,
          normal,
          [[x - dx, y - dy], [x + dx, y + dy]],
          i % 4 === 0 ? materials.hotLine : materials.hotLineDim,
          false,
          0.075
        )
      }
    }
  })

  return created
}

export default function HolocronViewer() {
  const mountRef = useRef(null)
  const threeRef = useRef({})
  const animRef = useRef(null)
  const phaseRef = useRef(PHASE.IDLE)
  const tRef = useRef(0)
  const timersRef = useRef([])

  const [phase, setPhase] = useState(PHASE.IDLE)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [flash, setFlash] = useState(false)
  const [shake, setShake] = useState(false)
  const [constellationReady, setConstellationReady] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 })

  function safeUniform(target, key, value) {
    if (target?.uniforms?.[key]) {
      target.uniforms[key].value = value
    }
  }

  function safeNeedsUpdate(geo, attr) {
    if (geo?.attributes?.[attr]) {
      geo.attributes[attr].needsUpdate = true
    }
  }

  useEffect(() => {
    let cancelled = false
    let resizeObserver = null
    let onResize = null
    const mount = mountRef.current
    if (!mount) return undefined

    async function init() {
      try {
        const THREE = await import('three')
        const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js')
        const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js')
        const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js')
        const { OutputPass } = await import('three/examples/jsm/postprocessing/OutputPass.js')
        const { AfterimagePass } = await import('three/examples/jsm/postprocessing/AfterimagePass.js')
        const { FilmPass } = await import('three/examples/jsm/postprocessing/FilmPass.js')
        const { GlitchPass } = await import('three/examples/jsm/postprocessing/GlitchPass.js')
        const { SMAAPass } = await import('three/examples/jsm/postprocessing/SMAAPass.js')
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js')
        if (cancelled) return

        const getSize = () => {
          const rect = mount.getBoundingClientRect()
          return {
            w: Math.max(1, Math.floor(rect.width || window.innerWidth || 1)),
            h: Math.max(1, Math.floor(rect.height || window.innerHeight || 1)),
          }
        }

        const { w, h } = getSize()
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.25))
        renderer.setSize(w, h, false)
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 0.88
        if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.setClearColor(0x000000, 1)
        mount.appendChild(renderer.domElement)

        const pmrem = new THREE.PMREMGenerator(renderer)
        pmrem.compileEquirectangularShader()

        const scene = new THREE.Scene()
        scene.fog = new THREE.FogExp2(0x020000, 0.010)
        const envRT = pmrem.fromScene(new RoomEnvironment(), 0.035)
        scene.environment = envRT.texture

        const camera = new THREE.PerspectiveCamera(36, w / h, 0.05, 140)
        camera.position.set(0, 0.28, 7.2)

        const composer = new EffectComposer(renderer)
        composer.addPass(new RenderPass(scene, camera))
        const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 1.4, 0.72, 0.18)
        composer.addPass(bloom)
        const filmPass = new FilmPass(0.08, 0.12, 648, false)
        filmPass.enabled = true
        composer.addPass(filmPass)
        const afterImage = new AfterimagePass(0.72)
        composer.addPass(afterImage)
        const glitchPass = new GlitchPass()
        glitchPass.enabled = false
        composer.addPass(glitchPass)
        if ((window.devicePixelRatio || 1) <= 1.25) composer.addPass(new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()))
        composer.addPass(new OutputPass())

        const disposables = []
        const register = item => {
          if (!item) return item
          if (item.geometry) disposables.push(item.geometry)
          if (item.material) {
            if (Array.isArray(item.material)) disposables.push(...item.material)
            else disposables.push(item.material)
          }
          return item
        }

        disposables.push(pmrem, envRT.texture)

        const circleTexture = new THREE.CanvasTexture(makeCircleTexture())
        disposables.push(circleTexture)

        const wearPack = makeProceduralWearPack(THREE)
        Object.values(wearPack).forEach(pack => {
          Object.values(pack).forEach(texture => disposables.push(texture))
        })

        const STAR_N = 4200
        const starPos = new Float32Array(STAR_N * 3)
        const starSize = new Float32Array(STAR_N)
        const starPhase = new Float32Array(STAR_N)
        for (let i = 0; i < STAR_N; i += 1) {
          setBufferPoint(starPos, i, spherePoint(rand(22, 62)))
          starSize[i] = rand(0.22, 1.95)
          starPhase[i] = rand(0, Math.PI * 2)
        }
        const starGeo = new THREE.BufferGeometry()
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
        starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1))
        starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhase, 1))
        const starMat = new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0.34 },
            uColorA: { value: new THREE.Color(0x180000) },
            uColorB: { value: new THREE.Color(0x920013) },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const starField = register(new THREE.Points(starGeo, starMat))
        scene.add(starField)

        const DATA_N = 1450
        const dataPos = new Float32Array(DATA_N * 3)
        const dataSize = new Float32Array(DATA_N)
        const dataPhase = new Float32Array(DATA_N)
        const dataMeta = []
        for (let i = 0; i < DATA_N; i += 1) {
          setBufferPoint(dataPos, i, { x: rand(-8, 8), y: rand(-4.8, 4.8), z: rand(-3, 7) })
          dataSize[i] = rand(0.35, 2.4)
          dataPhase[i] = rand(0, Math.PI * 2)
          dataMeta.push({ speed: rand(-0.0018, 0.0018), drift: rand(0.0003, 0.0015), phase: dataPhase[i] })
        }
        const dataGeo = new THREE.BufferGeometry()
        dataGeo.setAttribute('position', new THREE.BufferAttribute(dataPos, 3))
        dataGeo.setAttribute('aSize', new THREE.BufferAttribute(dataSize, 1))
        dataGeo.setAttribute('aPhase', new THREE.BufferAttribute(dataPhase, 1))
        const dataMat = new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0.16 },
            uColorA: { value: new THREE.Color(0x2c0003) },
            uColorB: { value: new THREE.Color(0xc30021) },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const dataDust = register(new THREE.Points(dataGeo, dataMat))
        scene.add(dataDust)

        const haloPlanes = []
        for (let i = 0; i < 6; i += 1) {
          const material = new THREE.MeshBasicMaterial({
            map: circleTexture,
            color: i % 2 ? 0x220003 : 0x530008,
            transparent: true,
            opacity: 0.022 + i * 0.005,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          const plane = register(new THREE.Mesh(new THREE.PlaneGeometry(rand(7, 14), rand(3, 6)), material))
          plane.position.set(rand(-3.2, 3.2), rand(-2.0, 2.0), rand(-6.2, -2.4))
          plane.rotation.set(rand(-0.2, 0.2), rand(-0.2, 0.2), rand(0, Math.PI))
          plane.userData = { speed: rand(-0.0008, 0.0008), phase: rand(0, Math.PI * 2), baseOpacity: material.opacity }
          haloPlanes.push(plane)
          scene.add(plane)
        }

        const holocron = new THREE.Group()
        holocron.rotation.set(-0.08, 0.6, 0.02)
        holocron.scale.setScalar(1.0)
        scene.add(holocron)

        const pyramid = makePyramidData(THREE)
        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: 0x060607,
          roughness: 0.72,
          metalness: 1,
          clearcoat: 0.0,
          clearcoatRoughness: 0.8,
          sheen: 0.0,
          emissive: 0x050000,
          emissiveIntensity: 0.08,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
          envMapIntensity: 2.2,
        })
        const body = register(new THREE.Mesh(pyramid.geometry, bodyMat))
        holocron.add(body)

        const raisedPlateMat = new THREE.MeshStandardMaterial({
          color: 0x0c0d0f,
          metalness: 0.98,
          roughness: 0.48,
          emissive: 0x030000,
          emissiveIntensity: 0.05,
          side: THREE.DoubleSide,
          envMapIntensity: 2.4,
        })
        const darkPlateMat = new THREE.MeshStandardMaterial({
          color: 0x050506,
          metalness: 0.94,
          roughness: 0.74,
          emissive: 0x080000,
          emissiveIntensity: 0.09,
          side: THREE.DoubleSide,
        })
        const darkPlateDeepMat = new THREE.MeshStandardMaterial({
          color: 0x010102,
          metalness: 0.85,
          roughness: 0.96,
          emissive: 0x100000,
          emissiveIntensity: 0.10,
          side: THREE.DoubleSide,
          envMapIntensity: 0.1,
        })
        const framePlateMat = new THREE.MeshStandardMaterial({
          color: 0x111315,
          metalness: 1,
          roughness: 0.52,
          emissive: 0x030000,
          emissiveIntensity: 0.03,
          side: THREE.DoubleSide,
          envMapIntensity: 1.1,
        })
        const lensMat = new THREE.MeshPhysicalMaterial({
          color: 0x180005,
          emissive: 0xd00024,
          emissiveIntensity: 2.4,
          roughness: 0.06,
          metalness: 0.38,
          transparent: true,
          opacity: 0.82,
          transmission: 0.12,
          thickness: 0.62,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          side: THREE.DoubleSide,
        })
        const lensHousingMat = new THREE.MeshStandardMaterial({
          color: 0x070708,
          roughness: 0.22,
          metalness: 1,
          emissive: 0x120002,
          emissiveIntensity: 0.2,
          side: THREE.DoubleSide,
        })
        const bandMat = new THREE.MeshStandardMaterial({
          color: 0x0a0b0d,
          roughness: 0.82,
          metalness: 0.96,
          emissive: 0x030000,
          emissiveIntensity: 0.04,
          envMapIntensity: 0.6,
        })
        const bandSleeveMat = new THREE.MeshStandardMaterial({
          color: 0x0e0f11,
          roughness: 0.76,
          metalness: 0.98,
          emissive: 0x0a0000,
          emissiveIntensity: 0.06,
          envMapIntensity: 0.7,
        })
        const cornerMat = new THREE.MeshStandardMaterial({
          color: 0x0d0d10,
          roughness: 0.68,
          metalness: 1,
          emissive: 0x120000,
          emissiveIntensity: 0.14,
          envMapIntensity: 0.8,
        })
        const cornerRingMat = new THREE.MeshBasicMaterial({ color: 0x8d0014, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
        const baseSocketMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 1, roughness: 0.26, emissive: 0x090000, emissiveIntensity: 0.12 })
        const baseCoreMat = new THREE.MeshStandardMaterial({ color: 0x130104, metalness: 0.92, roughness: 0.22, emissive: 0x9a0016, emissiveIntensity: 0.78 })
        const baseClawMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 1, roughness: 0.3, emissive: 0x040000, emissiveIntensity: 0.08 })
        const beveledArmorMat = new THREE.MeshStandardMaterial({
          color: 0x131418,
          metalness: 1,
          roughness: 0.58,
          emissive: 0x040000,
          emissiveIntensity: 0.05,
          side: THREE.DoubleSide,
          envMapIntensity: 1.0,
        })
        const beveledArmorDarkMat = new THREE.MeshStandardMaterial({
          color: 0x040405,
          metalness: 0.96,
          roughness: 0.72,
          emissive: 0x080000,
          emissiveIntensity: 0.07,
          side: THREE.DoubleSide,
        })
        const separationShellMat = new THREE.MeshStandardMaterial({
          color: 0x090a0c,
          metalness: 1,
          roughness: 0.3,
          emissive: 0x100000,
          emissiveIntensity: 0.16,
          transparent: true,
          opacity: 0.56,
          side: THREE.DoubleSide,
        })
        const separationInsetMat = new THREE.MeshStandardMaterial({
          color: 0x010102,
          metalness: 0.94,
          roughness: 0.6,
          emissive: 0x160000,
          emissiveIntensity: 0.22,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        })
        const lockColdMat = new THREE.MeshStandardMaterial({
          color: 0x08090b,
          metalness: 1,
          roughness: 0.2,
          emissive: 0x090000,
          emissiveIntensity: 0.16,
          transparent: true,
          opacity: 0.86,
        })
        const lockHotMat = new THREE.MeshBasicMaterial({ color: 0xff1238, transparent: true, opacity: 0.64, blending: THREE.AdditiveBlending, depthWrite: false })
        const lockHotDimMat = new THREE.MeshBasicMaterial({ color: 0x9c0017, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false })
        const shardDarkMat = new THREE.MeshStandardMaterial({
          color: 0x050506,
          metalness: 1,
          roughness: 0.34,
          emissive: 0x070000,
          emissiveIntensity: 0.1,
          transparent: true,
          opacity: 0.82,
          side: THREE.DoubleSide,
        })
        const shardHotMat = new THREE.MeshBasicMaterial({ color: 0xc00020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        const microPlateMat = new THREE.MeshStandardMaterial({
          color: 0x16181c,
          metalness: 1,
          roughness: 0.16,
          emissive: 0x070000,
          emissiveIntensity: 0.06,
          side: THREE.DoubleSide,
        })
        const microPlate2Mat = new THREE.MeshStandardMaterial({
          color: 0x0b0c0e,
          metalness: 1,
          roughness: 0.22,
          emissive: 0x110000,
          emissiveIntensity: 0.09,
          side: THREE.DoubleSide,
        })
        const microPlateDarkMat = new THREE.MeshStandardMaterial({
          color: 0x040405,
          metalness: 0.96,
          roughness: 0.48,
          emissive: 0x060000,
          emissiveIntensity: 0.08,
          side: THREE.DoubleSide,
        })
        const etchedLineMat = new THREE.LineBasicMaterial({ color: 0x341012, transparent: true, opacity: 0.84 })
        const notchLineMat = new THREE.LineBasicMaterial({ color: 0x632022, transparent: true, opacity: 0.76 })
        const hotLineDimMat = new THREE.LineBasicMaterial({ color: 0x900015, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending })
        const hotLineMat = new THREE.LineBasicMaterial({ color: 0xff1438, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending })
        const grooveShadowMat = new THREE.MeshStandardMaterial({ color: 0x000001, metalness: 0.88, roughness: 0.84, emissive: 0x020000, emissiveIntensity: 0.04 })
        const grooveHotMat = new THREE.MeshBasicMaterial({ color: 0xff1236, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false })
        const grooveHotDimMat = new THREE.MeshBasicMaterial({ color: 0x820011, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
        const grooveHotDimLineMat = new THREE.LineBasicMaterial({ color: 0xa90019, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending })
        const runeEtchMat = new THREE.LineBasicMaterial({ color: 0x19080a, transparent: true, opacity: 0.92 })
        const notchRodMat = new THREE.MeshStandardMaterial({ color: 0x070608, metalness: 1, roughness: 0.5, emissive: 0x080000, emissiveIntensity: 0.08 })
        const bandSleeveHeavyMat = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.78, metalness: 1, emissive: 0x0e0000, emissiveIntensity: 0.10 })
        const edgeToothMat = new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.78, metalness: 1, emissive: 0x060000, emissiveIntensity: 0.05 })

        applyWearMaps(bodyMat, wearPack.body, { bumpScale: 0.18, roughness: 0.72 })
        ;[raisedPlateMat, darkPlateMat, darkPlateDeepMat, framePlateMat, beveledArmorMat, beveledArmorDarkMat, separationShellMat, separationInsetMat, microPlateMat, microPlate2Mat, microPlateDarkMat].forEach(mat => {
          applyWearMaps(mat, wearPack.plates, { bumpScale: 0.10 })
        })
        ;[bandMat, bandSleeveMat, bandSleeveHeavyMat, cornerMat, baseSocketMat, baseClawMat, lockColdMat, notchRodMat, edgeToothMat].forEach(mat => {
          applyWearMaps(mat, wearPack.edges, { bumpScale: 0.09 })
        })

        const detailMaterials = {
          plateFrame: framePlateMat,
          raisedPlate: raisedPlateMat,
          darkPlate: darkPlateMat,
          darkPlateDeep: darkPlateDeepMat,
          lens: lensMat,
          lensHousing: lensHousingMat,
          etchedLine: etchedLineMat,
          notchLine: notchLineMat,
          hotLineDim: hotLineDimMat,
          hotLine: hotLineMat,
          bandSleeve: bandSleeveMat,
          cornerMat,
          cornerRing: cornerRingMat,
          baseSocket: baseSocketMat,
          baseCore: baseCoreMat,
          baseClaw: baseClawMat,
          beveledArmor: beveledArmorMat,
          beveledArmorDark: beveledArmorDarkMat,
          separationShell: separationShellMat,
          separationInset: separationInsetMat,
          lockCold: lockColdMat,
          lockHot: lockHotMat,
          lockHotDim: lockHotDimMat,
          shardDark: shardDarkMat,
          shardHot: shardHotMat,
          microPlate: microPlateMat,
          microPlate2: microPlate2Mat,
          microPlateDark: microPlateDarkMat,
          grooveShadow: grooveShadowMat,
          grooveHot: grooveHotMat,
          grooveHotDim: grooveHotDimMat,
          grooveHotDimLine: grooveHotDimLineMat,
          runeEtch: runeEtchMat,
          notchRod: notchRodMat,
          bandSleeveHeavy: bandSleeveHeavyMat,
          edgeTooth: edgeToothMat,
        }
        ;[
          raisedPlateMat,
          darkPlateMat,
          darkPlateDeepMat,
          framePlateMat,
          lensMat,
          lensHousingMat,
          bandMat,
          bandSleeveMat,
          cornerMat,
          cornerRingMat,
          baseSocketMat,
          baseCoreMat,
          baseClawMat,
          beveledArmorMat,
          beveledArmorDarkMat,
          separationShellMat,
          separationInsetMat,
          lockColdMat,
          lockHotMat,
          lockHotDimMat,
          shardDarkMat,
          shardHotMat,
          microPlateMat,
          microPlate2Mat,
          microPlateDarkMat,
          etchedLineMat,
          notchLineMat,
          hotLineDimMat,
          hotLineMat,
          grooveShadowMat,
          grooveHotMat,
          grooveHotDimMat,
          grooveHotDimLineMat,
          runeEtchMat,
          notchRodMat,
          bandSleeveHeavyMat,
          edgeToothMat,
        ].forEach(item => disposables.push(item))

        const edgeBands = []
        const edgeFacePairs = [[0,2],[0,1],[1,2],[0,3],[1,3],[2,3]]
        pyramid.edges.forEach((edge, i) => {
          const [fA, fB] = edgeFacePairs[i]
          const faceA = pyramid.faces[fA]
          const faceB = pyramid.faces[fB]
          const nA = new THREE.Vector3().subVectors(faceA[1], faceA[0]).cross(new THREE.Vector3().subVectors(faceA[2], faceA[0])).normalize()
          const nB = new THREE.Vector3().subVectors(faceB[1], faceB[0]).cross(new THREE.Vector3().subVectors(faceB[2], faceB[0])).normalize()
          const isApex = i < 3
          const rail = register(makeEdgeRail(THREE, edge[0], edge[1], nA, nB, isApex ? 0.11 : 0.13, isApex ? 0.055 : 0.065, bandMat))
          edgeBands.push(rail)
          holocron.add(rail)
        })
        pyramid.edges.forEach(([start, end], edgeIndex) => {
          const edgeVec = new THREE.Vector3().subVectors(end, start)
          const edgeDir = edgeVec.clone().normalize()
          const [fA, fB] = edgeFacePairs[edgeIndex]
          const faceA = pyramid.faces[fA]
          const nA = new THREE.Vector3().subVectors(faceA[1], faceA[0]).cross(new THREE.Vector3().subVectors(faceA[2], faceA[0])).normalize()
          const faceB = pyramid.faces[fB]
          const nB = new THREE.Vector3().subVectors(faceB[1], faceB[0]).cross(new THREE.Vector3().subVectors(faceB[2], faceB[0])).normalize()
          const outward = new THREE.Vector3().addVectors(nA, nB).normalize()
          const notchCount = edgeIndex < 3 ? 9 : 7
          for (let n = 1; n < notchCount; n++) {
            const t = n / notchCount
            const pos = start.clone().lerp(end, t).addScaledVector(outward, 0.044)
            const notchMesh = register(new THREE.Mesh(
              new THREE.BoxGeometry(0.055, 0.038, 0.055),
              n % 3 === 0 ? detailMaterials.bandSleeveHeavy : detailMaterials.bandSleeve
            ))
            notchMesh.position.copy(pos)
            notchMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), edgeDir)
            notchMesh.rotateY(n % 2 === 0 ? Math.PI/4 : 0)
            holocron.add(notchMesh)
          }
        })
        const brutalEdgeSegments = []

        const vertices = [pyramid.faces[0][0], pyramid.faces[0][1], pyramid.faces[1][1], pyramid.faces[1][2]]
addCornerBraces(THREE, holocron, vertices, detailMaterials, register)

const surfaceRelief = []
const carvedGrooves = []
const denseRunes = []
const beveledArmor = []

addCropPatchNeonLines(THREE, holocron, pyramid.faces, detailMaterials, register)
        pyramid.edges.forEach(([start, end], edgeIndex) => {
          const [fA, fB] = edgeFacePairs[edgeIndex]
          const faceA = pyramid.faces[fA]
          const faceB = pyramid.faces[fB]
          const nA = new THREE.Vector3().subVectors(faceA[1], faceA[0]).cross(new THREE.Vector3().subVectors(faceA[2], faceA[0])).normalize()
          const nB = new THREE.Vector3().subVectors(faceB[1], faceB[0]).cross(new THREE.Vector3().subVectors(faceB[2], faceB[0])).normalize()
          const outward = new THREE.Vector3().addVectors(nA, nB).normalize()
          const lift = 0.048
          const sA = start.clone().addScaledVector(outward, lift)
          const sB = end.clone().addScaledVector(outward, lift)
          const glowLine = register(makeLine(THREE, [sA, sB], detailMaterials.hotLine, false))
          holocron.add(glowLine)
          const dimLine = register(makeLine(THREE, [start.clone().addScaledVector(outward, 0.012), end.clone().addScaledVector(outward, 0.012)], detailMaterials.etchedLine, false))
          holocron.add(dimLine)
        })
        const undersideMachinery = addBaseMechanism(THREE, holocron, pyramid, detailMaterials, register)
        const faceLocks = []
        const separationPanels = []
        const orbitShards = []
        const brutalRunes = []

        const seamPlanes = []
        pyramid.faces.slice(0, 3).forEach((face, i) => {
          const tri = insetFace(THREE, face, 0.978, 0.037)
          const geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap(p => [p.x, p.y, p.z]), 3))
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2))
          geometry.computeVertexNormals()
          const material = new THREE.ShaderMaterial({
            vertexShader: SEAM_VERT,
            fragmentShader: SEAM_FRAG,
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.05 + i * 0.01 } },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          const mesh = register(new THREE.Mesh(geometry, material))
          seamPlanes.push(mesh)
          holocron.add(mesh)
        })

        const baseFeet = []

        const underGlow = register(new THREE.Mesh(
          new THREE.CircleGeometry(0.98, 128),
          new THREE.MeshBasicMaterial({ color: 0xa50018, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
        ))
        underGlow.rotation.x = -Math.PI / 2
        underGlow.position.y = -1.22
        holocron.add(underGlow)

        const rings = []
        for (let i = 0; i < 11; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: i % 2 ? 0x4b0007 : 0xc00020,
            transparent: true,
            opacity: 0.11 + i * 0.028,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          disposables.push(mat)
          const ring = register(new THREE.Mesh(new THREE.TorusGeometry(1.82 + i * 0.14, 0.004 + i * 0.0015, 6, 220), mat))
          ring.rotation.set(rand(0.25, Math.PI), rand(0.25, Math.PI), rand(0, Math.PI))
          ring.userData = { sx: rand(-0.004, 0.004), sy: rand(-0.006, 0.006), sz: rand(-0.006, 0.006), baseOpacity: mat.opacity }
          rings.push(ring)
          holocron.add(ring)
        }

        const runeObjects = []
        for (let i = 0; i < 72; i += 1) {
          const material = new THREE.LineBasicMaterial({ color: i % 2 ? 0x960018 : 0xdb0026, transparent: true, opacity: rand(0.24, 0.58), blending: THREE.AdditiveBlending })
          disposables.push(material)
          const s = rand(0.06, 0.15)
          const shape = [
            new THREE.Vector3(-s, -s, 0),
            new THREE.Vector3(s * 0.2, -s * 0.15, 0),
            new THREE.Vector3(s, -s * 0.45, 0),
            new THREE.Vector3(0, s, 0),
            new THREE.Vector3(-s * 0.7, s * 0.25, 0),
          ]
          const rune = register(makeLine(THREE, shape, material, true))
          rune.userData = {
            angle: (i / 72) * Math.PI * 2,
            speed: rand(0.0025, 0.0068) * (i % 2 ? 1 : -1),
            radius: rand(2.05, 2.55),
            y: rand(-0.82, 0.82),
            baseOpacity: material.opacity,
          }
          runeObjects.push(rune)
          holocron.add(rune)
        }

        const pedestal = new THREE.Group()
        pedestal.position.y = -1.62
        scene.add(pedestal)
        const pedestalCore = register(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.42, 0.24, 6, 1, false), new THREE.MeshStandardMaterial({ color: 0x040405, metalness: 1, roughness: 0.34, emissive: 0x050000, emissiveIntensity: 0.05 })))
        const pedestalCap = register(new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.12, 6, 1, false), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 1, roughness: 0.24, emissive: 0x090000, emissiveIntensity: 0.08 })))
        pedestalCap.position.y = -0.14
        pedestal.add(pedestalCore)
        pedestal.add(pedestalCap)

        const floorRings = []
        for (let i = 0; i < 8; i += 1) {
          const mat = new THREE.MeshBasicMaterial({
            color: i % 2 ? 0x290002 : 0x8c0013,
            transparent: true,
            opacity: 0.035 + i * 0.013,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          disposables.push(mat)
          const ring = register(new THREE.Mesh(new THREE.TorusGeometry(1.05 + i * 0.36, 0.004, 4, 200), mat))
          ring.rotation.x = Math.PI / 2
          ring.userData = { speed: rand(-0.002, 0.002), baseOpacity: mat.opacity }
          pedestal.add(ring)
          floorRings.push(ring)
        }

        const symbolPlane = register(new THREE.Mesh(
          new THREE.CircleGeometry(2.7, 128),
          new THREE.MeshBasicMaterial({ color: 0x6a0010, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
        ))
        symbolPlane.rotation.x = -Math.PI / 2
        symbolPlane.position.y = -0.02
        pedestal.add(symbolPlane)
        const ambient = new THREE.AmbientLight(0x080508, 0.35)
        scene.add(ambient)
        const keyLight = new THREE.DirectionalLight(0xd0ddf0, 1.6)
        keyLight.position.set(-3.5, 5.0, 4.2)
        keyLight.target.position.set(0, 0, 0)
        scene.add(keyLight)
        scene.add(keyLight.target)
        const rimLight = new THREE.DirectionalLight(0x1a0005, 1.1)
        rimLight.position.set(4.8, -2.2, -3.8)
        rimLight.target.position.set(0, 0, 0)
        scene.add(rimLight)
        scene.add(rimLight.target)
        const rakeLightSpecs = [
          { pos: [1.4, 2.2, 3.8],  color: 0x9ab0cc, intensity: 28, dist: 9, decay: 1.8 },
          { pos: [-4.2, 2.0, -1.2], color: 0x8090b8, intensity: 24, dist: 9, decay: 1.8 },
          { pos: [3.8, 1.8, 2.2],  color: 0x8898b8, intensity: 22, dist: 9, decay: 1.8 },
        ]
        const rakeLights = rakeLightSpecs.map(spec => {
          const light = new THREE.PointLight(spec.color, spec.intensity, spec.dist, spec.decay)
          light.position.set(...spec.pos)
          scene.add(light)
          return light
        })
        const seamLight = new THREE.PointLight(0xd10022, 18, 5, 2.2)
        seamLight.position.set(0, 0.12, 0.6)
        scene.add(seamLight)
        const underLight = new THREE.PointLight(0x6d0010, 18, 6, 2.0)
        underLight.position.set(0, -2.0, 0.8)
        scene.add(underLight)
        const topAccent = new THREE.SpotLight(0xeef4ff, 12, 16, Math.PI / 14, 0.12, 1.6)
        topAccent.position.set(-1.2, 7.0, 2.0)
        topAccent.target = holocron
        scene.add(topAccent)
        scene.add(topAccent.target)
        const backFill = new THREE.PointLight(0x060d14, 8, 20, 1.0)
        backFill.position.set(0, 0, -8)
        scene.add(backFill)

        const sideEdge = new THREE.PointLight(0xb0c4e0, 14, 12, 1.8)
        sideEdge.position.set(5.5, 0.5, -2.0)
        scene.add(sideEdge)

        const SPARK_N = 500
        const sparkPos = new Float32Array(SPARK_N * 3)
        const sparkSize = new Float32Array(SPARK_N)
        const sparkPhase = new Float32Array(SPARK_N)
        const sparkVel = []
        for (let i = 0; i < SPARK_N; i += 1) {
          sparkPos[i * 3] = 0
          sparkPos[i * 3 + 1] = 0
          sparkPos[i * 3 + 2] = 0
          sparkSize[i] = rand(0.3, 1.8)
          sparkPhase[i] = rand(0, Math.PI * 2)
          sparkVel.push({ x: 0, y: 0, z: 0, drag: rand(0.91, 2), active: false })
        }
        const sparkGeo = new THREE.BufferGeometry()
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
        sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1))
        sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(sparkPhase, 1))
        const sparkMat = new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 0 },
            uColorA: { value: new THREE.Color(0xffffff) },
            uColorB: { value: new THREE.Color(0xbf001d) },
          },
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const sparks = register(new THREE.Points(sparkGeo, sparkMat))
        scene.add(sparks)

        const shockMats = []
        for (let i = 0; i < 4; i += 1) {
          const mat = new THREE.ShaderMaterial({
            vertexShader: SHOCK_VERT,
            fragmentShader: SHOCK_FRAG,
            uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
          shockMats.push(mat)
          const shock = register(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), mat))
          shock.rotation.set(rand(-Math.PI, Math.PI), rand(-Math.PI, Math.PI), rand(-Math.PI, Math.PI))
          scene.add(shock)
        }

        threeRef.current = {
          THREE,
          ready: true,
          renderer,
          composer,
          camera,
          bloom,
          filmPass,
          afterImage,
          glitchPass,
          disposables,
          holocron,
          bodyMat,
          lensMat,
          seamPlanes,
          surfaceRelief,
          beveledArmor,
          faceLocks,
          separationPanels,
          orbitShards,
          brutalRunes,
          carvedGrooves,
          denseRunes,
          brutalEdgeSegments,
          undersideMachinery,
          edgeBands,
          cornerNodes: holocron.children.filter(child => child.userData?.isCornerCap),
          cornerRings: holocron.children.filter(child => child.geometry?.type === 'TorusGeometry' && child.userData?.corner),
          baseFeet,
          underGlow,
          rings,
          runeObjects,
          starField,
          starMat,
          dataDust,
          dataGeo,
          dataPos,
          dataMeta,
          dataMat,
          haloPlanes,
          pedestal,
          floorRings,
          keyLight,
          rimLight,
          seamLight,
          underLight,
          topAccent,
          sideEdge,
          rakeLights,
          backFill,
          sparks,
          sparkGeo,
          sparkPos,
          sparkSize,
          sparkVel,
          sparkMat,
          shockMats,
          burstActive: false,
          burstTime: 0,
          openProgress: 0,
        }

        onResize = () => {
          const size = getSize()
          renderer.setSize(size.w, size.h, false)
          composer.setSize(size.w, size.h)
          bloom.resolution.set(size.w, size.h)
          camera.aspect = size.w / size.h
          camera.updateProjectionMatrix()
          setCanvasSize(size)
        }
        window.addEventListener('resize', onResize)
        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(onResize)
          resizeObserver.observe(mount)
        }
        setCanvasSize({ w, h })
        setReady(true)

        function tick() {
          animRef.current = requestAnimationFrame(tick)
          try {
            const delta = 0.016
            tRef.current += delta
            const t = tRef.current
            const r = threeRef.current
            if (!r.ready) return
          const cur = phaseRef.current
          const targetOpen = cur === PHASE.IDLE || cur === PHASE.BURST ? 0 : 1
          r.openProgress += (targetOpen - r.openProgress) * 0.05
          const open = r.openProgress
          const sealed = 1 - open * 0.72
          const pulse = 0.5 + Math.sin(t * 2.4) * 0.5

          safeUniform(r.starMat, 'uTime', t)
          safeUniform(r.dataMat, 'uTime', t)
          safeUniform(r.sparkMat, 'uTime', t)

          r.holocron.rotation.y += 0.0048 + open * 0.0038
          r.holocron.rotation.x = -0.08 + Math.sin(t * 0.44) * 0.045
          r.holocron.rotation.z = Math.sin(t * 0.34) * 0.02
          r.holocron.position.y = Math.sin(t * 0.72) * 0.08 + open * 0.1
          r.holocron.position.z = -open * 0.22
          r.holocron.scale.setScalar(1.0 + Math.sin(t * 1.6) * 0.008 - open * 0.012)

          r.bodyMat.emissiveIntensity = 0.06 + pulse * 0.05
          r.bodyMat.opacity = 1 - open * 0.28
          r.lensMat.emissiveIntensity = 1.65 + pulse * 1.4 + open * 1.4
          r.seamPlanes.forEach((mesh, i) => {
            safeUniform(mesh.material, 'uTime', t)
            safeUniform(mesh.material, 'uOpacity', (0.04 + pulse * 0.036 + i * 0.006) * sealed)
          })
          r.underGlow.material.opacity = (0.1 + pulse * 0.09 + open * 0.1) * sealed

          r.beveledArmor.forEach((plate, i) => {
            const d = plate.userData
            const lift = Math.sin(t * 1.4 + i) * 0.004 + open * 0.007 * (d.layer + 1)
            plate.position.copy(d.openDir).multiplyScalar(lift)
          })

          r.faceLocks.forEach((lock, i) => {
            const d = lock.userData
            lock.position.copy(d.base).addScaledVector(d.normal, open * (d.openLift * 0.38) + Math.sin(t * 1.25 + i) * 0.006)
            lock.children.forEach((child, childIndex) => {
              if (child.geometry?.type === 'TorusGeometry') {
                child.rotation.z += child.userData.speed * (1 + open * 3.4)
              } else {
                child.rotation.z += d.speed * 0.35 * (1 + open)
              }
              if (child.material?.opacity !== undefined && child.userData?.baseOpacity !== undefined) {
                child.material.opacity = child.userData.baseOpacity * (0.35 + sealed * 0.65 + open * 0.65)
              }
            })
          })

          r.separationPanels.forEach((panel, i) => {
            const d = panel.userData
            const split = open * (0.09 + i * 0.012)
            panel.position.copy(d.base).addScaledVector(d.normal, split + Math.sin(t * 1.1 + i) * open * 0.01)
            panel.rotation.x = d.tilt * open * 0.28 + Math.sin(t * 0.52 + i) * open * 0.008
            panel.rotation.y = -d.tilt * 0.18 * open
            panel.rotation.z += d.spin * open
            panel.traverse(child => {
              if (child.material?.opacity !== undefined && child.userData?.baseOpacity !== undefined) {
                child.material.opacity = child.userData.baseOpacity * (0.08 + open * 0.92) * (0.72 + pulse * 0.28)
              }
            })
          })

          r.orbitShards.forEach((shard, i) => {
            const d = shard.userData
            d.angle += d.speed * (0.35 + open * 2.8)
            const radius = d.radius + Math.sin(t * 0.65 + d.phase) * d.bob
            shard.position.set(Math.cos(d.angle) * radius, d.y + Math.sin(t * 1.4 + d.phase) * d.bob * 2.2, Math.sin(d.angle) * radius)
            shard.rotation.x += d.spinX * (0.2 + open)
            shard.rotation.y += d.spinY * (0.2 + open)
            shard.rotation.z += d.spinZ * (0.2 + open)
            shard.scale.setScalar(d.baseScale * open * 0.5)
            shard.traverse(child => {
              if (child.material?.opacity !== undefined && child.userData?.baseOpacity !== undefined) {
                child.material.opacity = child.userData.baseOpacity * open * (0.65 + pulse * 0.35)
              }
            })
          })

          r.brutalRunes.forEach((rune, i) => {
            const d = rune.userData
            d.angle += d.speed * (1 + open * 2.2)
            rune.position.set(Math.cos(d.angle) * d.radius, d.y + Math.sin(t * 0.7 + i) * 0.12, Math.sin(d.angle) * d.radius)
            rune.lookAt(camera.position)
            rune.material.opacity = d.baseOpacity * (0.18 + open * 0.82) * (0.55 + pulse * 0.45)
          })

          r.carvedGrooves.forEach((piece, i) => {
            if (piece.userData?.hot && piece.material?.opacity !== undefined) {
              piece.material.opacity = piece.userData.baseOpacity * (0.52 + pulse * 0.48 + open * 0.22)
            }
            if (piece.material?.emissiveIntensity !== undefined) {
              piece.material.emissiveIntensity = (piece.userData?.baseEmissive ?? 0.04) + pulse * 0.05
            }
          })

          r.denseRunes.forEach((rune, i) => {
            if (rune.material?.opacity !== undefined) {
              rune.material.opacity = rune.userData.baseOpacity * (0.54 + pulse * 0.22 + Math.sin(t * 0.9 + i) * 0.06) * (0.82 + open * 0.28)
            }
          })

          r.brutalEdgeSegments.forEach((piece, i) => {
            if (piece.material?.emissiveIntensity !== undefined) {
              piece.material.emissiveIntensity = (piece.userData?.baseEmissive ?? 0.06) * (0.82 + pulse * 0.35)
            }
            piece.rotation.y += Math.sin(t * 0.42 + i) * 0.00005
          })

          r.undersideMachinery.forEach((part, i) => {
            if (part.userData?.spin) part.rotation.z += part.userData.spin * (1 + open * 2.2)
            if (part.material?.opacity !== undefined && part.userData?.baseOpacity !== undefined) {
              part.material.opacity = part.userData.baseOpacity * (0.72 + pulse * 0.28 + open * 0.18)
            }
            if (part.material?.emissiveIntensity !== undefined) {
              part.material.emissiveIntensity = (part.userData?.baseEmissive ?? 0.08) * (0.76 + pulse * 0.5 + open * 0.35)
            }
          })

          r.surfaceRelief.forEach((piece, i) => {
            if (piece.material?.emissiveIntensity !== undefined) {
              piece.material.emissiveIntensity = (piece.material.emissiveIntensity || 0.06) * (0.96 + Math.sin(t * 1.8 + i) * 0.01)
            }
          })

          r.edgeBands.forEach((band, i) => {
            band.rotation.y += 0.0003 * (i % 2 ? 1 : -1)
          })
          r.cornerNodes.forEach((node, i) => {
            node.rotateY(0.006 + i * 0.0008)
          })
          r.cornerRings.forEach(ring => {
            ring.rotation.x += ring.userData.sx
            ring.rotation.y += ring.userData.sy
            ring.rotation.z += ring.userData.sz
            ring.position.y = ring.userData.base.y + Math.sin(t * 1.1) * 0.01
          })
          r.baseFeet.forEach((foot, i) => {
            foot.position.y = foot.userData.base.y + Math.sin(t * 1.3 + i) * 0.012
          })

          r.rings.forEach(ring => {
            ring.rotation.x += ring.userData.sx
            ring.rotation.y += ring.userData.sy
            ring.rotation.z += ring.userData.sz
            ring.material.opacity = ring.userData.baseOpacity * sealed * (0.72 + pulse * 0.28)
          })

          r.runeObjects.forEach((rune, i) => {
            const d = rune.userData
            d.angle += d.speed * (1 + open * 1.7)
            rune.position.set(Math.cos(d.angle) * d.radius, d.y + Math.sin(t * 0.92 + i) * 0.07, Math.sin(d.angle) * d.radius)
            rune.lookAt(camera.position)
            rune.material.opacity = d.baseOpacity * sealed * (0.7 + 0.25 * Math.sin(t * 2 + i))
          })

          for (let i = 0; i < r.dataMeta.length; i += 1) {
            const m = r.dataMeta[i]
            r.dataPos[i * 3] += Math.sin(t * 0.55 + m.phase) * m.drift
            r.dataPos[i * 3 + 1] += m.speed
            if (r.dataPos[i * 3 + 1] > 4.8) r.dataPos[i * 3 + 1] = -4.8
            if (r.dataPos[i * 3 + 1] < -4.8) r.dataPos[i * 3 + 1] = 4.8
          }
          safeNeedsUpdate(r.dataGeo, 'position')

          r.haloPlanes.forEach((plane, i) => {
            plane.rotation.z += plane.userData.speed
            plane.material.opacity = plane.userData.baseOpacity * (0.7 + Math.sin(t * 0.32 + i) * 0.15)
          })

          r.pedestal.rotation.y += 0.0008
          r.floorRings.forEach(ring => {
            ring.rotation.z += ring.userData.speed
            ring.material.opacity = ring.userData.baseOpacity * (0.55 + pulse * 0.32 + open * 0.4)
          })
          keyLight.target.position.set(0, 0, 0)
          r.keyLight.position.set(Math.sin(t * 0.18) * 3.5 - 1.5, 5.0, Math.cos(t * 0.18) * 3.5 + 2.0)
          r.seamLight.intensity = 14 + pulse * 10 + open * 18
          r.underLight.intensity = 14 + pulse * 8 + open * 12
          r.topAccent.intensity = 10 + pulse * 4
          r.bloom.strength = 1.2 + pulse * 0.28 + open * 0.72
          safeUniform(r.afterImage, 'damp', 0.88 + open * 0.04)
          if (r.filmPass?.uniforms?.nIntensity) {
            safeUniform(r.filmPass, 'nIntensity', 0.12 + open * 0.03)
          } else if (r.filmPass?.uniforms?.intensity) {
            safeUniform(r.filmPass, 'intensity', 0.12 + open * 0.03)
          }

          if (r.burstActive) {
            r.burstTime += delta
            const bt = r.burstTime
            for (let i = 0; i < r.sparkVel.length; i += 1) {
              const v = r.sparkVel[i]
              if (!v.active) continue
              r.sparkPos[i * 3] += v.x
              r.sparkPos[i * 3 + 1] += v.y
              r.sparkPos[i * 3 + 2] += v.z
              v.x *= v.drag
              v.y *= v.drag
              v.z *= v.drag
            }
            safeNeedsUpdate(r.sparkGeo, 'position')
            safeUniform(r.sparkMat, 'uOpacity', Math.max(0, 0.22 - bt * 0.5))
            r.shockMats.forEach((mat, i) => {
              const wave = Math.min(1.15, bt * (1.55 - i * 0.12) - i * 0.08)
              safeUniform(mat, 'uProgress', Math.max(0, wave))
              safeUniform(mat, 'uOpacity', Math.max(0, (0.96 - i * 0.12) - bt * (0.92 + i * 0.05)))
            })
            r.glitchPass.enabled = bt < 0.42
            r.bloom.strength = Math.max(1.2, 2.1 - bt * 0.6)
            r.renderer.toneMappingExposure = 1.0 + Math.max(0, 0.72 - bt * 0.78)
            if (bt > 1.6) {
              r.burstActive = false
              r.glitchPass.enabled = false
              safeUniform(r.sparkMat, 'uOpacity', 0)
              r.shockMats.forEach(mat => { safeUniform(mat, 'uOpacity', 0) })
            }
          } else {
            r.glitchPass.enabled = false
            r.renderer.toneMappingExposure += (0.88 - r.renderer.toneMappingExposure) * 0.06
          }

          r.composer.render()
        } catch (error) {
          console.error('Holocron tick failed:', error)
          if (!cancelled) setLoadError(error?.message || 'Holocron tick failed')
          if (animRef.current) cancelAnimationFrame(animRef.current)
        }
        }
        tick()
      } catch (error) {
        console.error('Holocron failed to initialise:', error)
        if (!cancelled) setLoadError(error?.message || 'Holocron failed to initialise')
      }
    }

    init()

    return () => {
      cancelled = true
      setReady(false)
      timersRef.current.forEach(window.clearTimeout)
      timersRef.current = []
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (onResize) window.removeEventListener('resize', onResize)
      if (resizeObserver) resizeObserver.disconnect()
      const r = threeRef.current
      if (r.renderer) {
        r.renderer.dispose()
        if (mount?.contains(r.renderer.domElement)) mount.removeChild(r.renderer.domElement)
      }
      if (r.disposables) r.disposables.forEach(item => item?.dispose?.())
      threeRef.current = {}
    }
  }, [])

  const handleClick = useCallback(() => {
    if (phaseRef.current !== PHASE.IDLE) return
    const r = threeRef.current
    if (!r.ready || !r.sparkVel) return

    phaseRef.current = PHASE.BURST
    setPhase(PHASE.BURST)
    setConstellationReady(false)
    setSelectedNode(null)

    for (let i = 0; i < r.sparkVel.length; i += 1) {
      const v = r.sparkVel[i]
      v.active = true
      const p = spherePoint(rand(0.08, 0.34))
      const out = spherePoint(rand(0.05, 0.24))
      r.sparkPos[i * 3] = p.x
      r.sparkPos[i * 3 + 1] = p.y
      r.sparkPos[i * 3 + 2] = p.z
      v.x = out.x
      v.y = out.y
      v.z = out.z
      v.drag = rand(0.91, 0.968)
      r.sparkSize[i] = rand(0.42, 2.35)
    }
    safeNeedsUpdate(r.sparkGeo, 'position')
    safeNeedsUpdate(r.sparkGeo, 'aSize')
    safeUniform(r.sparkMat, 'uOpacity', 0.22)

    r.shockMats.forEach((mat, i) => {
      mat.uniforms.uProgress.value = 0
      mat.uniforms.uOpacity.value = 0.16
    })
    r.burstActive = true
    r.burstTime = 0

    setFlash(true)
    setShake(true)
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current = [
      window.setTimeout(() => setFlash(false), 760),
      window.setTimeout(() => setShake(false), 580),
      window.setTimeout(() => {
        phaseRef.current = PHASE.CONSTELLATION
        setPhase(PHASE.CONSTELLATION)
      }, 700),
      window.setTimeout(() => setConstellationReady(true), 980),
    ]
  }, [])

  const handleBack = useCallback(() => {
    timersRef.current.forEach(window.clearTimeout)
    timersRef.current = []
    setSelectedNode(null)
    setConstellationReady(false)
    phaseRef.current = PHASE.IDLE
    setPhase(PHASE.IDLE)
    const r = threeRef.current
    if (r.sparkVel) r.sparkVel.forEach(v => { v.active = false })
    if (r.shockMats) r.shockMats.forEach(mat => { safeUniform(mat, 'uOpacity', 0) })
    safeUniform(r.sparkMat, 'uOpacity', 0)
    if (r.glitchPass) r.glitchPass.enabled = false
  }, [])

  const selectNode = useCallback(node => {
    setSelectedNode(node)
    setPhase(PHASE.ARTICLE)
    phaseRef.current = PHASE.ARTICLE
  }, [])

  const closeArticle = useCallback(() => {
    setSelectedNode(null)
    setPhase(PHASE.CONSTELLATION)
    phaseRef.current = PHASE.CONSTELLATION
  }, [])

  const showConstellation = phase === PHASE.CONSTELLATION || phase === PHASE.ARTICLE

  return (
    <div className={`hv-root${shake ? ' hv-shake' : ''}`}>
      <div ref={mountRef} className="hv-mount" onClick={handleClick} />
      <div className="hv-scanlines" />
      <div className="hv-vignette" />
      <div className="hv-noise" />
      {phase === PHASE.IDLE && (
        <button className="hv-prompt" onClick={handleClick} disabled={!ready || Boolean(loadError)}>
          {ready ? 'OPEN HOLOCRON' : 'INITIALISING HOLOCRON'}
        </button>
      )}
      {loadError && <div className="hv-error">HOLOCRON RENDER FAILURE<br />{loadError}</div>}
      {flash && <div className="hv-flash" />}
      {showConstellation && (
        <div className={`hv-constellation${constellationReady ? ' hv-constellation--in' : ''}`}>
          <ConstellationMap
            nodes={nodes}
            edges={edges}
            canvasSize={canvasSize}
            selectedNode={selectedNode}
            onSelectNode={selectNode}
          />
          <button className="hv-back" onClick={handleBack}>← SEAL HOLOCRON</button>
        </div>
      )}
      {selectedNode && <ArticlePanel node={selectedNode} onClose={closeArticle} />}
      <style>{STYLES}</style>
    </div>
  )
}

function ConstellationMap({ nodes, edges, canvasSize, selectedNode, onSelectNode }) {
  const w = Math.max(1, canvasSize.w || (typeof window !== 'undefined' ? window.innerWidth : 1200))
  const h = Math.max(1, canvasSize.h || (typeof window !== 'undefined' ? window.innerHeight : 800))
  const gp = node => ({ x: node.x * w, y: node.y * h })
  const cx = w * 0.5
  const cy = h * 0.53

  return (
    <svg className="hv-svg" viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="hv-node-glow" x="-250%" y="-250%" width="600%" height="600%">
          <feGaussianBlur stdDeviation="4" result="b1" />
          <feGaussianBlur stdDeviation="14" result="b2" />
          <feGaussianBlur stdDeviation="34" result="b3" />
          <feMerge><feMergeNode in="b3" /><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="hv-super-glow" x="-350%" y="-350%" width="800%" height="800%">
          <feGaussianBlur stdDeviation="10" result="b1" />
          <feGaussianBlur stdDeviation="28" result="b2" />
          <feGaussianBlur stdDeviation="55" result="b3" />
          <feMerge><feMergeNode in="b3" /><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="hv-line-glow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <radialGradient id="hv-core-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="24%" stopColor="#ff7891" />
          <stop offset="54%" stopColor="#d00026" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#380007" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hv-map-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#250006" stopOpacity="0.72" />
          <stop offset="55%" stopColor="#070001" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hv-edge-gradient" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#3b0009" stopOpacity="0.05" />
          <stop offset="45%" stopColor="#d00024" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#3b0009" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <rect width={w} height={h} fill="transparent" />
      <ellipse cx={cx} cy={cy} rx={w * 0.46} ry={h * 0.42} fill="url(#hv-map-gradient)" />
      {[0, 1, 2, 3, 4].map(i => (
        <ellipse key={`halo-${i}`} cx={cx} cy={cy} rx={w * (0.16 + i * 0.07)} ry={h * (0.1 + i * 0.055)} fill="none" stroke="#710011" strokeWidth="1" strokeOpacity={0.14 - i * 0.018} strokeDasharray={`${8 + i * 5} ${10 + i * 2}`} className="hv-map-ring" style={{ animationDelay: `${i * -1.3}s` }} />
      ))}

      {edges.map(([a, b], i) => {
        const fromNode = nodes.find(node => node.id === a)
        const toNode = nodes.find(node => node.id === b)
        if (!fromNode || !toNode) return null
        const from = gp(fromNode)
        const to = gp(toNode)
        const mx = from.x + (to.x - from.x) * 0.5
        const my = from.y + (to.y - from.y) * 0.5
        const bend = Math.sin(i * 2.4) * 46
        const path = `M ${from.x} ${from.y} Q ${mx + bend} ${my - bend} ${to.x} ${to.y}`
        return (
          <g key={`${a}-${b}`} className="hv-edge" style={{ animationDelay: `${i * 0.11}s` }}>
            <path d={path} fill="none" stroke="#b00018" strokeWidth="7" strokeOpacity="0.055" filter="url(#hv-line-glow)" />
            <path d={path} fill="none" stroke="url(#hv-edge-gradient)" strokeWidth="1.1" strokeOpacity="0.82" strokeDasharray="8 11" className="hv-edge-dash" />
            <circle r="2" fill="#d00024" filter="url(#hv-node-glow)" className="hv-edge-pulse"><animateMotion dur={`${2.4 + i * 0.18}s`} repeatCount="indefinite" path={path} /></circle>
          </g>
        )
      })}

      {nodes.map((node, i) => {
        const p = gp(node)
        const selected = selectedNode?.id === node.id
        const auraOpacity = selected ? 0.28 : 0.09
        const spokeOpacityStrong = selected ? 0.9 : 0.4
        const spokeOpacityWeak = selected ? 0.4 : 0.15
        return (
          <g key={node.id} className="hv-node-group" style={{ animationDelay: `${i * 0.075}s` }} onClick={() => onSelectNode(node)}>
            <circle cx={p.x} cy={p.y} r={selected ? 70 : 42} fill="url(#hv-core-gradient)" opacity={selected ? 0.28 : 0.12} filter="url(#hv-super-glow)" className="hv-aura-fill" />
            <circle cx={p.x} cy={p.y} r={selected ? 48 : 30} fill="none" stroke="#c0001f" strokeWidth="1" strokeOpacity={auraOpacity} filter="url(#hv-node-glow)" className="hv-aura" />
            <circle cx={p.x} cy={p.y} r={selected ? 22 : 14} fill="none" stroke={selected ? '#ff8aa1' : '#bb1b2e'} strokeWidth={selected ? 1.7 : 1} strokeOpacity={selected ? 1 : 0.68} strokeDasharray="5 4" className="hv-ring" />
            <circle cx={p.x} cy={p.y} r={selected ? 34 : 22} fill="none" stroke="#5a000e" strokeWidth="1" strokeOpacity={selected ? 0.8 : 0.35} strokeDasharray="2 9" className="hv-counter-ring" />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(tick => {
              const angle = (tick / 12) * Math.PI * 2
              const radius = selected ? 22 : 14
              return <line key={tick} x1={p.x + Math.cos(angle) * (radius - 5)} y1={p.y + Math.sin(angle) * (radius - 5)} x2={p.x + Math.cos(angle) * (radius + 8)} y2={p.y + Math.sin(angle) * (radius + 8)} stroke="#d00024" strokeWidth="1" strokeOpacity={tick % 2 === 0 ? spokeOpacityStrong : spokeOpacityWeak} />
            })}
            <circle cx={p.x} cy={p.y} r={selected ? 11 : 6.4} fill="url(#hv-core-gradient)" filter={selected ? 'url(#hv-super-glow)' : 'url(#hv-node-glow)'} />
            <circle cx={p.x} cy={p.y} r={selected ? 3.4 : 2.2} fill="#ffffff" fillOpacity={selected ? 1 : 0.92} />
            <text x={p.x} y={p.y + (selected ? 54 : 37)} textAnchor="middle" fill={selected ? '#ffc4cf' : '#b92838'} fontSize={selected ? 13 : 10} fontFamily="'Share Tech Mono', monospace" letterSpacing="0.18em" className="hv-label">{node.label.toUpperCase()}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ArticlePanel({ node, onClose }) {
  return (
    <div className="hv-article">
      <div className="hv-article-noise" />
      <div className="hv-article-border-glow" />
      <div className="hv-article-inner">
        <button className="hv-article-close" onClick={onClose}>✕</button>
        <div className="hv-article-eyebrow">◈ HOLOCRON RECORD ◈</div>
        <h2 className="hv-article-title">{node.article.title}</h2>
        <div className="hv-divider"><div className="hv-divider-line" /><span className="hv-divider-gem">◆</span><div className="hv-divider-line" /></div>
        <p className="hv-article-body">{node.article.body}</p>
        {node.article.link && <a href={node.article.link} className="hv-article-link">ACCESS FULL RECORD <span>→</span></a>}
      </div>
    </div>
  )
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

  html,
  body {
    margin: 0;
    width: 100%;
    min-width: 100%;
    min-height: 100%;
    overflow: hidden;
    background: #000;
  }

  body > div {
    min-height: 100%;
  }

  .hv-root {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    min-height: 100vh;
    min-height: 100dvh;
    background:
      radial-gradient(circle at 50% 45%, rgba(78, 0, 14, .15), transparent 28%),
      radial-gradient(circle at 50% 100%, rgba(42, 0, 8, .12), transparent 34%),
      #000;
    font-family: 'Share Tech Mono', monospace;
    overflow: hidden;
    isolation: isolate;
    z-index: 0;
  }

  .hv-root,
  .hv-root * {
    box-sizing: border-box;
  }

  .hv-mount {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .hv-mount canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .hv-scanlines,
  .hv-vignette,
  .hv-noise {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .hv-scanlines {
    z-index: 8;
    background: repeating-linear-gradient(0deg, rgba(255, 0, 36, .024) 0, rgba(255, 0, 36, .024) 1px, transparent 1px, transparent 4px);
    mix-blend-mode: screen;
    opacity: .2;
    animation: hv-scan-drift 7s linear infinite;
  }

  @keyframes hv-scan-drift { from { transform: translateY(0); } to { transform: translateY(24px); } }

  .hv-vignette {
    z-index: 9;
    background:
      radial-gradient(circle at 50% 48%, transparent 0%, transparent 46%, rgba(0, 0, 0, .88) 100%),
      linear-gradient(90deg, rgba(0, 0, 0, .5), transparent 16%, transparent 84%, rgba(0, 0, 0, .56));
  }

  .hv-noise {
    z-index: 10;
    opacity: .1;
    background-image:
      repeating-radial-gradient(circle at 17% 23%, rgba(255, 0, 36, .09) 0, rgba(255, 0, 36, .09) 1px, transparent 1px, transparent 10px),
      repeating-linear-gradient(125deg, rgba(255, 0, 36, .025), transparent 2px, transparent 7px);
    mix-blend-mode: screen;
    animation: hv-noise-crawl .42s steps(2) infinite;
  }

  @keyframes hv-noise-crawl {
    0% { transform: translate(0, 0); }
    25% { transform: translate(-1%, 1%); }
    50% { transform: translate(1%, -1%); }
    75% { transform: translate(1%, 1%); }
    100% { transform: translate(0, 0); }
  }

  .hv-shake { animation: hv-shake .58s cubic-bezier(.36,.07,.19,.97) both; }
  @keyframes hv-shake {
    0%, 100% { transform: translate(0); }
    10% { transform: translate(-10px, -7px) rotate(-.55deg); }
    20% { transform: translate(9px, 7px) rotate(.55deg); }
    30% { transform: translate(-7px, 5px) rotate(-.25deg); }
    40% { transform: translate(7px, -5px) rotate(.2deg); }
    50% { transform: translate(-5px, 4px); }
    60% { transform: translate(4px, -3px); }
    70% { transform: translate(-3px, 2px); }
    80% { transform: translate(2px, -2px); }
    90% { transform: translate(-1px, 1px); }
  }

  .hv-prompt {
    position: absolute;
    left: 50%;
    bottom: 7.5%;
    transform: translateX(-50%);
    z-index: 24;
    border: 1px solid rgba(255, 32, 60, .24);
    background: linear-gradient(90deg, transparent, rgba(80, 0, 12, .3), transparent), rgba(3, 0, 0, .48);
    color: #e00028;
    font-family: 'Share Tech Mono', monospace;
    font-size: .68rem;
    letter-spacing: .54em;
    padding: 13px 24px 13px 31px;
    cursor: pointer;
    user-select: none;
    text-shadow: 0 0 14px rgba(210, 0, 36, .78), 0 0 36px rgba(160, 0, 36, .4);
    box-shadow: 0 0 38px rgba(190, 0, 28, .14), inset 0 0 26px rgba(190, 0, 28, .05);
    animation: hv-prompt-breathe 2.8s ease-in-out infinite;
  }

  .hv-prompt:hover {
    color: #ffd0d8;
    border-color: rgba(255, 80, 108, .72);
    box-shadow: 0 0 70px rgba(190, 0, 28, .3), inset 0 0 40px rgba(190, 0, 28, .12);
  }

  .hv-prompt:disabled { opacity: .45; cursor: wait; }
  @keyframes hv-prompt-breathe { 0%, 100% { opacity: .68; letter-spacing: .5em; } 50% { opacity: 1; letter-spacing: .64em; } }

  .hv-error {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 80;
    width: min(680px, 88vw);
    color: #ff7d91;
    text-align: center;
    font-size: .78rem;
    letter-spacing: .16em;
    line-height: 1.7;
    background: rgba(20, 0, 5, .86);
    border: 1px solid rgba(255, 0, 40, .35);
    padding: 24px;
    box-shadow: 0 0 70px rgba(255, 0, 40, .2);
  }

  .hv-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 60;
    background: radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,120,145,.92) 10%, rgba(190,0,36,.68) 28%, rgba(55,0,10,.28) 55%, transparent 76%);
    animation: hv-flash-anim .76s cubic-bezier(.16, 1, .3, 1) forwards;
    mix-blend-mode: screen;
  }

  @keyframes hv-flash-anim {
    0% { opacity: 1; transform: scale(.04); filter: blur(0); }
    18% { opacity: 1; transform: scale(1.55); filter: blur(1px); }
    100% { opacity: 0; transform: scale(3.4); filter: blur(8px); }
  }

  .hv-constellation {
    position: absolute;
    inset: 0;
    z-index: 18;
    opacity: 0;
    pointer-events: none;
    transition: opacity 1.05s ease;
    background: radial-gradient(ellipse at 50% 53%, rgba(35, 0, 8, .38), transparent 42%), radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, .18), rgba(0, 0, 0, .84) 82%);
    backdrop-filter: blur(1.5px) contrast(1.18);
  }

  .hv-constellation--in { opacity: 1; pointer-events: auto; }
  .hv-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hv-map-ring { transform-origin: center; animation: hv-map-spin 28s linear infinite; }
  .hv-map-ring:nth-of-type(odd) { animation-direction: reverse; }
  @keyframes hv-map-spin { to { transform: rotate(360deg); } }
  .hv-edge { opacity: 0; animation: hv-edge-in 1.2s ease forwards; }
  @keyframes hv-edge-in { from { opacity: 0; filter: blur(8px); } to { opacity: 1; filter: blur(0); } }
  .hv-edge-dash { animation: hv-edge-dash 1.8s linear infinite; }
  @keyframes hv-edge-dash { to { stroke-dashoffset: -76; } }
  .hv-edge-pulse { opacity: .9; }
  .hv-node-group { opacity: 0; cursor: pointer; transform-origin: center; animation: hv-node-pop .75s cubic-bezier(.2, 1.65, .25, 1) forwards; }
  @keyframes hv-node-pop { from { opacity: 0; transform: scale(.05); filter: blur(10px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
  .hv-node-group:hover .hv-label { fill: #ffd5dc !important; text-shadow: 0 0 18px rgba(210, 0, 36, 1); }
  .hv-node-group:hover .hv-aura-fill { opacity: .36; }
  .hv-aura { animation: hv-aura-pulse 3.6s ease-in-out infinite; }
  @keyframes hv-aura-pulse { 0%, 100% { stroke-opacity: .08; } 50% { stroke-opacity: .35; } }
  .hv-ring { animation: hv-ring-spin 8s linear infinite; transform-origin: center; transform-box: fill-box; }
  .hv-counter-ring { animation: hv-ring-spin 14s linear infinite reverse; transform-origin: center; transform-box: fill-box; }
  @keyframes hv-ring-spin { to { stroke-dashoffset: -300; transform: rotate(360deg); } }
  .hv-label { transition: fill .18s ease, text-shadow .18s ease; text-shadow: 0 0 12px rgba(210, 0, 36, .5); paint-order: stroke fill; stroke: rgba(0, 0, 0, .7); stroke-width: 2px; }

  .hv-back {
    position: absolute;
    top: 28px;
    left: 28px;
    z-index: 28;
    background: rgba(5, 0, 0, .55);
    border: 1px solid rgba(255, 0, 40, .22);
    color: #a0001d;
    font-family: 'Share Tech Mono', monospace;
    font-size: .62rem;
    letter-spacing: .32em;
    padding: 11px 22px;
    cursor: pointer;
    transition: all .2s ease;
    text-shadow: 0 0 12px rgba(210, 0, 36, .28);
    box-shadow: inset 0 0 24px rgba(210, 0, 36, .05);
  }

  .hv-back:hover {
    border-color: rgba(255, 70, 100, .82);
    color: #ffd0d8;
    box-shadow: 0 0 42px rgba(190, 0, 36, .28), inset 0 0 34px rgba(190, 0, 36, .12);
    text-shadow: 0 0 20px rgba(210, 0, 36, 1);
  }

  .hv-article {
    position: absolute;
    top: 0;
    right: 0;
    width: min(520px, 92vw);
    height: 100%;
    z-index: 34;
    overflow: hidden;
    background: linear-gradient(155deg, rgba(18, 0, 4, .96), rgba(5, 0, 1, .92) 48%, rgba(0, 0, 0, .97)), repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255, 0, 40, .025) 5px);
    border-left: 1px solid rgba(255, 0, 40, .22);
    box-shadow: -42px 0 140px rgba(190, 0, 36, .22), -1px 0 0 rgba(255, 110, 130, .16);
    animation: hv-panel-in .48s cubic-bezier(.16, 1, .3, 1) forwards;
    backdrop-filter: blur(6px) saturate(1.2);
  }

  @keyframes hv-panel-in { from { transform: translateX(100%); filter: blur(12px); } to { transform: translateX(0); filter: blur(0); } }
  .hv-article-noise { position: absolute; inset: 0; pointer-events: none; z-index: 0; background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255, 0, 40, .035) 4px), radial-gradient(circle at 20% 15%, rgba(255, 0, 40, .14), transparent 28%), radial-gradient(circle at 80% 78%, rgba(160, 0, 24, .12), transparent 35%); opacity: .7; }
  .hv-article-border-glow { position: absolute; top: 0; left: 0; width: 1px; height: 100%; background: linear-gradient(to bottom, transparent, #760014, #d00024, #ff8aa1, #760014, transparent); animation: hv-border-pulse 2.6s ease-in-out infinite; }
  @keyframes hv-border-pulse { 0%, 100% { opacity: .35; box-shadow: 0 0 10px rgba(210, 0, 36, .5); } 50% { opacity: 1; box-shadow: 0 0 26px rgba(210, 0, 36, 1); } }
  .hv-article-inner { position: relative; z-index: 1; height: 100%; padding: 60px 48px; overflow-y: auto; }
  .hv-article-inner::-webkit-scrollbar { width: 3px; }
  .hv-article-inner::-webkit-scrollbar-track { background: rgba(255, 0, 40, .05); }
  .hv-article-inner::-webkit-scrollbar-thumb { background: rgba(255, 0, 40, .34); }
  .hv-article-close { position: absolute; top: 22px; right: 24px; background: none; border: 1px solid rgba(255, 0, 40, .1); color: #831628; font-size: .9rem; cursor: pointer; transition: all .18s ease; font-family: monospace; padding: 6px 9px; }
  .hv-article-close:hover { color: #ffd0d8; border-color: rgba(255, 0, 40, .55); text-shadow: 0 0 12px rgba(210, 0, 36, 1); box-shadow: 0 0 24px rgba(210, 0, 36, .2); }
  .hv-article-eyebrow { color: #8a1628; font-size: .58rem; letter-spacing: .48em; margin-bottom: 28px; text-shadow: 0 0 18px rgba(210, 0, 36, .36); }
  .hv-article-title { color: #ff3356; font-family: 'Share Tech Mono', monospace; font-size: clamp(1.12rem, 2vw, 1.7rem); letter-spacing: .13em; font-weight: normal; margin: 0 0 30px; text-transform: uppercase; text-shadow: 0 0 24px rgba(210, 0, 36, .85), 0 0 70px rgba(210, 0, 36, .32); }
  .hv-divider { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
  .hv-divider-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 0, 40, .52), transparent); }
  .hv-divider-gem { color: #e00028; font-size: .55rem; text-shadow: 0 0 16px rgba(210, 0, 36, .9); }
  .hv-article-body { color: #ca6c7a; font-size: .88rem; line-height: 2.05; margin: 0 0 42px; text-shadow: 0 0 12px rgba(210, 0, 36, .12); }
  .hv-article-link { display: inline-flex; align-items: center; gap: 12px; color: #ff385a; font-family: 'Share Tech Mono', monospace; font-size: .62rem; letter-spacing: .3em; text-decoration: none; border: 1px solid rgba(255, 0, 40, .22); padding: 13px 20px; transition: all .22s ease; box-shadow: inset 0 0 24px rgba(210, 0, 36, .04); }
  .hv-article-link:hover { color: #ffd6dc; border-color: rgba(255, 70, 100, .84); box-shadow: 0 0 36px rgba(210, 0, 36, .28), inset 0 0 30px rgba(210, 0, 36, .13); text-shadow: 0 0 12px rgba(210, 0, 36, 1); }
  .hv-article-link span { transition: transform .18s ease; }
  .hv-article-link:hover span { transform: translateX(6px); }

  @media (max-width: 720px) {
    .hv-prompt { font-size: .55rem; letter-spacing: .34em; width: max-content; max-width: 88vw; }
    .hv-back { top: 18px; left: 18px; font-size: .54rem; letter-spacing: .18em; }
    .hv-article-inner { padding: 58px 30px; }
  }
`
