import {
  isMissingSchemaError, getAuthContext, canEditLibrary, createSignedStorageUrl, removeStorageObjects, supabaseRest, uploadStorageObject
} from "../../../lib/api-helpers.js";


const COTS_BUCKET = "cots";
const COTS_ROW_KEY = "current";

export const runtime = "nodejs";

const DEFAULT_COTS_STATE = {
  champion: {
    name: "coldmanjar123",
    title: "Reaver Initiate",
    motto: "The Future Belongs to the Bold.",
    season: "CoTS I",
    podiumImage: { bucket: "", path: "", url: "" }
  },
  podium: [
    { place: "I", name: "Coldmanjar123", note: "Champion" },
    { place: "II", name: "Oynx", note: "Finalist" },
    { place: "III", name: "Barrakuda", note: "Podium" }
  ],
  bracket: [
    {
      name: "Opening Duels",
      matches: [
        { id: "A1", left: "Oynx", right: "Coldmanjar", winner: "Coldmanjar", score: "0-1" },
        { id: "A2", left: "Shaz", right: "Tactia", winner: "Tactia", score: "0-1" },
        { id: "A3", left: "Shan", right: "Zyrax", winner: "Zyrax", score: "0-1" },
        { id: "A4", left: "Liquid", right: "Lux", winner: "Lux", score: "0-1" },
        { id: "A5", left: "Barrakuda", right: "Kumoku", winner: "Barrakuda", score: "1-0" },
        { id: "A6", left: "Kick", right: "Oynx", winner: "Oynx", score: "0-1" },
        { id: "A7", left: "Liquid", right: "Shan", winner: "Shan", score: "0-1" },
        { id: "A8", left: "Tactia", right: "Katt", winner: "Tactia", score: "1-0" }
      ]
    },
    {
      name: "Quarter Finals",
      matches: [
        { id: "Q1", left: "Coldmanjar", right: "Tactia", winner: "Coldmanjar", score: "1-0" },
        { id: "Q2", left: "Zyrax", right: "Lux", winner: "Zyrax", score: "1-0" },
        { id: "Q3", left: "Oynx", right: "Shan", winner: "Oynx", score: "1-0" },
        { id: "Q4", left: "Tactia", right: "xfz", winner: "Tactia", score: "1-0" }
      ]
    },
    {
      name: "Semi Finals",
      matches: [
        { id: "S1", left: "Coldmanjar", right: "Zyrax", winner: "Coldmanjar", score: "1-0" },
        { id: "S2", left: "Oynx", right: "Tactia", winner: "Oynx", score: "1-0" }
      ]
    },
    {
      name: "Grand Final",
      matches: [
        { id: "F1", left: "Coldmanjar", right: "Oynx", winner: "Coldmanjar", score: "1-0" }
      ]
    }
  ]
};

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function requestShim(request) {
  return {
    headers: {
      cookie: request.headers.get("cookie") || ""
    }
  };
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}


function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_COTS_STATE));
}

function normalizeImage(image = {}) {
  return {
    bucket: text(image.bucket),
    path: text(image.path),
    url: text(image.url)
  };
}

function normalizeState(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const fallback = cloneDefaultState();
  const champion = source.champion && typeof source.champion === "object" ? source.champion : {};

  return {
    champion: {
      name: text(champion.name, fallback.champion.name),
      title: text(champion.title, fallback.champion.title),
      motto: text(champion.motto, fallback.champion.motto),
      season: text(champion.season, fallback.champion.season),
      podiumImage: normalizeImage(champion.podiumImage || fallback.champion.podiumImage)
    },
    podium: Array.isArray(source.podium) && source.podium.length
      ? source.podium.slice(0, 3).map((entry, index) => ({
        place: text(entry?.place, ["I", "II", "III"][index] || String(index + 1)),
        name: text(entry?.name),
        note: text(entry?.note)
      }))
      : fallback.podium,
    bracketUrl: text(source.bracketUrl, fallback.bracketUrl || ""),
    bracket: Array.isArray(source.bracket) && source.bracket.length
      ? source.bracket.map((round, roundIndex) => ({
        name: text(round?.name, `Round ${roundIndex + 1}`),
        matches: Array.isArray(round?.matches)
          ? round.matches.map((match, matchIndex) => ({
            id: text(match?.id, `${roundIndex + 1}.${matchIndex + 1}`),
            left: text(match?.left),
            right: text(match?.right),
            winner: text(match?.winner),
            score: text(match?.score)
          }))
          : []
      }))
      : fallback.bracket
  };
}

async function withSignedImages(state) {
  const podiumImage = normalizeImage(state.champion.podiumImage);
  if (podiumImage.bucket && podiumImage.path) {
    podiumImage.url = await createSignedStorageUrl(podiumImage.bucket, podiumImage.path).catch(() => "");
  }

  return {
    ...state,
    champion: {
      ...state.champion,
      podiumImage
    }
  };
}

async function loadStoredState() {
  const [row] = await supabaseRest(
    `cots_state?state_key=eq.${encodeURIComponent(COTS_ROW_KEY)}&select=payload,updated_at,updated_by`
  );

  const state = normalizeState(row?.payload || DEFAULT_COTS_STATE);
  return {
    state: await withSignedImages(state),
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null
  };
}

function imageExtension(file) {
  const type = text(file?.type).toLowerCase();
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

async function storePodiumImage(file, previousImage) {
  if (!file || !Number(file.size)) return normalizeImage(previousImage);
  if (!text(file.type).startsWith("image/")) {
    throw new Error("PODIUM_IMAGE_MUST_BE_IMAGE");
  }

  const nextPath = `podium/podium-${Date.now()}.${imageExtension(file)}`;
  await uploadStorageObject(COTS_BUCKET, nextPath, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");

  const previous = normalizeImage(previousImage);
  if (previous.bucket && previous.path && (previous.bucket !== COTS_BUCKET || previous.path !== nextPath)) {
    await removeStorageObjects(previous.bucket, [previous.path]).catch(() => null);
  }

  return { bucket: COTS_BUCKET, path: nextPath, url: "" };
}

async function canEditCots(request) {
  const auth = await getAuthContext(requestShim(request), { optional: true });
  const permission = auth.authenticated ? canEditLibrary(auth.profile, "cots") : { authorized: false };

  return { auth, canEdit: Boolean(permission.authorized), reason: permission.reason };
}

export async function GET(request) {
  const { canEdit } = await canEditCots(request);

  try {
    const payload = await loadStoredState();
    return json({ ok: true, canEdit, ...payload });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return json({
        ok: true,
        canEdit,
        migrationRequired: true,
        state: cloneDefaultState(),
        updatedAt: null,
        updatedBy: null
      });
    }

    return json({ ok: false, error: error.message }, 500);
  }
}

export async function POST(request) {
  const { auth, canEdit, reason } = await canEditCots(request);
  if (!auth.authenticated) {
    return json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" }, 200);
  }
  if (!canEdit) {
    return json({ ok: false, authorized: false, reason: reason || "INSUFFICIENT_WRITE_CLEARANCE" }, 200);
  }

  try {
    const form = await request.formData();
    const incoming = normalizeState(JSON.parse(text(form.get("payload"), "{}")));
    const current = await loadStoredState().catch(() => ({ state: cloneDefaultState() }));
    const podiumImage = await storePodiumImage(form.get("podiumImage"), current.state.champion.podiumImage);
    const payload = normalizeState({
      ...incoming,
      champion: {
        ...incoming.champion,
        podiumImage
      }
    });
    const now = new Date().toISOString();

    await supabaseRest("cots_state?on_conflict=state_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        state_key: COTS_ROW_KEY,
        payload,
        updated_at: now,
        updated_by: text(auth.user?.roblox_id || auth.user?.roblox_username, "unknown")
      })
    });

    return json({ ok: true, canEdit: true, state: await withSignedImages(payload), updatedAt: now });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return json({ ok: false, reason: "MIGRATION_REQUIRED" }, 200);
    }

    return json({ ok: false, error: error.message }, 500);
  }
}
