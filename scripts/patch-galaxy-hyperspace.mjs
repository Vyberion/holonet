import { readFile, writeFile } from "node:fs/promises";

const filePath = "src/components/GalaxyControlMap.jsx";
let source = await readFile(filePath, "utf8");
const eol = source.includes("\r\n") ? "\r\n" : "\n";

function lines(parts) {
  return parts.join(eol);
}

function replaceOnce(before, after, label) {
  if (source.includes(after)) return false;
  if (!source.includes(before)) return false;
  source = source.replace(before, after);
  return true;
}

let changed = false;

changed = replaceOnce(
  lines([
    "  const materialRef = useRef(null);",
    "  const opacityRef = useRef(0);"
  ]),
  lines([
    "  const materialRef = useRef(null);",
    "  const opacityRef = useRef(0);",
    "  const forwardRef = useRef(new THREE.Vector3());"
  ]),
  "hyperspace forward vector"
) || changed;

const liveCameraLock = lines([
  "    ref.current.position.copy(camera.position);",
  "    ref.current.quaternion.copy(camera.quaternion);",
  "    ref.current.position.add(forwardRef.current.set(0, 0, -0.35).applyQuaternion(camera.quaternion));",
  "    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;"
]);

const oldAnchorLock = lines([
  "    const cameraAnchor = cameraAnchorRef?.current;",
  "    ref.current.position.copy(cameraAnchor?.position || camera.position);",
  "    ref.current.quaternion.copy(cameraAnchor?.quaternion || camera.quaternion);",
  "    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;"
]);

const stableWorldLock = lines([
  "    const cameraAnchor = cameraAnchorRef?.current;",
  "    const anchorPosition = cameraAnchor?.position || camera.position;",
  "    const anchorQuaternion = cameraAnchor?.quaternion || camera.quaternion;",
  "    ref.current.position.copy(anchorPosition);",
  "    ref.current.quaternion.copy(anchorQuaternion);",
  "    ref.current.position.add(forwardRef.current.set(0, 0, -0.35).applyQuaternion(anchorQuaternion));",
  "    ref.current.rotation.z += Math.sin(clock.elapsedTime * 0.8) * 0.0008;"
]);

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
