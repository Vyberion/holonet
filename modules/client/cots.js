function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeImage(image = {}) {
  return {
    bucket: text(image.bucket),
    path: text(image.path),
    url: text(image.url)
  };
}

function defaultState(root) {
  return parseJson(root?.dataset?.cotsState || "{}", {
    champion: { name: "", title: "", motto: "", season: "", podiumImage: {} },
    podium: [],
    bracket: [],
    losersBracket: [],
    grandFinals: []
  });
}

function normalizeState(value, fallback) {
  const state = value && typeof value === "object" ? value : {};
  const champion = state.champion && typeof state.champion === "object" ? state.champion : {};
  const fallbackChampion = fallback.champion || {};

  return {
    champion: {
      name: text(champion.name, fallbackChampion.name),
      title: text(champion.title, fallbackChampion.title),
      motto: text(champion.motto, fallbackChampion.motto),
      season: text(champion.season, fallbackChampion.season),
      podiumImage: normalizeImage(champion.podiumImage || fallbackChampion.podiumImage)
    },
    podium: Array.isArray(state.podium) && state.podium.length ? state.podium.slice(0, 3) : fallback.podium || [],
    bracket: Array.isArray(state.bracket) ? state.bracket : fallback.bracket || [],
    losersBracket: Array.isArray(state.losersBracket) ? state.losersBracket : fallback.losersBracket || [],
    grandFinals: Array.isArray(state.grandFinals) ? state.grandFinals : fallback.grandFinals || []
  };
}

function derivePodium(state) {
  let first = null;
  let second = null;
  let third = null;

  if (state.grandFinals && state.grandFinals.length > 0) {
    const gfLastRound = state.grandFinals[state.grandFinals.length - 1];
    if (gfLastRound.matches && gfLastRound.matches.length > 0) {
      const gfMatch = gfLastRound.matches[gfLastRound.matches.length - 1];
      if (gfMatch.winner) {
        first = gfMatch.winner;
        second = gfMatch.left === gfMatch.winner ? gfMatch.right : gfMatch.left;
      }
    }
  } else if (state.bracket && state.bracket.length > 0) {
    const wLastRound = state.bracket[state.bracket.length - 1];
    if (wLastRound.matches && wLastRound.matches.length > 0) {
      const wMatch = wLastRound.matches[wLastRound.matches.length - 1];
      if (wMatch.winner) {
        first = wMatch.winner;
        second = wMatch.left === wMatch.winner ? wMatch.right : wMatch.left;
      }
    }
  }

  if (state.losersBracket && state.losersBracket.length > 0) {
    const lLastRound = state.losersBracket[state.losersBracket.length - 1];
    if (lLastRound.matches && lLastRound.matches.length > 0) {
      const lMatch = lLastRound.matches[lLastRound.matches.length - 1];
      if (lMatch.winner) {
        third = lMatch.left === lMatch.winner ? lMatch.right : lMatch.left;
      }
    }
  }

  state.podium = [
    { place: "I", name: first || "", note: "Champion" },
    { place: "II", name: second || "", note: "Finalist" },
    { place: "III", name: third || "", note: "Podium" }
  ];
}

function autoResolveBrackets(state) {
  const hasLosers = state.losersBracket && state.losersBracket.length > 0;
  
  if (state.bracket) {
    const totalWinners = state.bracket.length;
    state.bracket.forEach((round, roundIndex) => {
      const distanceToEnd = totalWinners - 1 - roundIndex;
      if (distanceToEnd === 0) round.name = hasLosers ? "Winners Final" : "Grand Finals";
      else if (distanceToEnd === 1) round.name = "Semi Finals";
      else if (distanceToEnd === 2) round.name = "Quarter Finals";
      else if (roundIndex === 0) round.name = "Opening Duels";
      else round.name = \`Round of \${Math.max(1, (round.matches || []).length) * 2}\`;
      
      (round.matches || []).forEach((match, matchIndex) => { match.id = \`W\${roundIndex + 1}-\${matchIndex + 1}\`; });
    });
  }

  if (state.losersBracket) {
    const totalLosers = state.losersBracket.length;
    state.losersBracket.forEach((round, roundIndex) => {
      const distanceToEnd = totalLosers - 1 - roundIndex;
      if (distanceToEnd === 0) round.name = "Losers Final";
      else if (distanceToEnd === 1) round.name = "Losers Semi Finals";
      else if (distanceToEnd === 2) round.name = "Losers Quarter Finals";
      else if (roundIndex === 0) round.name = "Losers Opening Duels";
      else round.name = \`Losers Round of \${Math.max(1, (round.matches || []).length) * 2}\`;
      
      (round.matches || []).forEach((match, matchIndex) => { match.id = \`L\${roundIndex + 1}-\${matchIndex + 1}\`; });
    });
  }

  if (state.grandFinals) {
    state.grandFinals.forEach((round, roundIndex) => {
      round.name = "Grand Finals";
      (round.matches || []).forEach((match, matchIndex) => { match.id = \`GF-\${matchIndex + 1}\`; });
    });
  }
}

function podiumRow(entry, index) {
  return `
    <div class="cots-podium-row">
      <span>${escapeHtml(entry.place || ["I", "II", "III"][index] || index + 1)}</span>
      <strong>${escapeHtml(entry.name || "Awaiting victor")}</strong>
      <em>${escapeHtml(entry.note || "")}</em>
    </div>
  `;
}

function competitor(name, winner) {
  return `
    <div class="cots-bracket-competitor${winner ? " is-winner" : ""}">
      <span>${escapeHtml(name || "TBD")}</span>
      ${winner ? '<b aria-label="Winner">WIN</b>' : ""}
    </div>
  `;
}

function matchCard(match, matchIndex, roundSize, laneHeight) {
  const topPercent = ((matchIndex + 0.5) / Math.max(1, roundSize)) * 100;
  const pairLineHeight = laneHeight / Math.max(1, roundSize);

  return `
    <article
      class="cots-bracket-match"
      role="listitem"
      style="--match-top: ${topPercent}%; --pair-line-height: ${pairLineHeight}px;"
    >
      <div class="cots-match-code">${escapeHtml(match.id || "")}</div>
      ${competitor(match.left, match.winner && match.winner === match.left)}
      ${competitor(match.right, match.winner && match.winner === match.right)}
      <div class="cots-match-footer">
        <span>Score</span>
        <strong>${escapeHtml(match.score || "-")}</strong>
      </div>
    </article>
  `;
}

function roundMarkup(round, roundIndex, rounds) {
  const roundSize = Math.max(1, (round.matches || []).length);
  const previousSize = roundIndex > 0 ? Math.max(1, (rounds[roundIndex - 1]?.matches || []).length) : 0;
  const largestRoundSize = Math.max(1, ...rounds.map(item => (item.matches || []).length));
  const laneHeight = Math.max(720, largestRoundSize * 178);

  return `
    <section
      class="cots-bracket-round"
      aria-label="${escapeHtml(round.name || "Round")}"
      style="--round-size: ${roundSize}; --previous-round-size: ${previousSize}; --bracket-lane-height: ${laneHeight}px;"
    >
      <h4>${escapeHtml(round.name || "Round")}</h4>
      <div class="cots-bracket-stack">
        ${(round.matches || []).map((match, matchIndex) => matchCard(match, matchIndex, roundSize, laneHeight)).join("")}
      </div>
    </section>
  `;
}

function renderCots(root, state, canEdit, meta = {}) {
  autoResolveBrackets(state);
  derivePodium(state);

  const image = normalizeImage(state.champion.podiumImage);
  root.innerHTML = `
    <section class="cots-hero" aria-labelledby="cots-title">
      <div class="cots-hero-copy">
        <p class="hub-kicker">Current Champion</p>
        <h2 id="cots-title" class="cots-title">\${escapeHtml(state.champion.name || "Awaiting Champion")}</h2>
        <p class="cots-quote">&quot;\${escapeHtml(state.champion.motto || "")}&quot;</p>
      </div>
      <div class="cots-hero-stats" aria-label="Champion status">
        <div>
          <span class="hub-label">Title</span>
          <strong>\${escapeHtml(state.champion.title || "Unrecorded")}</strong>
        </div>
        <div>
          <span class="hub-label">Season</span>
          <strong>\${escapeHtml(state.champion.season || "Unrecorded")}</strong>
        </div>
      </div>
      \${canEdit ? '<button type="button" class="resource-editor-open cots-edit-button" data-cots-edit>Edit CoTS</button>' : ""}
    </section>

    <section class="cots-feature-grid" aria-label="Champion imagery and podium">
      <figure class="cots-media-card\${image.url ? "" : " cots-media-card--empty"}">
        <div class="cots-media-frame">
          \${image.url
            ? \`<img src="\${escapeHtml(image.url)}" alt="Champion of The Sith podium">\`
            : \`<div class="cots-media-placeholder"><span>Podium Image</span></div>\`}
        </div>
      </figure>

      <div class="hub-panel cots-podium-panel">
        <h3 class="hub-panel-title">Podium</h3>
        <div class="cots-podium-list">
          \${(state.podium || []).slice(0, 3).map(podiumRow).join("")}
        </div>
      </div>
    </section>

    <section class="hub-panel cots-bracket-panel" aria-label="Tournament bracket">
      <div class="hub-panel-head">
        <h3 class="hub-panel-title">Tournament Bracket</h3>
      </div>
      \${(state.bracket || []).length ? \`
        <h4 class="hub-kicker" style="margin: 20px 20px 0;">Winners Bracket</h4>
        <div class="cots-bracket" role="list">
          \${state.bracket.map(roundMarkup).join("")}
        </div>
      \` : ""}
      \${(state.losersBracket || []).length ? \`
        <h4 class="hub-kicker" style="margin: 20px 20px 0;">Losers Bracket</h4>
        <div class="cots-bracket" role="list">
          \${state.losersBracket.map(roundMarkup).join("")}
        </div>
      \` : ""}
      \${(state.grandFinals || []).length ? \`
        <h4 class="hub-kicker" style="margin: 20px 20px 0;">Grand Finals</h4>
        <div class="cots-bracket" role="list">
          \${state.grandFinals.map(roundMarkup).join("")}
        </div>
      \` : ""}
      \${!(state.bracket?.length) && !(state.losersBracket?.length) && !(state.grandFinals?.length) ? \`
        <p class="hub-empty" style="margin: 20px;">Bracket is empty.</p>
      \` : ""}
    </section>
  \`;
}

function ensureEditorOverlay() {
  let overlay = document.getElementById("cots-editor-overlay");
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.id = "cots-editor-overlay";
  overlay.innerHTML = `
    <div class="resource-editor-container library-editor-container cots-editor-container" role="dialog" aria-modal="true" aria-labelledby="cots-editor-title">
      <div class="resource-editor-topbar">
        <span class="resource-editor-title" id="cots-editor-title">EDIT CHAMPION OF THE SITH</span>
        <button type="button" class="resource-editor-close" data-cots-close>CLOSE</button>
      </div>
      <form class="resource-editor-form library-editor-form" id="cots-editor-form"></form>
      <div class="resource-editor-actions">
        <span class="resource-editor-status" data-cots-status></span>
        <button type="submit" class="resource-editor-submit" form="cots-editor-form">SAVE</button>
      </div>
      <div class="resource-editor-footer">
        <span class="resource-editor-hint"><kbd>ESC</kbd> CLOSE</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("[data-cots-close]").addEventListener("click", () => overlay.classList.remove("active"));
  overlay.addEventListener("pointerup", event => {
    if (event.target === overlay) overlay.classList.remove("active");
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") overlay.classList.remove("active");
  });
  return overlay;
}

function matchEditor(bracketPrefix, round, roundIndex, match, matchIndex) {
  const prefix = \`\${bracketPrefix}-round-\${roundIndex}-match-\${matchIndex}\`;
  return \`
    <section class="cots-match-editor" data-cots-match="\${bracketPrefix}:\${roundIndex}:\${matchIndex}">
      <div class="library-entry-toolbar">
        <span class="library-entry-title">Match \${matchIndex + 1}</span>
        <button type="button" class="library-inline-btn danger" data-cots-remove-match="\${bracketPrefix}:\${roundIndex}:\${matchIndex}">REMOVE MATCH</button>
      </div>
      <div class="cots-editor-grid" style="grid-template-columns: repeat(4, minmax(0, 1fr));">
        <div class="resource-editor-field"><label>Left</label><input name="\${prefix}-left" value="\${escapeHtml(match.left || "")}"></div>
        <div class="resource-editor-field"><label>Right</label><input name="\${prefix}-right" value="\${escapeHtml(match.right || "")}"></div>
        <div class="resource-editor-field"><label>Winner</label><input name="\${prefix}-winner" value="\${escapeHtml(match.winner || "")}"></div>
        <div class="resource-editor-field"><label>Score</label><input name="\${prefix}-score" value="\${escapeHtml(match.score || "")}"></div>
      </div>
    </section>
  \`;
}

function roundEditor(bracketPrefix, roundTitle, round, roundIndex) {
  return \`
    <section class="library-entry-editor cots-round-editor" data-cots-round="\${bracketPrefix}:\${roundIndex}">
      <div class="library-entry-toolbar">
        <span class="library-entry-title">\${escapeHtml(roundTitle)} Round \${roundIndex + 1}</span>
        <button type="button" class="library-inline-btn danger" data-cots-remove-round="\${bracketPrefix}:\${roundIndex}">REMOVE ROUND</button>
      </div>
      <div class="cots-match-editor-stack">
        \${(round.matches || []).map((match, matchIndex) => matchEditor(bracketPrefix, round, roundIndex, match, matchIndex)).join("")}
      </div>
      <div class="library-editor-buttons cots-inline-buttons">
        <button type="button" class="library-inline-btn" data-cots-add-match="\${bracketPrefix}:\${roundIndex}">ADD MATCH</button>
      </div>
    </section>
  \`;
}

function syncStateFromForm(form, workingState) {
  const data = Object.fromEntries(new FormData(form).entries());
  workingState.champion = {
    ...workingState.champion,
    name: text(data.championName),
    title: text(data.championTitle),
    motto: text(data.championMotto),
    season: text(data.championSeason)
  };
  
  const parseBracket = (arr, prefix) => {
    return (arr || []).map((round, roundIndex) => ({
      name: round.name,
      matches: (round.matches || []).map((match, matchIndex) => ({
        id: match.id,
        left: text(data[`${prefix}-round-${roundIndex}-match-${matchIndex}-left`], match.left),
        right: text(data[`${prefix}-round-${roundIndex}-match-${matchIndex}-right`], match.right),
        winner: text(data[`${prefix}-round-${roundIndex}-match-${matchIndex}-winner`], match.winner),
        score: text(data[`${prefix}-round-${roundIndex}-match-${matchIndex}-score`], match.score)
      }))
    }));
  };

  workingState.bracket = parseBracket(workingState.bracket, "w");
  workingState.losersBracket = parseBracket(workingState.losersBracket, "l");
  workingState.grandFinals = parseBracket(workingState.grandFinals, "gf");
}

function renderEditorForm(form, state) {
  form.innerHTML = `
    <div class="library-entry-stack">
      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Champion</span></div>
        <div class="resource-editor-field"><label>Champion Username</label><input name="championName" value="${escapeHtml(state.champion.name || "")}" required></div>
        <div class="resource-editor-field"><label>Champion Title</label><input name="championTitle" value="${escapeHtml(state.champion.title || "")}"></div>
        <div class="resource-editor-field"><label>Motto</label><input name="championMotto" value="${escapeHtml(state.champion.motto || "")}"></div>
        <div class="resource-editor-field"><label>Season</label><input name="championSeason" value="${escapeHtml(state.champion.season || "")}"></div>
        <div class="resource-editor-field"><label>Podium Image</label><input type="file" name="podiumImage" accept="image/*"></div>
      </section>

      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Winners Bracket</span></div>
        <div class="cots-round-editor-stack">
          ${(state.bracket || []).map((r, i) => roundEditor("w", "Winners", r, i)).join("")}
        </div>
        <div class="library-editor-buttons cots-inline-buttons">
          <button type="button" class="library-inline-btn" data-cots-add-round="w">ADD ROUND</button>
        </div>
      </section>

      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Losers Bracket</span></div>
        <div class="cots-round-editor-stack">
          ${(state.losersBracket || []).map((r, i) => roundEditor("l", "Losers", r, i)).join("")}
        </div>
        <div class="library-editor-buttons cots-inline-buttons">
          <button type="button" class="library-inline-btn" data-cots-add-round="l">ADD ROUND</button>
        </div>
      </section>

      <section class="library-entry-editor">
        <div class="library-entry-toolbar"><span class="library-entry-title">Grand Finals</span></div>
        <div class="cots-round-editor-stack">
          ${(state.grandFinals || []).map((r, i) => roundEditor("gf", "Grand Finals", r, i)).join("")}
        </div>
        <div class="library-editor-buttons cots-inline-buttons">
          <button type="button" class="library-inline-btn" data-cots-add-round="gf">ADD ROUND</button>
        </div>
      </section>
    </div>
  `;
}

async function saveCotsState(state, form) {
  const body = new FormData();
  body.set("payload", JSON.stringify(state));

  const image = form.podiumImage?.files?.[0];
  if (image) body.set("podiumImage", image);

  const response = await fetch("/api/cots", {
    method: "POST",
    body
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.reason || payload.error || "SAVE_FAILED");
  }
  return payload;
}

async function initCots() {
  const root = document.querySelector("[data-cots-root]");
  if (!root || root.dataset.cotsBound === "true") return;
  root.dataset.cotsBound = "true";

  const fallback = normalizeState(defaultState(root), { champion: {}, podium: [], bracket: [] });
  let state = fallback;
  let canEdit = false;
  let meta = {};

  renderCots(root, state, canEdit, meta);

  try {
    const response = await fetch("/api/cots", { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      state = normalizeState(payload.state, fallback);
      canEdit = Boolean(payload.canEdit);
      meta = { migrationRequired: Boolean(payload.migrationRequired) };
      renderCots(root, state, canEdit, meta);
    }
  } catch (error) {
    console.warn("CoTS payload unavailable:", error);
  }

  root.addEventListener("click", event => {
    if (!event.target.closest("[data-cots-edit]")) return;

    const overlay = ensureEditorOverlay();
    const form = overlay.querySelector("#cots-editor-form");
    const status = overlay.querySelector("[data-cots-status]");
    const workingState = normalizeState(JSON.parse(JSON.stringify(state)), fallback);

    renderEditorForm(form, workingState);
    status.textContent = meta.migrationRequired ? "Migration required before saving" : "";
    overlay.classList.add("active");

    form.onclick = event => {
      const removeRound = event.target.closest("[data-cots-remove-round]");
      const addRound = event.target.closest("[data-cots-add-round]");
      const removeMatch = event.target.closest("[data-cots-remove-match]");
      const addMatch = event.target.closest("[data-cots-add-match]");

      if (!removeRound && !addRound && !removeMatch && !addMatch) return;
      syncStateFromForm(form, workingState);

      const getBracketArray = (prefix) => {
        if (prefix === "l") return workingState.losersBracket;
        if (prefix === "gf") return workingState.grandFinals;
        return workingState.bracket;
      };

      if (removeRound) {
        const [prefix, roundIndex] = removeRound.dataset.cotsRemoveRound.split(":");
        getBracketArray(prefix).splice(Number(roundIndex), 1);
      } else if (addRound) {
        const prefix = addRound.dataset.cotsAddRound;
        getBracketArray(prefix).push({ name: "", matches: [] });
      } else if (removeMatch) {
        const [prefix, roundIndex, matchIndex] = removeMatch.dataset.cotsRemoveMatch.split(":");
        getBracketArray(prefix)[Number(roundIndex)]?.matches?.splice(Number(matchIndex), 1);
      } else if (addMatch) {
        const [prefix, roundIndex] = addMatch.dataset.cotsAddMatch.split(":");
        getBracketArray(prefix)[Number(roundIndex)]?.matches?.push({ id: "", left: "", right: "", winner: "", score: "" });
      }

      renderEditorForm(form, workingState);
    };

    form.onsubmit = async event => {
      event.preventDefault();
      syncStateFromForm(form, workingState);
      status.textContent = "Saving...";

      try {
        const payload = await saveCotsState(workingState, form);
        state = normalizeState(payload.state, fallback);
        meta = { migrationRequired: false };
        renderCots(root, state, canEdit, meta);
        status.textContent = "Saved";
        setTimeout(() => overlay.classList.remove("active"), 250);
      } catch (error) {
        status.textContent = error.message.replace(/_/g, " ");
      }
    };
  });
}

window.initHolonetCots = initCots;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCots);
  } else {
    initCots();
  }
