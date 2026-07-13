import { executeLegacyHandler } from "../../../lib/legacy-api-adapter.js";
import {
  getQueryParam, requireString, isMissingSchemaError, getAuthContext, canEditLibrary, ARCHIVE_SEED, ensureArchivesSeeded, writeArchiveArticle, deleteArchiveArticle
} from "../../../lib/api-helpers.js";




const handler = async (req, res) => {
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
  };

export function GET(request) { return executeLegacyHandler(handler, request); }
export function POST(request) { return executeLegacyHandler(handler, request); }
export function PATCH(request) { return executeLegacyHandler(handler, request); }
export function DELETE(request) { return executeLegacyHandler(handler, request); }
export function PUT(request) { return executeLegacyHandler(handler, request); }
