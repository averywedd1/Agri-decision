(function () {
  const POLYGON_KEY = "agridecisionFieldPolygons";
  let LRef = window.L;
  let mapRef = null;
  let layerRef = null;
  let drawing = false;
  let draft = [];

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readPolygons() {
    try { return JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]").filter(Boolean); }
    catch { return []; }
  }

  function savePolygons(polygons) {
    localStorage.setItem(POLYGON_KEY, JSON.stringify(polygons));
  }

  function acresFromPoints(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    const avgLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const metersLat = 111320;
    const metersLng = 111320 * Math.cos(avgLat * Math.PI / 180);
    const projected = points.map(point => ({ x: point.lng * metersLng, y: point.lat * metersLat }));
    let area = 0;
    projected.forEach((point, index) => {
      const next = projected[(index + 1) % projected.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2) / 4046.8564224;
  }

  function status(message) {
    const target = document.getElementById("field-boundary-status") || document.getElementById("field-map-status");
    if (target) target.textContent = message;
  }

  function ensureLayer() {
    if (!mapRef || !window.L) return null;
    if (!layerRef) layerRef = window.L.layerGroup().addTo(mapRef);
    return layerRef;
  }

  function renderPolygons() {
    const layer = ensureLayer();
    if (!layer || !window.L) return;
    layer.clearLayers();

    readPolygons().forEach(poly => {
      const points = poly.points || [];
      if (points.length < 3) return;
      window.L.polygon(points.map(point => [point.lat, point.lng]), {
        color: "#0F6E56",
        weight: 3,
        fillColor: "#5DCAA5",
        fillOpacity: 0.24
      }).bindPopup(`<strong>${esc(poly.name)}</strong><br>${esc(poly.acres || acresFromPoints(points).toFixed(1))} acres<br>${points.length} boundary points`).addTo(layer);
    });

    if (draft.length) {
      draft.forEach((point, index) => {
        window.L.circleMarker([point.lat, point.lng], {
          radius: 6,
          color: "#1A2B22",
          weight: 2,
          fillColor: "#fff",
          fillOpacity: 1
        }).bindTooltip(String(index + 1), { permanent: true, direction: "top" }).addTo(layer);
      });
      if (draft.length > 1) {
        window.L.polyline(draft.map(point => [point.lat, point.lng]), {
          color: "#1A2B22",
          weight: 3,
          dashArray: "6 5"
        }).addTo(layer);
      }
    }
  }

  function renderList() {
    const list = document.getElementById("field-boundary-list");
    if (!list) return;
    const polygons = readPolygons();
    list.innerHTML = polygons.length ? polygons.map((poly, index) => {
      const acres = poly.acres || acresFromPoints(poly.points || []).toFixed(1);
      return `<div class="field-boundary-item">
        <strong>${esc(poly.name || `Boundary ${index + 1}`)}</strong>
        <small>${esc(acres)} acres | ${poly.points?.length || 0} points</small>
        <button class="ghost-btn" type="button" data-remove-boundary="${index}">Remove Boundary</button>
      </div>`;
    }).join("") : '<p class="fineprint">No boundaries saved yet.</p>';

    list.querySelectorAll("[data-remove-boundary]").forEach(button => {
      button.addEventListener("click", () => {
        const next = readPolygons();
        next.splice(Number(button.dataset.removeBoundary), 1);
        savePolygons(next);
        renderList();
        renderPolygons();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    });
  }

  function start() {
    drawing = true;
    window.agriBoundaryDrawing = true;
    draft = [];
    renderPolygons();
    status("Boundary mode is on. Click points around the outside edge of the field.");
  }

  function clear() {
    drawing = false;
    window.agriBoundaryDrawing = false;
    draft = [];
    renderPolygons();
    status("Boundary points cleared.");
  }

  function finish() {
    if (draft.length < 3) {
      status("Click at least 3 points around the field edge before finishing.");
      return;
    }
    const defaultName = `Field Boundary ${readPolygons().length + 1}`;
    const name = prompt("Boundary name", defaultName);
    if (name === null) return;
    const calculated = acresFromPoints(draft).toFixed(1);
    const acres = prompt("Acres for this field", calculated);
    if (acres === null) return;
    const polygons = readPolygons();
    polygons.push({
      id: `boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim() || defaultName,
      acres: acres.trim() || calculated,
      points: draft.map(point => ({ lat: point.lat, lng: point.lng })),
      notes: "Selected as a field boundary on the map",
      updatedAt: new Date().toISOString()
    });
    savePolygons(polygons);
    drawing = false;
    window.agriBoundaryDrawing = false;
    draft = [];
    renderList();
    renderPolygons();
    status("Field boundary saved with the current project.");
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  }

  function installUi() {
    const panel = document.querySelector(".field-map-panel");
    if (!panel || document.getElementById("field-boundary-tools")) return;
    const tools = document.createElement("div");
    tools.className = "field-boundary-tools";
    tools.id = "field-boundary-tools";
    tools.innerHTML = `
      <strong>Field Boundary</strong>
      <p class="boundary-help" id="field-boundary-status">Start boundary mode, click around the actual field edge, then finish the shape.</p>
      <div class="field-boundary-actions">
        <button class="primary-btn" type="button" id="start-field-boundary">Start Boundary</button>
        <button class="ghost-btn" type="button" id="finish-field-boundary">Finish Boundary</button>
        <button class="ghost-btn" type="button" id="clear-field-boundary">Clear Points</button>
      </div>
      <div class="field-boundary-list" id="field-boundary-list"></div>
    `;
    panel.insertBefore(tools, document.getElementById("field-list") || null);
    document.getElementById("start-field-boundary")?.addEventListener("click", start);
    document.getElementById("finish-field-boundary")?.addEventListener("click", finish);
    document.getElementById("clear-field-boundary")?.addEventListener("click", clear);
    renderList();
    renderPolygons();
  }

  function attachToMap(map) {
    if (!map || map.isAgriBoundaryFixed) return map;
    map.isAgriBoundaryFixed = true;
    mapRef = map;
    window.agriBoundaryMap = map;

    const originalOn = map.on.bind(map);
    map.on = function (type, handler, ...rest) {
      if (type === "click" && typeof handler === "function" && String(handler).includes("Field name")) {
        const circleHandler = handler;
        handler = function (event) {
          if (drawing || window.agriBoundaryDrawing) return;
          return circleHandler.call(this, event);
        };
      }
      return originalOn(type, handler, ...rest);
    };

    originalOn("click", event => {
      if (!drawing && !window.agriBoundaryDrawing) return;
      draft.push({ lat: event.latlng.lat, lng: event.latlng.lng });
      renderPolygons();
      status(`${draft.length} boundary point${draft.length === 1 ? "" : "s"} selected. Keep clicking around the edge, then finish.`);
    });

    setTimeout(renderPolygons, 100);
    return map;
  }

  function patchLeaflet(L) {
    if (!L || !L.map || L.map.isAgriBoundaryFactoryFixed) return;
    const originalMap = L.map;
    const patchedMap = function (...args) {
      const map = originalMap.apply(this, args);
      const target = args[0];
      const id = typeof target === "string" ? target : target?.id;
      if (id === "field-map-canvas") attachToMap(map);
      return map;
    };
    patchedMap.isAgriBoundaryFactoryFixed = true;
    L.map = patchedMap;
  }

  function installLeafletHook() {
    try {
      let current = window.L;
      Object.defineProperty(window, "L", {
        configurable: true,
        get() { return current; },
        set(value) {
          current = value;
          LRef = value;
          patchLeaflet(value);
        }
      });
      if (current) patchLeaflet(current);
    } catch {
      if (window.L) patchLeaflet(window.L);
    }
  }

  function installPersistence() {
    if (typeof projectSnapshot === "function" && !projectSnapshot.isAgriBoundaryModeFix) {
      const baseProjectSnapshot = projectSnapshot;
      projectSnapshot = function (existing = {}) {
        const snapshot = baseProjectSnapshot(existing);
        snapshot.fieldPolygons = readPolygons();
        return snapshot;
      };
      projectSnapshot.isAgriBoundaryModeFix = true;
    }
    if (typeof loadProject === "function" && !loadProject.isAgriBoundaryModeFix) {
      const baseLoadProject = loadProject;
      loadProject = function (projectId) {
        const result = baseLoadProject(projectId);
        try {
          const project = getStore().projects.find(item => item.id === projectId);
          if (Array.isArray(project?.fieldPolygons)) savePolygons(project.fieldPolygons);
        } catch {}
        renderList();
        renderPolygons();
        return result;
      };
      loadProject.isAgriBoundaryModeFix = true;
    }
  }

  function install() {
    installLeafletHook();
    installUi();
    installPersistence();
    if (LRef) patchLeaflet(LRef);
  }

  install();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  setInterval(install, 500);
}());
