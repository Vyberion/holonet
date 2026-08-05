(function () {
  const ACTIVITY_PAGE_SIZE = 20;
  const SCOPE_PRESETS = [
    ["", "Select preset"],
    ["capability:admin", "Capability / admin"],
    ["page:registry", "Page / registry"],
    ["library:codex", "Library / codex"],
    ["library:archives", "Library / archives"],
    ["division:reavers", "Division / reavers"],
    ["division:dhg", "Division / dhg"],
    ["division:inquisitors", "Division / inquisitors"],
    ["division:dreadmasters", "Division / dreadmasters"],
    ["page:reavers_reports", "Page / reavers reports"],
    ["page:dhg_reports", "Page / dhg reports"],
    ["page:inquisitors_reports", "Page / inquisitors reports"],
    ["page:dreadmasters_reports", "Page / dreadmasters reports"],
    ["page:reavers_handbooks", "Page / reavers handbooks"],
    ["page:dhg_handbooks", "Page / dhg handbooks"],
    ["page:inquisitors_handbooks", "Page / inquisitors handbooks"],
    ["page:dreadmasters_handbooks", "Page / dreadmasters handbooks"]
  ];

  const state = {
    activityPage: 1,
    activitySource: "all",
    overrideUsername: "",
    lookupUser: null
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.reason || payload.error || "REQUEST_FAILED");
    }
    return payload;
  }

  function formatDate(value) {
    return value ? new Date(value).toLocaleString() : "Unknown";
  }

  function renderApprovals(approvals = []) {
    return `
      <div class="hub-panel-head">
        <h3 class="hub-panel-title">Pending Approvals</h3>
        <span class="hub-value">${escapeHtml(approvals.length)} total</span>
      </div>
      <div class="hub-list">
        ${approvals.map(item => `
          <article class="hub-row">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.status === "PENDING_CREATE" ? "Creation Request" : "Dissolution Request")}</span>
            <p>Leader: ${escapeHtml(item.leader_name || item.leader_id)}</p>
            <div class="admin-page-controls" style="margin-top: 10px;">
              <button type="button" class="library-inline-btn" data-approval-action="approve" data-powerbase-id="${escapeHtml(item.id)}">APPROVE</button>
              <button type="button" class="library-inline-btn" data-approval-action="reject" data-powerbase-id="${escapeHtml(item.id)}" style="color: var(--theme-accent-dim);">REJECT</button>
            </div>
          </article>
        `).join("") || '<p class="hub-empty">No pending approvals.</p>'}
      </div>
    `;
  }

  function option(value, label, selected) {
    return `<option value="${escapeHtml(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function overrideIsActive(item) {
    if (!item.active) return false;
    if (!item.expires_at) return true;
    return new Date(item.expires_at) > new Date();
  }

  function renderOverrides(overrides = []) {
    return `
      <div class="hub-panel-head">
        <h3 class="hub-panel-title">Permission Overrides</h3>
        <span class="hub-value">${escapeHtml(overrides.length)} total</span>
      </div>
      <form id="admin-override-form">
        <div class="resource-editor-field"><label>Roblox Username</label><input name="username" autocomplete="off" value="${escapeHtml(state.overrideUsername)}" required></div>
        <div class="resource-editor-field">
          <label>Scope Preset</label>
          <select name="scopePreset">${SCOPE_PRESETS.map(([value, label]) => option(value, label, "")).join("")}</select>
        </div>
        <div class="resource-editor-field">
          <label>Effect</label>
          <select name="effect">${option("grant", "Grant", "grant")}${option("revoke", "Revoke", "")}</select>
        </div>
        <div class="resource-editor-field">
          <label>Scope Type</label>
          <select name="scopeType">
            ${["capability", "page", "division", "library"].map(value => option(value, value, "capability")).join("")}
          </select>
        </div>
        <div class="resource-editor-field"><label>Scope Key</label><input name="scopeKey" placeholder="admin / personnel_lookup / reavers / codex" required></div>
        <div class="resource-editor-field"><label>Expires At</label><input type="datetime-local" name="expiresAt"></div>
        <div class="resource-editor-field"><label>Reason</label><textarea name="reason" required></textarea></div>
        <div class="resource-editor-actions">
          <span class="resource-editor-status" id="admin-override-status">Idle</span>
          <button type="submit" class="resource-editor-submit">Apply</button>
        </div>
      </form>
      <div class="hub-list">
        ${overrides.map(item => `
          <article class="hub-row">
            <strong>${escapeHtml(item.roblox_id)} / ${escapeHtml(item.effect)}</strong>
            <span>${escapeHtml(item.scope_type)} : ${escapeHtml(item.scope_key)} · ${overrideIsActive(item) ? "active" : "inactive"}</span>
            <p>${escapeHtml(item.reason || "")}</p>
            ${item.expires_at ? `<p>Expires ${escapeHtml(formatDate(item.expires_at))}</p>` : ""}
            <button type="button" class="hub-row-edit" data-override-delete="${escapeHtml(item.id)}">REMOVE OVERRIDE</button>
          </article>
        `).join("") || '<p class="hub-empty">No permission overrides recorded.</p>'}
      </div>
    `;
  }

  function activityUserLine(item = {}) {
    const meta = item.meta || {};
    const isClock = item.source === "clock" || String(item.type || "").startsWith("clock_");
    const isBot = item.source === "bot";
    if (!isClock && !isBot) return "";

    const userParts = [];
    if (meta.robloxUsername || meta.robloxUserId) {
      userParts.push(`Roblox ${meta.robloxUsername || meta.robloxUserId}`);
    }
    if (meta.discordUsername || meta.actorDiscordUsername || meta.discordUserId || meta.actorDiscordId) {
      userParts.push(`Discord ${meta.discordUsername || meta.actorDiscordUsername || meta.discordUserId || meta.actorDiscordId}`);
    }

    return `<p>User: ${escapeHtml(userParts.join(" · ") || "Unknown user")}</p>`;
  }

  function renderActivity(activity = {}) {
    const items = activity.items || [];
    return `
      <div class="hub-panel-head">
        <h3 class="hub-panel-title">Recent Activity</h3>
        <button type="button" class="hub-row-edit" data-activity-refresh>REFRESH</button>
      </div>
      <div class="admin-filter-row">
        <select data-activity-source>
          ${(activity.filters || ["all"]).map(value => option(value, value, state.activitySource)).join("")}
        </select>
        <span class="resource-editor-status">${escapeHtml(activity.totalApprox || 0)} item(s)</span>
      </div>
      ${items.length ? `<div class="hub-list admin-activity-list" data-activity-count="${escapeHtml(items.length)}">${items.map(item => `
        <article class="hub-row">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.source)} / ${escapeHtml(item.type)} / ${escapeHtml(item.scope || "global")}</span>
          ${activityUserLine(item)}
          <p>${escapeHtml(formatDate(item.at))}</p>
        </article>
      `).join("")}</div>` : '<p class="hub-empty">No recent activity recorded.</p>'}
      <div class="admin-page-controls">
        <button type="button" class="library-inline-btn" data-activity-prev ${activity.page <= 1 ? "disabled" : ""}>PREV</button>
        <span class="resource-editor-status">PAGE ${escapeHtml(activity.page || 1)}</span>
        <button type="button" class="library-inline-btn" data-activity-next ${!activity.hasNext ? "disabled" : ""}>NEXT</button>
      </div>
    `;
  }

  async function loadActivity() {
    const params = new URLSearchParams({
      page: String(state.activityPage),
      pageSize: String(ACTIVITY_PAGE_SIZE),
      source: state.activitySource
    });
    return fetchJson(`/api/admin/activity?${params.toString()}`);
  }

  async function initAdmin() {
    const nodes = {
      approvals: document.getElementById("admin-approvals"),
      overrides: document.getElementById("admin-overrides"),
      activity: document.getElementById("admin-activity")
    };
    if (!nodes.approvals || !nodes.overrides || !nodes.activity) return;
    document.body.classList.add("holonet-admin-mobile");

    let overrides = [];
    let pendingApprovals = [];

    async function hydrate() {
      const [overview, overridesPayload, approvalsPayload] = await Promise.all([
        fetchJson("/api/admin/overview"),
        fetchJson("/api/admin/overrides"),
        fetchJson("/api/admin/powerbases/approvals").catch(() => ({ approvals: [] }))
      ]);

      overrides = overridesPayload.overrides || [];
      pendingApprovals = approvalsPayload.approvals || [];
      
      nodes.approvals.innerHTML = renderApprovals(pendingApprovals);
      nodes.activity.innerHTML = renderActivity(overview.activity);
      nodes.overrides.innerHTML = renderOverrides(overrides);
      bindControls();
    }

    async function refreshActivity() {
      const payload = await loadActivity();
      nodes.activity.innerHTML = renderActivity(payload.activity);
      bindControls();
    }

    function bindControls() {
      document.querySelectorAll("[data-admin-refresh]").forEach(button => button.addEventListener("click", hydrate));
      
      document.querySelectorAll("[data-approval-action]").forEach(button => {
        button.addEventListener("click", async event => {
          const action = event.target.getAttribute("data-approval-action");
          const powerbaseId = event.target.getAttribute("data-powerbase-id");
          const originalText = event.target.textContent;
          event.target.textContent = "...";
          event.target.disabled = true;

          try {
            await fetchJson(`/api/admin/powerbases/${action}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: powerbaseId })
            });
            await hydrate();
          } catch (error) {
            alert(error.message);
            event.target.textContent = originalText;
            event.target.disabled = false;
          }
        });
      });
      document.querySelector("[data-activity-refresh]")?.addEventListener("click", refreshActivity);
      document.querySelector("[data-activity-source]")?.addEventListener("change", async event => {
        state.activitySource = event.target.value || "all";
        state.activityPage = 1;
        await refreshActivity();
      });
      document.querySelector("[data-activity-prev]")?.addEventListener("click", async () => {
        state.activityPage = Math.max(1, state.activityPage - 1);
        await refreshActivity();
      });
      document.querySelector("[data-activity-next]")?.addEventListener("click", async () => {
        state.activityPage += 1;
        await refreshActivity();
      });

      const form = document.getElementById("admin-override-form");
      const status = document.getElementById("admin-override-status");

      form?.username?.addEventListener("input", () => {
        const nextUsername = form.username.value.trim();
        if (nextUsername !== state.overrideUsername) {
          state.lookupUser = null;
        }
        state.overrideUsername = nextUsername;
      });

      form?.scopePreset?.addEventListener("change", () => {
        const [scopeType, scopeKey] = String(form.scopePreset.value || "").split(":");
        if (!scopeType || !scopeKey) return;
        form.scopeType.value = scopeType;
        form.scopeKey.value = scopeKey;
      });

      form?.addEventListener("submit", async event => {
        event.preventDefault();
        status.textContent = "Applying...";
        try {
          state.overrideUsername = form.username.value.trim();
          const lookup = state.lookupUser?.robloxId && state.overrideUsername === form.username.value.trim()
            ? { user: state.lookupUser }
            : await fetchJson(`/api/personnel-lookup?username=${encodeURIComponent(form.username.value.trim())}`);
          await fetchJson("/api/admin/overrides", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              robloxId: lookup.user.robloxId,
              username: form.username.value.trim(),
              effect: form.effect.value,
              scopeType: form.scopeType.value,
              scopeKey: form.scopeKey.value,
              reason: form.reason.value,
              expiresAt: form.expiresAt.value ? new Date(form.expiresAt.value).toISOString() : null
            })
          });
          state.lookupUser = null;
          await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      });

      nodes.overrides.querySelectorAll("[data-override-delete]").forEach(button => {
        button.addEventListener("click", async () => {
          await fetchJson(`/api/admin/overrides?id=${encodeURIComponent(button.dataset.overrideDelete)}`, { method: "DELETE" });
          await hydrate();
        });
      });
    }

    await hydrate();
  }

  
window.initHolonetAdmin = initAdmin;
if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAdmin);
    } else {
      initAdmin();
    }
})();
