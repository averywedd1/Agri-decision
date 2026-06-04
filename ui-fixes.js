(function () {
  const FIELD_MAP_KEY = "agridecisionFieldMap";
  const ACTIVE_TAB_KEY = "agridecisionActiveTab";
  let fieldMap = null;
  let fieldLayer = null;
  let leafletPromise = null;

  function installCommodityFetchBust() {
    if (!window.fetch || window.fetch.isAgriCommodityBust) return;
    const baseFetch = window.fetch.bind(window);
    const agriFetch = function (input, init = {}) {
      if (typeof input === "string" && input.startsWith("/api/commodities")) {
        const separator = input.includes("?") ? "&" : "?";
        input = `${input}${separator}_=${Date.now()}`;
        init = { ...init, cache: "no-store" };
      }
      return baseFetch(input, init);
    };
    agriFetch.isAgriCommodityBust = true;
    window.fetch = agriFetch;
  }

  function installFavicon() {
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(link => link.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = "/agridecision_icon.svg?v=2";
    document.head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = "/agridecision_icon.svg?v=2";
    document.head.appendChild(apple);
  }

  function installLogoStyles() {
    if (document.getElementById("agri-logo-style")) return;
    const style = document.createElement("style");
    style.id = "agri-logo-style";
    style.textContent = `
      .brand.agri-logo-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        text-decoration: none;
      }
      .agri-brand-icon {
        display: block;
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        object-fit: contain;
      }
      .agri-brand-word {
        color: #f7fbf1;
        font-size: 1.45rem;
        font-weight: 800;
        line-height: 1;
        letter-spacing: 0;
        white-space: nowrap;
      }
      @media (max-width: 640px) {
        .agri-brand-icon { width: 38px; height: 38px; flex-basis: 38px; }
        .agri-brand-word { font-size: 1.12rem; }
      }
    `;
    document.head.appendChild(style);
  }

  function installChatContrastStyles() {
    if (document.getElementById("agri-chat-contrast-style")) return;
    const style = document.createElement("style");
    style.id = "agri-chat-contrast-style";
    style.textContent = `
      #analysis-section .analysis-content {
        background: #f7faf5;
        color: #1a1a18;
        border: 1px solid rgba(176, 223, 169, 0.58);
        border-radius: 8px;
        box-shadow: 0 12px 28px rgba(26, 51, 24, 0.10);
      }
      #analysis-section .analysis-content h1,
      #analysis-section .analysis-content h2,
      #analysis-section .analysis-content h3,
      #analysis-section .analysis-content h4,
      #analysis-section .analysis-content strong,
      #analysis-section .analysis-content th {
        color: #122212;
      }
      #analysis-section .analysis-content p,
      #analysis-section .analysis-content li,
      #analysis-section .analysis-content td,
      #analysis-section .analysis-content small {
        color: #243421;
      }
      #analysis-section .analysis-content table {
        background: #ffffff;
      }
      #analysis-section .analysis-content th,
      #analysis-section .analysis-content td {
        border-color: rgba(26, 51, 24, 0.14);
      }
      #analysis-section .chatbot-card,
      #ai-view .chatbot-card {
        background: #f7faf5;
        border-color: rgba(176, 223, 169, 0.55);
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.24);
      }
      #analysis-section .chatbot-header,
      #ai-view .chatbot-header {
        background: #1a3318;
        border-bottom-color: rgba(176, 223, 169, 0.28);
      }
      #analysis-section .chatbot-header h3,
      #ai-view .chatbot-header h3 {
        color: #ffffff;
      }
      #analysis-section .chatbot-header small,
      #ai-view .chatbot-header small {
        color: #dff2db;
      }
      #analysis-section .chatbot-messages,
      #ai-view .chatbot-messages {
        background: #eef6ea;
      }
      #analysis-section .chat-msg,
      #ai-view .chat-msg {
        border: 1px solid rgba(26, 51, 24, 0.13);
        box-shadow: 0 4px 12px rgba(26, 51, 24, 0.08);
      }
      #analysis-section .chat-msg.ai,
      #ai-view .chat-msg.ai {
        background: #ffffff;
        color: #1a1a18;
      }
      #analysis-section .chat-msg.ai strong,
      #analysis-section .chat-msg.ai h1,
      #analysis-section .chat-msg.ai h2,
      #analysis-section .chat-msg.ai h3,
      #analysis-section .chat-msg.ai h4,
      #ai-view .chat-msg.ai strong,
      #ai-view .chat-msg.ai h1,
      #ai-view .chat-msg.ai h2,
      #ai-view .chat-msg.ai h3,
      #ai-view .chat-msg.ai h4 {
        color: #122212;
      }
      #analysis-section .chat-msg.user,
      #ai-view .chat-msg.user {
        background: #244d22;
        color: #ffffff;
        border-color: #3a8035;
      }
      #analysis-section .chatbot-quick,
      #ai-view .chatbot-quick {
        background: #f7faf5;
      }
      #analysis-section .chatbot-quick button,
      #ai-view .chatbot-quick button {
        background: #dff2db;
        color: #122212;
        border-color: #b0dfa9;
      }
      #analysis-section .chatbot-input-row,
      #ai-view .chatbot-input-row {
        background: #ffffff;
        border-top-color: rgba(26, 51, 24, 0.16);
      }
      #analysis-section .chatbot-input-row textarea,
      #ai-view .chatbot-input-row textarea {
        background: #ffffff;
        color: #1a1a18;
      }
    `;
    document.head.appendChild(style);
  }

  function installFieldMapStyles() {
    if (document.getElementById("agri-field-map-style")) return;
    const style = document.createElement("style");
    style.id = "agri-field-map-style";
    style.textContent = `
      .field-map-view { min-height: calc(100vh - 60px); padding-top: 44px; background: #f7faf5; }
      .field-map-layout { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 20px; align-items: start; }
      .field-map-panel, .field-map-card { border: 1px solid var(--line); border-radius: 8px; background: #ffffff; box-shadow: var(--shadow); }
      .field-map-panel { padding: 20px; display: grid; gap: 14px; }
      .field-map-panel label { display: grid; gap: 6px; color: var(--green-900); font-weight: 700; }
      .field-map-panel input, .field-map-panel textarea { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 11px 12px; font: inherit; }
      .field-map-panel textarea { min-height: 86px; resize: vertical; }
      .field-map-actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .field-map-card { overflow: hidden; }
      #field-map-canvas { height: min(68vh, 620px); min-height: 420px; background: #e9f1e3; }
      .field-list { display: grid; gap: 10px; margin-top: 14px; }
      .field-list-item { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #f7faf5; display: grid; gap: 4px; }
      .field-list-item strong { color: var(--green-900); }
      .field-list-item small { color: var(--muted); }
      .map-status { margin: 0; color: var(--muted); }
      @media (max-width: 920px) {
        .field-map-layout { grid-template-columns: 1fr; }
        #field-map-canvas { height: 480px; }
      }
    `;
    document.head.appendChild(style);
  }

  function applyLogo() {
    const brand = document.querySelector(".brand");
    if (!brand || brand.dataset.logoApplied === "icon-word") return;
    brand.classList.add("agri-logo-brand");
    brand.innerHTML = '<img class="agri-brand-icon" src="/agridecision_icon.svg" alt=""><span class="agri-brand-word">AgriDecision</span>';
    brand.dataset.logoApplied = "icon-word";
  }

  function moveExpenseChartToTools() {
    const card = document.getElementById("expense-chart-card");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!card || !toolsSection || toolsSection.contains(card)) return;

    const toolGrid = toolsSection.querySelector(".tool-grid");
    toolsSection.insertBefore(card, toolGrid || null);
    if (typeof updateExpensePieChart === "function") updateExpensePieChart();
  }

  function formatUpdatedTime(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "-" || raw.toLowerCase().includes("loading")) return raw || "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function applyCmeTableFixes() {
    document.querySelectorAll(".cme-snapshot-panel, .cme-snapshot-shell").forEach(element => {
      element.hidden = true;
    });

    document.querySelectorAll("#futures-body tr").forEach(row => {
      if (row.cells.length < 11) return;
      const updatedCell = row.cells[10];
      const raw = updatedCell.dataset.rawUpdated || updatedCell.textContent.trim();
      const formatted = formatUpdatedTime(raw);
      updatedCell.dataset.rawUpdated = raw;
      updatedCell.textContent = formatted;
      if (formatted !== raw) updatedCell.title = raw;
    });
  }

  function wrapCmeRefresh() {
    if (typeof loadFutures !== "function" || loadFutures.isAgriUiFix) return;
    const originalLoadFutures = loadFutures;
    loadFutures = async function (...args) {
      const result = await originalLoadFutures(...args);
      applyCmeTableFixes();
      return result;
    };
    loadFutures.isAgriUiFix = true;
  }

  function readFields() {
    try {
      return JSON.parse(localStorage.getItem(FIELD_MAP_KEY) || "[]").filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveFields(fields) {
    localStorage.setItem(FIELD_MAP_KEY, JSON.stringify(fields));
  }

  function fieldSummary(fields = readFields()) {
    if (!fields.length) return "No mapped field locations yet.";
    return fields.map(field => `${field.name}: ${field.acres || "unknown"} acres at ${Number(field.lat).toFixed(5)}, ${Number(field.lng).toFixed(5)}${field.notes ? ` (${field.notes})` : ""}`).join("\n");
  }

  function currentProjectFields() {
    try {
      const project = typeof activeProject === "function" ? activeProject() : null;
      return Array.isArray(project?.fieldMap) ? project.fieldMap : readFields();
    } catch {
      return readFields();
    }
  }

  function renderFieldList() {
    const list = document.getElementById("field-list");
    const status = document.getElementById("field-map-status");
    if (!list) return;
    const fields = readFields();
    if (status) status.textContent = fields.length ? `${fields.length} mapped field${fields.length === 1 ? "" : "s"} saved locally and with the current project when you save.` : "Click the map or enter coordinates to add a field.";
    list.innerHTML = fields.length ? fields.map((field, index) => `
      <div class="field-list-item">
        <strong>${esc(field.name || `Field ${index + 1}`)}</strong>
        <small>${esc(field.acres || "Unknown")} acres | ${Number(field.lat).toFixed(5)}, ${Number(field.lng).toFixed(5)}</small>
        ${field.notes ? `<small>${esc(field.notes)}</small>` : ""}
        <button class="ghost-btn" type="button" data-remove-field="${index}">Remove</button>
      </div>
    `).join("") : '<p class="fineprint">No fields mapped yet.</p>';
    list.querySelectorAll("[data-remove-field]").forEach(button => {
      button.addEventListener("click", () => {
        const next = readFields();
        next.splice(Number(button.dataset.removeField), 1);
        saveFields(next);
        renderFieldList();
        renderFieldMarkers();
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
      });
    });
  }

  function addField(field) {
    const fields = readFields();
    fields.push({
      id: `field-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: field.name || `Field ${fields.length + 1}`,
      acres: field.acres || "",
      lat: Number(field.lat),
      lng: Number(field.lng),
      notes: field.notes || "",
      updatedAt: new Date().toISOString()
    });
    saveFields(fields);
    renderFieldList();
    renderFieldMarkers();
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  }

  function renderFieldMarkers() {
    if (!fieldMap || !window.L) return;
    if (!fieldLayer) fieldLayer = window.L.layerGroup().addTo(fieldMap);
    fieldLayer.clearLayers();
    const fields = readFields();
    fields.forEach(field => {
      const acres = Number(field.acres) || 40;
      const radius = Math.max(90, Math.min(1100, Math.sqrt(acres) * 42));
      window.L.circle([field.lat, field.lng], {
        radius,
        color: "#244d22",
        weight: 2,
        fillColor: "#dff2db",
        fillOpacity: 0.35
      }).bindPopup(`<strong>${esc(field.name)}</strong><br>${esc(field.acres || "Unknown")} acres<br>${Number(field.lat).toFixed(5)}, ${Number(field.lng).toFixed(5)}`).addTo(fieldLayer);
    });
    if (fields.length) {
      const group = window.L.featureGroup(fieldLayer.getLayers());
      if (group.getLayers().length) fieldMap.fitBounds(group.getBounds().pad(0.25), { maxZoom: 14 });
    }
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
      script.onerror = () => reject(new Error("The map library could not load. You can still save fields by latitude and longitude."));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function initFieldMap() {
    const canvas = document.getElementById("field-map-canvas");
    if (!canvas || fieldMap) return;
    loadLeaflet().then(L => {
      fieldMap = L.map(canvas).setView([39.5, -98.35], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(fieldMap);
      fieldLayer = L.layerGroup().addTo(fieldMap);
      fieldMap.on("click", event => {
        const defaultName = `Field ${readFields().length + 1}`;
        const name = prompt("Field name", defaultName);
        if (name === null) return;
        const acres = prompt("How many acres?", "80");
        if (acres === null) return;
        addField({ name: name.trim() || defaultName, acres: acres.trim(), lat: event.latlng.lat, lng: event.latlng.lng, notes: "Selected on map" });
      });
      setTimeout(() => fieldMap.invalidateSize(), 100);
      renderFieldMarkers();
    }).catch(error => {
      const status = document.getElementById("field-map-status");
      if (status) status.textContent = error.message;
    });
  }

  function ensureFieldMapView() {
    installFieldMapStyles();
    const menu = document.getElementById("site-menu-panel");
    if (menu && !menu.querySelector('[data-app-tab="field-map"]')) {
      const button = document.createElement("button");
      button.className = "workspace-tab";
      button.type = "button";
      button.dataset.appTab = "field-map";
      button.textContent = "Field Map";
      button.addEventListener("click", () => {
        button.closest("details")?.removeAttribute("open");
        switchAppTab("field-map");
      });
      const tasksButton = menu.querySelector('[data-app-tab="tasks"]');
      const aiButton = menu.querySelector('[data-app-tab="ai"]');
      menu.insertBefore(button, tasksButton || aiButton || null);
    }

    if (!document.getElementById("field-map-view")) {
      const view = document.createElement("section");
      view.className = "app-view field-map-view";
      view.id = "field-map-view";
      view.innerHTML = `
        <div class="section field-map-section">
          <div class="section-kicker">Field Map</div>
          <h2>Select field locations and acres</h2>
          <p class="section-lead">Click the map to place fields or enter coordinates manually. These locations are added to AI context for location-aware analysis.</p>
          <div class="field-map-layout">
            <div class="field-map-panel">
              <p class="map-status" id="field-map-status">Click the map or enter coordinates to add a field.</p>
              <label>Field Name<input id="field-name" type="text" placeholder="North 80"></label>
              <label>Acres<input id="field-acres" type="number" min="0" step="0.01" placeholder="80"></label>
              <label>Latitude<input id="field-lat" type="number" step="0.000001" placeholder="41.8781"></label>
              <label>Longitude<input id="field-lng" type="number" step="0.000001" placeholder="-93.0977"></label>
              <label>Notes<textarea id="field-notes" placeholder="Drainage, soil, crop history, irrigation, access..."></textarea></label>
              <div class="field-map-actions">
                <button class="primary-btn" type="button" id="add-field-location">Add Field</button>
                <button class="ghost-btn" type="button" id="save-field-map">Save Field Map</button>
              </div>
              <div class="field-list" id="field-list"></div>
            </div>
            <div class="field-map-card"><div id="field-map-canvas" aria-label="Interactive field map"></div></div>
          </div>
        </div>
      `;
      document.body.insertBefore(view, document.getElementById("story-view") || document.querySelector("footer"));
      document.getElementById("add-field-location")?.addEventListener("click", () => {
        const lat = Number(document.getElementById("field-lat")?.value);
        const lng = Number(document.getElementById("field-lng")?.value);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return alert("Enter a latitude and longitude, or click the map to select a field.");
        addField({
          name: document.getElementById("field-name")?.value.trim() || `Field ${readFields().length + 1}`,
          acres: document.getElementById("field-acres")?.value.trim() || "",
          lat,
          lng,
          notes: document.getElementById("field-notes")?.value.trim() || ""
        });
      });
      document.getElementById("save-field-map")?.addEventListener("click", () => {
        if (typeof saveProject === "function") saveProject();
        const status = document.getElementById("field-map-status");
        if (status) status.textContent = "Field map saved with the current project.";
      });
    }
    renderFieldList();
  }

  function restoreFieldsFromProject(project) {
    if (Array.isArray(project?.fieldMap)) {
      saveFields(project.fieldMap);
      renderFieldList();
      renderFieldMarkers();
    }
  }

  function installFieldMapPersistence() {
    if (typeof projectSnapshot === "function" && !projectSnapshot.isAgriFieldMapFix) {
      const baseProjectSnapshot = projectSnapshot;
      projectSnapshot = function (existing = {}) {
        const snapshot = baseProjectSnapshot(existing);
        snapshot.fieldMap = readFields();
        return snapshot;
      };
      projectSnapshot.isAgriFieldMapFix = true;
    }

    if (typeof loadProject === "function" && !loadProject.isAgriFieldMapFix) {
      const baseLoadProject = loadProject;
      loadProject = function (projectId) {
        const result = baseLoadProject(projectId);
        try {
          const project = getStore().projects.find(item => item.id === projectId);
          restoreFieldsFromProject(project);
        } catch {}
        return result;
      };
      loadProject.isAgriFieldMapFix = true;
    }

    if (typeof buildContext === "function" && !buildContext.isAgriFieldMapFix) {
      const baseBuildContext = buildContext;
      buildContext = function (data) {
        return `${baseBuildContext(data)}\n\nField map locations:\n${fieldSummary(currentProjectFields())}`;
      };
      buildContext.isAgriFieldMapFix = true;
    }
  }

  function installTabPersistence() {
    if (typeof switchAppTab !== "function" || switchAppTab.isAgriTabFix) return;
    const baseSwitchAppTab = switchAppTab;
    switchAppTab = function (tabName) {
      ensureFieldMapView();
      localStorage.setItem(ACTIVE_TAB_KEY, tabName);
      baseSwitchAppTab(tabName);
      const fieldView = document.getElementById("field-map-view");
      if (fieldView) fieldView.classList.toggle("active", tabName === "field-map");
      document.querySelectorAll(".workspace-tab").forEach(button => button.classList.toggle("active", button.dataset.appTab === tabName));
      if (tabName === "field-map") {
        initFieldMap();
        setTimeout(() => fieldMap?.invalidateSize(), 120);
      }
    };
    switchAppTab.isAgriTabFix = true;

    setTimeout(() => {
      const saved = localStorage.getItem(ACTIVE_TAB_KEY);
      if (saved && document.querySelector(`[data-app-tab="${saved}"]`)) switchAppTab(saved);
    }, 450);
  }

  function installTaskSaveFix() {
    const button = document.getElementById("save-tasks");
    if (!button || button.dataset.agriSaveFix === "true") return;
    button.dataset.agriSaveFix = "true";
    button.addEventListener("click", () => {
      const output = document.getElementById("task-output");
      window.agriTaskContent = output?.innerHTML || window.agriTaskContent || "";
      if (typeof saveProject === "function") saveProject();
      const original = button.textContent;
      button.textContent = "Saved";
      setTimeout(() => { button.textContent = original || "Save Tasks"; }, 1400);
    }, true);
  }

  function installAccountUiFix() {
    if (typeof openAccount === "function" && !openAccount.isAgriAccountUiFix) {
      const baseOpenAccount = openAccount;
      openAccount = function (...args) {
        const result = baseOpenAccount(...args);
        setTimeout(updateAccountUi, 0);
        return result;
      };
      openAccount.isAgriAccountUiFix = true;
    }
    if (typeof applyProfile === "function" && !applyProfile.isAgriAccountUiFix) {
      const baseApplyProfile = applyProfile;
      applyProfile = function (...args) {
        const result = baseApplyProfile(...args);
        updateAccountUi();
        return result;
      };
      applyProfile.isAgriAccountUiFix = true;
    }
    updateAccountUi();
  }

  function updateAccountUi() {
    const p = typeof profile === "function" ? profile() : {};
    const hasAccount = Boolean(p?.email);
    const createMode = document.getElementById("auth-create-mode");
    const signInMode = document.getElementById("auth-signin-mode");
    const title = document.getElementById("account-title");
    const help = document.getElementById("account-help");
    const save = document.getElementById("save-account");
    const nav = document.getElementById("account-nav-btn");

    if (nav && hasAccount && p.name) nav.textContent = `Hi, ${String(p.name).split(" ")[0]}`;
    if (!hasAccount) return;

    if (createMode) {
      createMode.hidden = true;
      createMode.classList.remove("active");
    }
    if (signInMode) {
      signInMode.classList.add("active");
      signInMode.textContent = "Account";
    }
    if (title) title.textContent = "Your AgriDecision account";
    if (help) help.textContent = "Your account can sync profile details, projects, field maps, tasks, reports, and chats when cloud sync is configured.";
    if (save && /create account/i.test(save.textContent)) save.textContent = "Save Account";
  }

  function installChatFixes() {
    if (typeof sendReportChat === "function" && !sendReportChat.isAgriQuestionFix) {
      sendReportChat = async function () {
        const input = document.getElementById("chatbot-input");
        const question = input?.value.trim();
        if (!question) return;
        const provider = getProvider();
        if (!provider.id) return alert("No configured AI providers were found in Vercel.");
        addMessage("chatbot-messages", "user", question);
        input.value = "";
        document.getElementById("chatbot-send").disabled = true;
        addMessage("chatbot-messages", "ai", "<em>Thinking...</em>");
        const loading = document.getElementById("chatbot-messages").lastElementChild;
        const prompt = `Answer the user's question directly. Do not regenerate the full business report unless the user specifically asks for a new report. Use the farm data and report context only as background. Keep the answer practical, specific, and formatted in clean HTML without markdown asterisks.\n\nFarm data:\n${buildContext(getFormData())}\n\nReport context:\n${reportText()}\n\nRecent chat:\n${reportChat.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nUser question:\n${question}`;
        try {
          const safe = cleanAI(await callAI(provider, prompt, 1300, 0.35));
          loading.innerHTML = safe;
          reportChat.push({ role: "user", content: question }, { role: "assistant", content: safe.replace(/<[^>]*>/g, " ") });
          if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
        } catch (error) {
          loading.innerHTML = `<span style="color:#a03b2f;">Chat error: ${esc(error.message)}</span>`;
        } finally {
          document.getElementById("chatbot-send").disabled = false;
        }
      };
      sendReportChat.isAgriQuestionFix = true;
    }

    if (typeof sendComboChat === "function" && !sendComboChat.isAgriQuestionFix) {
      sendComboChat = async function () {
        const input = document.getElementById("ai-combo-input");
        const question = input?.value.trim();
        if (!question) return;
        if (typeof hasProfile === "function" && !hasProfile()) {
          openAccount();
          if (typeof updateAIContext === "function") updateAIContext();
          return;
        }
        if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
        addMessage("ai-combo-messages", "user", question);
        input.value = "";
        document.getElementById("ai-combo-send").disabled = true;
        addMessage("ai-combo-messages", "ai", "<em>Asking AgriDecision AI...</em>");
        const loading = document.getElementById("ai-combo-messages").lastElementChild;
        const prompt = `Answer the user's question directly using the saved account and project context. Do not paste a full report into the chat unless the user asks for one. Compare configured AI perspectives only when useful, then give one clear recommendation. Use clean HTML and do not use markdown asterisks.\n\nAccount: ${profile().name || "Account user"}\nProject: ${activeProject()?.name || projectName("Unsaved Project")}\nFarm data:\n${buildContext(getFormData())}\n\nExisting report context:\n${reportText()}\n\nUser question:\n${question}`;
        try {
          const safe = cleanAI(await callAI({ id: "all", name: "AgriDecision AI" }, prompt, 1500, 0.35));
          loading.innerHTML = safe;
          comboChat.push({ role: "user", content: question }, { role: "assistant", content: safe });
          if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
        } catch (error) {
          loading.innerHTML = `<span style="color:#a03b2f;">AgriDecision AI error: ${esc(error.message)}</span>`;
        } finally {
          document.getElementById("ai-combo-send").disabled = false;
        }
      };
      sendComboChat.isAgriQuestionFix = true;
    }
  }

  function applyUiFixes() {
    installLogoStyles();
    installChatContrastStyles();
    installFavicon();
    applyLogo();
    ensureFieldMapView();
    installFieldMapPersistence();
    installTabPersistence();
    installTaskSaveFix();
    installAccountUiFix();
    installChatFixes();

    const workspaceMarketWatch = document.getElementById("market-watch");
    if (workspaceMarketWatch) workspaceMarketWatch.remove();

    const select = document.getElementById("ai-provider");
    if (select) {
      Array.from(select.options).forEach(option => {
        if (option.value === "all" || /all configured/i.test(option.textContent)) {
          option.textContent = "AgriDecision AI";
        }
      });
    }

    const help = document.getElementById("provider-help");
    if (help) {
      help.textContent = "";
      help.hidden = true;
    }

    moveExpenseChartToTools();
    applyCmeTableFixes();
  }

  function installUiFixes() {
    installCommodityFetchBust();

    if (typeof updateProviderHelp === "function" && !updateProviderHelp.isAgriUiFix) {
      const originalUpdateProviderHelp = updateProviderHelp;
      updateProviderHelp = function () {
        originalUpdateProviderHelp();
        applyUiFixes();
      };
      updateProviderHelp.isAgriUiFix = true;
    }

    wrapCmeRefresh();
    applyUiFixes();
    setTimeout(() => {
      wrapCmeRefresh();
      applyUiFixes();
    }, 0);
    setTimeout(() => {
      wrapCmeRefresh();
      applyUiFixes();
    }, 250);
    setTimeout(() => {
      wrapCmeRefresh();
      applyUiFixes();
    }, 1000);
  }

  installCommodityFetchBust();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUiFixes);
  } else {
    installUiFixes();
  }
}());
