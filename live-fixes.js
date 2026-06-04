(function () {
  const POLYGON_KEY = "agridecisionFieldPolygons";
  const REFRESH_MS = 30000;
  let drawingBoundary = false;
  let draftPoints = [];
  let polygonLayer = null;
  let leafletPatched = false;
  let refreshTimer = null;

  function nowContext() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      local: now.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
      }),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local browser time"
    };
  }

  function readPolygons() {
    try {
      return JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]").filter(Boolean);
    } catch {
      return [];
    }
  }

  function savePolygons(polygons) {
    localStorage.setItem(POLYGON_KEY, JSON.stringify(polygons));
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function acresFromPoints(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    const avgLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);
    const projected = points.map(point => ({ x: point.lng * metersPerDegreeLng, y: point.lat * metersPerDegreeLat }));
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
      const acres = poly.acres || (acresFromPoints(poly.points || []).toFixed(1));
      const corners = (poly.points || []).map(point => `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`).join("; ");
      return `${poly.name}: ${acres} acres boundary with ${poly.points?.length || 0} points. Coordinates: ${corners}${poly.notes ? ` Notes: ${poly.notes}` : ""}`;
    }).join("\n");
  }

  function installStyles() {
    if (document.getElementById("agri-live-fixes-style")) return;
    const style = document.createElement("style");
    style.id = "agri-live-fixes-style";
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

  function patchLeafletMapFactory() {
    if (leafletPatched || !window.L?.map) return;
    leafletPatched = true;
    const originalMap = window.L.map;
    window.L.map = function (...args) {
      const map = originalMap.apply(this, args);
      window.agriFieldMap = map;
      const originalOn = map.on.bind(map);
      map.on = function (type, handler, ...rest) {
        if (type === "click" && typeof handler === "function" && String(handler).includes("Field name")) {
          const wrapped = function (event) {
            if (drawingBoundary) return;
            return handler.call(this, event);
          };
          return originalOn(type, wrapped, ...rest);
        }
        return originalOn(type, handler, ...rest);
      };
      originalOn("click", event => {
        if (!drawingBoundary) return;
        draftPoints.push({ lat: event.latlng.lat, lng: event.latlng.lng });
        renderBoundaryLayers();
        updateBoundaryStatus(`${draftPoints.length} boundary point${draftPoints.length === 1 ? "" : "s"} selected. Click around the field edge, then finish the boundary.`);
      });
      setTimeout(renderBoundaryLayers, 150);
      return map;
    };
  }

  function getMap() {
    return window.agriFieldMap || null;
  }

  function ensurePolygonLayer() {
    const map = getMap();
    if (!map || !window.L) return null;
    if (!polygonLayer) polygonLayer = window.L.layerGroup().addTo(map);
    return polygonLayer;
  }

  function renderBoundaryLayers() {
    const layer = ensurePolygonLayer();
    if (!layer || !window.L) return;
    layer.clearLayers();
    readPolygons().forEach(poly => {
      const points = poly.points || [];
      if (points.length < 3) return;
      window.L.polygon(points.map(point => [point.lat, point.lng]), {
        color: "#0F6E56",
        weight: 3,
        fillColor: "#5DCAA5",
        fillOpacity: 0.22
      }).bindPopup(`<strong>${esc(poly.name)}</strong><br>${esc(poly.acres || acresFromPoints(points).toFixed(1))} acres<br>${points.length} boundary points`).addTo(layer);
    });

    if (draftPoints.length) {
      draftPoints.forEach((point, index) => {
        window.L.circleMarker([point.lat, point.lng], {
          radius: 5,
          color: "#1A2B22",
          fillColor: "#fff",
          fillOpacity: 1,
          weight: 2
        }).bindTooltip(String(index + 1)).addTo(layer);
      });
      if (draftPoints.length > 1) {
        window.L.polyline(draftPoints.map(point => [point.lat, point.lng]), {
          color: "#1A2B22",
          weight: 3,
          dashArray: "5 5"
        }).addTo(layer);
      }
    }
  }

  function updateBoundaryStatus(message) {
    const status = document.getElementById("field-boundary-status") || document.getElementById("field-map-status");
    if (status) status.textContent = message;
  }

  function renderBoundaryList() {
    const list = document.getElementById("field-boundary-list");
    if (!list) return;
    const polygons = readPolygons();
    list.innerHTML = polygons.length ? polygons.map((poly, index) => {
      const acres = poly.acres || acresFromPoints(poly.points || []).toFixed(1);
      return `<div class="field-boundary-item">
        <strong>${esc(poly.name || `Boundary ${index + 1}`)}</strong>
        <small>${esc(acres)} acres | ${poly.points?.length || 0} boundary points</small>
        ${poly.notes ? `<small>${esc(poly.notes)}</small>` : ""}
        <button class="ghost-btn" type="button" data-remove-boundary="${index}">Remove Boundary</button>
      </div>`;
    }).join("") : '<p class="fineprint">No field boundaries saved yet.</p>';

    list.querySelectorAll("[data-remove-boundary]").forEach(button => {
      button.addEventListener("click", () => {
        const next = readPolygons();
        next.splice(Number(button.dataset.removeBoundary), 1);
        savePolygons(next);
        renderBoundaryList();
        renderBoundaryLayers();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    });
  }

  function startBoundary() {
    drawingBoundary = true;
    draftPoints = [];
    renderBoundaryLayers();
    updateBoundaryStatus("Boundary mode is on. Click points around the outside edge of the field.");
  }

  function clearDraftBoundary() {
    draftPoints = [];
    drawingBoundary = false;
    renderBoundaryLayers();
    updateBoundaryStatus("Boundary draft cleared.");
  }

  function finishBoundary() {
    if (draftPoints.length < 3) {
      updateBoundaryStatus("Select at least 3 points to make a field boundary.");
      return;
    }
    const defaultName = `Field Boundary ${readPolygons().length + 1}`;
    const name = prompt("Boundary name", defaultName);
    if (name === null) return;
    const calculated = acresFromPoints(draftPoints).toFixed(1);
    const acres = prompt("Acres for this field boundary", calculated);
    if (acres === null) return;
    const polygons = readPolygons();
    polygons.push({
      id: `boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim() || defaultName,
      acres: acres.trim() || calculated,
      points: draftPoints.map(point => ({ lat: point.lat, lng: point.lng })),
      notes: "Selected as a field boundary on the map",
      updatedAt: new Date().toISOString()
    });
    savePolygons(polygons);
    drawingBoundary = false;
    draftPoints = [];
    renderBoundaryList();
    renderBoundaryLayers();
    updateBoundaryStatus("Field boundary saved with the current project.");
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  }

  function ensureBoundaryUi() {
    installStyles();
    const panel = document.querySelector(".field-map-panel");
    if (!panel || document.getElementById("field-boundary-tools")) return;
    const tools = document.createElement("div");
    tools.className = "field-boundary-tools";
    tools.id = "field-boundary-tools";
    tools.innerHTML = `
      <strong>Field Boundary</strong>
      <p class="boundary-help" id="field-boundary-status">Use boundary mode when a field is not a circle. Start drawing, click the field corners/edges, then finish and save.</p>
      <div class="field-boundary-actions">
        <button class="primary-btn" type="button" id="start-field-boundary">Start Boundary</button>
        <button class="ghost-btn" type="button" id="finish-field-boundary">Finish Boundary</button>
        <button class="ghost-btn" type="button" id="clear-field-boundary">Clear Points</button>
      </div>
      <div class="field-boundary-list" id="field-boundary-list"></div>
    `;
    const fieldList = document.getElementById("field-list");
    panel.insertBefore(tools, fieldList || null);
    document.getElementById("start-field-boundary")?.addEventListener("click", startBoundary);
    document.getElementById("finish-field-boundary")?.addEventListener("click", finishBoundary);
    document.getElementById("clear-field-boundary")?.addEventListener("click", clearDraftBoundary);
    renderBoundaryList();
    renderBoundaryLayers();
  }

  function installProjectPersistence() {
    if (typeof projectSnapshot === "function" && !projectSnapshot.isAgriBoundaryFix) {
      const baseProjectSnapshot = projectSnapshot;
      projectSnapshot = function (existing = {}) {
        const snapshot = baseProjectSnapshot(existing);
        snapshot.fieldPolygons = readPolygons();
        return snapshot;
      };
      projectSnapshot.isAgriBoundaryFix = true;
    }

    if (typeof loadProject === "function" && !loadProject.isAgriBoundaryFix) {
      const baseLoadProject = loadProject;
      loadProject = function (projectId) {
        const result = baseLoadProject(projectId);
        try {
          const project = getStore().projects.find(item => item.id === projectId);
          if (Array.isArray(project?.fieldPolygons)) savePolygons(project.fieldPolygons);
        } catch {}
        renderBoundaryList();
        renderBoundaryLayers();
        return result;
      };
      loadProject.isAgriBoundaryFix = true;
    }

    if (typeof buildContext === "function" && !buildContext.isAgriBoundaryFix) {
      const baseBuildContext = buildContext;
      buildContext = function (data) {
        return `${baseBuildContext(data)}\n\nMapped field boundaries:\n${polygonSummary()}`;
      };
      buildContext.isAgriBoundaryFix = true;
    }
  }

  function installTimeContext() {
    if (typeof systemPrompt === "function" && !systemPrompt.isAgriTimeFix) {
      const baseSystemPrompt = systemPrompt;
      systemPrompt = function () {
        const time = nowContext();
        return `${baseSystemPrompt()} Current date and time context: ${time.local}. ISO timestamp: ${time.iso}. Browser time zone: ${time.zone}. If the user asks for today's date, the day of week, or current time, answer from this context directly and do not guess.`;
      };
      systemPrompt.isAgriTimeFix = true;
    }

    if (typeof callAI === "function" && !callAI.isAgriTimeFix) {
      const baseCallAI = callAI;
      callAI = function (provider, userPrompt, ...rest) {
        const time = nowContext();
        const prompt = `Current date/time for this request: ${time.local} (${time.zone}); ISO ${time.iso}.\n\n${userPrompt}`;
        return baseCallAI(provider, prompt, ...rest);
      };
      callAI.isAgriTimeFix = true;
    }
  }

  function installCmeLiveRefresh() {
    if (window.agriCmeLiveRefreshInstalled) return;
    window.agriCmeLiveRefreshInstalled = true;

    if (window.fetch && !window.fetch.isAgriLiveCmeFetch) {
      const baseFetch = window.fetch.bind(window);
      const liveFetch = function (input, init = {}) {
        if (typeof input === "string" && input.startsWith("/api/commodities")) {
          const separator = input.includes("?") ? "&" : "?";
          input = `${input}${separator}live=${Date.now()}`;
          init = { ...init, cache: "no-store", headers: { ...(init.headers || {}), "Cache-Control": "no-cache" } };
        }
        return baseFetch(input, init);
      };
      liveFetch.isAgriLiveCmeFetch = true;
      window.fetch = liveFetch;
    }

    function isCmeActive() {
      return document.getElementById("cme-view")?.classList.contains("active");
    }

    function refresh(silent = true) {
      if (typeof loadFutures === "function" && isCmeActive()) loadFutures({ silent, live: true });
    }

    if (typeof switchAppTab === "function" && !switchAppTab.isAgriCmeLiveFix) {
      const baseSwitchAppTab = switchAppTab;
      switchAppTab = function (tabName) {
        const result = baseSwitchAppTab(tabName);
        if (tabName === "cme") setTimeout(() => refresh(false), 150);
        return result;
      };
      switchAppTab.isAgriCmeLiveFix = true;
    }

    refreshTimer = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", () => refresh(true));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh(true);
    });
  }

  function installAll() {
    patchLeafletMapFactory();
    ensureBoundaryUi();
    installProjectPersistence();
    installTimeContext();
    installCmeLiveRefresh();
  }

  setInterval(() => {
    patchLeafletMapFactory();
    ensureBoundaryUi();
    renderBoundaryLayers();
  }, 800);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAll);
  } else {
    installAll();
  }

  window.addEventListener("beforeunload", () => {
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
    if (refreshTimer) clearInterval(refreshTimer);
  });
}());
