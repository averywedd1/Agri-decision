(function () {
  const $ = id => document.getElementById(id);

  function text(value) {
    return String(value || "").trim().toLowerCase();
  }

  function numberValue(id) {
    const raw = $(id)?.value;
    if (raw === "" || raw === undefined || raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function workspaceTerms() {
    const data = typeof getFormData === "function" ? getFormData() : {};
    const raw = `${data.commodities || ""}, ${data.farmType || ""}`.toLowerCase();
    const terms = raw.split(/[,;/|]+/).map(term => term.trim()).filter(Boolean);
    [
      ["corn", "corn"], ["soy", "soybean"], ["wheat", "wheat"], ["oat", "oats"],
      ["cattle", "cattle"], ["beef", "cattle"], ["hog", "hogs"], ["dairy", "milk"],
      ["milk", "milk"], ["cotton", "cotton"]
    ].forEach(([needle, term]) => {
      if (raw.includes(needle) && !terms.includes(term)) terms.push(term);
    });
    return terms;
  }

  function rowMatches(row, terms) {
    if (!terms.length) return false;
    const cells = Array.from(row.children).map(cell => text(cell.textContent));
    const commodity = `${cells[0] || ""} ${cells[1] || ""}`;
    return terms.some(term => commodity.includes(term) || term.includes(commodity.split(" ")[0]));
  }

  function removeCmeSnapshotTable() {
    const snapshotBody = $("futures-snapshot-body");
    const shell = snapshotBody?.closest(".table-shell");
    if (shell) shell.remove();
    const lead = document.querySelector("#market-watch-table .section-lead");
    if (lead) lead.textContent = "Delayed futures prices with workspace commodities moved to the top, quote units, and automatic refresh while this tab is open.";
    const title = document.querySelector(".cme-snapshot-panel h3");
    if (title) title.textContent = "Workspace focus";
  }

  function prioritizeCmeRows() {
    removeCmeSnapshotTable();
    const body = $("futures-body");
    const summary = $("futures-snapshot-summary");
    if (!body) return;
    const rows = Array.from(body.querySelectorAll("tr")).filter(row => !row.querySelector("td[colspan]"));
    if (!rows.length) {
      if (summary) summary.textContent = "Futures are not available right now. Try Refresh Futures again, then verify directly with CME Group.";
      return;
    }
    const terms = workspaceTerms();
    rows.forEach(row => row.classList.toggle("workspace-match", rowMatches(row, terms)));
    rows
      .sort((a, b) => Number(rowMatches(b, terms)) - Number(rowMatches(a, terms)))
      .forEach(row => body.appendChild(row));
    const count = rows.filter(row => rowMatches(row, terms)).length;
    if (summary) {
      summary.textContent = count
        ? `Showing all futures with ${count} workspace match${count === 1 ? "" : "es"} moved to the top.`
        : "No exact workspace commodity match yet. Enter commodities in the farm workspace to prioritize this table.";
    }
  }

  function calculateRevenueField() {
    const total = $("total-revenue");
    if (!total) return "";
    const acres = numberValue("total-acres");
    const yieldValue = numberValue("yield");
    const price = numberValue("price");
    const secondary = numberValue("secondary-rev") || 0;
    const other = numberValue("other-income") || 0;
    const hasPrimary = acres !== null && yieldValue !== null && price !== null;
    const totalRevenue = (hasPrimary ? acres * yieldValue * price : 0) + secondary + other;
    if (totalRevenue > 0) {
      const next = String(Math.round(totalRevenue));
      if (total.value !== next) total.value = next;
      return next;
    }
    return total.value || "";
  }

  function patchRevenueData() {
    ["total-acres", "yield", "price", "secondary-rev", "other-income"].forEach(id => {
      const input = $(id);
      if (!input || input.dataset.qcRevenueBound) return;
      input.dataset.qcRevenueBound = "true";
      input.addEventListener("input", calculateRevenueField);
      input.addEventListener("change", calculateRevenueField);
    });
    if (typeof getFormData === "function" && !getFormData.isQcRevenuePatch) {
      const base = getFormData;
      getFormData = function () {
        const data = base.apply(this, arguments);
        if (!data.totalRevenue) data.totalRevenue = calculateRevenueField();
        return data;
      };
      getFormData.isQcRevenuePatch = true;
    }
  }

  function patchProviderHelp() {
    const help = $("provider-help");
    if (help) {
      help.textContent = "";
      help.hidden = true;
    }
    const select = $("ai-provider");
    if (select) {
      Array.from(select.options).forEach(option => {
        option.textContent = option.textContent.replace(/all configured/ig, "").trim() || "AgriDecision AI";
      });
    }
    if (typeof updateProviderHelp === "function" && !updateProviderHelp.isQcProviderPatch) {
      updateProviderHelp = function () {
        $("custom-provider-fields")?.classList.toggle("visible", $("ai-provider")?.value === "custom");
        patchProviderHelp();
      };
      updateProviderHelp.isQcProviderPatch = true;
    }
  }

  function addGuestMessage(containerId, role, html) {
    const container = $(containerId);
    if (!container) return null;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${role === "user" ? "user" : "ai"}`;
    msg.innerHTML = role === "user"
      ? String(html || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      : html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  async function sendGuestAiChat() {
    const input = $("ai-combo-input");
    const button = $("ai-combo-send");
    const question = input?.value.trim() || "";
    if (!question || !button) return;
    const provider = typeof getProvider === "function" ? getProvider() : { id: "all", name: "AgriDecision AI" };
    const providerId = provider?.id || "all";
    addGuestMessage("ai-combo-messages", "user", question);
    input.value = "";
    button.disabled = true;
    const loading = addGuestMessage("ai-combo-messages", "ai", "<em>Asking AgriDecision AI...</em>");
    const farmContext = typeof buildContext === "function" && typeof getFormData === "function"
      ? buildContext(getFormData())
      : "No farm workspace data entered yet.";
    const prompt = `Answer as AgriDecision AI. The user may be a guest and may not have a saved account yet. Use any farm workspace data below, and if fields are blank, give a useful general answer without asking them to sign in.\n\nFarm workspace:\n${farmContext}\n\nQuestion: ${question}`;
    try {
      const raw = await callAI({ ...provider, id: providerId || "all", name: provider?.name || "AgriDecision AI" }, prompt, 2200, 0.45);
      loading.innerHTML = typeof cleanAI === "function" ? cleanAI(raw) : raw;
      if (typeof hasProfile === "function" && hasProfile() && typeof saveProject === "function") {
        saveProject({ silent: true, skipPrompt: true });
      }
    } catch (error) {
      loading.innerHTML = `<span style="color:#f09595;">AgriDecision AI error: ${String(error.message || error)}</span>`;
    } finally {
      button.disabled = false;
    }
  }

  function patchGuestAi() {
    const send = $("ai-combo-send");
    const input = $("ai-combo-input");
    if (send && !send.dataset.qcGuestAiBound) {
      send.dataset.qcGuestAiBound = "true";
      send.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        sendGuestAiChat();
      }, true);
    }
    if (input && !input.dataset.qcGuestAiBound) {
      input.dataset.qcGuestAiBound = "true";
      input.addEventListener("keydown", event => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        sendGuestAiChat();
      }, true);
    }
    const summary = $("ai-context-summary");
    if (summary && /Create an account/i.test(summary.textContent || "")) {
      summary.textContent = "You can ask questions as a guest. Sign in only when you want projects and chat history to sync across devices.";
    }
  }

  async function supabaseCreateClient() {
    const response = await fetch("/api/config");
    const config = await response.json();
    const supabase = config?.supabase || {};
    if (!supabase.configured || !supabase.url || !supabase.anonKey) return null;
    const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    return module.createClient(supabase.url, supabase.anonKey);
  }

  function writeProfile(profile) {
    localStorage.setItem("agridecisionProfile", JSON.stringify(profile));
    if (typeof applyProfile === "function") applyProfile();
    if (typeof ensureFirstProject === "function") ensureFirstProject(profile.farmName);
    if (typeof renderProjects === "function") renderProjects();
    if (typeof updateAIContext === "function") updateAIContext();
  }

  function patchAccountCreate() {
    const button = $("save-account");
    if (!button || button.dataset.qcCreateBound) return;
    button.dataset.qcCreateBound = "true";
    button.addEventListener("click", async event => {
      const creating = $("auth-create-mode")?.classList.contains("active") && !$("auth-signin-mode")?.classList.contains("active");
      if (!creating) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const status = $("account-sync-status");
      const name = $("account-name")?.value.trim() || "";
      const email = $("account-email")?.value.trim() || "";
      const password = $("account-password")?.value || "";
      const farmName = $("account-farm")?.value.trim() || $("farm-name")?.value.trim() || "";
      if (!name) return alert("Please enter your name.");
      if (!email) return alert("Please enter your email.");

      const existing = typeof profile === "function" ? profile() : {};
      const nextProfile = {
        ...existing,
        name,
        email,
        farmName,
        lastFarmData: typeof getFormData === "function" ? getFormData() : {},
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Creating...";
      try {
        const client = await supabaseCreateClient();
        if (!client) {
          writeProfile(nextProfile);
          if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
          if (status) status.textContent = "Created a local account profile on this device. Add cloud sync settings to use it across devices.";
          if (typeof closeAccount === "function") closeAccount();
          return;
        }

        if (password.length < 6) return alert("Please enter a password with at least 6 characters.");
        if (status) status.textContent = "Creating account...";
        const result = await client.auth.signUp({
          email,
          password,
          options: { data: { name, farm_name: farmName } }
        });

        if (result.error) {
          const message = result.error.message || "Could not create the account.";
          if (status) status.textContent = message;
          return alert(message);
        }

        const identities = result.data?.user?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          if (status) status.textContent = "That email already has an account. Choose Sign In when you are ready.";
          return;
        }

        writeProfile(nextProfile);
        if (result.data?.session) {
          if (typeof handleSignedIn === "function") await handleSignedIn(result.data.session.user);
          if (status) status.textContent = `Signed in as ${email}. Cloud sync is on.`;
          if (typeof closeAccount === "function") closeAccount();
        } else if (status) {
          status.textContent = "Account created. Check your email to confirm it, then sign in with this same email.";
        }
      } finally {
        button.disabled = false;
        button.textContent = originalText || "Create Account";
      }
    }, true);
  }

  function patchAuthModeControls() {
    const create = $("auth-create-mode");
    const signin = $("auth-signin-mode");
    const save = $("save-account");
    if (!create || !signin || !save || save.dataset.qcAuthModeBound) return;
    save.dataset.qcAuthModeBound = "true";

    create.addEventListener("click", () => {
      create.classList.add("active");
      signin.classList.remove("active");
      save.textContent = "Create Account";
      $("account-title").textContent = "Create your AgriDecision account";
      $("account-name")?.closest("label")?.style.setProperty("display", "flex");
      $("account-farm")?.closest("label")?.style.setProperty("display", "flex");
    });

    signin.addEventListener("click", () => {
      signin.classList.add("active");
      create.classList.remove("active");
      save.textContent = "Sign In";
      $("account-title").textContent = "Sign in to AgriDecision";
      $("account-name")?.closest("label")?.style.setProperty("display", "none");
      $("account-farm")?.closest("label")?.style.setProperty("display", "none");
    });
  }

  function restoreLogo() {
    const href = "/agridecision_icon.svg?v=15";
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(link => link.remove());
    [
      ["icon", "image/svg+xml"],
      ["shortcut icon", ""],
      ["apple-touch-icon", ""]
    ].forEach(([rel, type]) => {
      const link = document.createElement("link");
      link.rel = rel;
      if (type) link.type = type;
      link.href = href;
      document.head.appendChild(link);
    });

    const brand = document.querySelector(".brand");
    if (!brand || brand.dataset.qcLogoRestored) return;
    brand.dataset.qcLogoRestored = "true";
    brand.innerHTML = `<img class="brand-logo-img" src="${href}" alt="AgriDecision logo"><span>AgriDecision</span>`;
  }

  const FIELD_KEY = "agriFieldBoundary";

  function readBoundary() {
    try {
      const points = JSON.parse(localStorage.getItem(FIELD_KEY) || "[]");
      return Array.isArray(points) ? points : [];
    } catch {
      return [];
    }
  }

  function saveBoundary(points) {
    localStorage.setItem(FIELD_KEY, JSON.stringify(points));
  }

  function polygonArea(points) {
    if (points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area / 2);
  }

  function boundaryAcres(points) {
    const acres = polygonArea(points) * 1.7;
    return Number.isFinite(acres) ? acres : 0;
  }

  function drawBoundary() {
    const canvas = $("field-boundary-svg");
    const list = $("field-boundary-list");
    const acresText = $("field-boundary-acres");
    if (!canvas) return;
    const points = readBoundary();
    const pointText = points.map(point => `${point.x},${point.y}`).join(" ");
    canvas.innerHTML = `
      <rect x="0" y="0" width="100" height="100" rx="2"></rect>
      ${points.length >= 3 ? `<polygon points="${pointText}"></polygon>` : ""}
      ${points.length >= 2 ? `<polyline points="${pointText}"></polyline>` : ""}
      ${points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="1.7"><title>Point ${index + 1}</title></circle>`).join("")}
    `;
    const acres = boundaryAcres(points);
    if (acresText) acresText.textContent = points.length >= 3 ? `${acres.toFixed(1)} mapped acres` : "Click at least 3 points to create a boundary";
    if (list) {
      list.innerHTML = points.length
        ? points.map((point, index) => `<span>${index + 1}. ${point.x.toFixed(1)}, ${point.y.toFixed(1)}</span>`).join("")
        : "<span>No boundary points yet.</span>";
    }
  }

  function syncBoundaryAcres() {
    const points = readBoundary();
    const acres = boundaryAcres(points);
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

  function ensureFieldMap() {
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
      const tools = menu.querySelector('[data-app-tab="tools"]');
      const ai = menu.querySelector('[data-app-tab="ai"]');
      menu.insertBefore(button, tools || ai || null);
    }

    if (!$("field-map-view")) {
      const view = document.createElement("section");
      view.className = "app-view field-map-view";
      view.id = "field-map-view";
      view.innerHTML = `
        <div class="section field-map-section">
          <div class="section-kicker">Field Map</div>
          <h2>Draw field boundaries</h2>
          <p class="section-lead">Click points around the field edge. The boundary saves in this browser and updates mapped acres for the workspace.</p>
          <div class="field-map-layout">
            <button class="field-map-canvas" type="button" id="field-map-canvas" aria-label="Draw field boundary">
              <svg id="field-boundary-svg" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
            </button>
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
      const tools = $("tools-view");
      const ai = $("ai-view");
      document.body.insertBefore(view, tools || ai || document.querySelector("footer"));
    }

    const canvas = $("field-map-canvas");
    if (canvas && !canvas.dataset.qcMapBound) {
      canvas.dataset.qcMapBound = "true";
      canvas.addEventListener("click", event => {
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
        const points = readBoundary();
        points.push({ x, y, lat: 41.5 + (50 - y) / 60, lng: -93.5 + (x - 50) / 45 });
        saveBoundary(points);
        drawBoundary();
      });
    }
    const undo = $("undo-field-point");
    if (undo && !undo.dataset.qcMapBound) {
      undo.dataset.qcMapBound = "true";
      undo.addEventListener("click", () => {
      const points = readBoundary();
      points.pop();
      saveBoundary(points);
      drawBoundary();
      });
    }
    const clear = $("clear-field-points");
    if (clear && !clear.dataset.qcMapBound) {
      clear.dataset.qcMapBound = "true";
      clear.addEventListener("click", () => {
      saveBoundary([]);
      drawBoundary();
      });
    }
    const use = $("use-field-acres");
    if (use && !use.dataset.qcMapBound) {
      use.dataset.qcMapBound = "true";
      use.addEventListener("click", syncBoundaryAcres);
    }
    drawBoundary();
  }

  function moveExpensePieToTools() {
    if (!$("expense-chart-card") && typeof ensureExpensePieChart === "function") ensureExpensePieChart();
    const card = $("expense-chart-card");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!card || !toolsSection) return;
    const actions = toolsSection.querySelector(".tools-actions");
    if (card.parentElement !== toolsSection) toolsSection.insertBefore(card, actions?.nextSibling || toolsSection.firstChild?.nextSibling || null);
    if (typeof updateExpensePieChart === "function") updateExpensePieChart();
  }

  function patchFieldMapTab() {
    if (typeof switchAppTab !== "function" || switchAppTab.isQcFieldMapPatch) return;
    const base = switchAppTab;
    switchAppTab = function (tabName) {
      ensureFieldMap();
      const result = base.apply(this, arguments);
      const fieldView = $("field-map-view");
      if (fieldView) fieldView.classList.toggle("active", tabName === "field-map");
      document.querySelectorAll(".workspace-tab").forEach(button => {
        button.classList.toggle("active", button.dataset.appTab === tabName);
      });
      if (tabName === "field-map") {
        drawBoundary();
        window.scrollTo({ top: 0, behavior: "auto" });
      }
      return result;
    };
    switchAppTab.isQcFieldMapPatch = true;
  }

  function wrapCmeHelpers() {
    if (typeof ensureCmeTableView === "function" && !ensureCmeTableView.isQcCmePatch) {
      const base = ensureCmeTableView;
      ensureCmeTableView = function () {
        const result = base.apply(this, arguments);
        prioritizeCmeRows();
        return result;
      };
      ensureCmeTableView.isQcCmePatch = true;
    }
    if (typeof ensureEnhancedCmeView === "function" && !ensureEnhancedCmeView.isQcCmePatch) {
      const base = ensureEnhancedCmeView;
      ensureEnhancedCmeView = function () {
        const result = base.apply(this, arguments);
        prioritizeCmeRows();
        return result;
      };
      ensureEnhancedCmeView.isQcCmePatch = true;
    }
    if (typeof loadFutures === "function" && !loadFutures.isQcCmePatch) {
      const base = loadFutures;
      loadFutures = async function () {
        const result = await base.apply(this, arguments);
        prioritizeCmeRows();
        return result;
      };
      loadFutures.isQcCmePatch = true;
    }
  }

  function installStyles() {
    if ($("qc-pass-fixes-style")) return;
    const style = document.createElement("style");
    style.id = "qc-pass-fixes-style";
    style.textContent = `
      #provider-help{display:none!important}
      #futures-body tr.workspace-match td:first-child{box-shadow:inset 3px 0 0 var(--green-600)}
      .brand-logo-img{width:34px;height:34px;display:block;border-radius:9px;flex:0 0 auto}
      .brand span{display:inline!important;color:var(--green-900)}
      .field-map-view{min-height:calc(100vh - 60px);padding-top:44px;background:#f7faf5}
      .field-map-section{max-width:1180px}
      .field-map-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
      .field-map-canvas{min-height:520px;width:100%;padding:0;border:1px solid var(--line);border-radius:8px;background:linear-gradient(90deg,rgba(26,51,24,.08) 1px,transparent 1px),linear-gradient(rgba(26,51,24,.08) 1px,transparent 1px),#dfe9d7;background-size:32px 32px;cursor:crosshair;overflow:hidden}
      #field-boundary-svg{width:100%;height:100%;display:block}
      #field-boundary-svg rect{fill:rgba(255,255,255,.22)}
      #field-boundary-svg polygon{fill:rgba(58,128,53,.28);stroke:#2d6628;stroke-width:.7}
      #field-boundary-svg polyline{fill:none;stroke:#2d6628;stroke-width:.6}
      #field-boundary-svg circle{fill:#1a3318;stroke:white;stroke-width:.5}
      .field-map-panel{display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:var(--shadow)}
      .field-boundary-list{display:grid;gap:4px;max-height:180px;overflow:auto;color:var(--muted);font-size:12px}
      .field-map-actions{display:grid;gap:8px}
      @media(max-width:820px){.field-map-layout{grid-template-columns:1fr}.field-map-canvas{min-height:360px}}
    `;
    document.head.appendChild(style);
  }

  function run() {
    installStyles();
    restoreLogo();
    ensureFieldMap();
    patchFieldMapTab();
    patchProviderHelp();
    patchGuestAi();
    patchAuthModeControls();
    patchAccountCreate();
    patchRevenueData();
    wrapCmeHelpers();
    moveExpensePieToTools();
    calculateRevenueField();
    prioritizeCmeRows();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  setTimeout(run, 400);
  setTimeout(run, 1500);
  setInterval(() => {
    patchProviderHelp();
    prioritizeCmeRows();
    patchGuestAi();
    moveExpensePieToTools();
  }, 5000);
}());
