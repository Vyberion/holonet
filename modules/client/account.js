(function () {
  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setUnbound(id, isUnbound) {
    const element = document.getElementById(id);
    if (element) element.classList.toggle("unbound", isUnbound);
  }

  function friendlyDiscordLinkError(reason) {
    return {
      LOGIN_WITH_ROBLOX_FIRST: "Log in to the website with Roblox first, then link Discord.",
      SESSION_REQUIRED: "Log in to the website with Roblox first, then link Discord.",
      TOKEN_REQUIRED: "Discord verification link missing. Run /verify again.",
      LINK_TOKEN_NOT_FOUND: "Discord verification link not found. Run /verify again.",
      LINK_TOKEN_USED: "This Discord verification link was already used.",
      LINK_TOKEN_EXPIRED: "This Discord verification link expired. Run /verify again."
    }[reason] || String(reason || "DISCORD_LINK_FAILED").replace(/_/g, " ");
  }

  function clearCachedIdentity() {
    localStorage.removeItem("sith_roblox_id");
    localStorage.removeItem("sith_roblox_user");
    window.HolonetSite?.clearAllCanonPayloads?.();
    window.HolonetSite?.clearAccessPayload?.();
    window.dispatchEvent(new CustomEvent("holonet:access-updated", { detail: null }));
  }

  function updateUiBound(robloxId, username) {
    const button = document.getElementById("bind-btn");

    localStorage.setItem("sith_roblox_id", robloxId);
    localStorage.setItem("sith_roblox_user", username);
    window.HolonetSite?.clearAllCanonPayloads?.();
    window.HolonetSite?.clearAccessPayload?.();
    window.dispatchEvent(new CustomEvent("holonet:access-updated", { detail: null }));

    setText("auth-status", "ACTIVE");
    setText("roblox-id", robloxId);
    setText("roblox-user", `@${username}`);

    ["auth-status", "session-id", "roblox-id", "roblox-user"].forEach(id => setUnbound(id, false));

    if (button) {
      button.textContent = "TERMINATE SESSION";
      button.onclick = async () => {
        button.disabled = true;

        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
          console.error("Failed terminating security session:", error);
        }

        clearCachedIdentity();
        updateUiUnbound();
      };
    }
  }

  async function confirmDiscordLink(token) {
    const status = document.getElementById("discord-link-status");
    const button = document.getElementById("discord-link-btn");
    if (!token) return;

    if (button) {
      button.disabled = true;
      button.hidden = true;
    }
    if (status) status.textContent = "Linking Discord identity...";

    try {
      const response = await fetch("/api/discord-link/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(friendlyDiscordLinkError(payload.reason || payload.error));
      }

      sessionStorage.removeItem("holonet:discord-link-token");
      if (status) status.textContent = `Discord linked to @${payload.robloxUsername}. Return to Discord and run /update-roles.`;
      if (button) button.textContent = "LINKED";
    } catch (error) {
      if (status) status.textContent = error.message.replace(/_/g, " ");
      if (button) button.disabled = false;
    }
  }

  function updateUiUnbound() {
    const button = document.getElementById("bind-btn");

    setText("auth-status", "UNBOUND");
    setText("roblox-id", "NULL");
    setText("roblox-user", "NULL");

    ["auth-status", "session-id", "roblox-id", "roblox-user"].forEach(id => setUnbound(id, true));

    if (button) {
      button.disabled = false;
      button.textContent = "LOG IN";
      button.onclick = () => {
        window.HolonetSite?.clearAccessPayload?.();
        window.location.href = "/api/auth/login";
      };
    }
  }

  async function fetchSessionStatus() {
    try {
      const response = await fetch("/api/auth/check-status");
      const data = await response.json();

      if (response.ok && data.bound) {
        updateUiBound(data.robloxId, data.robloxUsername);
      } else {
        clearCachedIdentity();
        updateUiUnbound();
      }
    } catch (error) {
      console.error("Failed looking up security clearance session:", error);
      updateUiUnbound();
    }
  }

  async function initAccount() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const errorMessage = urlParams.get("msg");
    const incomingDiscordLink = urlParams.get("discordLink");
    if (incomingDiscordLink) sessionStorage.setItem("holonet:discord-link-token", incomingDiscordLink);
    const discordLink = incomingDiscordLink || sessionStorage.getItem("holonet:discord-link-token");
    const discordBox = document.getElementById("discord-link-box");
    const discordButton = document.getElementById("discord-link-btn");

    if (status === "error") {
      alert(`Matrix Error: ${errorMessage || "Authorization Rejected"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (status === "success") {
      window.HolonetSite?.clearAllCanonPayloads?.();
      window.HolonetSite?.clearAccessPayload?.();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await fetchSessionStatus();

    if (discordLink && discordBox) {
      discordBox.hidden = false;
      if (discordButton) {
        discordButton.hidden = true;
        discordButton.disabled = true;
      }

      const loggedIn = localStorage.getItem("sith_roblox_id");
      if (!loggedIn) {
        const statusNode = document.getElementById("discord-link-status");
        if (statusNode) statusNode.textContent = "Log in to the website with Roblox first. Discord will link automatically after login.";
      } else {
        await confirmDiscordLink(discordLink);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();