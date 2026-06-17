const RESOURCE_PAYLOAD_TTL_MS = 60 * 1000;
const resourcePayloadCache = new Map();

function resourceCacheKey(division, type) {
  return `${division}:${type}`;
}

function readCachedPayload(key) {
  const cached = resourcePayloadCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;
  resourcePayloadCache.delete(key);
  return null;
}

function rememberPayload(key, payload) {
  resourcePayloadCache.set(key, {
    payload,
    expiresAt: Date.now() + RESOURCE_PAYLOAD_TTL_MS
  });
  return payload;
}

function emptyPayload() {
  return { resources: [], canWrite: false, canUpload: false, slotCatalog: [] };
}

export async function fetchDivisionResourcePayload(division, type, options = {}) {
  const cacheKey = resourceCacheKey(division, type);
  if (!options.force) {
    const cached = readCachedPayload(cacheKey);
    if (cached) return cached;
  }

  try {
    const response = await fetch(`/api/resources?division=${encodeURIComponent(division)}&type=${encodeURIComponent(type)}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      resourcePayloadCache.delete(cacheKey);
      return emptyPayload();
    }

    return rememberPayload(cacheKey, {
      resources: payload.resources || [],
      canWrite: Boolean(payload.canWrite),
      canUpload: Boolean(payload.canUpload),
      slotCatalog: payload.slotCatalog || []
    });
  } catch (error) {
    console.warn("Resource feed unavailable:", error);
    return emptyPayload();
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

  resourcePayloadCache.delete(resourceCacheKey(division, type));
  return payload;
}
