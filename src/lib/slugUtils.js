export function processStatuteSlugs(statutes) {
  const totalCounts = {};
  const currentCounts = {};
  
  // First pass: count total occurrences of each base slug
  (statutes || []).forEach(statute => {
    const baseSlug = (statute.title || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "statute";
      
    totalCounts[baseSlug] = (totalCounts[baseSlug] || 0) + 1;
  });

  // Second pass: generate slugs
  return (statutes || []).map(statute => {
    const baseSlug = (statute.title || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "statute";
      
    if (totalCounts[baseSlug] > 1) {
      currentCounts[baseSlug] = (currentCounts[baseSlug] || 0) + 1;
      return { ...statute, slug: `${baseSlug}-${currentCounts[baseSlug]}` };
    } else {
      return { ...statute, slug: baseSlug };
    }
  });
}
