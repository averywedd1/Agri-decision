(function () {
  const POLYGON_KEY = "agridecisionFieldPolygons";
  let map = null;
  let layer = null;
  let leafletPromise = null;
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

  function cleanPoint(point) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function orderBoundaryPoints(points) {
    const cleaned = (Array.isArray(points) ? points : []).map(cleanPoint).filter(Boolean);
    if (cleaned.length < 3) return cleaned;
    const center = cleaned.reduce((sum, point) => ({
      lat: sum.lat + point.lat,
      lng: sum.lng + point.lng
    }), { lat: 0, lng: 0 });
    center.lat /= cleaned.length;
    center.lng /= cleaned.length;
    const lngScale = Math.max(0.2, Math.cos(center.lat * Math.PI / 180));
    return cleaned
      .map((point, index) => ({
        point,
        index,
        angle: Math.atan2(point.lat - center.lat, (point.lng - center.lng) * lngScale)
      }))
      .sort((a, b) => a.angle - b.angle || a.index - b.index)
      .map(item => item.point);
  }

  function readPolygons() {
    try { return JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]").filter(Boolean); }
    catch { return []; }
  }

  function savePolygons(polygons) {
    localStorage.setItem(POLYGON_KEY, JSON.stringify(polygons));
  }

  function acresFromPoints(points) {
    points = orderBoundaryPoints(points);
    if (!Array.isArray(points) || points.length < 3) return 0;
    const avgLat = points.reduce((sum, point) => sum + Number(point.lat || 0), 0) / points.length;
    const metersLat = 111320;
    const metersLng = 111320 * Math.cos(avgLat * Math.PI / 180);
    const projected = points.map(point => ({ x: Number(point.lng) * metersLng, y: Number(point.lat) * metersLat }));
    let area = 0;
    projected.forEach((point, index) => {
      const next = projected[(index + 1) % projected.length];
      area += point.x * next.y - next.x * point.y;
    });
    return Math.abs(area / 2) / 4046.8564224;
  }

  function polygonSummary(polygons = readPolygons()) {
    if (!polygons.length) return "No field boundaries drawn yet.";
    return polygons.map(poly => {
      const points = orderBoundaryPoints(poly.points || []);
      const acres = poly.acres || acresFromPoints(points).toFixed(1);
      const corners = points.map(point => `${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}`).join("; ");
      return `${poly.name}: ${acres} acres boundary with ${points.length} points. Coordinates: ${corners}${poly.notes ? ` Notes: ${poly.notes}` : ""}`;
    }).join("\n");
  }

  function setStatus(message) {
    const target = document.getElementById("boundary-status");
    if (target) target.textContent = message;
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error("The map library could not load. Refresh and try again."));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function installStyles() {
    if (document.getElementById("agri-boundary-only-style")) return;
    const style = document.createElement("style");
    style.id = "agri-boundary-only-style";
    style.textContent = `
      .boundary-only-view { min-height: calc(100vh - 60px); padding-top: 44px; background: #f7faf5; }
      .boundary-layout { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 20px; align-items: start; }
      .boundary-panel, .boundary-map-card { border: 1px solid var(--line); border-radius: 8px; background: #fff; box-shadow: var(--shadow); }
      .boundary-panel { display: grid; gap: 14px; padding: 20px; }
      .boundary-actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .boundary-map-card { overflow: hidden; }
      #boundary-map-canvas { height: min(68vh, 620px); min-height: 440px; background: #e9f1e3; }
      .boundary-status { margin: 0; color: var(--muted); }
      .boundary-list { display: grid; gap: 10px; }
      .boundary-item { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: #f7faf5; }
      .boundary-item small { color: var(--muted); }
      @media (max-width: 920px) {
        .boundary-layout { grid-template-columns: 1fr; }
        #boundary-map-canvas { height: 480px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMenuButton() {
    const menu = document.getElementById("site-menu-panel");
    if (!menu || menu.querySelector('[data-app-tab="field-map"]')) return;
    const button = document.createElement("button");
    button.className = "workspace-tab";
    button.type = "button";
    button.dataset.appTab = "field-map";
    button.textContent = "Field Map";
    button.addEventListener("click", () => {
      button.closest("details")?.removeAttribute("open");
      if (typeof switchAppTab === "function") switchAppTab("field-map");
    });
    const tasksButton = menu.querySelector('[data-app-tab="tasks"]');
    const aiButton = menu.querySelector('[data-app-tab="ai"]');
    menu.insertBefore(button, tasksButton || aiButton || null);
  }

  function ensureView() {
    installStyles();
    ensureMenuButton();
    let view = document.getElementById("field-map-view");
    if (!view) {
      view = document.createElement("section");
      view.id = "field-map-view";
      document.body.insertBefore(view, document.getElementById("story-view") || document.querySelector("footer"));
    }
    if (view.dataset.boundaryOnly === "true") return;
    view.className = "app-view field-map-view boundary-only-view";
    view.dataset.boundaryOnly = "true";
    view.innerHTML = `
      <div class="section boundary-section">
        <div class="section-kicker">Field Map</div>
        <h2>Draw field boundaries</h2>
        <p class="section-lead">This map automatically fills the field boundary from the points you select, even if the points are not clicked in perfect order.</p>
        <div class="boundary-layout">
          <div class="boundary-panel">
            <p class="boundary-status" id="boundary-status">Start Boundary, then click points around the field edge.</p>
            <div class="boundary-actions">
              <button class="primary-btn" type="button" id="start-boundary-only">Start Boundary</button>
              <button class="ghost-btn" type="button" id="finish-boundary-only">Finish Boundary</button>
              <button class="ghost-btn" type="button" id="clear-boundary-only">Clear Points</button>
              <button class="ghost-btn" type="button" id="save-boundary-only">Save Map</button>
            </div>
            <div class="boundary-list" id="boundary-list"></div>
          </div>
          <div class="boundary-map-card"><div id="boundary-map-canvas" aria-label="Boundary drawing map"></div></div>
        </div>
      </div>
    `;
    document.getElementById("start-boundary-only")?.addEventListener("click", startBoundary);
    document.getElementById("finish-boundary-only")?.addEventListener("click", finishBoundary);
    document.getElementById("clear-boundary-only")?.addEventListener("click", clearBoundary);
    document.getElementById("save-boundary-only")?.addEventListener("click", () => {
      if (typeof saveProject === "function") saveProject();
      setStatus("Field boundaries saved with the current project.");
    });
    map = null;
    layer = null;
    renderList();
  }

  function initMap() {
    ensureView();
    const canvas = document.getElementById("boundary-map-canvas");
    if (!canvas || map) {
      setTimeout(() => map?.invalidateSize?.(), 100);
      return;
    }
    loadLeaflet().then(L => {
      map = L.map(canvas).setView([39.5, -98.35], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.on("click", event => {
        if (!drawing) return;
        draft.push({ lat: event.latlng.lat, lng: event.latlng.lng });
        renderMap();
        const filled = draft.length >= 3 ? " The boundary preview is filled automatically." : "";
        setStatus(`${draft.length} boundary point${draft.length === 1 ? "" : "s"} selected.${filled}`);
      });
      setTimeout(() => map.invalidateSize(), 120);
      renderMap(true);
    }).catch(error => setStatus(error.message));
  }

  function renderMap(fit = false) {
    if (!layer || !window.L) return;
    layer.clearLayers();
    const shapes = [];
    readPolygons().forEach(poly => {
      const points = orderBoundaryPoints(poly.points || []);
      if (points.length < 3) return;
      const shape = window.L.polygon(points.map(point => [point.lat, point.lng]), {
        color: "#0F6E56",
        weight: 3,
        fillColor: "#5DCAA5",
        fillOpacity: 0.24
      }).bindPopup(`<strong>${esc(poly.name)}</strong><br>${esc(poly.acres || acresFromPoints(points).toFixed(1))} acres<br>${points.length} boundary points`).addTo(layer);
      shapes.push(shape);
    });
    if (draft.length) {
      draft.forEach((point, index) => {
        const marker = window.L.circleMarker([point.lat, point.lng], {
          radius: 6,
          color: "#1A2B22",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2
        }).bindTooltip(String(index + 1), { permanent: true, direction: "top" }).addTo(layer);
        shapes.push(marker);
      });
      if (draft.length >= 3) {
        const previewPoints = orderBoundaryPoints(draft);
        shapes.push(window.L.polygon(previewPoints.map(point => [point.lat, point.lng]), {
          color: "#1A2B22",
          weight: 3,
          dashArray: "6 5",
          fillColor: "#5DCAA5",
          fillOpacity: 0.18
        }).addTo(layer));
      } else if (draft.length > 1) {
        shapes.push(window.L.polyline(draft.map(point => [point.lat, point.lng]), {
          color: "#1A2B22",
          weight: 3,
          dashArray: "6 5"
        }).addTo(layer));
      }
    }
    if (fit && shapes.length && map) {
      const group = window.L.featureGroup(shapes);
      map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
    }
  }

  function renderList() {
    const list = document.getElementById("boundary-list");
    if (!list) return;
    const polygons = readPolygons();
    list.innerHTML = polygons.length ? polygons.map((poly, index) => {
      const acres = poly.acres || acresFromPoints(poly.points || []).toFixed(1);
      return `<div class="boundary-item">
        <strong>${esc(poly.name || `Boundary ${index + 1}`)}</strong>
        <small>${esc(acres)} acres | ${poly.points?.length || 0} boundary points</small>
        <button class="ghost-btn" type="button" data-remove-boundary="${index}">Remove Boundary</button>
      </div>`;
    }).join("") : '<p class="fineprint">No field boundaries saved yet.</p>';
    list.querySelectorAll("[data-remove-boundary]").forEach(button => {
      button.addEventListener("click", () => {
        const next = readPolygons();
        next.splice(Number(button.dataset.removeBoundary), 1);
        savePolygons(next);
        renderList();
        renderMap();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    });
  }

  function startBoundary() {
    drawing = true;
    draft = [];
    renderMap();
    setStatus("Boundary mode is on. Click the outside points of the field in any order.");
  }

  function clearBoundary() {
    drawing = false;
    draft = [];
    renderMap();
    setStatus("Boundary points cleared.");
  }

  function finishBoundary() {
    if (draft.length < 3) {
      setStatus("Click at least 3 points around the field edge before finishing.");
      return;
    }
    const orderedDraft = orderBoundaryPoints(draft);
    const defaultName = `Field Boundary ${readPolygons().length + 1}`;
    const name = prompt("Boundary name", defaultName);
    if (name === null) return;
    const calculated = acresFromPoints(orderedDraft).toFixed(1);
    const acres = prompt("Acres for this field", calculated);
    if (acres === null) return;
    const polygons = readPolygons();
    polygons.push({
      id: `boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim() || defaultName,
      acres: acres.trim() || calculated,
      points: orderedDraft.map(point => ({ lat: point.lat, lng: point.lng })),
      notes: "Selected as a field boundary on the map",
      updatedAt: new Date().toISOString()
    });
    savePolygons(polygons);
    drawing = false;
    draft = [];
    renderList();
    renderMap(true);
    setStatus("Field boundary saved with the points auto-filled into one shape.");
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  }

  function installPersistence() {
    if (typeof projectSnapshot === "function" && !projectSnapshot.isAgriBoundaryOnlyFix) {
      const baseProjectSnapshot = projectSnapshot;
      projectSnapshot = function (existing = {}) {
        const snapshot = baseProjectSnapshot(existing);
        snapshot.fieldPolygons = readPolygons().map(poly => ({ ...poly, points: orderBoundaryPoints(poly.points || []) }));
        snapshot.fieldMap = [];
        return snapshot;
      };
      projectSnapshot.isAgriBoundaryOnlyFix = true;
    }
    if (typeof loadProject === "function" && !loadProject.isAgriBoundaryOnlyFix) {
      const baseLoadProject = loadProject;
      loadProject = function (projectId) {
        const result = baseLoadProject(projectId);
        try {
          const project = getStore().projects.find(item => item.id === projectId);
          if (Array.isArray(project?.fieldPolygons)) {
            savePolygons(project.fieldPolygons.map(poly => ({ ...poly, points: orderBoundaryPoints(poly.points || []) })));
          }
        } catch {}
        renderList();
        renderMap(true);
        return result;
      };
      loadProject.isAgriBoundaryOnlyFix = true;
    }
    if (typeof buildContext === "function" && !buildContext.isAgriBoundaryOnlyFix) {
      const baseBuildContext = buildContext;
      buildContext = function (data) {
        return `${baseBuildContext(data)}\n\nMapped field boundaries:\n${polygonSummary()}`;
      };
      buildContext.isAgriBoundaryOnlyFix = true;
    }
    if (typeof switchAppTab === "function" && !switchAppTab.isAgriBoundaryOnlyFix) {
      const baseSwitchAppTab = switchAppTab;
      switchAppTab = function (tabName) {
        ensureView();
        const result = baseSwitchAppTab(tabName);
        const view = document.getElementById("field-map-view");
        if (view) view.classList.toggle("active", tabName === "field-map");
        if (tabName === "field-map") setTimeout(initMap, 80);
        return result;
      };
      switchAppTab.isAgriBoundaryOnlyFix = true;
    }
  }

  function install() {
    ensureView();
    installPersistence();
    if (document.getElementById("field-map-view")?.classList.contains("active")) initMap();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 300);
  setTimeout(install, 1200);
}());
