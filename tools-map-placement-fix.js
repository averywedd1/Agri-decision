(function () {
  const FIELD_KEY = "agriFieldBoundary";
  const POLYGON_KEY = "agridecisionFieldPolygons";
  let map = null;
  let shapeLayer = null;
  let markers = [];
  let leafletPromise = null;

  const $ = id => document.getElementById(id);

  function readBoundary() {
    try {
      const points = JSON.parse(localStorage.getItem(FIELD_KEY) || "[]");
      return Array.isArray(points)
        ? points.map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
          .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        : [];
    } catch {
      return [];
    }
  }

  function centerOf(points = readBoundary()) {
    if (!points.length) return { lat: 41.878, lng: -93.097 };
    return points.reduce((sum, point) => ({
      lat: sum.lat + point.lat / points.length,
      lng: sum.lng + point.lng / points.length
    }), { lat: 0, lng: 0 });
  }

  function acresFor(points) {
    if (points.length < 3) return 0;
    const avgLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const metersPerLat = 111320;
    const metersPerLng = 111320 * Math.cos(avgLat * Math.PI / 180);
    const projected = points.map(point => ({ x: point.lng * metersPerLng, y: point.lat * metersPerLat }));
    let area = 0;
    projected.forEach((point, index) => {
      const next = projected[(index + 1) % points.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2) / 4046.8564224;
  }

  function saveBoundary(points) {
    const cleaned = points
      .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const acres = acresFor(cleaned);
    localStorage.setItem(FIELD_KEY, JSON.stringify(cleaned));
    localStorage.setItem(POLYGON_KEY, JSON.stringify(cleaned.length >= 3 ? [{
      id: "primary-field-boundary",
      name: "Primary field boundary",
      points: cleaned,
      acres,
      updatedAt: new Date().toISOString()
    }] : []));
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", { detail: { points: cleaned, acres } }));
  }

  function ensureStyles() {
    if ($("tools-map-placement-style")) return;
    const style = document.createElement("style");
    style.id = "tools-map-placement-style";
    style.textContent = `
      .field-map-view{min-height:calc(100vh - 60px);padding-top:44px;background:#f7faf5}
      .field-map-view.active{display:block!important}
      .field-map-section{max-width:1180px}
      .field-map-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
      .field-map-canvas{min-height:520px;height:62vh;width:100%;padding:0;border:1px solid var(--line);border-radius:8px;background:#dfe9d7;cursor:crosshair;overflow:hidden;z-index:1}
      .field-map-panel{display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:var(--shadow)}
      .field-boundary-list{display:grid;gap:4px;max-height:180px;overflow:auto;color:var(--muted);font-size:12px}
      .field-map-actions{display:grid;gap:8px}
      #tools-view #expense-chart-card{margin:18px 0 0}
      @media(max-width:820px){.field-map-layout{grid-template-columns:1fr}.field-map-canvas{min-height:360px;height:58vh}}
    `;
    document.head.appendChild(style);
  }

  function ensureFieldMapView() {
    const menu = $("site-menu-panel");
    let button = menu?.querySelector('[data-app-tab="field-map"]');
    if (menu && !button) {
      button = document.createElement("button");
      button.className = "workspace-tab";
      button.type = "button";
      button.dataset.appTab = "field-map";
      button.textContent = "Field Map";
      menu.insertBefore(button, menu.querySelector('[data-app-tab="tools"]') || menu.querySelector('[data-app-tab="ai"]') || null);
    }
    if (button && button.dataset.placementFixBound !== "true") {
      button.dataset.placementFixBound = "true";
      button.addEventListener("click", () => {
        button.closest("details")?.removeAttribute("open");
        if (typeof switchAppTab === "function") switchAppTab("field-map");
      });
    }

    let view = $("field-map-view");
    if (!view) {
      view = document.createElement("section");
      view.className = "app-view field-map-view";
      view.id = "field-map-view";
      const anchor = $("tools-view") || $("ai-view") || document.querySelector("footer");
      document.body.insertBefore(view, anchor);
    }
    if (!view.querySelector("#field-map-canvas")) {
      view.innerHTML = `
        <div class="section field-map-section">
          <div class="section-kicker">Field Map</div>
          <h2>Map field boundaries</h2>
          <p class="section-lead">Zoom to your farm, then click points around the field edge. Saved projects include the field coordinates so AgriDecision AI can analyze location.</p>
          <div class="field-map-layout">
            <div class="field-map-canvas" id="field-map-canvas" aria-label="World map for field boundaries"></div>
            <aside class="field-map-panel">
              <strong id="field-boundary-acres">Click at least 3 points to create a boundary</strong>
              <div class="field-boundary-list" id="field-boundary-list"></div>
              <div class="field-map-actions">
                <button class="ghost-btn" type="button" id="undo-field-point">Undo Point</button>
                <button class="ghost-btn" type="button" id="clear-field-points">Clear Points</button>
                <button class="primary-btn" type="button" id="use-field-acres">Use Mapped Acres</button>
              </div>
            </aside>
          </div>
        </div>
      `;
    }
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-agri-leaflet="true"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.agriLeaflet = "true";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.defer = true;
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error("Map library could not load."));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function drawBoundary() {
    const points = readBoundary();
    const acres = acresFor(points);
    const acresText = $("field-boundary-acres");
    const list = $("field-boundary-list");
    if (acresText) acresText.textContent = points.length >= 3 ? `${acres.toFixed(1)} mapped acres` : "Click at least 3 points to create a boundary";
    if (list) {
      list.innerHTML = points.length
        ? points.map((point, index) => `<span>${index + 1}. ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</span>`).join("")
        : "<span>No boundary points yet.</span>";
    }
    if (!map || !window.L) return;
    markers.forEach(marker => marker.remove());
    markers = points.map((point, index) => window.L.circleMarker([point.lat, point.lng], {
      radius: 5,
      color: "#fff",
      weight: 2,
      fillColor: "#1a3318",
      fillOpacity: 1
    }).addTo(map).bindTooltip(`Point ${index + 1}`));
    if (shapeLayer) shapeLayer.remove();
    shapeLayer = points.length >= 3
      ? window.L.polygon(points.map(point => [point.lat, point.lng]), { color: "#2d6628", weight: 3, fillColor: "#3a8035", fillOpacity: 0.24 }).addTo(map)
      : points.length >= 2
        ? window.L.polyline(points.map(point => [point.lat, point.lng]), { color: "#2d6628", weight: 3 }).addTo(map)
        : null;
  }

  function syncMappedAcres() {
    const acres = acresFor(readBoundary());
    const total = $("total-acres");
    if (total && acres > 0) {
      total.value = acres.toFixed(1);
      total.dispatchEvent(new Event("input", { bubbles: true }));
      total.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const mapped = $("mapped-acres-value");
    const synced = $("synced-acres-value");
    if (mapped) mapped.textContent = acres.toFixed(1);
    if (synced) synced.textContent = acres.toFixed(1);
  }

  function initMap() {
    const canvas = $("field-map-canvas");
    if (!canvas || canvas.dataset.placementMapReady === "true") return;
    canvas.dataset.placementMapReady = "true";
    loadLeaflet().then(L => {
      if (map || canvas.classList.contains("leaflet-container")) return;
      const points = readBoundary();
      const center = centerOf(points);
      map = L.map(canvas, { scrollWheelZoom: true }).setView([center.lat, center.lng], points.length ? 14 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);
      map.on("click", event => {
        const points = readBoundary();
        points.push({ lat: event.latlng.lat, lng: event.latlng.lng });
        saveBoundary(points);
        drawBoundary();
        syncMappedAcres();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
      drawBoundary();
      if (points.length >= 2) map.fitBounds(points.map(point => [point.lat, point.lng]), { padding: [24, 24] });
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(error => {
      canvas.innerHTML = `<div class="field-map-error">World map could not load. Check your connection and refresh. ${String(error.message || "")}</div>`;
    });
  }

  function bindMapControls() {
    const undo = $("undo-field-point");
    if (undo && undo.dataset.placementFixBound !== "true") {
      undo.dataset.placementFixBound = "true";
      undo.addEventListener("click", () => {
        const points = readBoundary();
        points.pop();
        saveBoundary(points);
        drawBoundary();
        syncMappedAcres();
      });
    }
    const clear = $("clear-field-points");
    if (clear && clear.dataset.placementFixBound !== "true") {
      clear.dataset.placementFixBound = "true";
      clear.addEventListener("click", () => {
        saveBoundary([]);
        drawBoundary();
        syncMappedAcres();
      });
    }
    const use = $("use-field-acres");
    if (use && use.dataset.placementFixBound !== "true") {
      use.dataset.placementFixBound = "true";
      use.addEventListener("click", syncMappedAcres);
    }
  }

  function moveExpenseToTools() {
    if (typeof ensureToolsView === "function") ensureToolsView();
    if (!$("expense-chart-card") && typeof ensureExpensePieChart === "function") ensureExpensePieChart();
    const card = $("expense-chart-card");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!card || !toolsSection) return;
    const actions = toolsSection.querySelector(".tools-actions");
    if (card.parentElement !== toolsSection) {
      toolsSection.insertBefore(card, actions?.nextSibling || toolsSection.firstChild?.nextSibling || null);
    }
    if (typeof updateExpensePieChart === "function") updateExpensePieChart();
  }

  function patchProjectData() {
    if (typeof getFormData === "function" && !getFormData.placementFieldMapPatch) {
      const base = getFormData;
      getFormData = function () {
        const data = base.apply(this, arguments);
        const points = readBoundary();
        if (points.length >= 3) {
          data.fieldBoundary = { source: "field map", acres: Number(acresFor(points).toFixed(1)), center: centerOf(points), points };
          data.mappedAcres = String(data.fieldBoundary.acres);
        }
        return data;
      };
      getFormData.placementFieldMapPatch = true;
    }
  }

  function patchTabSwitcher() {
    if (typeof switchAppTab !== "function" || switchAppTab.placementFieldMapPatch) return;
    const base = switchAppTab;
    switchAppTab = function (tabName) {
      ensureFieldMapView();
      moveExpenseToTools();
      let result;
      try {
        result = base.apply(this, arguments);
      } catch (error) {
        console.warn("AgriDecision tab switch fallback used", error);
      }
      document.querySelectorAll(".app-view").forEach(view => {
        if (view.id === "field-map-view") view.classList.toggle("active", tabName === "field-map");
        else if (tabName === "field-map") view.classList.remove("active");
      });
      document.querySelectorAll(".workspace-tab").forEach(button => button.classList.toggle("active", button.dataset.appTab === tabName));
      if (tabName === "field-map") {
        initMap();
        drawBoundary();
        setTimeout(() => map?.invalidateSize(), 160);
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      if (tabName === "tools") moveExpenseToTools();
      return result;
    };
    switchAppTab.placementFieldMapPatch = true;
  }

  function run() {
    ensureStyles();
    ensureFieldMapView();
    moveExpenseToTools();
    bindMapControls();
    patchProjectData();
    patchTabSwitcher();
    initMap();
    drawBoundary();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  setTimeout(run, 500);
  setTimeout(run, 1800);
  setInterval(() => {
    ensureFieldMapView();
    moveExpenseToTools();
    bindMapControls();
    drawBoundary();
  }, 4000);
}());
