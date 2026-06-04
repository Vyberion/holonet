(function () {
  // Hide content instantly while access token validations process
  document.documentElement.style.display = 'none';

  document.addEventListener("DOMContentLoaded", async () => {
    const deviceId = localStorage.getItem('sith_device_id');
    
    // Convert pathname into a distinct structured key: e.g., /index/reaver/reaver.html -> index_reaver_reaver
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastIndex = segments.length - 1;
      segments[lastIndex] = segments[lastIndex].replace('.html', '');
    }
    const pathKey = segments.join('_') || 'home';

    if (!deviceId) {
      rejectAccess("ACCESS DENIED");
      return;
    }

    try {
      const response = await fetch(`/api/auth/check-access?deviceId=${encodeURIComponent(deviceId)}&page=${encodeURIComponent(pathKey)}`);
      const access = await response.json();

      if (response.ok && access.authorized) {
        // Clearance granted, render page layout smoothly
        document.documentElement.style.display = '';
      } else {
        const clearReason = access.reason || "INSUFFICIENT CLEARANCE LEVEL";
        rejectAccess(`ACCESS DENIED: ${clearReason.replace(/_/g, ' ')}`);
      }
    } catch (e) {
      console.error("Security grid error:", e);
      rejectAccess("ACCESS DENIED");
    }
  });

  function rejectAccess(message) {
    // Replace the page with a stylized Sith Holonet termination screen
    document.documentElement.style.display = '';
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
        <a href="/account.html" style="
          margin-top: 30px; 
          color: #ff0022; 
          text-decoration: none; 
          border: 1px solid #6b0010; 
          padding: 10px 20px; 
          font-size: 0.8rem; 
          letter-spacing: 0.2em;
          transition: all 0.3s;
        " onmouseover="this.style.background='rgba(192,0,26,0.1)'" onmouseout="this.style.background='transparent'">MANAGE ACCOUNT</a>
      </div>
    `;
  }
})();