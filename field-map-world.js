(function () {
  const FIELD_KEY = "agriFieldBoundary";
  const POLYGON_KEY = "agridecisionFieldPolygons";
  let map = null;
  let shapeLayer = null;
  let fieldLayers = [];
  let markers = [];
  let leafletPromise = null;

  const $ = id => document.getElementById(id);

  function readBoundary() {
    try {
      const points = JSON.parse(localStorage.getItem(FIELD_KEY) || "[]");
      return Array.isArray(points)
        ? points
          .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
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
      const next = projected[(index + 1) % projected.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2) / 4046.8564224;
  }

  function readSavedFields() {
    try {
      const fields = JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]");
      return Array.isArray(fields)
        ? fields
          .filter(field => field && field.id !== "primary-field-boundary")
          .map((field, index) => ({
            id: field.id || `field-${index + 1}`,
            name: field.name || `Field ${index + 1}`,
            tenure: field.tenure === "leased" ? "leased" : "owned",
            acres: Number(field.acres) || acresFor(field.points || []),
            mappedAcres: Number(field.mappedAcres) || acresFor(field.points || []),
            points: Array.isArray(field.points)
              ? field.points
                .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
                .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
              : []
          }))
          .filter(field => field.points.length >= 3)
        : [];
    } catch {
      return [];
    }
  }

  function saveBoundary(points) {
    const cleaned = (points || [])
      .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const acres = acresFor(cleaned);
    const savedFields = readSavedFields();
    localStorage.setItem(FIELD_KEY, JSON.stringify(cleaned));
    localStorage.setItem(POLYGON_KEY, JSON.stringify([
      ...savedFields,
      ...(cleaned.length >= 3 ? [{
      id: "primary-field-boundary",
      name: "Primary field boundary",
      points: cleaned,
      acres,
      updatedAt: new Date().toISOString()
      }] : [])
    ]));
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", { detail: { points: cleaned, acres, fields: savedFields } }));
  }

  function fieldContextText() {
    const points = readBoundary();
    if (points.length < 3) return "";
    const center = centerOf(points);
    const acres = acresFor(points);
    const coordinates = points.map(point => `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`).join(" | ");
    return `Mapped field boundary:
Center: ${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}
Mapped acres: ${acres.toFixed(1)}
Boundary coordinates: ${coordinates}`;
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

  function ensureView() {
    const menu = $("site-menu-panel");
    if (menu && !menu.querySelector('[data-app-tab="field-map"]')) {
      const button = document.createElement("button");
      button.className = "workspace-tab";
      button.type = "button";
      button.dataset.appTab = "field-map";
      button.textContent = "Field Map";
      button.addEventListener("click", () => {
        button.closest("details")?.removeAttribute("open");
        if (typeof switchAppTab === "function") switchAppTab("field-map");
      });
      menu.insertBefore(button, menu.querySelector('[data-app-tab="tools"]') || null);
    }

    if (!$("field-map-view")) {
      const view = document.createElement("section");
      view.className = "app-view field-map-view";
      view.id = "field-map-view";
      const anchor = $("tools-view") || $("ai-view") || document.querySelector("footer");
      document.body.insertBefore(view, anchor);
    }

    const view = $("field-map-view");
    if (!view || view.dataset.worldMapReady === "true") return;
    view.dataset.worldMapReady = "true";
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

  function draw() {
    const points = readBoundary();
    const savedFields = readSavedFields();
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
    fieldLayers.forEach(layer => layer.remove());
    fieldLayers = savedFields.map(field => {
      const leased = field.tenure === "leased";
      return window.L.polygon(field.points.map(point => [point.lat, point.lng]), {
        color: leased ? "#b7791f" : "#2d6628",
        weight: 3,
        fillColor: leased ? "#d69e2e" : "#3a8035",
        fillOpacity: 0.22
      }).addTo(map).bindTooltip(`${field.name}: ${leased ? "Leased" : "Owned"} - ${field.acres.toFixed(1)} acres`);
    });
    markers.forEach(marker => marker.remove());
    markers = points.map((point, index) => window.L.circleMarker([point.lat, point.lng], {
      radius: 5,
      color: "#ffffff",
      weight: 2,
      fillColor: "#1a3318",
      fillOpacity: 1
    }).addTo(map).bindTooltip(`Point ${index + 1}`));
    if (shapeLayer) shapeLayer.remove();
    shapeLayer = points.length >= 3
      ? window.L.polygon(points.map(point => [point.lat, point.lng]), {
        color: "#2d6628",
        weight: 3,
        fillColor: "#3a8035",
        fillOpacity: 0.24
      }).addTo(map)
      : points.length >= 2
        ? window.L.polyline(points.map(point => [point.lat, point.lng]), { color: "#2d6628", weight: 3 }).addTo(map)
        : null;
  }

  function syncAcres() {
    const points = readBoundary();
    const acres = acresFor(points);
    const total = $("total-acres");
    const mapped = $("mapped-acres-value");
    const synced = $("synced-acres-value");
    if (mapped) mapped.textContent = acres.toFixed(1);
    if (synced) synced.textContent = acres.toFixed(1);
    if (total && acres > 0) {
      total.value = acres.toFixed(1);
      total.dispatchEvent(new Event("input", { bubbles: true }));
      total.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function initMap() {
    const target = $("field-map-canvas");
    if (!target || target.dataset.leafletReady === "true") return;
    target.dataset.leafletReady = "loading";
    loadLeaflet()
      .then(L => {
        target.dataset.leafletReady = "true";
        const points = readBoundary();
        const center = centerOf(points);
        map = L.map(target, { scrollWheelZoom: true }).setView([center.lat, center.lng], points.length ? 14 : 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 20,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        map.on("click", event => {
          const next = readBoundary();
          next.push({ lat: event.latlng.lat, lng: event.latlng.lng });
          saveBoundary(next);
          draw();
          syncAcres();
          if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
        });
        draw();
        if (points.length >= 2) map.fitBounds(points.map(point => [point.lat, point.lng]), { padding: [24, 24] });
        setTimeout(() => map.invalidateSize(), 250);
      })
      .catch(error => {
        target.dataset.leafletReady = "error";
        target.innerHTML = `<div class="field-map-error">World map could not load. Check your connection and refresh. ${String(error.message || "")}</div>`;
      });
  }

  function bindControls() {
    if (document.documentElement.dataset.worldMapBoundaryListener !== "true") {
      document.documentElement.dataset.worldMapBoundaryListener = "true";
      window.addEventListener("agri-field-boundary-updated", () => setTimeout(draw, 0));
    }
    const undo = $("undo-field-point");
    if (undo && undo.dataset.worldMapBound !== "true") {
      undo.dataset.worldMapBound = "true";
      undo.addEventListener("click", () => {
        const points = readBoundary();
        points.pop();
        saveBoundary(points);
        draw();
        syncAcres();
      });
    }
    const clear = $("clear-field-points");
    if (clear && clear.dataset.worldMapBound !== "true") {
      clear.dataset.worldMapBound = "true";
      clear.addEventListener("click", () => {
        saveBoundary([]);
        draw();
        syncAcres();
      });
    }
    const use = $("use-field-acres");
    if (use && use.dataset.worldMapBound !== "true") {
      use.dataset.worldMapBound = "true";
      use.addEventListener("click", syncAcres);
    }
  }

  function restoreBoundaryFromData(data) {
    const points = data?.fieldBoundary?.points;
    if (!Array.isArray(points) || points.length < 3) return;
    saveBoundary(points);
    draw();
    if (map) {
      setTimeout(() => map.fitBounds(readBoundary().map(point => [point.lat, point.lng]), { padding: [24, 24] }), 80);
    }
  }

  function patchProjectData() {
    if (typeof getFormData === "function" && !getFormData.isWorldMapPatch) {
      const base = getFormData;
      getFormData = function () {
        const data = base.apply(this, arguments);
        const points = readBoundary();
        if (points.length >= 3) {
          data.fieldBoundary = {
            source: "field map",
            acres: Number(acresFor(points).toFixed(1)),
            center: centerOf(points),
            points
          };
          data.mappedAcres = String(data.fieldBoundary.acres);
        }
        return data;
      };
      getFormData.isWorldMapPatch = true;
    }
    if (typeof setFormData === "function" && !setFormData.isWorldMapPatch) {
      const base = setFormData;
      setFormData = function (data = {}) {
        const result = base.apply(this, arguments);
        restoreBoundaryFromData(data);
        return result;
      };
      setFormData.isWorldMapPatch = true;
    }
    if (typeof buildContext === "function" && !buildContext.isWorldMapPatch) {
      const base = buildContext;
      buildContext = function () {
        const text = base.apply(this, arguments);
        const field = fieldContextText();
        return field ? `${text}\n\n${field}` : text;
      };
      buildContext.isWorldMapPatch = true;
    }
  }

  function patchTab() {
    if (typeof switchAppTab !== "function" || switchAppTab.isWorldMapPatch) return;
    const base = switchAppTab;
    switchAppTab = function (tabName) {
      const result = base.apply(this, arguments);
      if (tabName === "field-map") {
        run();
        setTimeout(() => map?.invalidateSize(), 120);
      }
      return result;
    };
    switchAppTab.isWorldMapPatch = true;
  }

  function installStyles() {
    if ($("world-field-map-style")) return;
    const style = document.createElement("style");
    style.id = "world-field-map-style";
    style.textContent = `
      .field-map-canvas{min-height:520px;height:62vh;width:100%;padding:0;border:1px solid var(--line);border-radius:8px;background:#dfe9d7;cursor:crosshair;overflow:hidden;z-index:1}
      .field-map-canvas .leaflet-control-attribution{font-size:10px}
      .field-map-canvas .leaflet-control-zoom a{color:#1a3318}
      .field-map-error{display:grid;place-items:center;min-height:520px;padding:24px;color:var(--muted);text-align:center}
      @media(max-width:820px){.field-map-canvas{min-height:360px;height:58vh}}
    `;
    document.head.appendChild(style);
  }

  function run() {
    installStyles();
    ensureView();
    bindControls();
    patchProjectData();
    patchTab();
    initMap();
    draw();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  setTimeout(run, 600);
  setTimeout(run, 1800);
}());
