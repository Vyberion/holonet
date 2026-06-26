import { getAuthContext } from "../../modules/auth/auth-context.js";
import {
  canAccessAdmin,
  canAccessNexus,
  canAccessPersonnelLookup,
  canAccessRegistry,
  canEditLibrary,
  canViewDivisionReports,
  canWriteDivisionReport,
  checkPageAccess,
  checkResourceWriteAccess,
  hasCoreAccess,
  hasHighCommandAccess
} from "../../modules/auth/permissions.js";
import {
  clearCookie,
  cleanupExpiredSessions,
  createRandomToken,
  createSessionForUser,
  createSignedStorageUrl,
  deleteSessionToken,
  getCookie,
  getSessionUser,
  removeStorageObjects,
  serializeCookie,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  supabaseRest
} from "../../modules/auth/session-store.js";
import { ROBLOX_GROUPS } from "../../modules/auth/roblox-groups.js";
import { tierAtLeast } from "../../modules/auth/profile.js";
import { ARCHIVE_SEED } from "../../modules/data/archive-seed.js";
import { LIBRARY_SEED } from "../../modules/data/library-seed.js";
import { getHandbookSlot, getHandbookSlots } from "../../modules/data/handbook-slots.js";
import { getDivision, listDivisions } from "../../modules/data/divisions/index.js";
import { extractGoogleFileId, extractGoogleTabId } from "./google-drive.js";

function getQueryParam(req, name) {
  return String(req?.query?.[name] || "").trim();
}

function requireString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function slugify(value) {
  return requireString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `resource-${Date.now()}`;
}

function toRoman(value) {
  const number = Math.max(1, Math.min(3999, Number(value) || 1));
  const numerals = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let remaining = number;
  let result = "";
  numerals.forEach(([amount, glyph]) => {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  });
  return result;
}

function fromRoman(value) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const source = String(value || "").toUpperCase();
  const text = source.match(/\b[IVXLCDM]+\b/g)?.at(-1) || "";
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    const current = map[text[index]] || 0;
    const next = map[text[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total || 0;
}

function articleOrderFrom(value, fallback = 1) {
  const text = requireString(value);
  const explicit = text.match(/\d+/)?.[0];
  const parsed = explicit ? Number(explicit) : fromRoman(text);
  const fallbackNumber = Number(fallback);
  const order = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : Number.isFinite(fallbackNumber) && fallbackNumber > 0
      ? fallbackNumber
      : 1;

  return Math.max(1, Math.floor(order));
}

function regulationOrderFrom(entry, index) {
  const explicit = Number(entry?.displayOrder);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const anchorNumber = String(entry?.anchor || "").match(/reg-\d+-(\d+)/i)?.[1];
  if (anchorNumber) return Number(anchorNumber);
  const labelNumber = String(entry?.label || "").match(/\d+/)?.[0];
  return Number(labelNumber) || index + 1;
}

function regulationAnchor(articleOrder, regulationOrder) {
  return `reg-${String(articleOrder).padStart(2, "0")}-${String(regulationOrder).padStart(2, "0")}`;
}

function withIncrementedOrder(row, orderColumn = "display_order") {
  return {
    [orderColumn]: (Number(row?.[orderColumn]) || 0) + 1
  };
}

async function shiftDisplayOrders({ table, targetOrder, scope = "", excludeId = "" }) {
  const order = Number(targetOrder);
  if (!Number.isFinite(order) || order < 1) return;

  const scopeFilter = scope ? `${scope}&` : "";
  const excludeFilter = excludeId ? `&id=neq.${encodeURIComponent(excludeId)}` : "";
  const rows = await supabaseRest(
    `${table}?${scopeFilter}display_order=gte.${encodeURIComponent(order)}${excludeFilter}&select=id,display_order&order=display_order.desc`
  );

  for (const row of rows || []) {
    await supabaseRest(`${table}?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify(withIncrementedOrder(row))
    });
  }
}

async function shiftLibraryDocumentOrders(libraryKey, targetOrder, excludeId = "") {
  const order = Number(targetOrder);
  if (!Number.isFinite(order) || order < 1) return;

  const excludeFilter = excludeId ? `&id=neq.${encodeURIComponent(excludeId)}` : "";
  const rows = await supabaseRest(
    `library_documents?library_key=eq.${encodeURIComponent(libraryKey)}&display_order=gte.${encodeURIComponent(order)}${excludeFilter}&select=id,display_order&order=display_order.desc`
  );

  for (const row of rows || []) {
    const displayOrder = (Number(row?.display_order) || 0) + 1;
    await supabaseRest(`library_documents?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        display_order: displayOrder,
        article_number: `ARTICLE ${toRoman(displayOrder)}`
      })
    });
  }
}

function insertAtDisplayOrder(items, item, targetOrder) {
  const order = Math.max(1, Math.floor(Number(targetOrder) || 1));

  items.forEach(existing => {
    if ((Number(existing.displayOrder) || 0) >= order) {
      existing.displayOrder = (Number(existing.displayOrder) || 0) + 1;
    }
  });

  item.displayOrder = order;
  items.push(item);
}

function resolveEntryDisplayOrders(entries = []) {
  const normalized = entries.map((entry, index) => {
    const requestedOrder = regulationOrderFrom(entry, index);
    const originalOrder = Number(entry?.originalDisplayOrder);

    return {
      entry,
      index,
      requestedOrder,
      originalOrder: Number.isFinite(originalOrder) && originalOrder > 0
        ? Math.floor(originalOrder)
        : requestedOrder,
      displayOrder: requestedOrder
    };
  });

  const resolved = [];
  const changed = [];

  normalized.forEach(item => {
    if (item.originalOrder === item.requestedOrder) {
      resolved.push(item);
      return;
    }

    changed.push(item);
  });

  changed.forEach(item => {
    insertAtDisplayOrder(resolved, item, item.requestedOrder);
  });

  return resolved.sort((left, right) => left.index - right.index);
}

function isMissingSchemaError(error) {
  return /does not exist|Could not find the table|column .* does not exist/i.test(String(error?.message || ""));
}

const COUNCIL_RANKS = {
  council: 60,
  emperorPowerbase: 65,
  emperor: 151,
  projectManager: 254,
  groupOwner: 255
};

const COUNCIL_COUNTING_RANKS = [COUNCIL_RANKS.council, COUNCIL_RANKS.emperorPowerbase, COUNCIL_RANKS.emperor];
const COUNCIL_VOTING_RANKS = [...COUNCIL_COUNTING_RANKS, COUNCIL_RANKS.projectManager, COUNCIL_RANKS.groupOwner];
const COUNCIL_VETO_RANKS = [COUNCIL_RANKS.emperor, COUNCIL_RANKS.projectManager, COUNCIL_RANKS.groupOwner];

function councilRank(profile) {
  return Number(profile?.groupRanks?.[ROBLOX_GROUPS.HIGH_RANKS.groupId] || 0);
}

function councilRoleForRank(rank) {
  return {
    [COUNCIL_RANKS.council]: "Council",
    [COUNCIL_RANKS.emperorPowerbase]: "Emperor's Powerbase",
    [COUNCIL_RANKS.emperor]: "Emperor",
    [COUNCIL_RANKS.projectManager]: "Project Manager",
    [COUNCIL_RANKS.groupOwner]: "Group Owner"
  }[rank] || "";
}

function councilPermissions(profile) {
  const rank = councilRank(profile);
  const isSuperUser = Boolean(profile?.isSuperUser);
  const floorAccess = profile ? checkPageAccess(profile, "dark-council/council-floor") : { authorized: false };
  const hasFloorOverride = floorAccess.reason === "OVERRIDE_GRANT";
  const canUseFloor = isSuperUser || COUNCIL_VOTING_RANKS.includes(rank) || hasFloorOverride;

  return {
    rank,
    role: isSuperUser ? "Super User" : councilRoleForRank(rank) || (hasFloorOverride ? "Override Authority" : ""),
    canView: floorAccess.authorized || canUseFloor,
    canPropose: canUseFloor,
    canVote: canUseFloor,
    canVeto: isSuperUser || COUNCIL_VETO_RANKS.includes(rank),
    canReopen: isSuperUser || COUNCIL_VETO_RANKS.includes(rank),
    countsTowardsMajority: COUNCIL_COUNTING_RANKS.includes(rank)
  };
}

function canViewInquisitorOverview(profile) {
  const roles = profile?.authorityRoles || {};

  return Boolean(
    hasCoreAccess(profile) ||
    tierAtLeast(profile?.divisions?.inquisitors || "none", "member") ||
    roles.groupOwner ||
    roles.projectManager ||
    roles.emperor ||
    roles.emperorPowerbase
  );
}

function hasDarkCouncilPlus(profile) {
  return Boolean(hasCoreAccess(profile) || Object.values(profile?.authorityRoles || {}).some(Boolean));
}

function canWriteDivisionWeeklyReport(profile, division) {
  return canWriteDivisionReport(profile, division).authorized;
}

function canWriteBoardBroadcast(profile) {
  const division1ic = Object.values(profile?.divisions || {}).some(tier => tierAtLeast(tier, "1ic"));
  return Boolean(
    hasCoreAccess(profile) ||
    division1ic ||
    ["upper", "overseer"].includes(profile?.highRank) ||
    hasDarkCouncilPlus(profile)
  );
}

function boardChannelsFor(profile) {
  if (hasCoreAccess(profile) || ["upper", "overseer"].includes(profile?.highRank) || hasDarkCouncilPlus(profile)) {
    return ["holonet", "reavers", "dhg", "inquisitors", "dreadmasters", "highranks", "darkCouncil"];
  }

  return Object.entries(profile?.divisions || {})
    .filter(([, tier]) => tierAtLeast(tier, "1ic"))
    .map(([division]) => division);
}

function clampDurationHours(value) {
  const hours = Number(value) || 24;
  return Math.max(24, Math.min(168, Math.floor(hours)));
}

function publicImageUrl(path) {
  const value = requireString(path);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  if (value.startsWith("public/")) return `/${value.slice("public/".length)}`;
  if (value.startsWith("assets/")) return `/${value}`;
  return "";
}

function encodeInList(values) {
  return `(${values.map(value => String(value).replace(/[(),]/g, "")).join(",")})`;
}

function detailTableFor(resourceType) {
  return `resource_${resourceType}s`;
}

function normalizeSubClauses(value) {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    if (typeof item === "string") {
      return {
        label: `Sub-Section ${index + 1}`,
        body: requireString(item)
      };
    }

    return {
      label: requireString(item?.label || `Sub-Section ${index + 1}`),
      body: requireString(item?.body)
    };
  }).filter(item => item.body);
}

async function resolveRobloxId(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false
    })
  });

  if (!response.ok) {
    throw new Error("ROBLOX_USER_LOOKUP_FAILED");
  }

  const payload = await response.json();
  const resolved = payload.data?.[0];
  if (!resolved?.id) {
    throw new Error("USER_NOT_FOUND");
  }

  return String(resolved.id);
}

async function confirmDiscordLink(req) {
  const auth = await getAuthContext(req);
  if (!auth.authenticated) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" } };
  }

  const body = readJsonBody(req);
  const token = requireString(body.token || getQueryParam(req, "token"));
  if (!token) {
    return { ok: false, status: 400, payload: { ok: false, reason: "TOKEN_REQUIRED" } };
  }

  const [pending] = await supabaseRest(
    `discord_link_tokens?token=eq.${encodeURIComponent(token)}&select=*`
  );

  if (!pending) {
    return { ok: false, status: 404, payload: { ok: false, reason: "LINK_TOKEN_NOT_FOUND" } };
  }

  if (pending.consumed_at) {
    return { ok: false, status: 200, payload: { ok: false, reason: "LINK_TOKEN_USED" } };
  }

  if (new Date(pending.expires_at) <= new Date()) {
    return { ok: false, status: 200, payload: { ok: false, reason: "LINK_TOKEN_EXPIRED" } };
  }

  const now = new Date().toISOString();
  const robloxId = String(auth.user.roblox_id);
  await supabaseRest("discord_users", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      discord_user_id: pending.discord_user_id,
      discord_username: pending.discord_username,
      updated_at: now
    })
  });

  await supabaseRest(`verification_links?roblox_user_id=eq.${encodeURIComponent(robloxId)}&discord_user_id=neq.${encodeURIComponent(pending.discord_user_id)}`, {
    method: "DELETE"
  });

  await supabaseRest("verification_links?on_conflict=discord_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      discord_user_id: pending.discord_user_id,
      roblox_user_id: robloxId,
      verified_at: now,
      updated_at: now
    })
  });

  await supabaseRest(`discord_link_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: "PATCH",
    body: JSON.stringify({ consumed_at: now })
  });

  await supabaseRest("bot_audit_logs", {
    method: "POST",
    body: JSON.stringify({
      action: "verification.confirm",
      actor_discord_id: pending.discord_user_id,
      target_discord_id: pending.discord_user_id,
      roblox_user_id: robloxId,
      metadata: { source: "account_page" }
    })
  }).catch(() => null);

  return {
    ok: true,
    status: 200,
    payload: {
      ok: true,
      discordUserId: pending.discord_user_id,
      robloxId,
      robloxUsername: auth.user.roblox_username || auth.user.roblox_display_name || robloxId
    }
  };
}

function readJsonBody(req) {
  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }

  return req.body || {};
}

async function cleanupRetiredHandbooks() {
  const now = encodeURIComponent(new Date().toISOString());
  const retirements = await supabaseRest(
    `resource_handbook_retirements?purge_after=lt.${now}&select=id,storage_bucket,storage_path`
  ).catch(() => []);

  if (!retirements?.length) return;

  for (const retirement of retirements) {
    await removeStorageObjects(retirement.storage_bucket || "handbooks", [retirement.storage_path]).catch(() => null);
    await supabaseRest(`resource_handbook_retirements?id=eq.${encodeURIComponent(retirement.id)}`, {
      method: "DELETE"
    });
  }
}

async function loadArchiveArticles() {
  const articles = await supabaseRest(
    "archive_articles?select=id,slug,title,body,image_bucket,image_path,image_alt,status,display_order,created_at,updated_at&order=display_order.asc,created_at.asc"
  );

  const normalized = await Promise.all((articles || []).map(async article => {
    const articleOrder = articleOrderFrom(article.display_order);
    return {
      id: article.id,
      slug: article.slug,
      articleNumber: `ARTICLE ${articleOrder}`,
      title: article.title,
      body: article.body,
      imageBucket: article.image_bucket || "",
      imagePath: article.image_path || "",
      imageAlt: article.image_alt || "",
      imageUrl: publicImageUrl(article.image_path) || (article.image_path
        ? await createSignedStorageUrl(article.image_bucket || "archives", article.image_path).catch(() => "")
        : ""),
      status: article.status,
      displayOrder: articleOrder,
      createdAt: article.created_at,
      updatedAt: article.updated_at
    };
  }));

  return normalized.sort((a, b) => a.displayOrder - b.displayOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function seedArchives() {
  const articles = ARCHIVE_SEED.articles || [];
  for (const article of articles) {
    await supabaseRest(
      "archive_articles?on_conflict=slug&select=id,slug,title,body,image_bucket,image_path,image_alt,status,display_order,created_at,updated_at",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          slug: slugify(article.slug || article.title),
          title: requireString(article.title),
          body: requireString(article.body),
          image_bucket: article.imagePath ? "archives" : null,
          image_path: requireString(article.imagePath),
          image_alt: requireString(article.imageAlt || article.title),
          status: requireString(article.status, "published"),
          display_order: Number(article.displayOrder) || 0
        })
      }
    );
  }

  return loadArchiveArticles();
}

async function ensureArchivesSeeded() {
  try {
    const existing = await loadArchiveArticles();
    if (existing.length) return existing;
    return seedArchives();
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return (ARCHIVE_SEED.articles || []).map(article => ({
        id: article.slug,
        slug: article.slug,
        articleNumber: article.articleNumber || "ARTICLE 1",
        title: article.title,
        body: article.body,
        imageBucket: article.imagePath ? "archives" : "",
        imagePath: article.imagePath || "",
        imageAlt: article.imageAlt || article.title,
        imageUrl: "",
        status: article.status || "published",
        displayOrder: article.displayOrder || 0
      }));
    }
    throw error;
  }
}

async function writeArchiveArticle(body) {
  const id = requireString(body.id);
  const title = requireString(body.title);
  const articleBody = requireString(body.body);
  const articleOrder = articleOrderFrom(body.articleNumber || body.displayOrder);

  if (!title || !articleBody) {
    return { ok: false, status: 400, payload: { ok: false, reason: "ARTICLE_FIELDS_REQUIRED" } };
  }

  const payload = {
    slug: slugify(body.slug || title),
    title,
    body: articleBody,
    image_bucket: requireString(body.imagePath) ? "archives" : null,
    image_path: requireString(body.imagePath),
    image_alt: requireString(body.imageAlt || title),
    status: ["draft", "published", "archived"].includes(body.status) ? body.status : "published",
    display_order: articleOrder,
    updated_at: new Date().toISOString()
  };

  let article = { id };

  if (id) {
    const [existing] = await supabaseRest(`archive_articles?id=eq.${encodeURIComponent(id)}&select=id,display_order`).catch(() => []);
    if ((Number(existing?.display_order) || 0) !== articleOrder) {
      await shiftDisplayOrders({ table: "archive_articles", targetOrder: articleOrder, excludeId: id });
    }

    await supabaseRest(`archive_articles?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    const [stored] = await supabaseRest(`archive_articles?id=eq.${encodeURIComponent(id)}&select=id,slug`);
    article = stored || article;
  } else {
    await shiftDisplayOrders({ table: "archive_articles", targetOrder: articleOrder });

    const [created] = await supabaseRest(
      "archive_articles?on_conflict=slug&select=id,slug",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload)
      }
    );
    article = created;
  }

  return { ok: true, status: 200, payload: { ok: true, id: article.id } };
}

async function deleteArchiveArticle(id) {
  await supabaseRest(`archive_articles?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

async function loadLibraryDocuments(libraryKey) {
  const documents = await supabaseRest(
    `library_documents?library_key=eq.${encodeURIComponent(libraryKey)}&select=id,library_key,slug,article_number,title,status,display_order,created_at,updated_at&order=display_order.asc,created_at.asc`
  );

  if (!documents?.length) return [];

  const ids = documents.map(document => document.id).join(",");
  const entries = await supabaseRest(
    `library_entries?document_id=in.(${ids})&select=id,document_id,anchor,label,body,sub_clauses,display_order,created_at,updated_at&order=display_order.asc,created_at.asc`
  );

  const entriesByDocument = new Map();
  (entries || []).forEach(entry => {
    const list = entriesByDocument.get(entry.document_id) || [];
    list.push({
      id: entry.id,
      anchor: entry.anchor,
      label: entry.label,
      body: entry.body,
      subClauses: Array.isArray(entry.sub_clauses) ? entry.sub_clauses : [],
      displayOrder: entry.display_order,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at
    });
    entriesByDocument.set(entry.document_id, list);
  });

  return documents.map(document => {
    const articleOrder = articleOrderFrom(document.article_number, document.display_order);
    return {
      id: document.id,
      slug: document.slug,
      articleNumber: `ARTICLE ${toRoman(articleOrder)}`,
      title: document.title,
      status: document.status,
      displayOrder: articleOrder,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
      entries: entriesByDocument.get(document.id) || []
    };
  }).sort((a, b) => a.displayOrder - b.displayOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function seedLibrary(libraryKey) {
  const seed = LIBRARY_SEED[libraryKey];
  if (!seed?.documents?.length) return [];

  for (const document of seed.documents) {
    const [createdDocument] = await supabaseRest(
      "library_documents?on_conflict=library_key,slug&select=id,slug,article_number,title,status,display_order,created_at,updated_at",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          library_key: libraryKey,
          slug: slugify(document.slug || document.title),
          article_number: requireString(document.articleNumber),
          title: requireString(document.title),
          status: requireString(document.status, "published"),
          display_order: Number(document.displayOrder) || 0
        })
      }
    );

    await supabaseRest(`library_entries?document_id=eq.${encodeURIComponent(createdDocument.id)}`, {
      method: "DELETE"
    });

    if (document.entries?.length) {
      await supabaseRest("library_entries", {
        method: "POST",
        body: JSON.stringify(document.entries.map((entry, index) => ({
          document_id: createdDocument.id,
          anchor: requireString(entry.anchor || `${createdDocument.slug}-${index + 1}`),
          label: requireString(entry.label || `Regulation ${index + 1}`),
          body: requireString(entry.body),
          sub_clauses: normalizeSubClauses(entry.subClauses),
          display_order: Number(entry.displayOrder) || index + 1
        })))
      });
    }
  }

  return loadLibraryDocuments(libraryKey);
}

async function ensureLibrarySeeded(libraryKey) {
  try {
    const existing = await loadLibraryDocuments(libraryKey);
    if (existing.length) return existing;
    return seedLibrary(libraryKey);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return (LIBRARY_SEED[libraryKey]?.documents || []).map(document => ({
        ...document,
        id: document.slug
      }));
    }
    throw error;
  }
}

async function writeLibraryDocument(libraryKey, body) {
  const documentId = requireString(body.id);
  const title = requireString(body.title);
  const articleOrder = articleOrderFrom(body.articleNumber, body.displayOrder);
  const articleNumber = `ARTICLE ${toRoman(articleOrder)}`;

  if (!title || !articleNumber) {
    return { ok: false, status: 400, payload: { ok: false, reason: "ARTICLE_METADATA_REQUIRED" } };
  }

  const documentPayload = {
    library_key: libraryKey,
    slug: slugify(body.slug || `${articleNumber}-${title}`),
    article_number: articleNumber,
    title,
    status: ["draft", "published", "archived"].includes(body.status) ? body.status : "published",
    display_order: articleOrder,
    updated_at: new Date().toISOString()
  };

  let document = { id: documentId };

  if (documentId) {
    const [existing] = await supabaseRest(`library_documents?id=eq.${encodeURIComponent(documentId)}&select=id,display_order`).catch(() => []);
    if ((Number(existing?.display_order) || 0) !== articleOrder) {
      await shiftLibraryDocumentOrders(libraryKey, articleOrder, documentId);
    }

    await supabaseRest(`library_documents?id=eq.${encodeURIComponent(documentId)}`, {
      method: "PATCH",
      body: JSON.stringify(documentPayload)
    });

    const [stored] = await supabaseRest(`library_documents?id=eq.${encodeURIComponent(documentId)}&select=id,slug`);
    document = stored || document;
  } else {
    await shiftLibraryDocumentOrders(libraryKey, articleOrder);

    const [createdDocument] = await supabaseRest(
      "library_documents?on_conflict=library_key,slug&select=id,slug",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(documentPayload)
      }
    );

    document = createdDocument;
  }

  await supabaseRest(`library_entries?document_id=eq.${encodeURIComponent(document.id)}`, {
    method: "DELETE"
  });

  const entries = Array.isArray(body.entries) ? body.entries : [];
  const orderedEntries = resolveEntryDisplayOrders(entries);
  if (orderedEntries.length) {
    await supabaseRest("library_entries", {
      method: "POST",
      body: JSON.stringify(orderedEntries.map(({ entry, displayOrder }, index) => {
        const regulationOrder = displayOrder || regulationOrderFrom(entry, index);
        return {
          document_id: document.id,
          anchor: regulationAnchor(articleOrder, regulationOrder),
          label: requireString(entry.label || `Regulation ${regulationOrder}`),
          body: requireString(entry.body),
          sub_clauses: normalizeSubClauses(entry.subClauses),
          display_order: regulationOrder
        };
      }))
    });
  }

  return { ok: true, status: 200, payload: { ok: true, id: document.id } };
}

async function deleteLibraryDocument(id) {
  await supabaseRest(`library_entries?document_id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  await supabaseRest(`library_documents?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

async function loadPublishedResources(division, resourceType) {
  return supabaseRest(
    `registry_resources?division_key=eq.${encodeURIComponent(division)}&resource_type=eq.${encodeURIComponent(resourceType)}&status=eq.published&select=id,division_key,slug,title,description,visibility,status,display_order,created_at,updated_at&order=display_order.asc,created_at.desc`
  );
}

async function loadDetailRows(detailTable, resourceIds) {
  const ids = encodeURIComponent(encodeInList(resourceIds));
  return supabaseRest(`${detailTable}?resource_id=in.${ids}&select=*`);
}

async function normalizeRows(resources, detailRows, resourceType) {
  const detailsById = new Map((detailRows || []).map(row => [row.resource_id, row]));

  return Promise.all(resources.map(async resource => {
    const detail = detailsById.get(resource.id) || {};
    const base = {
      id: resource.id,
      divisionKey: resource.division_key || "",
      slug: resource.slug,
      title: resource.title,
      description: resource.description || "",
      status: resource.status,
      visibility: resource.visibility,
      displayOrder: resource.display_order,
      createdAt: resource.created_at,
      updatedAt: resource.updated_at
    };

    if (resourceType === "handbook") {
      const slot = getHandbookSlot(resource.division_key, detail.slot_key || "");
      const googleFileId = detail.google_file_id || extractGoogleFileId(detail.google_doc_url);
      const googleTabId = detail.google_tab_id || extractGoogleTabId(detail.google_doc_url);
      const googleDocUrl = detail.google_doc_url || "";
      const sourceType = googleFileId || detail.source_type === "google_doc" ? "google_doc" : "supabase_pdf";
      const signedUrl = googleFileId
        ? `/api/handbook-pdf?resourceId=${encodeURIComponent(resource.id)}`
        : detail.storage_path
        ? await createSignedStorageUrl(detail.storage_bucket || "handbooks", detail.storage_path)
        : "";

      return {
        ...base,
        slotKey: detail.slot_key || "",
        meta: slot?.label || detail.version_label || "Handbook",
        fileName: detail.file_name || detail.storage_path?.split("/").pop() || "",
        sourceType,
        googleFileId,
        googleTabId,
        googleDocUrl,
        storageBucket: detail.storage_bucket || "handbooks",
        storagePath: detail.storage_path || "",
        href: signedUrl,
        signedUrl,
        available: Boolean(signedUrl),
        mimeType: detail.mime_type || "application/pdf",
        publishedAt: detail.published_at || null
      };
    }

    if (resourceType === "transmission") {
      return {
        ...base,
        author: detail.author_name || "",
        body: detail.body || resource.description || "",
        publishedAt: detail.published_at || null
      };
    }

    if (resourceType === "tracker") {
      return {
        ...base,
        href: detail.external_url || "",
        provider: detail.provider || "google_sheets",
        notes: detail.notes || ""
      };
    }

    return {
      ...base,
      author: detail.author_name || "",
      summary: detail.summary || resource.description || "",
      body: detail.body || resource.description || "",
      reportPeriodStart: detail.report_period_start || null,
      reportPeriodEnd: detail.report_period_end || null,
      submittedAt: detail.submitted_at || null
    };
  }));
}

async function loadBoardTransmissions() {
  const resources = await supabaseRest(
    "registry_resources?resource_type=eq.transmission&status=eq.published&select=id,division_key,slug,title,description,visibility,status,display_order,created_at,updated_at&order=updated_at.desc,created_at.desc&limit=40"
  );

  const rows = resources?.length
    ? await normalizeRows(resources, await loadDetailRows("resource_transmissions", resources.map(resource => resource.id)), "transmission")
    : [];

  return rows
    .filter(row => ["public", "published", ""].includes(String(row.visibility || "").toLowerCase()))
    .map(row => ({
      ...row,
      channel: row.divisionKey || "holonet",
      signal: row.publishedAt || row.updatedAt || row.createdAt
    }));
}

async function loadNexusOverview(profile) {
  const divisions = listDivisions().filter(division => ["reavers", "dhg", "inquisitors", "dreadmasters"].includes(division.id));
  const rows = await Promise.all(divisions.map(async division => {
    if (division.id === "inquisitors" && !canViewInquisitorOverview(profile)) {
      return {
        id: division.id,
        name: division.shortName || division.name,
        node: division.node,
        href: division.href,
        theme: division.theme,
        status: "classified",
        classified: true,
        canWriteReport: false,
        latestReport: null,
        latestInspection: null,
        inspections: [],
        latestDocument: null,
        latestTransmission: null,
        counts: {
          reports: null,
          inspections: null,
          trackers: null,
          documents: null,
          transmissions: null
        },
        links: {
          reports: "",
          trackers: "",
          transmissions: ""
        }
      };
    }

    const [weeklyReports, inspections, trackers, documents, transmissions] = await Promise.all([
      loadWeeklyReports(division.id).catch(() => []),
      loadInspections(division.id).catch(() => []),
      loadPublishedResources(division.id, "tracker").catch(() => []),
      loadPublishedResources(division.id, "handbook").catch(() => []),
      loadPublishedResources(division.id, "transmission").catch(() => [])
    ]);

    const latestReport = weeklyReports[0] || null;
    const latestInspection = inspections[0] || null;
    const latestDocument = documents[0] || null;
    const latestTransmission = transmissions[0] || null;
    const latestReportAt = latestReport?.weekStart || latestReport?.updatedAt || null;
    const reportAgeDays = latestReportAt
      ? Math.floor((Date.now() - new Date(latestReportAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: division.id,
      name: division.shortName || division.name,
      node: division.node,
      href: division.href,
      theme: division.theme,
      status: reportAgeDays === null ? "missing" : reportAgeDays > 14 ? "overdue" : "current",
      canWriteReport: canWriteDivisionWeeklyReport(profile, division.id),
      latestReport: latestReport ? {
        title: `Weekly Report`,
        updatedAt: latestReportAt,
        href: `${division.href.replace(/\/home$/, "")}/reports`,
        totals: latestReport.totals,
        authorName: latestReport.authorName,
        members: latestReport.members
      } : null,
      latestInspection,
      inspections,
      latestDocument: latestDocument ? {
        title: latestDocument.title,
        updatedAt: latestDocument.updated_at || latestDocument.created_at,
        href: `${division.href.replace(/\/home$/, "")}/handbooks`
      } : null,
      latestTransmission: latestTransmission ? {
        title: latestTransmission.title,
        updatedAt: latestTransmission.updated_at || latestTransmission.created_at,
        href: `${division.href.replace(/\/home$/, "")}/transmissions`
      } : null,
      counts: {
        reports: weeklyReports.length,
        inspections: inspections.length,
        trackers: trackers.length,
        documents: documents.length,
        transmissions: transmissions.length
      },
      links: {
        reports: `${division.href.replace(/\/home$/, "")}/reports`,
        trackers: `${division.href.replace(/\/home$/, "")}/trackers`,
        transmissions: `${division.href.replace(/\/home$/, "")}/transmissions`
      }
    };
  }));

  return rows;
}

function canonicalDivisionId(value) {
  const normalized = requireString(value).toLowerCase();
  return listDivisions().find(division => division.id.toLowerCase() === normalized)?.id || "";
}

function rosterDefinitionForDivision(division) {
  if (division === "highranks") return ROBLOX_GROUPS.HIGH_RANKS;
  if (division === "darkCouncil") return ROBLOX_GROUPS.DARK_COUNCIL;
  return ROBLOX_GROUPS.DIVISIONS[division];
}

async function fetchDivisionRoster(division) {
  const definition = rosterDefinitionForDivision(division);
  if (!definition?.groupId) return [];

  const maxRank = Math.max(...Object.values(definition.ranks || {}).flat().map(Number).filter(Boolean));
  let cursor = "";
  const members = [];

  do {
    const url = new URL(`https://groups.roblox.com/v1/groups/${definition.groupId}/users`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortOrder", "Asc");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url);
    if (!response.ok) throw new Error("ROBLOX_ROSTER_LOOKUP_FAILED");
    const payload = await response.json();

    (payload.data || []).forEach(item => {
      const rank = Number(item.role?.rank || 0);
      if (rank <= maxRank) {
        members.push({
          robloxId: String(item.user?.userId || item.user?.id || ""),
          username: item.user?.username || "",
          displayName: item.user?.displayName || "",
          rank,
          role: item.role?.name || ""
        });
      }
    });

    cursor = payload.nextPageCursor || "";
  } while (cursor);

  return members.filter(member => member.robloxId);
}

function normalizeReportMember(row, index = 0) {
  return {
    robloxId: String(row.roblox_id || ""),
    username: row.username || "",
    displayName: row.display_name || "",
    rank: Number(row.rank) || 0,
    role: row.role || "",
    hours: Number(row.hours) || 0,
    minutes: Number(row.minutes) || 0,
    eventsHosted: Number(row.events_hosted) || 0,
    eventsAttended: Number(row.events_attended) || 0,
    displayOrder: Number(row.display_order ?? index) || 0
  };
}

function normalizeWeeklyReport(row, members = []) {
  const reportMembers = members.map(normalizeReportMember);
  return {
    id: row.id,
    divisionKey: row.division_key,
    weekStart: row.week_start,
    authorId: row.author_id,
    authorName: row.author_name,
    status: row.status,
    members: reportMembers,
    totals: reportTotals(reportMembers),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadWeeklyReportMembers(reportIds = []) {
  const ids = [...new Set(reportIds.map(value => String(value || "")).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await supabaseRest(
    `division_weekly_report_members?report_id=${encodeURIComponent(inFilter(ids))}&select=*&order=display_order.asc,created_at.asc`
  );

  return (rows || []).reduce((map, row, index) => {
    const reportId = String(row.report_id || "");
    if (!map.has(reportId)) map.set(reportId, []);
    map.get(reportId).push(row);
    return map;
  }, new Map());
}

async function loadWeeklyReports(division = "") {
  const filter = division ? `division_key=eq.${encodeURIComponent(division)}&` : "";
  const rows = await supabaseRest(
    `division_weekly_reports?${filter}status=eq.published&select=id,division_key,week_start,author_id,author_name,status,created_at,updated_at&order=week_start.desc,created_at.desc&limit=40`
  );
  const memberMap = await loadWeeklyReportMembers((rows || []).map(row => row.id));
  return (rows || []).map(row => normalizeWeeklyReport(row, memberMap.get(String(row.id)) || []));
}

function clockScopeForDivision(division) {
  return {
    reavers: "reavers",
    dhg: "dhg",
    inquisitors: "inquisitors",
    dreadmasters: "dreadmasters",
    highranks: "highranks",
    darkCouncil: "darkCouncil"
  }[division] || "";
}

function shiftTotalSeconds(row, now = Date.now()) {
  const baseSeconds = row.status === "active"
    ? Math.max(0, Math.floor((now - new Date(row.started_at).getTime()) / 1000))
    : Number(row.duration_seconds || 0);

  return Math.max(0, baseSeconds + Number(row.adjustment_seconds || 0));
}

function formatMemberShift(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60)
  };
}

function inFilter(values) {
  return `in.(${values.map(value => `"${String(value).replace(/"/g, '\\"')}"`).join(",")})`;
}

async function loadVerificationLinksForRobloxIds(robloxIds = []) {
  const ids = [...new Set(robloxIds.map(value => String(value || "")).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await supabaseRest(
    `verification_links?roblox_user_id=${encodeURIComponent(inFilter(ids))}&select=discord_user_id,roblox_user_id`
  );

  return (rows || []).reduce((links, row) => {
    if (row.roblox_user_id && row.discord_user_id) {
      links.set(String(row.roblox_user_id), String(row.discord_user_id));
    }
    return links;
  }, new Map());
}

async function loadClockShiftTotalsForRoster(division, members = []) {
  const scope = clockScopeForDivision(division);
  const robloxIds = [...new Set(members.map(member => String(member.robloxId || "")).filter(Boolean))];
  if (!scope || !robloxIds.length) return new Map();

  const linkMap = await loadVerificationLinksForRobloxIds(robloxIds);
  const discordToRoblox = new Map([...linkMap.entries()].map(([robloxId, discordId]) => [discordId, robloxId]));
  const discordIds = [...new Set([...linkMap.values()])];
  const rowMap = new Map();
  const select = "id,scope,discord_user_id,roblox_user_id,status,started_at,duration_seconds,adjustment_seconds";

  const robloxRows = await supabaseRest(
    `clock_shifts?roblox_user_id=${encodeURIComponent(inFilter(robloxIds))}&select=${select}`
  );
  (robloxRows || []).forEach(row => rowMap.set(row.id, row));

  if (discordIds.length) {
    const discordRows = await supabaseRest(
      `clock_shifts?discord_user_id=${encodeURIComponent(inFilter(discordIds))}&select=${select}`
    );
    (discordRows || []).forEach(row => rowMap.set(row.id, row));
  }

  const now = Date.now();
  return [...rowMap.values()].filter(row => row.scope === scope).reduce((totals, row) => {
    const robloxId = String(row.roblox_user_id || "") || discordToRoblox.get(String(row.discord_user_id || "")) || "";
    if (!robloxId) return totals;
    totals.set(robloxId, (totals.get(robloxId) || 0) + shiftTotalSeconds(row, now));
    return totals;
  }, new Map());
}

async function buildWeeklyReportRoster(division) {
  const roster = await fetchDivisionRoster(division);
  const shiftTotals = await loadClockShiftTotalsForRoster(division, roster);

  return roster.map(member => ({
    ...member,
    ...formatMemberShift(shiftTotals.get(String(member.robloxId || "")) || 0)
  }));
}

async function resetClockShiftsForReport(division, members = [], reportAt = new Date().toISOString()) {
  const scope = clockScopeForDivision(division);
  const robloxIds = [...new Set(members.map(member => String(member.robloxId || "")).filter(Boolean))];
  if (!scope || !robloxIds.length) return;

  const linkMap = await loadVerificationLinksForRobloxIds(robloxIds);
  const discordIds = [...new Set([...linkMap.values()])];
  const identityFilters = [`roblox_user_id.${inFilter(robloxIds)}`];
  if (discordIds.length) identityFilters.push(`discord_user_id.${inFilter(discordIds)}`);
  const identityFilter = `or=(${identityFilters.join(",")})`;
  const queryBase = `clock_shifts?scope=eq.${encodeURIComponent(scope)}&${identityFilter}`;

  await supabaseRest(`${queryBase}&status=eq.completed`, { method: "DELETE" });
  await supabaseRest(`${queryBase}&status=eq.active`, {
    method: "PATCH",
    body: JSON.stringify({
      started_at: reportAt,
      duration_seconds: null,
      adjustment_seconds: 0,
      late: false,
      late_minutes: null,
      clockout_late: false,
      clockout_late_minutes: null
    })
  });
}

function reportTotals(members) {
  return members.reduce((totals, member) => ({
    hours: totals.hours + (Number(member.hours) || 0),
    minutes: totals.minutes + (Number(member.minutes) || 0),
    eventsHosted: totals.eventsHosted + (Number(member.eventsHosted) || 0),
    eventsAttended: totals.eventsAttended + (Number(member.eventsAttended) || 0)
  }), { hours: 0, minutes: 0, eventsHosted: 0, eventsAttended: 0 });
}

function reportMemberRows(reportId, members = []) {
  return members.map((member, index) => ({
    report_id: reportId,
    roblox_id: requireString(member.robloxId),
    username: requireString(member.username),
    display_name: requireString(member.displayName),
    rank: Number(member.rank) || 0,
    role: requireString(member.role),
    hours: Math.max(0, Number(member.hours) || 0),
    minutes: Math.max(0, Number(member.minutes) || 0),
    events_hosted: Math.max(0, Number(member.eventsHosted) || 0),
    events_attended: Math.max(0, Number(member.eventsAttended) || 0),
    display_order: index
  })).filter(row => row.roblox_id);
}

async function replaceWeeklyReportMembers(reportId, members = []) {
  if (!reportId) return;

  await supabaseRest(`division_weekly_report_members?report_id=eq.${encodeURIComponent(reportId)}`, {
    method: "DELETE"
  });

  const rows = reportMemberRows(reportId, members);
  if (!rows.length) return;

  await supabaseRest("division_weekly_report_members", {
    method: "POST",
    body: JSON.stringify(rows)
  });
}

async function writeWeeklyReport(auth, body) {
  const division = requireString(body.division).toLowerCase();
  if (!ROBLOX_GROUPS.DIVISIONS[division]) {
    return { ok: false, status: 400, payload: { ok: false, reason: "UNKNOWN_DIVISION" } };
  }

  if (!canWriteDivisionWeeklyReport(auth.profile, division)) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" } };
  }

  const members = Array.isArray(body.members) ? body.members.map(member => ({
    robloxId: requireString(member.robloxId),
    username: requireString(member.username),
    displayName: requireString(member.displayName),
    rank: Number(member.rank) || 0,
    role: requireString(member.role),
    hours: Math.max(0, Number(member.hours) || 0),
    minutes: Math.max(0, Number(member.minutes) || 0),
    eventsHosted: Math.max(0, Number(member.eventsHosted) || 0),
    eventsAttended: Math.max(0, Number(member.eventsAttended) || 0)
  })).filter(member => member.robloxId) : [];

  const weekStart = requireString(body.weekStart || body.week_start) || new Date().toISOString().slice(0, 10);
  const id = requireString(body.id);
  const isNewReport = !id;
  const reportAt = new Date().toISOString();
  const payload = {
    division_key: division,
    week_start: weekStart,
    author_id: String(auth.user.roblox_id),
    author_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
    status: ["draft", "published", "archived"].includes(body.status) ? body.status : "published",
    updated_at: reportAt
  };

  if (id) {
    await supabaseRest(`division_weekly_reports?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await replaceWeeklyReportMembers(id, members);
    return { ok: true, status: 200, payload: { ok: true, id } };
  }

  const [created] = await supabaseRest("division_weekly_reports?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  await replaceWeeklyReportMembers(created?.id, members);
  if (isNewReport) {
    await resetClockShiftsForReport(division, members, reportAt);
  }
  return { ok: true, status: 200, payload: { ok: true, id: created?.id } };
}

function inspectionSectionsFor(division, sections = []) {
  const fallback = {
    dhg: ["Attendance", "Combat", "Jailing", "Guarding", "Codex", "Formations"],
    reavers: ["Attendance", "Combat", "Assassinations", "Codex", "Formations"],
    dreadmasters: ["Attendance", "Combat", "Lore", "Dread Lore", "Codex", "Formations"],
    inquisitors: ["Placeholder"]
  }[division] || ["Attendance", "Combat", "Codex", "Formations"];

  const incoming = Array.isArray(sections) && sections.length ? sections : fallback.map(name => ({ name }));
  return incoming.map(section => ({
    name: requireString(section.name),
    outOf: Number(section.outOf) || 0,
    weightedPercentage: Number(section.weightedPercentage) || 0,
    achievedScore: Number(section.achievedScore) || 0
  })).filter(section => section.name);
}

function calculateInspectionOverall(sections, bonusPercentage = 0) {
  const subtotal = sections.reduce((sum, section) => {
    if (!section.outOf || !section.weightedPercentage) return sum;
    return sum + (section.achievedScore / section.outOf) * section.weightedPercentage;
  }, 0);
  return Math.round((subtotal + (Number(bonusPercentage) || 0)) * 100) / 100;
}

function normalizeInspectionSection(row, index = 0) {
  return {
    name: row.name || "",
    outOf: Number(row.out_of) || 0,
    weightedPercentage: Number(row.weighted_percentage) || 0,
    achievedScore: Number(row.achieved_score) || 0,
    displayOrder: Number(row.display_order ?? index) || 0
  };
}

function normalizeInspection(row, sections = []) {
  const normalizedSections = sections.map(normalizeInspectionSection);
  return {
    id: row.id,
    divisionKey: row.division_key,
    heldOn: row.held_on,
    cadence: row.cadence,
    authorName: row.author_name,
    sections: normalizedSections,
    bonusPercentage: Number(row.bonus_percentage) || 0,
    overallScore: Number(row.overall_score) || calculateInspectionOverall(normalizedSections, row.bonus_percentage),
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadInspectionSections(inspectionIds = []) {
  const ids = [...new Set(inspectionIds.map(value => String(value || "")).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await supabaseRest(
    `division_inspection_sections?inspection_id=${encodeURIComponent(inFilter(ids))}&select=*&order=display_order.asc,created_at.asc`
  );

  return (rows || []).reduce((map, row, index) => {
    const inspectionId = String(row.inspection_id || "");
    if (!map.has(inspectionId)) map.set(inspectionId, []);
    map.get(inspectionId).push(row);
    return map;
  }, new Map());
}

async function loadInspections(division = "") {
  const filter = division ? `division_key=eq.${encodeURIComponent(division)}&` : "";
  const rows = await supabaseRest(
    `division_inspections?${filter}select=id,division_key,held_on,cadence,author_id,author_name,bonus_percentage,overall_score,notes,created_at,updated_at&order=held_on.desc,created_at.desc&limit=40`
  );
  const sectionMap = await loadInspectionSections((rows || []).map(row => row.id));
  return (rows || []).map(row => normalizeInspection(row, sectionMap.get(String(row.id)) || []));
}

function inspectionSectionRows(inspectionId, sections = []) {
  return sections.map((section, index) => ({
    inspection_id: inspectionId,
    name: requireString(section.name),
    out_of: Number(section.outOf) || 0,
    weighted_percentage: Number(section.weightedPercentage) || 0,
    achieved_score: Number(section.achievedScore) || 0,
    display_order: index
  })).filter(row => row.name);
}

async function replaceInspectionSections(inspectionId, sections = []) {
  if (!inspectionId) return;

  await supabaseRest(`division_inspection_sections?inspection_id=eq.${encodeURIComponent(inspectionId)}`, {
    method: "DELETE"
  });

  const rows = inspectionSectionRows(inspectionId, sections);
  if (!rows.length) return;

  await supabaseRest("division_inspection_sections", {
    method: "POST",
    body: JSON.stringify(rows)
  });
}

async function writeInspection(auth, body) {
  if (!hasHighCommandAccess(auth.profile)) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" } };
  }

  const division = requireString(body.division).toLowerCase();
  if (!ROBLOX_GROUPS.DIVISIONS[division]) {
    return { ok: false, status: 400, payload: { ok: false, reason: "UNKNOWN_DIVISION" } };
  }

  const sections = inspectionSectionsFor(division, body.sections);
  const bonusPercentage = Number(body.bonusPercentage || body.bonus_percentage) || 0;
  const id = requireString(body.id);
  const payload = {
    division_key: division,
    held_on: requireString(body.heldOn || body.held_on) || new Date().toISOString().slice(0, 10),
    cadence: ["weekly", "biweekly"].includes(body.cadence) ? body.cadence : "weekly",
    author_id: String(auth.user.roblox_id),
    author_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
    bonus_percentage: bonusPercentage,
    overall_score: calculateInspectionOverall(sections, bonusPercentage),
    notes: requireString(body.notes),
    updated_at: new Date().toISOString()
  };

  if (id) {
    await supabaseRest(`division_inspections?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await replaceInspectionSections(id, sections);
    return { ok: true, status: 200, payload: { ok: true, id } };
  }

  const [created] = await supabaseRest("division_inspections?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload)
  });
  await replaceInspectionSections(created?.id, sections);
  return { ok: true, status: 200, payload: { ok: true, id: created?.id } };
}

async function writeResource({ division, resourceType, detailTable, body, authorName }) {
  if (typeof body === "string") {
    body = body ? JSON.parse(body) : {};
  }

  if (!["transmission", "tracker", "report"].includes(resourceType)) {
    return { ok: false, status: 400, payload: { ok: false, reason: "RESOURCE_TYPE_NOT_WRITABLE" } };
  }

  const title = requireString(body.title);
  if (!title) {
    return { ok: false, status: 400, payload: { ok: false, reason: "TITLE_REQUIRED" } };
  }

  const now = new Date().toISOString();
  const slug = slugify(body.slug || title);
  const status = ["draft", "published", "archived"].includes(body.status) ? body.status : "published";
  const resourceId = requireString(body.id);
  const parentDescription = requireString(body.body || body.summary || body.notes || title);

  const parentPayload = {
    division_key: division,
    resource_type: resourceType,
    slug,
    title,
    description: parentDescription,
    access_key: requireString(body.accessKey || `${division}_${resourceType}s`),
    visibility: ["public", "restricted", "private"].includes(body.visibility) ? body.visibility : "restricted",
    status,
    display_order: Number.isFinite(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
    updated_at: now
  };

  let resource = { id: resourceId };

  if (resourceId) {
    await supabaseRest(`registry_resources?id=eq.${encodeURIComponent(resourceId)}`, {
      method: "PATCH",
      body: JSON.stringify(parentPayload)
    });
  } else {
    const [createdResource] = await supabaseRest("registry_resources?on_conflict=division_key,resource_type,slug&select=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(parentPayload)
    });
    resource = createdResource;
  }

  const detailPayload = (() => {
    if (resourceType === "transmission") {
      return {
        resource_id: resource.id,
        author_name: authorName,
        body: requireString(body.body),
        published_at: body.status === "published" ? new Date().toISOString() : null
      };
    }

    if (resourceType === "tracker") {
      return {
        resource_id: resource.id,
        external_url: requireString(body.href || body.externalUrl),
        provider: requireString(body.provider, "google_sheets"),
        notes: requireString(body.notes)
      };
    }

    return {
      resource_id: resource.id,
      author_name: authorName,
      summary: requireString(body.summary || body.body),
      body: requireString(body.body),
      report_period_start: body.reportPeriodStart || null,
      report_period_end: body.reportPeriodEnd || null
    };
  })();

  await supabaseRest(`${detailTable}?on_conflict=resource_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(detailPayload)
  });

  return { ok: true, status: 200, payload: { ok: true, id: resource.id } };
}

async function resolveUserByUsername(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      excludeBannedUsers: false
    })
  });

  if (!response.ok) {
    throw new Error("ROBLOX_USER_LOOKUP_FAILED");
  }

  const payload = await response.json();
  return payload.data?.[0] || null;
}

async function fetchBadgeCount(userId) {
  let count = 0;
  let cursor = "";

  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`https://badges.roblox.com/v1/users/${userId}/badges`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("sortOrder", "Asc");
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("ROBLOX_BADGE_LOOKUP_FAILED");
    }

    const payload = await response.json();
    count += Array.isArray(payload.data) ? payload.data.length : 0;
    cursor = payload.nextPageCursor || "";

    if (!cursor) break;
  }

  return count;
}

async function loadCounts() {
  const [documents, archives, overrides, retirements, botLinks, activeShifts, resources] = await Promise.all([
    supabaseRest("library_documents?library_key=eq.codex&select=id").catch(() => []),
    loadArchiveArticles().catch(() => []),
    supabaseRest("access_overrides?active=eq.true&select=id").catch(() => []),
    loadPendingRetirements().catch(() => []),
    supabaseRest("verification_links?select=discord_user_id").catch(() => []),
    supabaseRest("clock_shifts?status=eq.active&select=id").catch(() => []),
    supabaseRest("registry_resources?status=eq.published&select=id").catch(() => [])
  ]);

  return {
    codexArticles: documents.length,
    archiveArticles: archives.length,
    activeOverrides: overrides.length,
    pendingRetirements: retirements,
    activeBotLinks: botLinks.length,
    activeShifts: activeShifts.length,
    publishedResources: resources.length
  };
}

async function loadPendingRetirements() {
  return supabaseRest(
    "resource_handbook_retirements?select=id,resource_id,division_key,slot_key,storage_bucket,storage_path,file_name,file_size_bytes,mime_type,retired_at,purge_after&order=purge_after.asc"
  ).catch(() => []);
}

function activityItem({ id, source, type, title, scope = "", at, meta = {} }) {
  return {
    id: String(id || `${source}-${title}-${at}`),
    source,
    type,
    title: title || type,
    scope,
    at: at || null,
    meta
  };
}

function pagedActivity(items, page = 1, pageSize = 20, source = "all") {
  const filtered = source === "all" ? items : items.filter(item => item.source === source);
  const sorted = filtered
    .filter(item => item.at)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  const safePageSize = Math.max(5, Math.min(50, Number(pageSize) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const start = (safePage - 1) * safePageSize;

  return {
    items: sorted.slice(start, start + safePageSize),
    page: safePage,
    pageSize: safePageSize,
    totalApprox: sorted.length,
    hasNext: start + safePageSize < sorted.length,
    filters: ["all", ...new Set(items.map(item => item.source).filter(Boolean))].sort()
  };
}

async function loadRecentActivity({ page = 1, pageSize = 20, source = "all" } = {}) {
  const [
    resources,
    documents,
    archives,
    weeklyReports,
    inspections,
    proposals,
    timeline,
    retirements,
    botLogs,
    shifts,
    overrides
  ] = await Promise.all([
    supabaseRest("registry_resources?select=id,division_key,resource_type,title,status,updated_at,created_at&order=updated_at.desc&limit=80").catch(() => []),
    supabaseRest("library_documents?select=id,library_key,title,status,updated_at,created_at&order=updated_at.desc&limit=50").catch(() => []),
    supabaseRest("archive_articles?select=id,title,status,updated_at,created_at&order=updated_at.desc&limit=50").catch(() => []),
    supabaseRest("division_weekly_reports?select=id,division_key,week_start,author_name,status,updated_at,created_at&order=updated_at.desc&limit=50").catch(() => []),
    supabaseRest("division_inspections?select=id,division_key,held_on,cadence,author_name,overall_score,updated_at,created_at&order=updated_at.desc&limit=50").catch(() => []),
    supabaseRest("council_proposals?select=id,proposal_type,title,status,updated_at,created_at&order=updated_at.desc&limit=40").catch(() => []),
    supabaseRest("group_timeline_entries?select=id,title,status,updated_at,created_at&order=updated_at.desc&limit=40").catch(() => []),
    loadPendingRetirements().catch(() => []),
    supabaseRest("bot_audit_logs?select=id,action,actor_discord_id,target_discord_id,roblox_user_id,metadata,created_at&order=created_at.desc&limit=80").catch(() => []),
    supabaseRest("clock_shifts?select=id,scope,discord_user_id,roblox_user_id,status,started_at,ended_at,created_at&order=created_at.desc&limit=80").catch(() => []),
    supabaseRest("access_overrides?select=id,roblox_id,effect,scope_type,scope_key,active,created_at,expires_at&order=created_at.desc&limit=80").catch(() => [])
  ]);

  const items = [
    ...(resources || []).map(item => activityItem({
      id: item.id,
      source: "registry",
      type: item.resource_type || "resource",
      title: item.title,
      scope: item.division_key,
      at: item.updated_at || item.created_at,
      meta: { status: item.status }
    })),
    ...(documents || []).map(item => activityItem({
      id: item.id,
      source: item.library_key === "codex" ? "codex" : "library",
      type: "library_document",
      title: item.title,
      scope: item.library_key,
      at: item.updated_at || item.created_at,
      meta: { status: item.status }
    })),
    ...(archives || []).map(item => activityItem({
      id: item.id,
      source: "archives",
      type: "archive_article",
      title: item.title,
      at: item.updated_at || item.created_at,
      meta: { status: item.status }
    })),
    ...(weeklyReports || []).map(item => activityItem({
      id: item.id,
      source: "weekly_reports",
      type: "weekly_report",
      title: `Weekly Report ${item.week_start || ""}`.trim(),
      scope: item.division_key,
      at: item.updated_at || item.created_at,
      meta: { author: item.author_name, status: item.status }
    })),
    ...(inspections || []).map(item => activityItem({
      id: item.id,
      source: "inspections",
      type: "inspection",
      title: `Inspection ${item.held_on || ""}`.trim(),
      scope: item.division_key,
      at: item.updated_at || item.created_at,
      meta: { author: item.author_name, score: item.overall_score, cadence: item.cadence }
    })),
    ...(proposals || []).map(item => activityItem({
      id: item.id,
      source: "council",
      type: item.proposal_type || "proposal",
      title: item.title,
      scope: "darkCouncil",
      at: item.updated_at || item.created_at,
      meta: { status: item.status }
    })),
    ...(timeline || []).map(item => activityItem({
      id: item.id,
      source: "timeline",
      type: "timeline_entry",
      title: item.title,
      at: item.updated_at || item.created_at,
      meta: { status: item.status }
    })),
    ...(retirements || []).map(item => activityItem({
      id: item.id,
      source: "handbook_retirements",
      type: "handbook_retired",
      title: item.file_name || item.slot_key,
      scope: item.division_key,
      at: item.retired_at || item.purge_after,
      meta: { slot: item.slot_key, purgeAfter: item.purge_after }
    })),
    ...(botLogs || []).map(item => activityItem({
      id: item.id,
      source: "bot",
      type: item.action,
      title: item.action,
      scope: item.metadata?.scope || "",
      at: item.created_at,
      meta: { actorDiscordId: item.actor_discord_id, targetDiscordId: item.target_discord_id, robloxUserId: item.roblox_user_id }
    })),
    ...(shifts || []).map(item => activityItem({
      id: item.id,
      source: "clock",
      type: item.status === "active" ? "clock_active" : "clock_completed",
      title: item.status === "active" ? "Active Shift" : "Completed Shift",
      scope: item.scope,
      at: item.ended_at || item.started_at || item.created_at,
      meta: { discordUserId: item.discord_user_id, robloxUserId: item.roblox_user_id, status: item.status }
    })),
    ...(overrides || []).map(item => activityItem({
      id: item.id,
      source: "overrides",
      type: item.active ? "override_active" : "override_inactive",
      title: `${item.effect} ${item.scope_type}:${item.scope_key}`,
      scope: item.scope_key,
      at: item.created_at,
      meta: { robloxId: item.roblox_id, expiresAt: item.expires_at, active: item.active }
    }))
  ];

  return pagedActivity(items, page, pageSize, source);
}

async function loadAdminHealth() {
  const checks = await Promise.all([
    supabaseRest("division_weekly_report_members?select=id&limit=1").then(() => ({ key: "weeklyReportMembers", ok: true })).catch(error => ({ key: "weeklyReportMembers", ok: false, reason: error.message })),
    supabaseRest("division_inspection_sections?select=id&limit=1").then(() => ({ key: "inspectionSections", ok: true })).catch(error => ({ key: "inspectionSections", ok: false, reason: error.message })),
    supabaseRest("bot_audit_logs?select=id&limit=1").then(() => ({ key: "botAuditLogs", ok: true })).catch(error => ({ key: "botAuditLogs", ok: false, reason: error.message })),
    supabaseRest("clock_shifts?select=id&limit=1").then(() => ({ key: "clockShifts", ok: true })).catch(error => ({ key: "clockShifts", ok: false, reason: error.message })),
    supabaseRest(`access_overrides?active=eq.true&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&select=id`).then(rows => ({ key: "expiredActiveOverrides", ok: !rows?.length, count: rows?.length || 0 })).catch(error => ({ key: "expiredActiveOverrides", ok: false, reason: error.message }))
  ]);

  return {
    ok: checks.every(check => check.ok),
    checks
  };
}

async function loadOverrides() {
  return supabaseRest("access_overrides?select=*&order=created_at.desc").catch(() => []);
}

async function restoreHandbookRetirement(id, auth = null) {
  const [retirement] = await supabaseRest(
    `resource_handbook_retirements?id=eq.${encodeURIComponent(id)}&select=*`
  );

  if (!retirement) {
    return { ok: false, status: 404, payload: { ok: false, reason: "RETIREMENT_NOT_FOUND" } };
  }

  const [current] = await supabaseRest(
    `resource_handbooks?resource_id=eq.${encodeURIComponent(retirement.resource_id)}&select=*`
  );
  const now = new Date();

  if (current?.storage_path && current.storage_path !== retirement.storage_path) {
    await supabaseRest("resource_handbook_retirements", {
      method: "POST",
      body: JSON.stringify({
        resource_id: retirement.resource_id,
        division_key: retirement.division_key,
        slot_key: retirement.slot_key,
        storage_bucket: current.storage_bucket || "handbooks",
        storage_path: current.storage_path,
        file_name: current.file_name,
        file_size_bytes: current.file_size_bytes,
        mime_type: current.mime_type,
        retired_at: now.toISOString(),
        purge_after: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString()
      })
    });
  }

  await supabaseRest("resource_handbooks?on_conflict=resource_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      resource_id: retirement.resource_id,
      slot_key: retirement.slot_key,
      storage_bucket: retirement.storage_bucket || "handbooks",
      storage_path: retirement.storage_path,
      file_name: retirement.file_name,
      file_size_bytes: retirement.file_size_bytes,
      mime_type: retirement.mime_type,
      version_label: current?.version_label || retirement.slot_key,
      published_at: now.toISOString()
    })
  });

  await supabaseRest(`registry_resources?id=eq.${encodeURIComponent(retirement.resource_id)}`, {
    method: "PATCH",
    body: JSON.stringify({ updated_at: now.toISOString(), status: "published" })
  });

  await supabaseRest(`resource_handbook_retirements?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

  await supabaseRest("bot_audit_logs", {
    method: "POST",
    body: JSON.stringify({
      action: "admin.handbook.restore",
      roblox_user_id: auth?.user?.roblox_id ? String(auth.user.roblox_id) : null,
      metadata: {
        retirementId: id,
        resourceId: retirement.resource_id,
        division: retirement.division_key,
        slot: retirement.slot_key,
        fileName: retirement.file_name
      }
    })
  }).catch(() => null);

  return { ok: true, status: 200, payload: { ok: true, retirements: await loadPendingRetirements() } };
}

async function fetchCouncilEligibleSnapshot() {
  const response = await fetch(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUPS.HIGH_RANKS.groupId}/roles`);
  if (!response.ok) {
    throw new Error("COUNCIL_ROLE_SYNC_FAILED");
  }

  const payload = await response.json();
  const roles = payload.roles || payload.data || [];
  const snapshot = Object.entries(COUNCIL_RANKS).map(([key, rank]) => {
    const role = roles.find(item => Number(item.rank) === rank) || {};
    return {
      key,
      rank,
      name: role.name || councilRoleForRank(rank),
      memberCount: Number(role.memberCount || role.member_count || 0),
      countsTowardsMajority: COUNCIL_COUNTING_RANKS.includes(rank)
    };
  });

  const countingEligibleCount = snapshot
    .filter(item => item.countsTowardsMajority)
    .reduce((sum, item) => sum + item.memberCount, 0);

  return {
    snapshot,
    countingEligibleCount,
    majorityCount: Math.floor(countingEligibleCount / 2) + 1
  };
}

function normalizeCouncilVote(row) {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    robloxId: row.roblox_id,
    robloxUsername: row.roblox_username || "",
    vote: row.vote,
    voterRank: row.voter_rank || 0,
    voterRole: row.voter_role || "",
    countsTowardsMajority: Boolean(row.counts_towards_majority),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function voteCounts(votes = []) {
  return votes.reduce((counts, vote) => {
    if (vote.vote === "yes") counts.yes += 1;
    if (vote.vote === "no") counts.no += 1;
    if (vote.vote === "abstain") counts.abstain += 1;
    if (vote.countsTowardsMajority && vote.vote === "yes") counts.countingYes += 1;
    if (vote.countsTowardsMajority && vote.vote === "no") counts.countingNo += 1;
    if (vote.countsTowardsMajority && vote.vote === "abstain") counts.countingAbstain += 1;
    if (!vote.countsTowardsMajority && vote.vote === "yes") counts.advisoryYes += 1;
    if (!vote.countsTowardsMajority && vote.vote === "no") counts.advisoryNo += 1;
    if (!vote.countsTowardsMajority && vote.vote === "abstain") counts.advisoryAbstain += 1;
    return counts;
  }, {
    yes: 0,
    no: 0,
    abstain: 0,
    countingYes: 0,
    countingNo: 0,
    countingAbstain: 0,
    advisoryYes: 0,
    advisoryNo: 0,
    advisoryAbstain: 0
  });
}

function derivedCouncilStatus(proposal, votes = []) {
  if (["vetoed", "withdrawn", "passed", "failed"].includes(proposal.status)) return proposal.status;

  const openedAt = new Date(proposal.opens_at || proposal.created_at);
  const closesAt = new Date(proposal.closes_at);
  const now = new Date();
  const minimumCloseAt = new Date(openedAt.getTime() + 24 * 60 * 60 * 1000);
  const counts = voteCounts(votes);

  if (now >= minimumCloseAt && counts.yes >= Number(proposal.majority_count || 1)) {
    return "passed";
  }

  if (now >= closesAt) {
    return "failed";
  }

  return "open";
}

async function loadCouncilProposals() {
  const proposals = await supabaseRest(
    "council_proposals?select=*&order=created_at.desc"
  );

  if (!proposals?.length) return [];

  const ids = proposals.map(item => item.id);
  const votes = await supabaseRest(
    `council_votes?proposal_id=in.${encodeURIComponent(encodeInList(ids))}&select=*&order=created_at.asc`
  );

  const votesByProposal = new Map();
  (votes || []).forEach(row => {
    const list = votesByProposal.get(row.proposal_id) || [];
    list.push(normalizeCouncilVote(row));
    votesByProposal.set(row.proposal_id, list);
  });

  return proposals.map(row => {
    const proposalVotes = votesByProposal.get(row.id) || [];
    const counts = voteCounts(proposalVotes);
    return {
      id: row.id,
      proposalType: row.proposal_type,
      title: row.title,
      body: row.body,
      status: derivedCouncilStatus(row, proposalVotes),
      storedStatus: row.status,
      createdBy: row.created_by,
      createdByName: row.created_by_name || row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      durationHours: row.duration_hours,
      eligibleSnapshot: Array.isArray(row.eligible_snapshot) ? row.eligible_snapshot : [],
      majorityCount: row.majority_count || 0,
      countingEligibleCount: row.counting_eligible_count || 0,
      vetoedBy: row.vetoed_by || "",
      vetoedByName: row.vetoed_by_name || "",
      vetoedAt: row.vetoed_at || null,
      vetoReason: row.veto_reason || "",
      counts,
      votes: proposalVotes
    };
  });
}

async function createCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canPropose) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" } };
  }

  const proposalType = requireString(body.proposalType || body.proposal_type || "motion");
  const title = requireString(body.title);
  const proposalBody = requireString(body.body);
  const durationHours = clampDurationHours(body.durationHours || body.duration_hours);

  if (!["legislation", "motion", "councillor_election"].includes(proposalType) || !title || !proposalBody) {
    return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_FIELDS_REQUIRED" } };
  }

  const roleSnapshot = await fetchCouncilEligibleSnapshot();
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + durationHours * 60 * 60 * 1000);

  await supabaseRest("council_proposals", {
    method: "POST",
    body: JSON.stringify({
      proposal_type: proposalType,
      title,
      body: proposalBody,
      status: "open",
      created_by: String(auth.user.roblox_id),
      created_by_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      duration_hours: durationHours,
      eligible_snapshot: roleSnapshot.snapshot,
      counting_eligible_count: roleSnapshot.countingEligibleCount,
      majority_count: roleSnapshot.majorityCount
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function writeCouncilVote(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canVote) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };
  }

  const proposalId = requireString(body.proposalId || body.proposal_id);
  const vote = requireString(body.vote).toLowerCase();
  if (!proposalId || !["yes", "no", "abstain"].includes(vote)) {
    return { ok: false, status: 400, payload: { ok: false, reason: "VOTE_FIELDS_REQUIRED" } };
  }

  const [proposal] = await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}&select=*`);
  if (!proposal || derivedCouncilStatus(proposal, []) !== "open") {
    return { ok: false, status: 200, payload: { ok: false, reason: "PROPOSAL_CLOSED" } };
  }

  await supabaseRest("council_votes?on_conflict=proposal_id,roblox_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      proposal_id: proposalId,
      roblox_id: String(auth.user.roblox_id),
      roblox_username: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
      vote,
      voter_rank: permissions.rank,
      voter_role: permissions.role,
      counts_towards_majority: permissions.countsTowardsMajority,
      updated_at: new Date().toISOString()
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function vetoCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canVeto) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };
  }

  const proposalId = requireString(body.proposalId || body.proposal_id);
  if (!proposalId) {
    return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_ID_REQUIRED" } };
  }

  await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "vetoed",
      vetoed_by: String(auth.user.roblox_id),
      vetoed_by_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
      vetoed_at: new Date().toISOString(),
      veto_reason: requireString(body.reason)
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

async function reopenCouncilProposal(auth, body) {
  const permissions = councilPermissions(auth.profile);
  if (!permissions.canReopen) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" } };
  }

  const proposalId = requireString(body.proposalId || body.proposal_id);
  const durationHours = clampDurationHours(body.durationHours || body.duration_hours);
  if (!proposalId) {
    return { ok: false, status: 400, payload: { ok: false, reason: "PROPOSAL_ID_REQUIRED" } };
  }

  const [proposal] = await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}&select=*`);
  if (!proposal) {
    return { ok: false, status: 404, payload: { ok: false, reason: "PROPOSAL_NOT_FOUND" } };
  }

  const votes = await supabaseRest(`council_votes?proposal_id=eq.${encodeURIComponent(proposalId)}&select=*`).catch(() => []);
  if (votes?.length) {
    await supabaseRest("council_vote_history", {
      method: "POST",
      body: JSON.stringify(votes.map(vote => ({
        proposal_id: proposalId,
        roblox_id: vote.roblox_id,
        roblox_username: vote.roblox_username,
        vote: vote.vote,
        voter_rank: vote.voter_rank,
        voter_role: vote.voter_role,
        counts_towards_majority: vote.counts_towards_majority,
        original_created_at: vote.created_at,
        original_updated_at: vote.updated_at,
        archived_by: String(auth.user.roblox_id),
        archived_by_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id)
      })))
    });

    await supabaseRest(`council_votes?proposal_id=eq.${encodeURIComponent(proposalId)}`, { method: "DELETE" });
  }

  const roleSnapshot = await fetchCouncilEligibleSnapshot();
  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + durationHours * 60 * 60 * 1000);

  await supabaseRest(`council_proposals?id=eq.${encodeURIComponent(proposalId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "open",
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
      duration_hours: durationHours,
      eligible_snapshot: roleSnapshot.snapshot,
      counting_eligible_count: roleSnapshot.countingEligibleCount,
      majority_count: roleSnapshot.majorityCount,
      vetoed_by: null,
      vetoed_by_name: null,
      vetoed_at: null,
      veto_reason: null,
      updated_at: new Date().toISOString()
    })
  });

  return { ok: true, status: 200, payload: { ok: true, proposals: await loadCouncilProposals() } };
}

function normalizeTimelineEntry(entry) {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    category: entry.category,
    dateLabel: entry.date_label || "",
    startDate: entry.start_date || "",
    endDate: entry.end_date || "",
    imagePath: entry.image_path || "",
    imageAlt: entry.image_alt || "",
    imageUrl: publicImageUrl(entry.image_path),
    status: entry.status,
    displayOrder: entry.display_order,
    createdBy: entry.created_by || "",
    createdByName: entry.created_by_name || "",
    createdAt: entry.created_at,
    updatedAt: entry.updated_at
  };
}

async function loadTimelineEntries(includeDrafts = false) {
  const statusFilter = includeDrafts ? "" : "status=eq.published&";
  const entries = await supabaseRest(
    `group_timeline_entries?${statusFilter}select=*&order=start_date.asc,display_order.asc,created_at.asc`
  );
  return (entries || []).map(normalizeTimelineEntry);
}

async function writeTimelineEntry(auth, body) {
  const permission = canAccessAdmin(auth.profile);
  if (!permission.authorized) {
    return { ok: false, status: 200, payload: { ok: false, authorized: false, reason: permission.reason } };
  }

  const id = requireString(body.id);
  const title = requireString(body.title);
  const entryBody = requireString(body.body);
  const category = requireString(body.category || "major_event");

  if (!title || !entryBody || !["owner", "era", "emperor", "map", "major_event", "reform"].includes(category)) {
    return { ok: false, status: 400, payload: { ok: false, reason: "TIMELINE_FIELDS_REQUIRED" } };
  }

  const payload = {
    title,
    body: entryBody,
    category,
    date_label: requireString(body.dateLabel || body.date_label),
    start_date: body.startDate || body.start_date || null,
    end_date: body.endDate || body.end_date || null,
    image_path: requireString(body.imagePath || body.image_path),
    image_alt: requireString(body.imageAlt || body.image_alt || title),
    status: ["draft", "published", "archived"].includes(body.status) ? body.status : "published",
    display_order: Number.isFinite(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
    created_by: String(auth.user.roblox_id),
    created_by_name: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id),
    updated_at: new Date().toISOString()
  };

  if (id) {
    await supabaseRest(`group_timeline_entries?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  } else {
    await supabaseRest("group_timeline_entries", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return { ok: true, status: 200, payload: { ok: true, entries: await loadTimelineEntries(true) } };
}

export const LEGACY_API_HANDLERS = {
  "auth/login": async (req, res) => {
    const clientID = process.env.ROBLOX_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.ROBLOX_REDIRECT_URI);
    const state = createRandomToken();
    const scope = encodeURIComponent("openid profile");
    const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=${encodeURIComponent(state)}`;

    res.setHeader("Set-Cookie", serializeCookie(STATE_COOKIE, state, { maxAge: 60 * 10 }));
    return res.redirect(robloxAuthUrl);
  },
  "auth/logout": async (req, res) => {
    try {
      const token = getCookie(req, SESSION_COOKIE);
      await deleteSessionToken(token);
      res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
      return res.status(200).json({ ok: true });
    } catch (err) {
      res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
      return res.status(500).json({ ok: false, error: err.message });
    }
  },
  "auth/check-status": async (req, res) => {
    try {
      await cleanupExpiredSessions();
      const session = await getSessionUser(req);

      if (!session.authenticated) {
        return res.status(200).json({ bound: false, reason: session.reason });
      }

      return res.status(200).json({
        bound: true,
        robloxId: session.user.roblox_id,
        robloxUsername: session.user.roblox_username
      });
    } catch (err) {
      return res.status(500).json({ bound: false, error: err.message });
    }
  },
  "discord-link/confirm": async (req, res) => {
    try {
      const result = await confirmDiscordLink(req);
      return res.status(result.status).json(result.payload);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  },
  "auth/callback": async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect("/account.html?status=error&msg=Invalid+callback+payload");
    }

    const expectedState = getCookie(req, STATE_COOKIE);

    if (!expectedState || state !== expectedState) {
      res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
      return res.redirect("/account.html?status=error&msg=OAuth+state+verification+failed");
    }

    try {
      const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.ROBLOX_CLIENT_ID,
          client_secret: process.env.ROBLOX_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.ROBLOX_REDIRECT_URI
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error_description || "Failed token transaction exchange");
      }

      const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      const userData = await userResponse.json();
      if (!userResponse.ok) {
        throw new Error("Could not fetch Roblox identity profile data.");
      }

      const robloxId = String(userData.sub);
      const robloxUsername = userData.preferred_username;
      const robloxDisplayName = userData.name;

      await deleteSessionToken(getCookie(req, SESSION_COOKIE));

      const { token, expiresAt } = await createSessionForUser({
        robloxId,
        robloxUsername,
        robloxDisplayName
      });

      res.setHeader("Set-Cookie", [
        clearCookie(STATE_COOKIE),
        serializeCookie(SESSION_COOKIE, token, {
          maxAge: SESSION_MAX_AGE_SECONDS,
          expires: expiresAt
        })
      ]);

      return res.redirect("/account.html?status=success");
    } catch (err) {
      res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
      return res.redirect(`/account.html?status=error&msg=${encodeURIComponent(err.message)}`);
    }
  },
  "auth/check-access": async (req, res) => {
    const page = getQueryParam(req, "page");
    let pageIsUnknown = false;

    try {
      if (page) {
        const unknownCheck = checkPageAccess({
          isSuperUser: false,
          hasFullAccess: false,
          divisions: {},
          highRank: "none"
        }, page);

        pageIsUnknown = unknownCheck.reason === "UNKNOWN_RESOURCE";

        if (unknownCheck.authorized) {
          return res.status(200).json(unknownCheck);
        }
      }

      const auth = await getAuthContext(req, { optional: true });
      if (!auth.authenticated) {
        if (pageIsUnknown) {
          return res.status(200).json({
            authorized: false,
            reason: "UNKNOWN_RESOURCE"
          });
        }

        return res.status(200).json({
          authorized: false,
          reason: auth.reason || "SESSION_REQUIRED"
        });
      }
      const profile = auth.profile;

      if (page) {
        const access = checkPageAccess(profile, page);
        return res.status(200).json({
          ...access,
          profile,
          permissions: {
            canAccessAdmin: canAccessAdmin(profile).authorized,
            canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
            canAccessNexus: canAccessNexus(profile).authorized,
            canAccessRegistry: canAccessRegistry(profile).authorized
          }
        });
      }

      return res.status(200).json({
        authorized: true,
        profile,
        permissions: {
          canAccessAdmin: canAccessAdmin(profile).authorized,
          canAccessPersonnelLookup: canAccessPersonnelLookup(profile).authorized,
          canAccessNexus: canAccessNexus(profile).authorized,
          canAccessRegistry: canAccessRegistry(profile).authorized
        }
      });
    } catch (err) {
      return res.status(500).json({ authorized: false, error: err.message });
    }
  },
  library: async (req, res) => {
    try {
      const libraryKey = requireString(getQueryParam(req, "library")).toLowerCase();
      if (libraryKey === "archives") {
        try {
          if (req.method !== "GET") {
            return res.status(400).json({ ok: false, reason: "ARCHIVES_USE_ARCHIVE_ENDPOINT" });
          }

          const auth = await getAuthContext(req, { optional: true });
          const canEdit = auth.authenticated ? canEditLibrary(auth.profile, "archives").authorized : false;
          const articles = await ensureArchivesSeeded();

          return res.status(200).json({
            ok: true,
            library: "archives",
            canEdit,
            articles,
            documents: articles
          });
        } catch (error) {
          if (req.method === "GET" && isMissingSchemaError(error)) {
            const articles = (ARCHIVE_SEED.articles || []).map(article => ({
              id: article.slug,
              slug: article.slug,
              articleNumber: article.articleNumber || "ARTICLE 1",
              title: article.title,
              body: article.body,
              imageBucket: article.imagePath ? "archives" : "",
              imagePath: article.imagePath || "",
              imageAlt: article.imageAlt || article.title,
              imageUrl: "",
              status: article.status || "published",
              displayOrder: article.displayOrder || 0
            }));

            return res.status(200).json({
              ok: true,
              library: "archives",
              canEdit: false,
              migrationRequired: true,
              articles,
              documents: articles
            });
          }

          return res.status(500).json({ ok: false, error: error.message });
        }
      }

      if (libraryKey !== "codex") {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_LIBRARY" });
      }

      if (req.method === "GET") {
        const auth = await getAuthContext(req, { optional: true });
        const canEdit = auth.authenticated
          ? canEditLibrary(auth.profile, libraryKey).authorized
          : false;

        const documents = await ensureLibrarySeeded(libraryKey);
        return res.status(200).json({
          ok: true,
          library: libraryKey,
          canEdit,
          documents
        });
      }

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canEditLibrary(auth.profile, libraryKey);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const result = await writeLibraryDocument(libraryKey, typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}));
        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "DOCUMENT_ID_REQUIRED" });
        }

        await deleteLibraryDocument(id);
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (req.method === "GET" && isMissingSchemaError(error)) {
        const libraryKey = requireString(getQueryParam(req, "library")).toLowerCase();
        return res.status(200).json({
          ok: true,
          library: libraryKey,
          canEdit: false,
          migrationRequired: true,
          documents: (LIBRARY_SEED[libraryKey]?.documents || []).map(document => ({
            ...document,
            id: document.slug
          }))
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  archives: async (req, res) => {
    try {
      if (req.method === "GET") {
        const auth = await getAuthContext(req, { optional: true });
        const canEdit = auth.authenticated ? canEditLibrary(auth.profile, "archives").authorized : false;
        const articles = await ensureArchivesSeeded();

        return res.status(200).json({
          ok: true,
          library: "archives",
          canEdit,
          articles,
          documents: articles
        });
      }

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canEditLibrary(auth.profile, "archives");
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeArchiveArticle(body);
        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "ARTICLE_ID_REQUIRED" });
        }

        await deleteArchiveArticle(id);
        return res.status(200).json({ ok: true });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (req.method === "GET" && isMissingSchemaError(error)) {
        const articles = (ARCHIVE_SEED.articles || []).map(article => ({
          id: article.slug,
          slug: article.slug,
          articleNumber: article.articleNumber || "ARTICLE 1",
          title: article.title,
          body: article.body,
          imageBucket: article.imagePath ? "archives" : "",
          imagePath: article.imagePath || "",
          imageAlt: article.imageAlt || article.title,
          imageUrl: "",
          status: article.status || "published",
          displayOrder: article.displayOrder || 0
        }));

        return res.status(200).json({
          ok: true,
          library: "archives",
          canEdit: false,
          migrationRequired: true,
          articles,
          documents: articles
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  resources: async (req, res) => {
    try {
      const division = getQueryParam(req, "division");
      const requestedType = getQueryParam(req, "type");
      const resourceType = {
        handbooks: "handbook",
        documents: "handbook",
        transmissions: "transmission",
        trackers: "tracker",
        reports: "report"
      }[requestedType];
      const detailTable = detailTableFor(resourceType);

      if (!division || !resourceType || !detailTable) {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_RESOURCE_TYPE" });
      }

      await cleanupRetiredHandbooks();

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason });
      }

      const pageKey = `${division}_${{
        handbook: "handbooks",
        transmission: "transmissions",
        tracker: "trackers",
        report: "reports"
      }[resourceType]}`;
      const access = checkPageAccess(auth.profile, pageKey);
      if (!access.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: access.reason || "ACCESS_DENIED" });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        if (resourceType === "handbook") {
          return res.status(405).json({ ok: false, reason: "HANDBOOK_UPLOADS_DISABLED" });
        }

        const writeAccess = checkResourceWriteAccess(auth.profile, { division, resourceType });
        if (!writeAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: writeAccess.reason });
        }

        const result = await writeResource({
          division,
          resourceType,
          detailTable,
          body: req.body || {},
          authorName: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id)
        });

        return res.status(result.status).json(result.payload);
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      const resources = await loadPublishedResources(division, resourceType);
      const rows = resources?.length
        ? await normalizeRows(resources, await loadDetailRows(detailTable, resources.map(resource => resource.id)), resourceType)
        : [];

      if (resourceType === "handbook") {
        const slotCatalog = getHandbookSlots(division);
        const sortedRows = rows.slice().sort((left, right) => {
          const leftSlot = getHandbookSlot(division, left.slotKey || "");
          const rightSlot = getHandbookSlot(division, right.slotKey || "");
          return (leftSlot?.order || left.displayOrder || 0) - (rightSlot?.order || right.displayOrder || 0);
        });

        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite: false,
          canUpload: false,
          slotCatalog,
          resources: sortedRows
        });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        canWrite: checkResourceWriteAccess(auth.profile, { division, resourceType }).authorized,
        resources: rows
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  board: async (req, res) => {
    try {
      const auth = await getAuthContext(req, { optional: true });

      if (req.method === "GET") {
        const canWrite = auth.authenticated ? canWriteBoardBroadcast(auth.profile) : false;
        return res.status(200).json({
          ok: true,
          canWrite,
          channels: canWrite ? boardChannelsFor(auth.profile) : [],
          transmissions: await loadBoardTransmissions()
        });
      }

      if (req.method === "POST") {
        if (!auth.authenticated) {
          return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
        }

        if (!canWriteBoardBroadcast(auth.profile)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "INSUFFICIENT_WRITE_CLEARANCE" });
        }

        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const channel = requireString(body.channel || "holonet");
        const allowedChannels = boardChannelsFor(auth.profile);
        if (!allowedChannels.includes(channel)) {
          return res.status(200).json({ ok: false, authorized: false, reason: "CHANNEL_NOT_AUTHORIZED" });
        }

        const result = await writeResource({
          division: channel,
          resourceType: "transmission",
          detailTable: "resource_transmissions",
          body: {
            ...body,
            status: "published",
            visibility: "public"
          },
          authorName: auth.user.roblox_username || auth.user.roblox_display_name || String(auth.user.roblox_id)
        });

        return res.status(result.status).json({ ...result.payload, transmissions: await loadBoardTransmissions() });
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, migrationRequired: true, transmissions: [] });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  nexus: async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessNexus(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        canInspect: hasHighCommandAccess(auth.profile),
        divisions: await loadNexusOverview(auth.profile)
      });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, authorized: true, migrationRequired: true, divisions: [] });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "weekly-reports": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const division = requireString(getQueryParam(req, "division")).toLowerCase();
      if (req.method === "GET") {
        const viewAccess = division
          ? canViewDivisionReports(auth.profile, division)
          : { authorized: false, reason: "UNKNOWN_DIVISION" };
        if (!viewAccess.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: viewAccess.reason || "ACCESS_DENIED" });
        }

        const canWrite = division ? canWriteDivisionWeeklyReport(auth.profile, division) : false;
        const draft = getQueryParam(req, "draft") === "1";
        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite,
          roster: draft && canWrite ? await buildWeeklyReportRoster(division) : [],
          reports: await loadWeeklyReports(division)
        });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeWeeklyReport(auth, body);
        return res.status(result.status).json(result.payload);
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "division-roster": async (req, res) => {
    try {
      if (req.method !== "GET") {
        return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
      }

      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const division = canonicalDivisionId(getQueryParam(req, "division"));
      const divisionConfig = getDivision(division);
      if (!divisionConfig || !rosterDefinitionForDivision(division)) {
        return res.status(400).json({ ok: false, reason: "UNKNOWN_DIVISION" });
      }

      const access = checkPageAccess(auth.profile, divisionConfig.access?.trackers || `${division}_trackers`);
      if (!access.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: access.reason || "ACCESS_DENIED" });
      }

      const members = (await buildWeeklyReportRoster(division))
        .sort((left, right) => (
          Number(right.rank || 0) - Number(left.rank || 0)
          || String(left.username || left.displayName || "").localeCompare(String(right.username || right.displayName || ""))
        ));

      return res.status(200).json({
        ok: true,
        authorized: true,
        members
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  inspections: async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const division = requireString(getQueryParam(req, "division")).toLowerCase();
      if (req.method === "GET") {
        return res.status(200).json({
          ok: true,
          authorized: true,
          canWrite: hasHighCommandAccess(auth.profile),
          inspections: await loadInspections(division)
        });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeInspection(auth, body);
        return res.status(result.status).json(result.payload);
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "personnel-lookup": async (req, res) => {
    try {
      const username = requireString(req.method === "POST" ? req.body?.username : getQueryParam(req, "username"));
      if (!username) {
        return res.status(400).json({ ok: false, reason: "USERNAME_REQUIRED" });
      }

      const resolved = await resolveUserByUsername(username);
      if (!resolved?.id) {
        return res.status(200).json({ ok: false, reason: "USER_NOT_FOUND" });
      }

      const [userResponse, groupResponse] = await Promise.all([
        fetch(`https://users.roblox.com/v1/users/${resolved.id}`),
        fetch(`https://groups.roblox.com/v1/users/${resolved.id}/groups/roles`)
      ]);

      if (!userResponse.ok || !groupResponse.ok) {
        throw new Error("ROBLOX_PROFILE_LOOKUP_FAILED");
      }

      const user = await userResponse.json();
      const groups = await groupResponse.json();
      const [friendsResponse, badgeCountResult] = await Promise.all([
        fetch(`https://friends.roblox.com/v1/users/${resolved.id}/friends/count`),
        fetchBadgeCount(resolved.id).then(count => ({ ok: true, count })).catch(() => ({ ok: false, count: null }))
      ]);

      if (!friendsResponse.ok) {
        throw new Error("ROBLOX_FRIEND_COUNT_FAILED");
      }

      const friendsPayload = await friendsResponse.json();
      const mainGroupMembership = (groups.data || []).find(
        membership => membership?.group?.id === ROBLOX_GROUPS.HIGH_RANKS.groupId
      );
      const divisionMemberships = Object.entries(ROBLOX_GROUPS.DIVISIONS)
        .map(([divisionKey, definition]) => {
          const membership = (groups.data || []).find(item => item?.group?.id === definition.groupId);
          if (!membership) return null;
          return {
            divisionKey,
            label: divisionKey === "dhg" ? "Dark Honor Guard" : divisionKey === "inquisitors" ? "Inquisitors" : divisionKey.charAt(0).toUpperCase() + divisionKey.slice(1),
            rankName: membership.role?.name || "Unknown",
            rank: membership.role?.rank || 0,
            joinedAt: membership.joinedAt || membership.joined_at || null
          };
        })
        .filter(Boolean);
      const accountCreated = user.created ? new Date(user.created) : null;
      const accountAgeDays = accountCreated ? Math.max(0, Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24))) : null;
      const warnings = [];

      if (accountAgeDays !== null && accountAgeDays < 30) {
        warnings.push({ key: "low_age", label: "Low age account", detail: `Account is ${accountAgeDays} day${accountAgeDays === 1 ? "" : "s"} old.` });
      }

      if (typeof friendsPayload.count === "number" && friendsPayload.count < 20) {
        warnings.push({ key: "low_friends", label: "Low number of friends", detail: `${friendsPayload.count} friend${friendsPayload.count === 1 ? "" : "s"} found.` });
      }

      if (typeof badgeCountResult.count === "number" && badgeCountResult.count < 10) {
        warnings.push({ key: "low_badges", label: "Low number of badges", detail: `${badgeCountResult.count} badge${badgeCountResult.count === 1 ? "" : "s"} found.` });
      }

      return res.status(200).json({
        ok: true,
        authorized: true,
        user: {
          robloxId: String(resolved.id),
          username: resolved.name || username,
          displayName: resolved.displayName || user.displayName || resolved.name || username,
          created: user.created || null,
          accountAgeDays,
          friendsCount: friendsPayload.count ?? null,
          badgeCount: badgeCountResult.ok ? badgeCountResult.count : null,
          profileUrl: `https://www.roblox.com/users/${resolved.id}/profile`,
          mainGroup: mainGroupMembership ? {
            inGroup: true,
            rankName: mainGroupMembership.role?.name || "Unknown",
            rank: mainGroupMembership.role?.rank || 0,
            joinedAt: mainGroupMembership.joinedAt || mainGroupMembership.joined_at || null
          } : {
            inGroup: false,
            rankName: "",
            rank: 0,
            joinedAt: null
          },
          divisionMemberships,
          warnings
        }
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "council-floor": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permissions = councilPermissions(auth.profile);
      if (!permissions.canView) {
        return res.status(200).json({ ok: false, authorized: false, reason: "INSUFFICIENT_CLEARANCE_LEVEL" });
      }

      if (req.method === "GET") {
        let roleSnapshot = null;
        try {
          roleSnapshot = await fetchCouncilEligibleSnapshot();
        } catch {
          roleSnapshot = { snapshot: [], countingEligibleCount: 0, majorityCount: 0 };
        }

        return res.status(200).json({
          ok: true,
          authorized: true,
          permissions,
          roleSnapshot,
          proposals: await loadCouncilProposals()
        });
      }

      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = requireString(body.action || (req.method === "POST" ? "create" : "")).toLowerCase();

      if (req.method === "POST" && action === "create") {
        const result = await createCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "vote") {
        const result = await writeCouncilVote(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "veto") {
        const result = await vetoCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if ((req.method === "POST" || req.method === "PATCH") && action === "reopen") {
        const result = await reopenCouncilProposal(auth, body);
        return res.status(result.status).json(result.payload);
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        if (req.method !== "GET") {
          return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
        }

        return res.status(200).json({
          ok: true,
          migrationRequired: true,
          authorized: true,
          permissions: {},
          roleSnapshot: { snapshot: [], countingEligibleCount: 0, majorityCount: 0 },
          proposals: []
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "group-timeline": async (req, res) => {
    try {
      const auth = await getAuthContext(req, { optional: true });
      const canEdit = auth.authenticated ? canAccessAdmin(auth.profile).authorized : false;

      if (req.method === "GET") {
        return res.status(200).json({
          ok: true,
          canEdit,
          entries: await loadTimelineEntries(canEdit)
        });
      }

      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const result = await writeTimelineEntry(auth, body);
        return res.status(result.status).json(result.payload);
      }

      if (req.method === "DELETE") {
        const permission = canAccessAdmin(auth.profile);
        if (!permission.authorized) {
          return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
        }

        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "TIMELINE_ID_REQUIRED" });
        }

        await supabaseRest(`group_timeline_entries?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        return res.status(200).json({ ok: true, entries: await loadTimelineEntries(true) });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, migrationRequired: true, canEdit: false, entries: [] });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "admin/overview": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      const [counts, health, pendingRetirements, activity] = await Promise.all([
        loadCounts(),
        loadAdminHealth(),
        loadPendingRetirements(),
        loadRecentActivity()
      ]);

      return res.status(200).json({
        ok: true,
        counts,
        health,
        pendingRetirements,
        activity
      });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({
          ok: true,
          migrationRequired: true,
          counts: {
            codexArticles: 0,
            archiveArticles: 0,
            activeOverrides: 0,
            activeBotLinks: 0,
            activeShifts: 0,
            publishedResources: 0,
            pendingRetirements: []
          },
          health: { ok: false, checks: [] },
          pendingRetirements: [],
          activity: { items: [], page: 1, pageSize: 20, totalApprox: 0, hasNext: false, filters: ["all"] }
        });
      }

      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "admin/activity": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      const activity = await loadRecentActivity({
        page: Number(getQueryParam(req, "page")) || 1,
        pageSize: Number(getQueryParam(req, "pageSize")) || 20,
        source: requireString(getQueryParam(req, "source"), "all") || "all"
      });

      return res.status(200).json({ ok: true, activity });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: true, activity: { items: [], page: 1, pageSize: 20, totalApprox: 0, hasNext: false, filters: ["all"] } });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "admin/retirements": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "GET") {
        return res.status(200).json({ ok: true, retirements: await loadPendingRetirements() });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const action = requireString(body.action).toLowerCase();
        const id = requireString(body.id);

        if (action !== "restore" || !id) {
          return res.status(400).json({ ok: false, reason: "RETIREMENT_ACTION_REQUIRED" });
        }

        const result = await restoreHandbookRetirement(id, auth);
        return res.status(result.status).json(result.payload);
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "admin/overrides": async (req, res) => {
    try {
      const auth = await getAuthContext(req);
      if (!auth.authenticated) {
        return res.status(200).json({ ok: false, authorized: false, reason: auth.reason || "SESSION_REQUIRED" });
      }

      const permission = canAccessAdmin(auth.profile);
      if (!permission.authorized) {
        return res.status(200).json({ ok: false, authorized: false, reason: permission.reason });
      }

      if (req.method === "GET") {
        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
        const robloxId = requireString(body.robloxId) || await resolveRobloxId(requireString(body.username));
        const effect = requireString(body.effect).toLowerCase();
        const scopeType = requireString(body.scopeType).toLowerCase();
        const scopeKey = requireString(body.scopeKey);
        const reason = requireString(body.reason);

        if (!robloxId || !["grant", "revoke"].includes(effect) || !["page", "division", "library", "capability"].includes(scopeType) || !scopeKey || !reason) {
          return res.status(400).json({ ok: false, reason: "OVERRIDE_FIELDS_REQUIRED" });
        }

        await supabaseRest("access_overrides", {
          method: "POST",
          body: JSON.stringify({
            roblox_id: robloxId,
            effect,
            scope_type: scopeType,
            scope_key: scopeKey,
            reason,
            created_by: String(auth.user.roblox_id),
            created_at: new Date().toISOString(),
            expires_at: body.expiresAt || null,
            active: true
          })
        });

        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.override.create",
            roblox_user_id: String(auth.user.roblox_id),
            metadata: { targetRobloxId: robloxId, effect, scopeType, scopeKey }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      if (req.method === "DELETE") {
        const id = requireString(getQueryParam(req, "id"));
        if (!id) {
          return res.status(400).json({ ok: false, reason: "OVERRIDE_ID_REQUIRED" });
        }

        const [existing] = await supabaseRest(`access_overrides?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
        await supabaseRest(`access_overrides?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
        await supabaseRest("bot_audit_logs", {
          method: "POST",
          body: JSON.stringify({
            action: "admin.override.remove",
            roblox_user_id: String(auth.user.roblox_id),
            metadata: existing ? { targetRobloxId: existing.roblox_id, effect: existing.effect, scopeType: existing.scope_type, scopeKey: existing.scope_key } : { overrideId: id }
          })
        }).catch(() => null);

        return res.status(200).json({ ok: true, overrides: await loadOverrides() });
      }

      return res.status(405).json({ ok: false, reason: "METHOD_NOT_ALLOWED" });
    } catch (error) {
      if (isMissingSchemaError(error)) {
        return res.status(200).json({ ok: false, reason: "MIGRATION_REQUIRED" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
  },
  "unknown-resource": async (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restricted Node - Sith Holonet</title>
  <style>
    html,
    body {
      background: #0e0000;
      margin: 0;
      min-height: 100%;
    }
  </style>
</head>
<body>
  <div style="min-height:100vh;display:grid;place-items:center;color:#ff3b4f;font-family:'Share Tech Mono',monospace;text-align:center;padding:24px;">
    <div>
      <h1 style="font-family:'Orbitron',sans-serif;letter-spacing:.2em;">[ RESTRICTED NODE ]</h1>
      <p style="letter-spacing:.12em;text-transform:uppercase;">ACCESS DENIED: RESOURCE UNKNOWN</p>
      <p><a href="/registry" style="color:#ff3b4f;text-decoration:none;border:1px solid currentColor;padding:10px 18px;display:inline-block;">GO BACK</a></p>
    </div>
  </div>
</body>
</html>`);
  }
};
