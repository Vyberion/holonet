export async function fetchDivisionResourcePayload(division, type) {
  try {
    const response = await fetch(`/api/resources?division=${encodeURIComponent(division)}&type=${encodeURIComponent(type)}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      return { resources: [], canWrite: false, canUpload: false, slotCatalog: [] };
    }

    return {
      resources: payload.resources || [],
      canWrite: Boolean(payload.canWrite),
      canUpload: Boolean(payload.canUpload),
      slotCatalog: payload.slotCatalog || []
    };
  } catch (error) {
    console.warn("Resource feed unavailable:", error);
    return { resources: [], canWrite: false, canUpload: false, slotCatalog: [] };
  }
}

export async function fetchDivisionResources(division, type) {
  const payload = await fetchDivisionResourcePayload(division, type);
  return payload.resources;
}

export async function saveDivisionResource(division, type, data) {
  const response = await fetch(`/api/resources?division=${encodeURIComponent(division)}&type=${encodeURIComponent(type)}`, {
    method: data.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  }

  return payload;
}
