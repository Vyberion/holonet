(function () {
  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem("sith_device_id");

    if (!deviceId) {
      deviceId = `DEV-${crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase()}`;
      localStorage.setItem("sith_device_id", deviceId);
    }

    return deviceId;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setUnbound(id, isUnbound) {
    const element = document.getElementById(id);
    if (element) element.classList.toggle("unbound", isUnbound);
  }

  function updateUiBound(robloxId, username) {
    const button = document.getElementById("bind-btn");

    setText("auth-status", "SECURE LINK ACTIVE");
    setText("roblox-id", robloxId);
    setText("roblox-user", `@${username}`);

    ["auth-status", "roblox-id", "roblox-user"].forEach(id => setUnbound(id, false));

    if (button) {
      button.textContent = "TERMINATE SESSION";
      button.onclick = () => {
        localStorage.removeItem("sith_roblox_id");
        localStorage.removeItem("sith_roblox_user");
        location.reload();
      };
    }
  }

  function updateUiUnbound(deviceId) {
    const button = document.getElementById("bind-btn");

    setText("auth-status", "UNBOUND");
    setText("roblox-id", "NULL");
    setText("roblox-user", "NULL");

    ["auth-status", "roblox-id", "roblox-user"].forEach(id => setUnbound(id, true));

    if (button) {
      button.textContent = "LOG IN";
      button.onclick = () => {
        window.location.href = `/api/auth/login?deviceId=${encodeURIComponent(deviceId)}`;
      };
    }
  }

  async function fetchDatabaseVerificationStatus(deviceId) {
    try {
      const response = await fetch(`/api/auth/check-status?deviceId=${encodeURIComponent(deviceId)}`);
      const data = await response.json();

      if (response.ok && data.bound) {
        localStorage.setItem("sith_roblox_id", data.robloxId);
        localStorage.setItem("sith_roblox_user", data.robloxUsername);
        updateUiBound(data.robloxId, data.robloxUsername);
      } else {
        localStorage.removeItem("sith_roblox_id");
        localStorage.removeItem("sith_roblox_user");
        updateUiUnbound(deviceId);
      }
    } catch (error) {
      console.error("Failed looking up security clearance mapping status:", error);

      const cachedId = localStorage.getItem("sith_roblox_id");
      const cachedUser = localStorage.getItem("sith_roblox_user");

      if (cachedId && cachedUser) updateUiBound(cachedId, cachedUser);
      else updateUiUnbound(deviceId);
    }
  }

  async function initAccount() {
    const deviceId = getOrCreateDeviceId();
    setText("device-id", deviceId);

    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const robloxId = urlParams.get("rblx");
    const username = urlParams.get("user");
    const errorMessage = urlParams.get("msg");

    if (status === "success" && robloxId && username) {
      localStorage.setItem("sith_roblox_id", robloxId);
      localStorage.setItem("sith_roblox_user", username);
      window.history.replaceState({}, document.title, window.location.pathname);
      updateUiBound(robloxId, username);
      return;
    }

    if (status === "error") {
      alert(`Matrix Error: ${errorMessage || "Authorization Rejected"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await fetchDatabaseVerificationStatus(deviceId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
