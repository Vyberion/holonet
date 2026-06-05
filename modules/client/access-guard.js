(function () {
  document.documentElement.style.background = "#0e0000";
  document.documentElement.style.visibility = "hidden";

  function getPageKey() {
    const segments = location.pathname.split("/").filter(Boolean);

    if (segments.length > 0) {
      const lastIndex = segments.length - 1;
      segments[lastIndex] = segments[lastIndex].replace(".html", "");
    }

    return segments.join("_") || "home";
  }

  function rejectAccess(message, options = {}) {
    const buttonStyle = `
      color: #ff0022;
      text-decoration: none;
      border: 1px solid #6b0010;
      padding: 10px 20px;
      font-size: 0.8rem;
      letter-spacing: 0.2em;
      transition: all 0.3s;
      background: transparent;
      font-family: 'Share Tech Mono', monospace;
      cursor: crosshair;
    `;

    document.documentElement.style.visibility = "";
    document.body.innerHTML = `
      <div style="
        background: #060003;
        color: #ff0022;
        font-family: 'Share Tech Mono', monospace;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        padding: 20px;
        box-shadow: inset 0 0 100px rgba(192,0,26,0.3);
      ">
        <h1 style="font-family: 'Orbitron', sans-serif; font-size: 2rem; letter-spacing: 0.2em; text-shadow: 0 0 10px #ff0022;">[ RESTRICTED NODE ]</h1>
        <div style="width: 300px; height: 1px; background: #6b0010; margin: 20px 0;"></div>
        <p style="font-size: 0.9rem; letter-spacing: 0.1em; text-transform: uppercase;">${message}</p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 30px;">
          <button type="button" id="restricted-go-back" style="${buttonStyle}" onmouseover="this.style.background='rgba(192,0,26,0.1)'" onmouseout="this.style.background='transparent'">GO BACK</button>
          ${options.showAccount ? `<a href="/account.html" style="${buttonStyle}" onmouseover="this.style.background='rgba(192,0,26,0.1)'" onmouseout="this.style.background='transparent'">MANAGE ACCOUNT</a>` : ""}
        </div>
      </div>
    `;

    document.getElementById("restricted-go-back")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else window.location.href = "/registry.html";
    });
  }

  async function verifyAccess() {
    try {
      const pageKey = getPageKey();
      const response = await fetch(`/api/auth/check-access?page=${encodeURIComponent(pageKey)}`);
      const access = await response.json();

      if (response.ok && access.authorized) {
        document.documentElement.style.visibility = "";
        return;
      }

      const reason = access.reason || "INSUFFICIENT_CLEARANCE_LEVEL";
      const showAccount = ["SESSION_MISSING", "SESSION_INVALID", "SESSION_EXPIRED", "USER_NOT_FOUND"].includes(reason);
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
