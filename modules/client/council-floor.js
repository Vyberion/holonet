function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function proposalTypeLabel(type) {
  return {
    legislation: "Legislation",
    motion: "Motion",
    councillor_election: "Councillor Election"
  }[type] || "Motion";
}

async function fetchCouncilPayload() {
  const response = await fetch("/api/council-floor");
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "COUNCIL_FLOOR_UNAVAILABLE");
  }
  return payload;
}

async function sendCouncilAction(data) {
  const response = await fetch("/api/council-floor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "COUNCIL_ACTION_FAILED");
  }
  return payload;
}

function renderRoleSnapshot(snapshot) {
  const roles = snapshot?.snapshot || [];
  if (!roles.length) return `<p class="hub-empty">Council roster sync unavailable.</p>`;

  return `<div class="hub-status-grid council-status-grid">${roles.map(role => `
    <div class="hub-status-cell">
      <span class="hub-label">${escapeHtml(role.name || role.key)}</span>
      <span class="hub-value">${escapeHtml(role.memberCount ?? 0)}</span>
    </div>
  `).join("")}</div>`;
}

function renderVotes(votes = []) {
  if (!votes.length) return `<p class="hub-empty">No votes cast.</p>`;

  return `<div class="council-vote-list">${votes.map(vote => `
    <div class="council-vote-row">
      <span>${escapeHtml(vote.robloxUsername || vote.robloxId)}</span>
      <strong data-vote="${escapeHtml(vote.vote)}">${escapeHtml(vote.vote)}</strong>
      <span>${escapeHtml(vote.voterRole || "Authority")}</span>
    </div>
  `).join("")}</div>`;
}

function renderResultPanel(proposal) {
  const counts = proposal.counts || {};
  const yes = Number(counts.yes || 0);
  const no = Number(counts.no || 0);
  const abstain = Number(counts.abstain || 0);
  const majority = Number(proposal.majorityCount || 0);
  const progress = majority ? Math.min(100, Math.round((yes / majority) * 100)) : 0;

  return `
    <div class="council-result-panel" aria-label="Council vote results">
      <div class="council-result-meter">
        <span style="width:${progress}%"></span>
      </div>
      <div class="council-result-grid">
        <div><span class="hub-label">Yes</span><strong>${escapeHtml(yes)}</strong></div>
        <div><span class="hub-label">No</span><strong>${escapeHtml(no)}</strong></div>
        <div><span class="hub-label">Abstain</span><strong>${escapeHtml(abstain)}</strong></div>
        <div><span class="hub-label">Majority</span><strong>${escapeHtml(majority)}</strong></div>
      </div>
    </div>
  `;
}

function renderCloseMeta(proposal) {
  if (proposal.status === "open") {
    return `<span>Closes ${escapeHtml(formatDate(proposal.closesAt))}</span>`;
  }

  const closedAt = proposal.vetoedAt || proposal.updatedAt || proposal.closesAt;
  return `<span>Closed ${escapeHtml(formatDate(closedAt))}</span>`;
}

function renderProposal(proposal, permissions) {
  const open = proposal.status === "open";
  const canVote = permissions.canVote && open;
  const canVeto = permissions.canVeto && open;
  const canReopen = permissions.canReopen && !open;

  return `
    <article class="hub-panel council-proposal" data-proposal-id="${escapeHtml(proposal.id)}">
      <div class="council-proposal-head">
        <div>
          <span class="hub-kicker">${escapeHtml(proposalTypeLabel(proposal.proposalType))}</span>
          <h3 class="hub-panel-title">${escapeHtml(proposal.title)}</h3>
        </div>
        <span class="council-status council-status--${escapeHtml(proposal.status)}">${escapeHtml(proposal.status)}</span>
      </div>
      <p class="hub-summary">${escapeHtml(proposal.body)}</p>
      <div class="council-proposal-meta">
        <span>Opened ${escapeHtml(formatDate(proposal.opensAt))}</span>
        ${renderCloseMeta(proposal)}
        <span>Majority ${escapeHtml(proposal.majorityCount)} / ${escapeHtml(proposal.countingEligibleCount)}</span>
      </div>
      ${proposal.authors && proposal.authors.length ? `<p class="hub-summary council-authors"><strong>Authors:</strong> ${escapeHtml(proposal.authors.join(", "))}</p>` : ""}
      ${proposal.coAuthors && proposal.coAuthors.length ? `<p class="hub-summary council-authors"><strong>Co-Authors:</strong> ${escapeHtml(proposal.coAuthors.join(", "))}</p>` : ""}
      ${proposal.parentBillId ? `<p class="hub-summary council-amendment"><em>Amendment Iteration: ${escapeHtml(proposal.amendmentIteration)}</em></p>` : ""}
      ${renderResultPanel(proposal)}
      <div class="council-actions">
        ${canVote ? `
          <button type="button" class="resource-editor-open" data-council-vote="yes">YES</button>
          <button type="button" class="resource-editor-open" data-council-vote="no">NO</button>
          <button type="button" class="resource-editor-open" data-council-vote="abstain">ABSTAIN</button>
        ` : ""}
        ${canVeto ? `<button type="button" class="library-inline-btn danger" data-council-veto>VETO</button>` : ""}
        ${canReopen ? `
          <select class="council-reopen-select" data-council-reopen-duration aria-label="Reopen duration">
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
          <button type="button" class="resource-editor-open" data-council-reopen>REOPEN</button>
        ` : ""}
        ${!open && permissions.canVote ? `<button type="button" class="resource-editor-open" data-council-amend>AMEND</button>` : ""}
      </div>
      ${proposal.vetoedBy ? `<p class="hub-empty">Vetoed by ${escapeHtml(proposal.vetoedByName || proposal.vetoedBy)}${proposal.vetoReason ? `: ${escapeHtml(proposal.vetoReason)}` : ""}</p>` : ""}
      ${renderVotes(proposal.votes || [])}
    </article>
  `;
}

function ensureProposalOverlay() {
  let overlay = document.getElementById("council-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "council-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container" role="dialog" aria-modal="true" aria-labelledby="council-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="council-editor-title">PROPOSE MOTION</span>
        <button type="button" class="resource-editor-close" data-council-close>CLOSE</button>
      </div>
      <form class="resource-editor-form" id="council-editor-form">
        <input type="hidden" name="proposalId" id="council-editor-parent-id">
        <input type="hidden" name="amendmentIteration" id="council-editor-amend-iter">
        <div class="resource-editor-field">
          <label>Type</label>
          <select name="proposalType">
            <option value="legislation">Legislation</option>
            <option value="motion">Motion</option>
            <option value="councillor_election">Councillor Election</option>
          </select>
        </div>
        <div class="resource-editor-field">
          <label>Title</label>
          <input name="title" required>
        </div>
        <div class="resource-editor-field">
          <label>Authors (comma separated)</label>
          <input name="authors">
        </div>
        <div class="resource-editor-field">
          <label>Co-Authors (comma separated)</label>
          <input name="coAuthors">
        </div>
        <div class="resource-editor-field">
          <label>Body</label>
          <textarea name="body" required style="min-height: 200px;"></textarea>
        </div>

        <div class="resource-editor-field">
          <label>Duration</label>
          <select name="durationHours">
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-council-status></span>
        <button type="submit" class="resource-editor-submit" form="council-editor-form">OPEN VOTE</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("[data-council-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("click", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  return overlay;
}

function renderCouncil(mount, payload) {
  const permissions = payload.permissions || {};
  mount.innerHTML = `
    <section class="hub-shell council-floor-shell">
      <div class="hub-hero council-floor-hero">
        <div class="hub-identity">
          <div>
            <span class="hub-kicker">Dark Council / Legislative Channel</span>
            <h2 class="hub-title">Council Floor</h2>
          </div>
          <div>
            <span class="hub-kicker">Your Role</span>
            <span class="hub-value">${escapeHtml(permissions.role || "Observer")}</span>
          </div>
        </div>
        <p class="hub-summary">Motions, legislation and councillor elections are proposed, voted and archived here.</p>
        ${renderRoleSnapshot(payload.roleSnapshot)}
        ${payload.migrationRequired ? `<p class="hub-empty">Council database tables have not been installed.</p>` : ""}
        ${permissions.canPropose ? `<button type="button" class="resource-editor-open" data-council-new>PROPOSE</button>` : ""}
      </div>
      <div class="council-proposal-stack">
        ${(payload.proposals || []).length
          ? payload.proposals.map(proposal => renderProposal(proposal, permissions)).join("")
          : `<p class="hub-empty">No council proposals recorded.</p>`}
      </div>
    </section>
  `;
}

async function initCouncilFloor() {
  const mount = document.querySelector("[data-council-floor]");
  if (!mount || mount.dataset.councilBound === "true") return;
  mount.dataset.councilBound = "true";
  let hydrating = false;
  let latestPayload = null;

  function applyActionPayload(actionPayload) {
    if (!latestPayload) return false;
    latestPayload = {
      ...latestPayload,
      ...actionPayload,
      proposals: actionPayload.proposals || latestPayload.proposals
    };
    renderCouncil(mount, latestPayload);
    return true;
  }

  async function hydrate({ preserveOnError = false } = {}) {
    if (hydrating) return;
    hydrating = true;
    try {
      const payload = await fetchCouncilPayload();
      latestPayload = payload;
      renderCouncil(mount, payload);
    } catch (error) {
      if (!preserveOnError) {
        mount.innerHTML = `<p class="hub-empty">${escapeHtml(error.message.replace(/_/g, " "))}</p>`;
      }
    } finally {
      hydrating = false;
    }
  }

  mount.addEventListener("click", async event => {
    const proposal = event.target.closest("[data-proposal-id]");
    const newButton = event.target.closest("[data-council-new]");
    if (newButton) {
      const overlay = ensureProposalOverlay();
      const form = overlay.querySelector("#council-editor-form");
      const status = overlay.querySelector("[data-council-status]");
      status.textContent = "";
      form.reset();
      form.elements.proposalId.value = "";
      form.elements.amendmentIteration.value = "0";

      form.onsubmit = async submitEvent => {
        submitEvent.preventDefault();
        status.textContent = "Opening vote...";
        try {
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());

          const payload = await sendCouncilAction({ action: "create", ...data });
          overlay.classList.remove("active");
          if (!applyActionPayload(payload)) await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      };
      overlay.classList.add("active");
      return;
    }

    if (!proposal) return;

    const amendButton = event.target.closest("[data-council-amend]");
    if (amendButton) {
      const propData = latestPayload.proposals.find(p => p.id === proposal.dataset.proposalId);
      if (!propData) return;

      const overlay = ensureProposalOverlay();
      const form = overlay.querySelector("#council-editor-form");
      const status = overlay.querySelector("[data-council-status]");
      status.textContent = "";
      form.reset();

      // Populate fields
      form.elements.proposalId.value = propData.id;
      form.elements.amendmentIteration.value = (propData.amendmentIteration || 0) + 1;
      form.elements.proposalType.value = propData.proposalType || "legislation";
      form.elements.title.value = propData.title;
      form.elements.body.value = propData.body;
      form.elements.authors.value = (propData.authors || []).join(", ");
      form.elements.coAuthors.value = (propData.coAuthors || []).join(", ");


      form.onsubmit = async submitEvent => {
        submitEvent.preventDefault();
        status.textContent = "Opening vote...";
        try {
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());

          const payload = await sendCouncilAction({ action: "amend", ...data });
          overlay.classList.remove("active");
          if (!applyActionPayload(payload)) await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      };
      overlay.classList.add("active");
      return;
    }

    const voteButton = event.target.closest("[data-council-vote]");
    if (voteButton) {
      const payload = await sendCouncilAction({
        action: "vote",
        proposalId: proposal.dataset.proposalId,
        vote: voteButton.dataset.councilVote
      });
      applyActionPayload(payload);
      return;
    }

    const vetoButton = event.target.closest("[data-council-veto]");
    if (vetoButton) {
      const reason = prompt("Veto reason") || "";
      const payload = await sendCouncilAction({ action: "veto", proposalId: proposal.dataset.proposalId, reason });
      if (!applyActionPayload(payload)) await hydrate();
      return;
    }

    const reopenButton = event.target.closest("[data-council-reopen]");
    if (reopenButton) {
      const duration = proposal.querySelector("[data-council-reopen-duration]")?.value || "24";
      const payload = await sendCouncilAction({ action: "reopen", proposalId: proposal.dataset.proposalId, durationHours: duration });
      if (!applyActionPayload(payload)) await hydrate();
    }
  });

  await hydrate();

  const liveRefresh = window.setInterval(() => {
    const proposalOverlay = document.getElementById("council-editor-overlay");
    if (document.hidden || proposalOverlay?.classList.contains("active")) return;
    hydrate({ preserveOnError: true });
  }, 15000);

  window.addEventListener("pagehide", () => window.clearInterval(liveRefresh), { once: true });
}

window.initHolonetCouncilFloor = initCouncilFloor;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCouncilFloor);
  } else {
    initCouncilFloor();
  }
