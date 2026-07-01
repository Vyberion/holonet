const TARGET_FILE = /GalaxyControlMap\.jsx$/;

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Galaxy visual tuning patch failed: ${label}`);
  }
  return source.replace(search, replacement);
}

module.exports = function galaxyControlMapLoader(source) {
  if (!TARGET_FILE.test(this.resourcePath || "")) return source;

  let output = source;

  output = replaceRequired(
    output,
    `const PARTICLE_COUNTS = {\n  high: { stars: 56000, dust: 82000, sky: 7200, sparkles: 340, streaks: 1900 },\n  balanced: { stars: 30000, dust: 44000, sky: 3400, sparkles: 150, streaks: 1150 },\n  reduced: { stars: 16000, dust: 22000, sky: 2200, sparkles: 90, streaks: 620 }\n};`,
    `const PARTICLE_COUNTS = {\n  high: { stars: 132000, dust: 205000, sky: 7200, sparkles: 340, streaks: 1900 },\n  balanced: { stars: 72000, dust: 112000, sky: 3400, sparkles: 150, streaks: 1150 },\n  reduced: { stars: 36000, dust: 56000, sky: 2200, sparkles: 90, streaks: 620 }\n};`,
    "particle counts"
  );

  output = replaceRequired(
    output,
    `function spiralAngle(radius, arm, armCount = SPIRAL_ARM_COUNT) {\n  const base = (arm / armCount) * TAU;\n  const r = Math.max(radius, CORE_RADIUS);\n  // theta = theta0 + ln(r / r0) / tan(pitch) - a true logarithmic spiral.\n  // Near the core the angle changes fast (tight winding); further out it changes\n  // slowly (loose, open winding) - exactly how real spiral arms are shaped.\n  return base + Math.log(r / CORE_RADIUS) / SPIRAL_B;\n}`,
    `const SPIRAL_ARM_PROFILES = [\n  { startScale: 0.92, endScale: 1.03, wrap: 1.18, offset: -0.08, widthScale: 1.08, tail: 0.24 },\n  { startScale: 1.12, endScale: 0.93, wrap: 0.86, offset: 0.17, widthScale: 0.88, tail: -0.18 },\n  { startScale: 0.98, endScale: 1.08, wrap: 1.34, offset: -0.21, widthScale: 1.18, tail: 0.34 },\n  { startScale: 1.22, endScale: 0.88, wrap: 0.74, offset: 0.29, widthScale: 0.82, tail: -0.28 },\n  { startScale: 0.86, endScale: 0.99, wrap: 1.02, offset: 0.05, widthScale: 1.02, tail: 0.14 }\n];\n\nfunction spiralArmProfile(arm) {\n  return SPIRAL_ARM_PROFILES[arm % SPIRAL_ARM_PROFILES.length] || SPIRAL_ARM_PROFILES[0];\n}\n\nfunction spiralAngle(radius, arm, armCount = SPIRAL_ARM_COUNT, wrap = 1, offset = 0) {\n  const profile = spiralArmProfile(arm);\n  const base = (arm / armCount) * TAU + offset + profile.offset;\n  const r = Math.max(radius, CORE_RADIUS);\n  return base + (Math.log(r / CORE_RADIUS) / SPIRAL_B) * wrap * profile.wrap;\n}`,
    "spiral angle profiles"
  );

  output = replaceRequired(
    output,
    `function makeSpiralArmPoints(arm, radiusStart = 1.1, radiusEnd = GALAXY_RADIUS, segments = 96, offset = 0) {\n  const points = [];\n  for (let i = 0; i <= segments; i += 1) {\n    const t = i / segments;\n    const radius = radiusStart + (radiusEnd - radiusStart) * t;\n    const angle = spiralAngle(radius, arm) + offset;\n    const widthWave = Math.sin(t * Math.PI) * 0.18;\n    points.push(new THREE.Vector3(\n      Math.cos(angle) * (radius + widthWave),\n      0.032 + Math.sin(t * TAU + arm) * 0.018,\n      Math.sin(angle) * (radius + widthWave) * GALAXY_VISUAL_FLATTEN\n    ));\n  }\n  return points;\n}`,
    `function makeSpiralArmPoints(arm, radiusStart = 1.1, radiusEnd = GALAXY_RADIUS, segments = 96, offset = 0) {\n  const profile = spiralArmProfile(arm);\n  const actualStart = radiusStart * profile.startScale;\n  const actualEnd = radiusEnd * profile.endScale;\n  const points = [];\n  for (let i = 0; i <= segments; i += 1) {\n    const t = i / segments;\n    const fade = smoothstep(0.74, 1, t);\n    const radius = actualStart + (actualEnd - actualStart) * t;\n    const angle = spiralAngle(radius, arm, SPIRAL_ARM_COUNT, 1, offset) + profile.tail * fade;\n    const curtail = 1 - fade * (profile.endScale < 0.95 ? 0.08 : 0.025);\n    const widthWave = Math.sin(t * Math.PI) * (0.14 + profile.widthScale * 0.09) + Math.sin(t * TAU * 1.65 + arm) * 0.045;\n    const rimFeather = smoothstep(0.82, 1, t);\n    const armRadius = (radius + widthWave * (1 - rimFeather * 0.35)) * curtail;\n    points.push(new THREE.Vector3(\n      Math.cos(angle) * armRadius,\n      0.032 + Math.sin(t * TAU + arm) * 0.018,\n      Math.sin(angle) * armRadius * GALAXY_VISUAL_FLATTEN\n    ));\n  }\n  return points;\n}`,
    "spiral arm points"
  );

  output = output.replaceAll(
    `points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.08, GALAXY_RADIUS * 0.96, 110, 0),`,
    `points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.08, GALAXY_RADIUS * 0.985, 132, 0),`
  );
  output = output.replaceAll(
    `points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.32, GALAXY_RADIUS * 0.925, 92, -0.18),`,
    `points: makeSpiralArmPoints(arm, CORE_RADIUS * 1.28, GALAXY_RADIUS * 0.955, 116, -0.18),`
  );
  output = output.replaceAll(`opacity: arm % 2 ? 0.16 : 0.12,`, `opacity: arm % 2 ? 0.26 : 0.22,`);
  output = output.replaceAll(`opacity: 0.24,`, `opacity: 0.34,`);
  output = output.replaceAll(`radius: arm % 2 ? 0.026 : 0.022`, `radius: arm % 2 ? 0.032 : 0.028`);
  output = output.replaceAll(`radius: 0.028`, `radius: 0.035`);

  output = replaceRequired(
    output,
    `    const isInterArm = !isCore && rnd() < (mode === "dust" ? 0.32 : 0.22);\n    const arm = i % SPIRAL_ARM_COUNT;\n    const armStart = mode === "dust" ? CORE_RADIUS * 1.16 : CORE_RADIUS * 1.24;\n    const radius = isCore\n      ? Math.pow(rnd(), 1.9) * CORE_RADIUS\n      : Math.pow(rnd(), isInterArm ? 0.82 : mode === "dust" ? 0.68 : 0.6) * (GALAXY_RADIUS - armStart) + armStart;\n    const armAngle = spiralAngle(radius, arm);`,
    `    const isInterArm = !isCore && rnd() < (mode === "dust" ? 0.78 : 0.66);\n    const arm = Math.floor(rnd() * SPIRAL_ARM_COUNT);\n    const profile = spiralArmProfile(arm);\n    const armStart = (mode === "dust" ? CORE_RADIUS * 1.08 : CORE_RADIUS * 1.16) * profile.startScale;\n    const armEnd = GALAXY_RADIUS * (isInterArm ? randRange(rnd, 0.94, 1.08) : profile.endScale);\n    const radius = isCore\n      ? Math.pow(rnd(), 1.9) * CORE_RADIUS\n      : Math.pow(rnd(), isInterArm ? 0.74 : mode === "dust" ? 0.62 : 0.56) * (armEnd - armStart) + armStart;\n    const tailCurl = smoothstep(GALAXY_RADIUS * 0.78, GALAXY_RADIUS * 1.04, radius) * profile.tail;\n    const armAngle = spiralAngle(radius, arm) + tailCurl;`,
    "particle arm selection"
  );

  output = output.replace(
    `const armWidth = mode === "dust" ? 0.11 + radius * 0.014 : 0.055 + radius * 0.007;`,
    `const armWidth = (mode === "dust" ? 0.13 + radius * 0.018 : 0.064 + radius * 0.009) * profile.widthScale;`
  );
  output = output.replace(
    `armWidth * (mode === "dust" ? 1.55 : 1.9),\n      interArmGap * (mode === "dust" ? 0.46 : 0.42)`,
    `armWidth * (mode === "dust" ? 1.35 : 1.55),\n      interArmGap * (mode === "dust" ? 0.54 : 0.5)`
  );
  output = output.replace(
    `? (mode === "dust" ? 0.18 + radius * 0.018 : 0.048 + radius * 0.007)\n      : (mode === "dust" ? 0.11 + radius * 0.012 : 0.018 + radius * 0.004);`,
    `? (mode === "dust" ? 0.3 + radius * 0.026 : 0.09 + radius * 0.012)\n      : (mode === "dust" ? 0.18 + radius * 0.018 : 0.032 + radius * 0.006);`
  );
  output = output.replace(
    `if (isInterArm) color.lerp(new THREE.Color("#b9d5ff"), mode === "dust" ? 0.18 : 0.28);`,
    `if (isInterArm) color.lerp(new THREE.Color("#dce8ff"), mode === "dust" ? 0.28 : 0.38);`
  );
  output = output.replace(
    `? randRange(rnd, 0.036, 0.118) * (1.12 - rimFade * 0.12) * (isInterArm ? 0.82 : 1)\n      : randRange(rnd, 0.016, 0.06) * (isCore ? 0.72 : isInterArm ? 0.86 : 1);`,
    `? randRange(rnd, 0.07, 0.19) * (1.18 - rimFade * 0.1) * (isInterArm ? 1.18 : 1.34)\n      : randRange(rnd, 0.026, 0.096) * (isCore ? 0.92 : isInterArm ? 1.2 : 1.34);`
  );

  output = output.replace(
    `blending={THREE.AdditiveBlending}\n        uniforms={{`,
    `blending={THREE.AdditiveBlending}\n        toneMapped={false}\n        uniforms={{`
  );
  output = output.replace(
    `float core = 1.0 - smoothstep(0.0, 0.18, d);\n            float glow = 1.0 - smoothstep(0.12, 1.0, d);\n            float twinkle = 0.75 + 0.25 * sin(uTime * 1.8 + vColor.r * 17.0);\n            gl_FragColor = vec4(vColor, (core + glow * 0.62) * uOpacity * twinkle);`,
    `float core = 1.0 - smoothstep(0.0, 0.24, d);\n            float glow = 1.0 - smoothstep(0.08, 1.0, d);\n            float twinkle = 0.82 + 0.28 * sin(uTime * 1.8 + vColor.r * 17.0);\n            gl_FragColor = vec4(vColor * 1.45, (core * 1.18 + glow * 1.05) * uOpacity * twinkle);`
  );
  output = output.replace(
    `<GalaxyParticles mode="stars" count={counts.stars} seed={4321} opacity={0.9 * opacity} sizeScale={0.86} />\n      <GalaxyParticles mode="dust" count={counts.dust} seed={8827} opacity={0.32 * opacity} sizeScale={1.18} />`,
    `<GalaxyParticles mode="stars" count={counts.stars} seed={4321} opacity={1.08 * opacity} sizeScale={1.12} />\n      <GalaxyParticles mode="dust" count={counts.dust} seed={8827} opacity={0.62 * opacity} sizeScale={1.42} />`
  );

  return output;
};
