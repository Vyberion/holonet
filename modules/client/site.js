(function () {
  function loadNav() {
    const container = document.getElementById("nav-container");
    if (!container) return;

    fetch("/modules/html/nav.html")
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load nav: ${response.status}`);
        return response.text();
      })
      .then(html => {
        container.innerHTML = html;

        const script = document.createElement("script");
        script.src = "/js/nav.js";
        document.body.appendChild(script);
      })
      .catch(error => {
        console.error(error);
      });
  }

  function initLoader() {
    const loader = document.getElementById("loader");
    if (!loader) return;

    if (sessionStorage.getItem("loaderShown")) {
      loader.style.display = "none";
      return;
    }

    sessionStorage.setItem("loaderShown", "true");

    window.addEventListener("load", () => {
      setTimeout(() => {
        loader.classList.add("hidden");
      }, 2000);
    });
  }

  function initDirectoryCards() {
    document.querySelectorAll(".dir-card[data-href]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("a, button")) return;
        window.location.href = card.dataset.href;
      });
    });
  }

  window.HolonetSite = {
    loadNav,
    initLoader,
    boot() {
      initLoader();
      loadNav();
      initDirectoryCards();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", window.HolonetSite.boot);
  } else {
    window.HolonetSite.boot();
  }
})();
