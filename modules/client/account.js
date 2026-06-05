(function () {
  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setUnbound(id, isUnbound) {
    const element = document.getElementById(id);
    if (element) element.classList.toggle("unbound", isUnbound);
  }

  function clearCachedIdentity() {
    localStorage.removeItem("sith_roblox_id");
    localStorage.removeItem("sith_roblox_user");
  }

  function updateUiBound(robloxId, username) {
    const button = document.getElementById("bind-btn");

    localStorage.setItem("sith_roblox_id", robloxId);
    localStorage.setItem("sith_roblox_user", username);

    setText("auth-status", "SECURE LINK ACTIVE");
    setText("session-id", "SERVER COOKIE");
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

  function updateUiUnbound() {
    const button = document.getElementById("bind-btn");

    setText("auth-status", "UNBOUND");
    setText("session-id", "NULL");
    setText("roblox-id", "NULL");
    setText("roblox-user", "NULL");

    ["auth-status", "session-id", "roblox-id", "roblox-user"].forEach(id => setUnbound(id, true));

    if (button) {
      button.disabled = false;
      button.textContent = "LOG IN";
      button.onclick = () => {
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

    if (status === "error") {
      alert(`Matrix Error: ${errorMessage || "Authorization Rejected"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (status === "success") {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await fetchSessionStatus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
