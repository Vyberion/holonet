(function () {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function renderRow(label, value) {
    return `
      <div class="personnel-row">
        <span class="personnel-label">${escapeHtml(label)}</span>
        <span class="personnel-value">${value}</span>
      </div>
    `;
  }

  function renderBlock(title, rows, emptyText = "No data available.") {
    return `
      <section class="personnel-block">
        <h3 class="personnel-block-title">${escapeHtml(title)}</h3>
        ${rows.length ? rows.join("") : `<p class="personnel-empty">${escapeHtml(emptyText)}</p>`}
      </section>
    `;
  }

  async function initPersonnel() {
    const form = document.getElementById("personnel-form");
    const status = document.getElementById("personnel-status");
    const results = document.getElementById("personnel-results");
    if (!form || !status || !results) return;

    async function runLookup(username) {
      if (!username) return;

      form.username.value = username;
      status.textContent = "Querying";

      try {
        const response = await fetch("/api/personnel-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.reason || payload.error || "LOOKUP_FAILED");
        }

        const warnings = Array.isArray(payload.user.warnings) ? payload.user.warnings : [];
        const mainGroup = payload.user.mainGroup;
        const divisionMemberships = Array.isArray(payload.user.divisionMemberships) ? payload.user.divisionMemberships : [];
        const accountAge = payload.user.accountAgeDays === null || payload.user.accountAgeDays === undefined
          ? "Unknown"
          : `${escapeHtml(payload.user.accountAgeDays)} day${payload.user.accountAgeDays === 1 ? "" : "s"}`;

        const warningBlock = warnings.length ? `
          <section class="personnel-warning">
            <h3 class="personnel-block-title">Warnings</h3>
            <div class="personnel-warning-list">
              ${warnings.map(item => `
                <article class="personnel-warning-item">
                  <strong>${escapeHtml(item.label)}</strong>
                  <p>${escapeHtml(item.detail)}</p>
                </article>
              `).join("")}
            </div>
          </section>
        ` : "";

        const identityRows = [
          renderRow("Username", `@${escapeHtml(payload.user.username)}`),
          renderRow("Display Name", escapeHtml(payload.user.displayName || payload.user.username)),
          renderRow("Roblox ID", escapeHtml(payload.user.robloxId)),
          renderRow("Created", escapeHtml(payload.user.created ? new Date(payload.user.created).toLocaleString() : "Unknown")),
          renderRow("Account Age", escapeHtml(accountAge)),
          renderRow("Friends", escapeHtml(payload.user.friendsCount ?? "Unknown")),
          renderRow("Profile", `<a class="personnel-link" href="${escapeHtml(payload.user.profileUrl)}" target="_blank" rel="noopener noreferrer">Open Roblox Profile</a>`)
        ];

        const mainGroupRows = [
          renderRow("MAIN GROUP", mainGroup.inGroup ? `${escapeHtml(mainGroup.rankName)} (${escapeHtml(mainGroup.rank)})` : "Not in group"),
          ...(mainGroup.joinedAt ? [renderRow("Joined", escapeHtml(new Date(mainGroup.joinedAt).toLocaleString()))] : [])
        ];

        const divisionRows = divisionMemberships.length
          ? divisionMemberships.map(item => renderRow(
            item.label,
            `${escapeHtml(item.rankName)} (${escapeHtml(item.rank)})${item.joinedAt ? ` / Joined ${escapeHtml(new Date(item.joinedAt).toLocaleString())}` : ""}`
          ))
          : [];

        results.innerHTML = [
          warningBlock,
          renderBlock("Identity", identityRows),
          renderBlock("Groups", [...mainGroupRows, ...divisionRows], "No group memberships recorded.")
        ].join("");

        status.textContent = "Record Ready";
      } catch (error) {
        results.innerHTML = `<p class="personnel-empty">${escapeHtml(error.message.replace(/_/g, " "))}</p>`;
        status.textContent = "Lookup Failed";
      }
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      await runLookup(form.username.value.trim());
    });

    const queryUsername = new URLSearchParams(window.location.search).get("username");
    if (queryUsername) await runLookup(queryUsername.trim());
  }

  if (document.readyState === "loading") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initPersonnel);
    } else {
      initPersonnel();
    }
  } else {
    initPersonnel();
  }
})();
