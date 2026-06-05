(function () {
  const WEATHER_KEY = "agriWeatherContext";
  const BASIS_KEY = "agriBasisContext";
  const POLYGON_KEY = "agridecisionFieldPolygons";
  const STATE_POINTS = {
    alabama: [32.8067, -86.7911], alaska: [61.3707, -152.4044], arizona: [33.7298, -111.4312],
    arkansas: [34.9697, -92.3731], california: [36.1162, -119.6816], colorado: [39.0598, -105.3111],
    connecticut: [41.5978, -72.7554], delaware: [39.3185, -75.5071], florida: [27.7663, -81.6868],
    georgia: [33.0406, -83.6431], idaho: [44.2405, -114.4788], illinois: [40.3495, -88.9861],
    indiana: [39.8494, -86.2583], iowa: [42.0115, -93.2105], kansas: [38.5266, -96.7265],
    kentucky: [37.6681, -84.6701], louisiana: [31.1695, -91.8678], maine: [44.6939, -69.3819],
    maryland: [39.0639, -76.8021], massachusetts: [42.2302, -71.5301], michigan: [43.3266, -84.5361],
    minnesota: [45.6945, -93.9002], mississippi: [32.7416, -89.6787], missouri: [38.4561, -92.2884],
    montana: [46.9219, -110.4544], nebraska: [41.1254, -98.2681], nevada: [38.3135, -117.0554],
    newhampshire: [43.4525, -71.5639], newjersey: [40.2989, -74.521], newmexico: [34.8405, -106.2485],
    newyork: [42.1657, -74.9481], northcarolina: [35.6301, -79.8064], northdakota: [47.5289, -99.784],
    ohio: [40.3888, -82.7649], oklahoma: [35.5653, -96.9289], oregon: [44.572, -122.0709],
    pennsylvania: [40.5908, -77.2098], southcarolina: [33.8569, -80.945], southdakota: [44.2998, -99.4388],
    tennessee: [35.7478, -86.6923], texas: [31.0545, -97.5635], utah: [40.15, -111.8624],
    vermont: [44.0459, -72.7107], virginia: [37.7693, -78.17], washington: [47.4009, -121.4905],
    westvirginia: [38.4912, -80.9545], wisconsin: [44.2685, -89.6165], wyoming: [42.756, -107.3025]
  };

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

  function readPolygons() {
    try {
      return JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]").filter(Boolean);
    } catch {
      return [];
    }
  }

  function mappedFieldCenter() {
    const points = readPolygons().flatMap(poly => Array.isArray(poly.points) ? poly.points : []);
    const cleaned = points
      .map(point => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (!cleaned.length) return null;
    const center = cleaned.reduce((sum, point) => ({
      lat: sum.lat + point.lat,
      lng: sum.lng + point.lng
    }), { lat: 0, lng: 0 });
    center.lat /= cleaned.length;
    center.lng /= cleaned.length;
    return center;
  }

  function stateLabel(key) {
    const labels = {
      newhampshire: "New Hampshire", newjersey: "New Jersey", newmexico: "New Mexico",
      newyork: "New York", northcarolina: "North Carolina", northdakota: "North Dakota",
      southcarolina: "South Carolina", southdakota: "South Dakota", westvirginia: "West Virginia"
    };
    if (labels[key]) return labels[key];
    return String(key || "").replace(/([a-z])([a-z]*)/g, word => word.charAt(0).toUpperCase() + word.slice(1));
  }

  function nearestState(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    let bestKey = "";
    let bestDistance = Infinity;
    Object.entries(STATE_POINTS).forEach(([key, point]) => {
      const [stateLat, stateLng] = point;
      const latDistance = lat - stateLat;
      const lngDistance = (lng - stateLng) * Math.max(0.2, Math.cos(lat * Math.PI / 180));
      const distance = latDistance * latDistance + lngDistance * lngDistance;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = key;
      }
    });
    return stateLabel(bestKey);
  }

  function regionalLocation() {
    const form = data();
    const center = mappedFieldCenter();
    if (center) {
      const inferredRegion = nearestState(center.lat, center.lng) || form.state || "mapped field";
      return {
        lat: center.lat,
        lng: center.lng,
        region: inferredRegion,
        source: "field map"
      };
    }
    return {
      region: form.state || "",
      source: "farm profile"
    };
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
    const location = regionalLocation();
    const region = location.region || "";
    if (!region.trim() && !Number.isFinite(location.lat)) return;
    const body = byId("weather-context-body");
    if (body && force) body.textContent = "Refreshing weather context...";
    try {
      const params = new URLSearchParams({
        region,
        commodities: form.commodities || "",
        source: location.source
      });
      if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
        params.set("lat", String(location.lat));
        params.set("lon", String(location.lng));
      }
      const response = await fetch(`/api/weather?${params.toString()}`);
      renderWeather(await response.json());
    } catch {
      renderWeather({ ok: false, error: "Weather context could not load. Check connection and try again." });
    }
  }

  async function refreshBasis(force = false) {
    const form = data();
    const location = regionalLocation();
    const region = location.region || "";
    const commodities = form.commodities || "";
    if (!region.trim() && !commodities.trim()) return;
    const body = byId("basis-context-body");
    if (body && force) body.textContent = "Refreshing local basis context...";
    try {
      const params = new URLSearchParams({
        region,
        commodities,
        source: location.source
      });
      const response = await fetch(`/api/basis?${params.toString()}`);
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
    if (!window.__agriRegionalStorageBound) {
      window.__agriRegionalStorageBound = true;
      window.addEventListener("storage", event => {
        if (event.key !== POLYGON_KEY) return;
        queueRefresh();
      });
    }
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
  setInterval(() => {
    const current = JSON.stringify(readPolygons());
    if (window.__agriLastPolygonContext === current) return;
    window.__agriLastPolygonContext = current;
    refreshWeather(false);
    refreshBasis(false);
  }, 2500);
}());
