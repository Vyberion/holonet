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
  if (proposal.status === "docket") {
    return `<span>Tabled for Upcoming Council Meeting</span>`;
  }
  if (proposal.status === "open") {
    return `<span>Closes ${escapeHtml(formatDate(proposal.closesAt))}</span>`;
  }

  const closedAt = proposal.vetoedAt || proposal.updatedAt || proposal.closesAt;
  return `<span>Closed ${escapeHtml(formatDate(closedAt))}</span>`;
}

function renderProposal(proposal, permissions) {
  const isDocket = proposal.status === "docket";
  const open = proposal.status === "open";
  const canVote = permissions.canVote && open;
  const canVeto = permissions.canVeto && open;
  const canReopen = permissions.canReopen && !open && !isDocket;

  return `
    <article class="hub-panel council-proposal" data-proposal-id="${escapeHtml(proposal.id)}">
      <div class="council-proposal-head">
        <div>
          <span class="hub-kicker">${escapeHtml(proposalTypeLabel(proposal.proposalType))} &bull; ${escapeHtml(proposal.id?.slice(0, 8))}</span>
          <h3 class="hub-panel-title">${escapeHtml(proposal.title)}</h3>
        </div>
        <span class="council-status council-status--${escapeHtml(proposal.status)}">${isDocket ? "TABLED ON DOCKET" : escapeHtml(proposal.status.toUpperCase())}</span>
      </div>
      <p class="hub-summary">${escapeHtml(proposal.body)}</p>
      <div class="council-proposal-meta">
        <span>Created ${escapeHtml(formatDate(proposal.createdAt || proposal.opensAt))}</span>
        ${renderCloseMeta(proposal)}
        ${!isDocket ? `<span>Majority ${escapeHtml(proposal.majorityCount)} / ${escapeHtml(proposal.countingEligibleCount)}</span>` : ""}
      </div>
      ${proposal.authors && proposal.authors.length ? `<p class="hub-summary council-authors"><strong>Authors:</strong> ${escapeHtml(proposal.authors.join(", "))}</p>` : ""}
      ${proposal.coAuthors && proposal.coAuthors.length ? `<p class="hub-summary council-authors"><strong>Co-Authors:</strong> ${escapeHtml(proposal.coAuthors.join(", "))}</p>` : ""}
      ${proposal.parentBillId ? `<p class="hub-summary council-amendment"><em>Amendment Iteration: ${escapeHtml(proposal.amendmentIteration)}</em></p>` : ""}
      
      ${!isDocket ? renderResultPanel(proposal) : ""}

      <div class="council-actions">
        ${isDocket && permissions.canPropose ? `
          <button type="button" class="hub-write-btn" data-council-promote="${escapeHtml(proposal.id)}">OPEN TO FLOOR &rarr;</button>
        ` : ""}
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
        ${!open && !isDocket && permissions.canVote ? `<button type="button" class="resource-editor-open" data-council-amend>AMEND</button>` : ""}
      </div>
      ${proposal.vetoedBy ? `<p class="hub-empty">Vetoed by ${escapeHtml(proposal.vetoedByName || proposal.vetoedBy)}${proposal.vetoReason ? `: ${escapeHtml(proposal.vetoReason)}` : ""}</p>` : ""}
      ${!isDocket ? renderVotes(proposal.votes || []) : ""}
    </article>
  `;
}

function ensureProposalOverlay() {
  let overlay = document.getElementById("council-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "council-editor-overlay";
  overlay.className = "codex-modal-backdrop";
  overlay.innerHTML = `
    <div class="codex-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="council-editor-title" style="width: min(780px, calc(100vw - 32px)); max-width: 780px; margin: auto;">
      <div class="codex-modal-header">
        <h2 style="font-family: Cinzel, serif; font-size: 1.2rem; color: var(--theme-accent, var(--red-bright)); margin: 0; letter-spacing: 0.15em; text-shadow: 0 0 6px rgba(255,0,34,0.55);" id="council-editor-title">CREATE COUNCIL PROPOSAL</h2>
        <button type="button" class="codex-modal-close" data-council-close>&times;</button>
      </div>
      <form class="codex-modal-body" id="council-editor-form" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.2rem;">
        <input type="hidden" name="proposalId" id="council-editor-parent-id">
        <input type="hidden" name="amendmentIteration" id="council-editor-amend-iter">
        
        <div class="codex-modal-grid-2">
          <div>
            <label class="codex-label">TARGET STAGE</label>
            <select class="codex-select" name="targetStatus">
              <option value="docket">Add to Council Docket (Upcoming Meeting)</option>
              <option value="open">Open Directly to Council Floor</option>
            </select>
          </div>
          <div>
            <label class="codex-label">PROPOSAL TYPE</label>
            <select class="codex-select" name="proposalType">
              <option value="legislation">Legislation</option>
              <option value="motion">Motion</option>
              <option value="councillor_election">Councillor Election</option>
            </select>
          </div>
        </div>

        <div>
          <label class="codex-label">MOTION TITLE</label>
          <input class="codex-input" name="title" placeholder="E.G. STATUTE OF INQUISITORIAL JURISDICTION" required>
        </div>

        <div class="codex-modal-grid-2">
          <div>
            <label class="codex-label">AUTHORS (COMMA SEPARATED)</label>
            <input class="codex-input" name="authors" placeholder="Darth ...">
          </div>
          <div>
            <label class="codex-label">CO-AUTHORS (COMMA SEPARATED)</label>
            <input class="codex-input" name="coAuthors" placeholder="Lord ...">
          </div>
        </div>

        <div>
          <label class="codex-label">PROPOSAL TEXT & LEGISLATIVE BODY</label>
          <textarea class="codex-textarea" name="body" rows="8" placeholder="Inscribe the complete text of the proposed statute or motion..." required></textarea>
        </div>

        <div>
          <label class="codex-label">FLOOR VOTING DURATION</label>
          <select class="codex-select" name="durationHours">
            <option value="24">24 hours</option>
            <option value="48" selected>48 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </form>
      <div class="codex-modal-footer" style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding: 1.2rem 1.5rem;">
        <span class="resource-editor-status" data-council-status style="color: var(--text-dim); margin-right: 1rem;"></span>
        <button type="button" class="hub-cancel-btn" data-council-close>CANCEL</button>
        <button type="submit" class="hub-write-btn" form="council-editor-form">SUBMIT PROPOSAL</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeProposal = () => {
    overlay.classList.remove("active");
    document.body.classList.remove("editor-overlay-active");
  };

  overlay.querySelectorAll("[data-council-close]").forEach(btn => {
    btn.addEventListener("click", closeProposal);
  });
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeProposal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeProposal();
  });
  return overlay;
}

function renderCouncil(mount, payload) {
  const permissions = payload.permissions || {};
  const currentTab = mount.dataset.councilTab || "docket";
  const proposals = payload.proposals || [];

  const docketItems = proposals.filter(p => p.status === "docket");
  const floorItems = proposals.filter(p => p.status === "open");
  const decreeItems = proposals.filter(p => ["passed", "failed", "vetoed"].includes(p.status));

  let displayItems = proposals;
  if (currentTab === "docket") displayItems = docketItems;
  if (currentTab === "floor") displayItems = floorItems;
  if (currentTab === "decrees") displayItems = decreeItems;

  mount.innerHTML = `
    <section class="hub-shell council-floor-shell" style="max-width: 1100px; margin: 0 auto; padding-bottom: 4rem;">
      <div class="hub-hero council-floor-hero">
        <div class="hub-identity" style="display: flex; justify-content: space-between; align-items: flex-end; flexWrap: wrap; gap: 1rem;">
          <div>
            <span class="hub-kicker">// DARK COUNCIL • THE COUNCIL FLOOR</span>
            <h1 class="hub-title" style="font-family: Cinzel, serif; font-size: 1.8rem; color: var(--red-bright); margin: 0.2rem 0;">
              The Council Floor
            </h1>
            <p style="color: var(--text-dim); font-family: Share Tech Mono, monospace; font-size: 0.85rem; margin: 0;">
              The legislative body of the Sith Order.
            </p>
          </div>
          <div>
            <span class="hub-kicker">Authority Status</span>
            <span class="hub-value">${escapeHtml(permissions.role || "Observer")}</span>
          </div>
        </div>

        ${renderRoleSnapshot(payload.roleSnapshot)}
        ${payload.migrationRequired ? `<p class="hub-empty">Council database tables have not been installed.</p>` : ""}

        <!-- Council Sub-navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
          <button
            type="button"
            class="hub-tab-btn ${currentTab === "docket" ? "active" : ""}"
            data-council-switch-tab="docket"
            style="background: ${currentTab === "docket" ? "rgba(192,0,26,0.2)" : "rgba(0,0,0,0.4)"}; border: 1px solid ${currentTab === "docket" ? "var(--red-bright)" : "var(--border-hot)"}; color: ${currentTab === "docket" ? "var(--red-bright)" : "var(--text-dim)"}; padding: 0.4rem 0.9rem; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; cursor: pointer;"
          >
            THE COUNCIL DOCKET (${docketItems.length})
          </button>
          <button
            type="button"
            class="hub-tab-btn ${currentTab === "floor" ? "active" : ""}"
            data-council-switch-tab="floor"
            style="background: ${currentTab === "floor" ? "rgba(192,0,26,0.2)" : "rgba(0,0,0,0.4)"}; border: 1px solid ${currentTab === "floor" ? "var(--red-bright)" : "var(--border-hot)"}; color: ${currentTab === "floor" ? "var(--red-bright)" : "var(--text-dim)"}; padding: 0.4rem 0.9rem; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; cursor: pointer;"
          >
            THE COUNCIL FLOOR (${floorItems.length})
          </button>
          <button
            type="button"
            class="hub-tab-btn ${currentTab === "decrees" ? "active" : ""}"
            data-council-switch-tab="decrees"
            style="background: ${currentTab === "decrees" ? "rgba(192,0,26,0.2)" : "rgba(0,0,0,0.4)"}; border: 1px solid ${currentTab === "decrees" ? "var(--red-bright)" : "var(--border-hot)"}; color: ${currentTab === "decrees" ? "var(--red-bright)" : "var(--text-dim)"}; padding: 0.4rem 0.9rem; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; cursor: pointer;"
          >
            IMPERIAL DECREES (${decreeItems.length})
          </button>
          <button
            type="button"
            class="hub-tab-btn ${currentTab === "all" ? "active" : ""}"
            data-council-switch-tab="all"
            style="background: ${currentTab === "all" ? "rgba(192,0,26,0.2)" : "rgba(0,0,0,0.4)"}; border: 1px solid ${currentTab === "all" ? "var(--red-bright)" : "var(--border-hot)"}; color: ${currentTab === "all" ? "var(--red-bright)" : "var(--text-dim)"}; padding: 0.4rem 0.9rem; font-family: 'Share Tech Mono', monospace; font-size: 0.8rem; cursor: pointer;"
          >
            ALL MATTERS (${proposals.length})
          </button>

          ${permissions.canPropose ? `
            <button type="button" class="hub-write-btn" data-council-new style="margin-left: auto; padding: 0.4rem 1.1rem; font-size: 0.8rem;">
              INSCRIBE PROPOSAL
            </button>
          ` : ""}
        </div>
      </div>

      <div class="council-proposal-stack" style="margin-top: 2rem;">
        ${displayItems.length
      ? displayItems.map(proposal => renderProposal(proposal, permissions)).join("")
      : `<div style="text-align: center; padding: 4rem 1rem; border: 1px dashed var(--border-hot); background: rgba(192,0,26,0.02); font-family: 'Share Tech Mono', monospace; color: var(--text-dim);">NO COUNCIL PROPOSALS RECORDED UNDER THIS CATEGORY.</div>`}
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
    // Tab switching
    const tabButton = event.target.closest("[data-council-switch-tab]");
    if (tabButton) {
      const targetTab = tabButton.dataset.councilSwitchTab;
      if (targetTab === "decrees") {
        window.location.href = "/decrees";
        return;
      }
      mount.dataset.councilTab = targetTab;
      if (latestPayload) renderCouncil(mount, latestPayload);
      return;
    }

    // Promote docket item to floor
    const promoteBtn = event.target.closest("[data-council-promote]");
    if (promoteBtn) {
      const proposalId = promoteBtn.dataset.councilPromote;
      if (!window.confirm("Open this proposal from the Council Docket to the active Council Floor for voting?")) return;
      try {
        const payload = await sendCouncilAction({ action: "promote_floor", proposalId, durationHours: 48 });
        mount.dataset.councilTab = "floor";
        if (!applyActionPayload(payload)) await hydrate();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

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
        status.textContent = "Submitting proposal...";
        try {
          const formData = new FormData(form);
          const data = Object.fromEntries(formData.entries());

          const payload = await sendCouncilAction({ action: "create", ...data });
          overlay.classList.remove("active");
          document.body.classList.remove("editor-overlay-active");
          if (data.targetStatus === "docket") {
            mount.dataset.councilTab = "docket";
          } else {
            mount.dataset.councilTab = "floor";
          }
          if (!applyActionPayload(payload)) await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      };
      overlay.classList.add("active");
      document.body.classList.add("editor-overlay-active");
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
          document.body.classList.remove("editor-overlay-active");
          if (!applyActionPayload(payload)) await hydrate();
        } catch (error) {
          status.textContent = error.message.replace(/_/g, " ");
        }
      };
      overlay.classList.add("active");
      document.body.classList.add("editor-overlay-active");
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
