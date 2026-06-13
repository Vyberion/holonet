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

import { createClient } from "@supabase/supabase-js";

export async function uploadDivisionHandbook(division, slotKey, file) {
  const startResponse = await fetch("/api/handbook-upload/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      division,
      slotKey,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || "application/pdf"
    })
  });

  const startPayload = await startResponse.json();

  if (!startResponse.ok || !startPayload.ok) {
    throw new Error(startPayload.reason || startPayload.error || "UPLOAD_START_FAILED");
  }

  const supabase = createClient(
    startPayload.supabaseUrl,
    startPayload.supabaseAnonKey
  );

  const { error: uploadError } = await supabase.storage
    .from(startPayload.bucket)
    .uploadToSignedUrl(
      startPayload.path,
      startPayload.token,
      file,
      { contentType: file.type || "application/pdf" }
    );

  if (uploadError) {
    throw new Error(uploadError.message || "DIRECT_UPLOAD_FAILED");
  }

  const finishResponse = await fetch("/api/handbook-upload/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      division,
      slotKey,
      resourceId: startPayload.resourceId,
      storagePath: startPayload.path,
      fileName: startPayload.fileName,
      fileSizeBytes: file.size,
      mimeType: file.type || "application/pdf"
    })
  });

  const finishPayload = await finishResponse.json();

  if (!finishResponse.ok || !finishPayload.ok) {
    throw new Error(finishPayload.reason || finishPayload.error || "UPLOAD_FINISH_FAILED");
  }

  return finishPayload;
}

