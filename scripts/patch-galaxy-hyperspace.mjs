import { readFile, writeFile } from "node:fs/promises";

const filePath = "src/components/GalaxyControlMap.jsx";
let source = await readFile(filePath, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return false;
  if (!source.includes(before)) return false;
  source = source.replace(before, after);
  return true;
}

let changed = false;

changed = replaceOnce(
  `  const materialRef = useRef(null);\n  const opacityRef = useRef(0);`,
  `  const materialRef = useRef(null);\n  const opacityRef = useRef(0);\n  const forwardRef = useRef(new THREE.Vector3());`,
  "hyperspace forward vector"
) || changed;

const liveCameraLock = `    ref.current.position.copy(camera.position);\n    ref.current.quaternion.copy(camera.quaternion);\n    ref.current.position.add(forwardRef.current.set(0, 0, -0.35).applyQuaternion(camera.quaternion));\n    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;`;

const oldAnchorLock = `    const cameraAnchor = cameraAnchorRef?.current;\n    ref.current.position.copy(cameraAnchor?.position || camera.position);\n    ref.current.quaternion.copy(cameraAnchor?.quaternion || camera.quaternion);\n    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;`;

const stableWorldLock = `    const cameraAnchor = cameraAnchorRef?.current;\n    const anchorPosition = cameraAnchor?.position || camera.position;\n    const anchorQuaternion = cameraAnchor?.quaternion || camera.quaternion;\n    ref.current.position.copy(anchorPosition);\n    ref.current.quaternion.copy(anchorQuaternion);\n    ref.current.position.add(forwardRef.current.set(0, 0, -0.35).applyQuaternion(anchorQuaternion));\n    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;`;

changed = replaceOnce(oldAnchorLock, liveCameraLock, "old anchor lock") || changed;
changed = replaceOnce(stableWorldLock, liveCameraLock, "stable world lock") || changed;

changed = replaceOnce(
  `    <lineSegments ref={ref} geometry={geometry} visible={false}>`,
  `    <lineSegments ref={ref} geometry={geometry} visible={false} frustumCulled={false} renderOrder={900}>`,
  "hyperspace line render props"
) || changed;

if (!source.includes(liveCameraLock)) {
  throw new Error("Galaxy hyperspace live camera lock target not found.");
}

if (changed) {
  await writeFile(filePath, source);
  console.log("Patched galaxy hyperspace tunnel to lock to the live camera view.");
} else {
  console.log("Galaxy hyperspace tunnel already locked to the live camera view.");
}
