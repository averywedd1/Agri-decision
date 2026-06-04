(function () {
  const POLYGON_KEY = "agridecisionFieldPolygons";
  let mapRef = null;
  let layerRef = null;
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

  function polygonSummary() {
    const polygons = readPolygons();
    if (!polygons.length) return "No field boundaries drawn yet.";
    return polygons.map(poly => {
      const acres = poly.acres || acresFromPoints(poly.points || []).toFixed(1);
      const corners = (poly.points || []).map(point => `${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}`).join("; ");
      return `${poly.name}: ${acres} acres boundary with ${poly.points?.length || 0} points. Coordinates: ${corners}`;
    }).join("\n");
  }

  function setStatus(message) {
    const target = document.getElementById("field-boundary-status") || document.getElementById("field-map-status");
    if (target) target.textContent = message;
  }

  function installStyles() {
    if (document.getElementById("agri-boundary-override-style")) return;
    const style = document.createElement("style");
    style.id = "agri-boundary-override-style";
    style.textContent = `
      .field-boundary-tools {
        display: grid;
        gap: 10px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #eef6ea;
      }
      .field-boundary-tools strong { color: var(--green-900); }
      .field-boundary-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .field-boundary-list { display: grid; gap: 10px; }
      .field-boundary-item {
        display: grid;
        gap: 4px;
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #ffffff;
      }
      .field-boundary-item small { color: var(--muted); }
      .boundary-help { margin: 0; color: var(--muted); font-size: 13px; }
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    installStyles();
    const panel = document.querySelector(".field-map-panel");
    if (!panel || document.getElementById("field-boundary-tools")) return;
    const tools = document.createElement("div");
    tools.className = "field-boundary-tools";
    tools.id = "field-boundary-tools";
    tools.innerHTML = `
      <strong>Field Boundary</strong>
      <p class="boundary-help" id="field-boundary-status">Start boundary mode, click around the field edge, then finish the shape.</p>
      <div class="field-boundary-actions">
        <button class="primary-btn" type="button" id="start-field-boundary">Start Boundary</button>
        <button class="ghost-btn" type="button" id="finish-field-boundary">Finish Boundary</button>
        <button class="ghost-btn" type="button" id="clear-field-boundary">Clear Points</button>
      </div>
      <div class="field-boundary-list" id="field-boundary-list"></div>
    `;
    panel.insertBefore(tools, document.getElementById("field-list") || null);
    renderList();
  }

  function ensureLayer() {
    if (!mapRef || !window.L) return null;
    if (!layerRef) layerRef = window.L.layerGroup().addTo(mapRef);
    return layerRef;
  }

  function render() {
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
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2
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
        <small>${esc(acres)} acres | ${poly.points?.length || 0} boundary points</small>
        <button class="ghost-btn" type="button" data-remove-boundary="${index}">Remove Boundary</button>
      </div>`;
    }).join("") : '<p class="fineprint">No boundaries saved yet.</p>';

    list.querySelectorAll("[data-remove-boundary]").forEach(button => {
      button.addEventListener("click", () => {
        const next = readPolygons();
        next.splice(Number(button.dataset.removeBoundary), 1);
        savePolygons(next);
        renderList();
        render();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    });
  }

  function startBoundary() {
    window.agriBoundaryDrawing = true;
    draft = [];
    render();
    setStatus("Boundary mode is on. Click points around the outside edge of the field.");
  }

  function clearBoundary() {
    window.agriBoundaryDrawing = false;
    draft = [];
    render();
    setStatus("Boundary points cleared.");
  }

  function finishBoundary() {
    if (draft.length < 3) {
      setStatus("Click at least 3 points around the field edge before finishing.");
      return;
    }
    const promptFn = window.nativeAgriPrompt || window.prompt.bind(window);
    const defaultName = `Field Boundary ${readPolygons().length + 1}`;
    const name = promptFn("Boundary name", defaultName);
    if (name === null) return;
    const calculated = acresFromPoints(draft).toFixed(1);
    const acres = promptFn("Acres for this field", calculated);
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
    window.agriBoundaryDrawing = false;
    draft = [];
    renderList();
    render();
    setStatus("Field boundary saved with the current project.");
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  }

  function hookMap(map) {
    if (!map || map.isAgriBoundaryOverrideHooked) return;
    map.isAgriBoundaryOverrideHooked = true;
    mapRef = map;
    window.agriBoundaryMap = map;
    map.on("click", event => {
      if (!window.agriBoundaryDrawing) return;
      if (event.originalEvent) {
        event.originalEvent.preventDefault?.();
        event.originalEvent.stopPropagation?.();
      }
      draft.push({ lat: event.latlng.lat, lng: event.latlng.lng });
      render();
      setStatus(`${draft.length} boundary point${draft.length === 1 ? "" : "s"} selected. Keep clicking around the edge, then finish.`);
    });
    render();
  }

  function patchLeaflet() {
    if (!window.L?.map || window.L.map.isAgriBoundaryOverrideFactory) return;
    const originalMap = window.L.map;
    const patched = function (...args) {
      const map = originalMap.apply(this, args);
      const target = args[0];
      const id = typeof target === "string" ? target : target?.id;
      if (id === "field-map-canvas") hookMap(map);
      return map;
    };
    patched.isAgriBoundaryOverrideFactory = true;
    window.L.map = patched;
  }

  function installPromptGuard() {
    if (window.nativeAgriPrompt) return;
    window.nativeAgriPrompt = window.prompt.bind(window);
    window.prompt = function (message, fallback) {
      if (window.agriBoundaryDrawing && /field name/i.test(String(message || ""))) return null;
      return window.nativeAgriPrompt(message, fallback);
    };
  }

  function installButtonOverride() {
    if (window.agriBoundaryButtonOverrideInstalled) return;
    window.agriBoundaryButtonOverrideInstalled = true;
    document.addEventListener("click", event => {
      const start = event.target.closest?.("#start-field-boundary");
      const finish = event.target.closest?.("#finish-field-boundary");
      const clear = event.target.closest?.("#clear-field-boundary");
      if (!start && !finish && !clear) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (start) startBoundary();
      if (finish) finishBoundary();
      if (clear) clearBoundary();
    }, true);
  }

  function installPersistence() {
    if (typeof projectSnapshot === "function" && !projectSnapshot.isAgriBoundaryOverrideFix) {
      const baseProjectSnapshot = projectSnapshot;
      projectSnapshot = function (existing = {}) {
        const snapshot = baseProjectSnapshot(existing);
        snapshot.fieldPolygons = readPolygons();
        return snapshot;
      };
      projectSnapshot.isAgriBoundaryOverrideFix = true;
    }
    if (typeof loadProject === "function" && !loadProject.isAgriBoundaryOverrideFix) {
      const baseLoadProject = loadProject;
      loadProject = function (projectId) {
        const result = baseLoadProject(projectId);
        try {
          const project = getStore().projects.find(item => item.id === projectId);
          if (Array.isArray(project?.fieldPolygons)) savePolygons(project.fieldPolygons);
        } catch {}
        renderList();
        render();
        return result;
      };
      loadProject.isAgriBoundaryOverrideFix = true;
    }
    if (typeof buildContext === "function" && !buildContext.isAgriBoundaryOverrideFix) {
      const baseBuildContext = buildContext;
      buildContext = function (data) {
        return `${baseBuildContext(data)}\n\nMapped field boundaries:\n${polygonSummary()}`;
      };
      buildContext.isAgriBoundaryOverrideFix = true;
    }
  }

  function install() {
    installPromptGuard();
    installButtonOverride();
    installPersistence();
    ensureUi();
    patchLeaflet();
    renderList();
    render();
    if (window.agriBoundaryMap) hookMap(window.agriBoundaryMap);
    if (window.agriFieldMap) hookMap(window.agriFieldMap);
  }

  install();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  setInterval(install, 500);
}());
