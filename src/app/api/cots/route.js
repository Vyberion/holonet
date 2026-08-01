import {
  isMissingSchemaError, getAuthContext, canEditLibrary, createSignedStorageUrl, removeStorageObjects, supabaseRest, uploadStorageObject
} from "../../../lib/api-helpers.js";


const COTS_BUCKET = "cots";
const COTS_ROW_KEY = "current";

export const runtime = "nodejs";
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
