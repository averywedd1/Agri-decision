(function () {
  const WEATHER_KEY = "agriWeatherContext";
  const BASIS_KEY = "agriBasisContext";

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function data() {
    return typeof getFormData === "function" ? getFormData() : {};
  }

  function installStyles() {
    if (byId("agri-context-style")) return;
    const style = document.createElement("style");
    style.id = "agri-context-style";
    style.textContent = `
      .regional-context-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
        max-width: 1040px;
        margin: 0 auto 22px;
      }
      .regional-context-card {
        display: grid;
        gap: 12px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .regional-context-card h3 {
        margin: 0;
      }
      .regional-context-card small,
      .context-muted {
        color: var(--muted);
      }
      .context-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .context-pill {
        display: inline-flex;
        padding: 5px 9px;
        border-radius: 999px;
        background: #eef4ec;
        color: var(--green-800);
        font-size: 12px;
        font-weight: 800;
      }
      .context-table {
        width: 100%;
        min-width: 0;
      }
      .context-table th,
      .context-table td {
        padding: 8px 0;
      }
      .pwa-install-card {
        display: none;
        max-width: 1040px;
        margin: 0 auto 18px;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .pwa-install-card.visible {
        display: flex;
      }
      @media (max-width: 820px) {
        .regional-context-grid { grid-template-columns: 1fr; }
        .pwa-install-card.visible { display: grid; }
      }
    `;
    document.head.appendChild(style);
  }

  function installManifestAndServiceWorker() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.webmanifest";
      document.head.appendChild(manifest);
    }
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.content = "#1a3318";

    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }

  function installPwaPrompt() {
    if (byId("pwa-install-card")) return;
    const dataSection = byId("data-entry");
    if (!dataSection) return;
    const card = document.createElement("div");
    card.className = "pwa-install-card";
    card.id = "pwa-install-card";
    card.innerHTML = `
      <span><strong>Use AgriDecision from the cab.</strong> Install it on your phone and reopen saved browser drafts even with spotty service.</span>
      <button class="ghost-btn" type="button" id="pwa-install-btn">Install App</button>
    `;
    dataSection.insertBefore(card, dataSection.querySelector(".settings-bar"));

    let deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      deferredPrompt = event;
      card.classList.add("visible");
    });
    byId("pwa-install-btn")?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
      card.classList.remove("visible");
    });
  }

  function installContextPanel() {
    if (byId("regional-context-grid")) return;
    const dataSection = byId("data-entry");
    const form = byId("farm-form");
    if (!dataSection || !form) return;
    const grid = document.createElement("div");
    grid.className = "regional-context-grid";
    grid.id = "regional-context-grid";
    grid.innerHTML = `
      <article class="regional-context-card">
        <div>
          <div class="section-kicker">Weather + Regional Context</div>
          <h3>Seasonal field outlook</h3>
          <small id="weather-source">Uses the state/region entered below.</small>
        </div>
        <div id="weather-context-body" class="context-muted">Enter a state or region to load a local weather context.</div>
        <button class="ghost-btn" type="button" id="refresh-weather-context">Refresh Weather</button>
      </article>
      <article class="regional-context-card">
        <div>
          <div class="section-kicker">Local Basis + Cash Prices</div>
          <h3>Marketing context</h3>
          <small id="basis-source">Uses commodities and region from the workspace.</small>
        </div>
        <div id="basis-context-body" class="context-muted">Enter commodities and a region to estimate cash-price context.</div>
        <button class="ghost-btn" type="button" id="refresh-basis-context">Refresh Basis</button>
      </article>
    `;
    form.parentElement?.insertBefore(grid, form);
    byId("refresh-weather-context")?.addEventListener("click", () => refreshWeather(true));
    byId("refresh-basis-context")?.addEventListener("click", () => refreshBasis(true));
  }

  function renderWeather(payload) {
    const body = byId("weather-context-body");
    const source = byId("weather-source");
    if (!body) return;
    if (!payload?.ok) {
      body.innerHTML = `<p>${esc(payload?.error || "Weather context is unavailable right now.")}</p>`;
      return;
    }
    localStorage.setItem(WEATHER_KEY, JSON.stringify(payload));
    if (source) source.textContent = `${payload.source || "NWS forecast"} for ${payload.location || payload.region || "selected region"}.`;
    body.innerHTML = `
      <div class="context-pill-row">
        <span class="context-pill">${esc(payload.plantingWindow || "Seasonal window pending")}</span>
        <span class="context-pill">${esc(payload.riskLevel || "Watch local conditions")}</span>
      </div>
      <p>${esc(payload.summary || "Use local field conditions before planting or spraying.")}</p>
      <table class="context-table">
        <tbody>
          ${(payload.periods || []).slice(0, 3).map(period => `
            <tr><td><strong>${esc(period.name)}</strong></td><td>${esc(period.forecast)}</td></tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderBasis(payload) {
    const body = byId("basis-context-body");
    const source = byId("basis-source");
    if (!body) return;
    if (!payload?.ok) {
      body.innerHTML = `<p>${esc(payload?.error || "Basis context is unavailable right now.")}</p>`;
      return;
    }
    localStorage.setItem(BASIS_KEY, JSON.stringify(payload));
    if (source) source.textContent = payload.source || "Regional basis context";
    body.innerHTML = `
      <table class="context-table">
        <thead><tr><th>Commodity</th><th>Basis</th><th>Cash Context</th></tr></thead>
        <tbody>
          ${(payload.rows || []).map(row => `
            <tr>
              <td>${esc(row.commodity)}</td>
              <td>${esc(row.basis)}</td>
              <td>${esc(row.cashPrice || row.note || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <p class="context-muted">${esc(payload.note || "Verify cash bids with local elevators before marketing grain.")}</p>
    `;
  }

  async function refreshWeather(force = false) {
    const form = data();
    const region = form.state || "";
    if (!region.trim()) return;
    const body = byId("weather-context-body");
    if (body && force) body.textContent = "Refreshing weather context...";
    try {
      const response = await fetch(`/api/weather?region=${encodeURIComponent(region)}&commodities=${encodeURIComponent(form.commodities || "")}`);
      renderWeather(await response.json());
    } catch {
      renderWeather({ ok: false, error: "Weather context could not load. Check connection and try again." });
    }
  }

  async function refreshBasis(force = false) {
    const form = data();
    const region = form.state || "";
    const commodities = form.commodities || "";
    if (!region.trim() && !commodities.trim()) return;
    const body = byId("basis-context-body");
    if (body && force) body.textContent = "Refreshing local basis context...";
    try {
      const response = await fetch(`/api/basis?region=${encodeURIComponent(region)}&commodities=${encodeURIComponent(commodities)}`);
      renderBasis(await response.json());
    } catch {
      renderBasis({ ok: false, error: "Basis context could not load. Check connection and try again." });
    }
  }

  function patchAiContext() {
    if (typeof buildContext !== "function" || buildContext.isRegionalContextPatch) return;
    const base = buildContext;
    buildContext = function (farmData) {
      const weather = localStorage.getItem(WEATHER_KEY) || "";
      const basis = localStorage.getItem(BASIS_KEY) || "";
      return `${base(farmData)}

Weather and regional context:
${weather}

Local basis and cash-price context:
${basis}`.trim();
    };
    buildContext.isRegionalContextPatch = true;
  }

  function bindInputs() {
    let refreshTimer = null;
    const queueRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshWeather(false);
        refreshBasis(false);
      }, 650);
    };
    document.querySelectorAll("#state, #commodities, #farm-type").forEach(input => {
      if (input.dataset.regionalContextBound === "true") return;
      input.dataset.regionalContextBound = "true";
      input.addEventListener("change", queueRefresh);
      input.addEventListener("input", queueRefresh);
    });
  }

  function install() {
    installStyles();
    installManifestAndServiceWorker();
    installPwaPrompt();
    installContextPanel();
    patchAiContext();
    bindInputs();
    refreshWeather(false);
    refreshBasis(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 700);
  setTimeout(install, 1800);
}());
