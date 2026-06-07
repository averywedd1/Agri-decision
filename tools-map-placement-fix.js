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
      const next = projected[(index + 1) % projected.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2) / 4046.8564224;
  }

  function saveBoundary(points) {
    const cleaned = points
      .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    const acres = acresFor(cleaned);
    const savedFields = readFields().filter(field => field.id !== "primary-field-boundary");
    localStorage.setItem(FIELD_KEY, JSON.stringify(cleaned));
    if (!savedFields.length) {
      localStorage.setItem(POLYGON_KEY, JSON.stringify(cleaned.length >= 3 ? [{
        id: "primary-field-boundary",
        name: "Primary field boundary",
        tenure: activeTenure(),
        points: cleaned,
        acres,
        updatedAt: new Date().toISOString()
      }] : []));
    }
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", { detail: { points: cleaned, acres } }));
  }

  function readFields() {
    try {
      const fields = JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]");
      return Array.isArray(fields)
        ? fields.map((field, index) => ({
          id: field.id || `field-${index + 1}`,
          name: field.name || `Field ${index + 1}`,
          tenure: field.tenure === "leased" ? "leased" : "owned",
          points: Array.isArray(field.points) ? field.points.map(point => ({ lat: Number(point.lat), lng: Number(point.lng) })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng)) : [],
          acres: Number(field.acres) || acresFor(field.points || []),
          mappedAcres: Number(field.mappedAcres) || acresFor(field.points || []),
          updatedAt: field.updatedAt || ""
        })).filter(field => field.points.length >= 3)
        : [];
    } catch {
      return [];
    }
  }

  function writeFields(fields) {
    localStorage.setItem(POLYGON_KEY, JSON.stringify(fields));
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", {
      detail: {
        fields,
        ownedAcres: fields.filter(field => field.tenure === "owned").reduce((sum, field) => sum + (Number(field.acres) || 0), 0),
        leasedAcres: fields.filter(field => field.tenure === "leased").reduce((sum, field) => sum + (Number(field.acres) || 0), 0)
      }
    }));
  }

  function activeTenure() {
    return document.querySelector("[data-field-tenure].active")?.dataset.fieldTenure || "owned";
  }

  function setActiveTenure(tenure) {
    document.querySelectorAll("[data-field-tenure]").forEach(button => {
      button.classList.toggle("active", button.dataset.fieldTenure === tenure);
    });
  }

  function fieldColor(tenure) {
    return tenure === "leased"
      ? { stroke: "#b7791f", fill: "#d69e2e" }
      : { stroke: "#2d6628", fill: "#3a8035" };
  }

  function fieldTotals(fields = readFields()) {
    return fields.reduce((totals, field) => {
      if (field.id === "primary-field-boundary") return totals;
      if (field.tenure === "leased") totals.leased += Number(field.acres) || 0;
      else totals.owned += Number(field.acres) || 0;
      return totals;
    }, { owned: 0, leased: 0 });
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
      .field-acre-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .field-acre-summary div{padding:10px;border:1px solid var(--line);border-radius:8px;background:#f7faf5}
      .field-acre-summary small{display:block;color:var(--muted);font-size:11px}
      .field-acre-summary strong{display:block;color:var(--green-900);font-size:18px}
      .field-tenure-toggle{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .field-tenure-toggle button.active{background:var(--green-700);border-color:var(--green-700);color:#fff}
      .field-map-field-name{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}
      .field-map-acre-override{display:grid;gap:6px}
      .field-map-acre-override label{font-size:12px;font-weight:800;color:var(--green-900)}
      .field-map-acre-override input{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit}
      .field-map-acre-override small{color:var(--muted);line-height:1.35}
      .field-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)}
      .field-row-dot{width:10px;height:10px;border-radius:999px}
      .field-row button{border:0;background:transparent;color:#9b2c2c;cursor:pointer;font:inherit;padding:2px}
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
              <div class="field-acre-summary">
                <div><small>Owned acres</small><strong id="owned-field-acres">0.0</strong></div>
                <div><small>Leased acres</small><strong id="leased-field-acres">0.0</strong></div>
              </div>
              <input class="field-map-field-name" id="field-area-name" type="text" placeholder="Field name, e.g. North 80">
              <div class="field-map-acre-override">
                <label for="field-area-acres">Custom acres for this field</label>
                <input id="field-area-acres" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Optional, e.g. 78.5">
                <small>Leave blank to use the mapped outline. Enter acres here if the boundary is slightly off.</small>
              </div>
              <div class="field-tenure-toggle" aria-label="Field ownership type">
                <button class="ghost-btn active" type="button" data-field-tenure="owned">Owned</button>
                <button class="ghost-btn" type="button" data-field-tenure="leased">Leased</button>
              </div>
              <div class="field-boundary-list" id="field-boundary-list"></div>
              <div class="field-map-actions">
                <button class="primary-btn" type="button" id="save-field-area">Save Field Area</button>
                <button class="ghost-btn" type="button" id="new-field-area">Start New Field</button>
                <button class="ghost-btn" type="button" id="undo-field-point">Undo Point</button>
                <button class="ghost-btn" type="button" id="clear-field-points">Clear Points</button>
                <button class="primary-btn" type="button" id="use-field-acres">Use Mapped Acres</button>
              </div>
            </aside>
          </div>
        </div>
      `;
    }
    const panel = view.querySelector(".field-map-panel");
    const list = view.querySelector("#field-boundary-list");
    const actions = view.querySelector(".field-map-actions");
    if (panel && !view.querySelector("#owned-field-acres")) {
      const controls = document.createElement("div");
      controls.innerHTML = `
        <div class="field-acre-summary">
          <div><small>Owned acres</small><strong id="owned-field-acres">0.0</strong></div>
          <div><small>Leased acres</small><strong id="leased-field-acres">0.0</strong></div>
        </div>
        <input class="field-map-field-name" id="field-area-name" type="text" placeholder="Field name, e.g. North 80">
        <div class="field-map-acre-override">
          <label for="field-area-acres">Custom acres for this field</label>
          <input id="field-area-acres" type="number" min="0" step="0.1" inputmode="decimal" placeholder="Optional, e.g. 78.5">
          <small>Leave blank to use the mapped outline. Enter acres here if the boundary is slightly off.</small>
        </div>
        <div class="field-tenure-toggle" aria-label="Field ownership type">
          <button class="ghost-btn active" type="button" data-field-tenure="owned">Owned</button>
          <button class="ghost-btn" type="button" data-field-tenure="leased">Leased</button>
        </div>
      `;
      panel.insertBefore(controls, list || actions || panel.children[1] || null);
    }
    if (actions && !view.querySelector("#save-field-area")) {
      const save = document.createElement("button");
      save.className = "primary-btn";
      save.type = "button";
      save.id = "save-field-area";
      save.textContent = "Save Field Area";
      const next = document.createElement("button");
      next.className = "ghost-btn";
      next.type = "button";
      next.id = "new-field-area";
      next.textContent = "Start New Field";
      actions.insertBefore(next, actions.firstChild);
      actions.insertBefore(save, next);
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
    const fields = readFields().filter(field => field.id !== "primary-field-boundary");
    const acres = acresFor(points);
    const acresText = $("field-boundary-acres");
    const list = $("field-boundary-list");
    const totals = fieldTotals(fields);
    if ($("owned-field-acres")) $("owned-field-acres").textContent = totals.owned.toFixed(1);
    if ($("leased-field-acres")) $("leased-field-acres").textContent = totals.leased.toFixed(1);
    if (acresText) acresText.textContent = points.length >= 3 ? `${acres.toFixed(1)} acres in current outline` : "Click at least 3 points to create a boundary";
    if (list) {
      const saved = fields.length ? fields.map(field => {
        const color = fieldColor(field.tenure);
        const mappedAcres = Number(field.mappedAcres) || acresFor(field.points || []);
        const customAcres = Number(field.acres) || mappedAcres;
        const adjusted = Math.abs(customAcres - mappedAcres) >= 0.05
          ? `<br><small>Mapped outline: ${mappedAcres.toFixed(1)} acres</small>`
          : "";
        return `<div class="field-row">
          <span class="field-row-dot" style="background:${color.fill}"></span>
          <span><strong>${field.name}</strong><br>${field.tenure === "leased" ? "Leased" : "Owned"} - ${customAcres.toFixed(1)} acres${adjusted}</span>
          <button type="button" data-delete-field="${field.id}" aria-label="Delete ${field.name}">Delete</button>
        </div>`;
      }).join("") : '<span>No saved owned or leased fields yet.</span>';
      const draft = points.length
        ? `<span>Current outline: ${points.length} point${points.length === 1 ? "" : "s"}</span>`
        : "<span>Click the map to start a field outline.</span>";
      list.innerHTML = `${saved}${draft}`;
    }
    if (!map || !window.L) return;
    fieldLayers.forEach(layer => layer.remove());
    fieldLayers = fields.map(field => {
      const color = fieldColor(field.tenure);
      return window.L.polygon(field.points.map(point => [point.lat, point.lng]), {
        color: color.stroke,
        weight: 3,
        fillColor: color.fill,
        fillOpacity: 0.22
      }).addTo(map).bindTooltip(`${field.name}: ${field.tenure === "leased" ? "Leased" : "Owned"} - ${(Number(field.acres) || 0).toFixed(1)} acres`);
    });
    markers.forEach(marker => marker.remove());
    markers = points.map((point, index) => window.L.circleMarker([point.lat, point.lng], {
      radius: 5,
      color: "#fff",
      weight: 2,
      fillColor: "#1a3318",
      fillOpacity: 1
    }).addTo(map).bindTooltip(`Point ${index + 1}`));
    if (shapeLayer) shapeLayer.remove();
    const draftColor = fieldColor(activeTenure());
    shapeLayer = points.length >= 3
      ? window.L.polygon(points.map(point => [point.lat, point.lng]), { color: draftColor.stroke, dashArray: "6 6", weight: 3, fillColor: draftColor.fill, fillOpacity: 0.14 }).addTo(map)
      : points.length >= 2
        ? window.L.polyline(points.map(point => [point.lat, point.lng]), { color: draftColor.stroke, dashArray: "6 6", weight: 3 }).addTo(map)
        : null;
  }

  function syncMappedAcres() {
    const totals = fieldTotals();
    const draftAcres = acresFor(readBoundary());
    const acres = totals.owned + totals.leased || draftAcres;
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
    document.querySelectorAll("[data-field-tenure]").forEach(button => {
      if (button.dataset.placementFixBound === "true") return;
      button.dataset.placementFixBound = "true";
      button.addEventListener("click", () => {
        setActiveTenure(button.dataset.fieldTenure);
        drawBoundary();
      });
    });
    const saveField = $("save-field-area");
    if (saveField && saveField.dataset.placementFixBound !== "true") {
      saveField.dataset.placementFixBound = "true";
      saveField.addEventListener("click", () => {
        const points = readBoundary();
        if (points.length < 3) return alert("Click at least 3 points on the map before saving a field area.");
        const fields = readFields().filter(field => field.id !== "primary-field-boundary");
        const tenure = activeTenure();
        const mappedAcres = acresFor(points);
        const nameInput = $("field-area-name");
        const acresInput = $("field-area-acres");
        const requestedAcres = Number(acresInput?.value);
        const acres = Number.isFinite(requestedAcres) && requestedAcres > 0 ? requestedAcres : mappedAcres;
        const fallbackNumber = fields.filter(field => field.tenure === tenure).length + 1;
        const name = (nameInput?.value || `${tenure === "leased" ? "Leased" : "Owned"} Field ${fallbackNumber}`).trim();
        fields.push({
          id: `field-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name,
          tenure,
          acres,
          mappedAcres,
          points,
          updatedAt: new Date().toISOString()
        });
        writeFields(fields);
        localStorage.setItem(FIELD_KEY, "[]");
        if (nameInput) nameInput.value = "";
        if (acresInput) acresInput.value = "";
        drawBoundary();
        syncMappedAcres();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    }
    const newField = $("new-field-area");
    if (newField && newField.dataset.placementFixBound !== "true") {
      newField.dataset.placementFixBound = "true";
      newField.addEventListener("click", () => {
        saveBoundary([]);
        const nameInput = $("field-area-name");
        const acresInput = $("field-area-acres");
        if (nameInput) nameInput.value = "";
        if (acresInput) acresInput.value = "";
        drawBoundary();
        syncMappedAcres();
      });
    }
    const list = $("field-boundary-list");
    if (list && list.dataset.placementFixBound !== "true") {
      list.dataset.placementFixBound = "true";
      list.addEventListener("click", event => {
        const button = event.target.closest("[data-delete-field]");
        if (!button) return;
        writeFields(readFields().filter(field => field.id !== button.dataset.deleteField));
        drawBoundary();
        syncMappedAcres();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    }
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
        const fields = readFields().filter(field => field.id !== "primary-field-boundary");
        const totals = fieldTotals(fields);
        if (fields.length) {
          data.fieldBoundaries = fields;
          data.ownedMappedAcres = String(totals.owned.toFixed(1));
          data.leasedMappedAcres = String(totals.leased.toFixed(1));
        }
        if (points.length >= 3) {
          data.fieldBoundary = { source: "field map", acres: Number(acresFor(points).toFixed(1)), center: centerOf(points), points };
          data.mappedAcres = String(data.fieldBoundary.acres);
        } else if (fields.length) {
          data.fieldBoundary = fields[0];
          data.mappedAcres = String((totals.owned + totals.leased).toFixed(1));
        }
        return data;
      };
      getFormData.placementFieldMapPatch = true;
    }
    if (typeof setFormData === "function" && !setFormData.placementFieldMapPatch) {
      const base = setFormData;
      setFormData = function (data = {}) {
        const result = base.apply(this, arguments);
        if (Array.isArray(data.fieldBoundaries) && data.fieldBoundaries.length) {
          const fields = data.fieldBoundaries
            .map((field, index) => ({
              id: field.id || `field-${Date.now()}-${index}`,
              name: field.name || `Field ${index + 1}`,
              tenure: field.tenure === "leased" ? "leased" : "owned",
              acres: Number(field.acres) || acresFor(field.points || []),
              mappedAcres: Number(field.mappedAcres) || acresFor(field.points || []),
              points: Array.isArray(field.points)
                ? field.points.map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
                  .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
                : [],
              updatedAt: field.updatedAt || new Date().toISOString()
            }))
            .filter(field => field.points.length >= 3);
          if (fields.length) {
            localStorage.setItem(FIELD_KEY, "[]");
            writeFields(fields);
            drawBoundary();
            syncMappedAcres();
          }
        }
        return result;
      };
      setFormData.placementFieldMapPatch = true;
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
