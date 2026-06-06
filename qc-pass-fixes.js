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
    `;
    document.head.appendChild(style);
  }

  function run() {
    installStyles();
    restoreLogo();
    patchProviderHelp();
    patchAuthModeControls();
    patchAccountCreate();
    patchRevenueData();
    wrapCmeHelpers();
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
  }, 5000);
}());
