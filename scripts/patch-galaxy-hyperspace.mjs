import { readFile, writeFile } from "node:fs/promises";

const filePath = "src/components/GalaxyControlMap.jsx";
let source = await readFile(filePath, "utf8");

const replacements = [
  [
    `  const anchorObject = useMemo(() => new THREE.Object3D(), []);\n  const updateHyperspaceAnchor = useCallback((position, target) => {\n    const anchor = hyperspaceCameraAnchorRef?.current;\n    if (!anchor) return;\n    anchorObject.position.copy(position);\n    anchorObject.up.copy(camera.up);\n    anchorObject.lookAt(target);\n    anchorObject.updateMatrixWorld();\n    anchor.position.copy(position);\n    anchor.quaternion.copy(anchorObject.quaternion);\n  }, [anchorObject, camera.up, hyperspaceCameraAnchorRef]);`,
    `  const stableAnchorCamera = useMemo(() => new THREE.PerspectiveCamera(), []);\n  const updateHyperspaceAnchor = useCallback((position, target) => {\n    const anchor = hyperspaceCameraAnchorRef?.current;\n    if (!anchor) return;\n    stableAnchorCamera.position.copy(position);\n    stableAnchorCamera.up.copy(camera.up);\n    stableAnchorCamera.lookAt(target);\n    stableAnchorCamera.updateMatrixWorld();\n    anchor.position.copy(position);\n    anchor.quaternion.copy(stableAnchorCamera.quaternion);\n  }, [camera.up, hyperspaceCameraAnchorRef, stableAnchorCamera]);`
  ],
  [
    `  const materialRef = useRef(null);\n  const opacityRef = useRef(0);`,
    `  const materialRef = useRef(null);\n  const opacityRef = useRef(0);\n  const forwardRef = useRef(new THREE.Vector3());`
  ],
  [
    `    const cameraAnchor = cameraAnchorRef?.current;\n    ref.current.position.copy(cameraAnchor?.position || camera.position);\n    ref.current.quaternion.copy(cameraAnchor?.quaternion || camera.quaternion);\n    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;`,
    `    const cameraAnchor = cameraAnchorRef?.current;\n    const anchorPosition = cameraAnchor?.position || camera.position;\n    const anchorQuaternion = cameraAnchor?.quaternion || camera.quaternion;\n    ref.current.position.copy(anchorPosition);\n    ref.current.quaternion.copy(anchorQuaternion);\n    ref.current.position.add(forwardRef.current.set(0, 0, -0.35).applyQuaternion(anchorQuaternion));\n    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;`
  ],
  [
    `    <lineSegments ref={ref} geometry={geometry} visible={false}>`,
    `    <lineSegments ref={ref} geometry={geometry} visible={false} frustumCulled={false} renderOrder={900}>`
  ]
];

let changed = false;

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  if (!source.includes(before)) {
    throw new Error(`Galaxy hyperspace patch target not found: ${before.slice(0, 80)}...`);
  }
  source = source.replace(before, after);
  changed = true;
}

if (changed) {
  await writeFile(filePath, source);
  console.log("Patched galaxy hyperspace line anchor.");
} else {
  console.log("Galaxy hyperspace line anchor already patched.");
}
