export const criticalPreloadImages = [];

export const hierarchyPreloadImages = [
  "/assets/morphs/academy_student.png",
  "/assets/morphs/acolyte.png",
  "/assets/morphs/clown.jpg",
  "/assets/morphs/dark_honor_guard.png",
  "/assets/morphs/darth.png",
  "/assets/morphs/dread_master.png",
  "/assets/morphs/grotthu.png",
  "/assets/morphs/hopeful.png",
  "/assets/morphs/initiate.png",
  "/assets/morphs/inquisitor.png",
  "/assets/morphs/neophyte.png",
  "/assets/morphs/reaver.png",
  "/assets/morphs/sith_adept.png",
  "/assets/morphs/sith_apprentice.png",
  "/assets/morphs/sith_lord.png",
  "/assets/morphs/sith_marauder.png",
  "/assets/morphs/sith_master.png",
  "/assets/morphs/sith_overseer.png",
  "/assets/morphs/sith_prospect.png",
  "/assets/morphs/sith_seer.png",
  "/assets/morphs/sith_sorcerer.png",
  "/assets/morphs/sith_warrior.png",
  "/assets/morphs/tyro.png"
];

const preloadedImages = new Set();

export function preloadImage(src) {
  if (typeof window === "undefined" || !src || preloadedImages.has(src)) return;

  preloadedImages.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

export function preloadHierarchyImages() {
  hierarchyPreloadImages.forEach(preloadImage);
}
