import { isEmperorArchiveRobloxId } from "../auth/emperor-archive-access.js";

(function () {
  document.documentElement.style.background = "#050606";
  document.documentElement.classList.add("access-pending");

  const pendingStyle = document.createElement("style");
  pendingStyle.id = "access-pending-style";
  pendingStyle.textContent = `
    html.access-pending body > :not(#loader):not(script):not(style):not(link) {
      visibility: hidden !important;
    }
    html.access-pending #loader {
      visibility: visible !important;
    }
  `;
  document.head.appendChild(pendingStyle);

  function getPageKey() {
    const segments = location.pathname.split("/").filter(Boolean);

    if (segments.length > 0) {
      const lastIndex = segments.length - 1;
      segments[lastIndex] = segments[lastIndex].replace(".html", "");
    }

    const pageKey = (segments.join("_") || "home").replace(/-/g, "_");
    return pageKey === "reports" ? "nexus" : pageKey;
  }

  function isEmperorArchivePage() {
    const segments = location.pathname.split("/").filter(Boolean);
    return segments[0] === "archives" && segments[1] === "emperors";
  }

  function hasEmperorArchiveAccess(profile) {
    const roles = profile?.authorityRoles || {};
    return Boolean(
      profile?.isSuperUser ||
      roles.groupOwner ||
      roles.projectManager ||
      isEmperorArchiveRobloxId(profile?.robloxId)
    );
  }

  function rejectAccess(message, options = {}) {
    const styles = document.body ? getComputedStyle(document.body) : null;
    const accent = styles?.getPropertyValue("--theme-accent").trim() || "#ff0022";
    const accentDim = styles?.getPropertyValue("--theme-accent-dim").trim() || "#6b0010";
    const accentGlow = styles?.getPropertyValue("--theme-accent-glow").trim() || "rgba(192,0,26,0.3)";
    const bg = styles?.getPropertyValue("--theme-bg").trim() || "#060003";
    const text = styles?.getPropertyValue("--text").trim() || accent;

    const buttonStyle = `
      color: ${accent};
      text-decoration: none;
      border: 1px solid ${accentDim};
      padding: 10px 20px;
      font-size: 0.8rem;
      letter-spacing: 0.2em;
      transition: all 0.3s;
      background: transparent;
      font-family: 'Share Tech Mono', monospace;
      cursor: crosshair;
    `;

    document.documentElement.classList.remove("access-pending");
    pendingStyle.remove();
    document.body.innerHTML = `
      <div style="
        background: ${bg};
        color: ${text};
        font-family: 'Share Tech Mono', monospace;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 20px;
        box-shadow: inset 0 0 100px ${accentGlow};
      ">
        <h1 style="color:${accent}; font-family: 'Orbitron', sans-serif; font-size: 2rem; letter-spacing: 0.2em; text-shadow: 0 0 10px ${accentGlow};">[ RESTRICTED NODE ]</h1>
        <div style="width: 300px; height: 1px; background: ${accentDim}; margin: 20px 0;"></div>
        <p style="font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase;">${message}</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 30px;">
          <button type="button" id="restricted-go-back" style="${buttonStyle}" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">GO BACK</button>
          ${options.showAccount ? `<a href="/account" style="${buttonStyle}" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">MANAGE ACCOUNT</a>` : ""}
        </div>
      </div>
    `;

    document.getElementById("restricted-go-back")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = "/registry";
    });
  }

  function allowAccess(access) {
    try {
      sessionStorage.setItem("holonet:access:global", JSON.stringify(access));
    } catch {}
    document.documentElement.classList.remove("access-pending");
    pendingStyle.remove();
  }

  async function verifyEmperorArchiveAccess() {
    const response = await fetch("/api/auth/check-access");
    const access = await response.json();

    if (response.ok && access.authorized && hasEmperorArchiveAccess(access.profile)) {
      allowAccess(access);
      return;
    }

    const reason = access.reason || "EMPEROR_ARCHIVE_RESTRICTED";
    const showAccount = ["SESSION_MISSING", "SESSION_INVALID", "SESSION_EXPIRED", "SESSION_REQUIRED", "USER_NOT_FOUND"].includes(reason);
    rejectAccess(`ACCESS DENIED: ${reason.replace(/_/g, " ")}`, { showAccount });
  }

  async function verifyAccess() {
    try {
      if (isEmperorArchivePage()) {
        await verifyEmperorArchiveAccess();
        return;
      }

      const pageKey = getPageKey();
      const response = await fetch(`/api/auth/check-access?page=${encodeURIComponent(pageKey)}`);
      const access = await response.json();

      if (response.ok && access.authorized) {
        allowAccess(access);
        return;
      }

      const reason = access.reason || "INSUFFICIENT_CLEARANCE_LEVEL";
      const showAccount = ["SESSION_MISSING", "SESSION_INVALID", "SESSION_EXPIRED", "SESSION_REQUIRED", "USER_NOT_FOUND"].includes(reason);
      rejectAccess(`ACCESS DENIED: ${reason.replace(/_/g, " ")}`, { showAccount });
    } catch (error) {
      console.error("Security grid error:", error);
      rejectAccess("ACCESS DENIED");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", verifyAccess);
  } else {
    verifyAccess();
  }
})();
