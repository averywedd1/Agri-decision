(function () {
  const COST_FIELDS = [
    ["seed", "Seed"],
    ["fertilizer", "Fertilizer"],
    ["chemicals", "Chemicals"],
    ["labor", "Labor"],
    ["fuel", "Fuel"],
    ["equipment", "Equipment"],
    ["custom-hire", "Custom Hire"],
    ["water", "Water / Irrigation"],
    ["insurance", "Insurance"],
    ["maintenance", "Maintenance"]
  ];

  const PLACEHOLDERS = {
    "farm-name": "e.g. Miller Family Farms",
    "state": "e.g. Iowa, Central Illinois",
    "total-acres": "e.g. 1,200 acres",
    "years-op": "e.g. 12 years",
    commodities: "e.g. Corn, soybeans, wheat",
    "op-description": "Owned/rented acres, family labor, main pressure points...",
    yield: "e.g. 185 bu/acre",
    price: "e.g. 4.65 $/bu",
    "secondary-rev": "e.g. 25,000 dollars",
    "other-income": "e.g. 12,000 dollars",
    "total-revenue": "e.g. 900,000 dollars",
    seed: "e.g. 112 $/acre",
    fertilizer: "e.g. 190 $/acre",
    chemicals: "e.g. 62 $/acre",
    labor: "e.g. 42 $/acre",
    fuel: "e.g. 35 $/acre",
    equipment: "e.g. 58 $/acre",
    "custom-hire": "e.g. 20 $/acre",
    water: "e.g. 0 $/acre",
    insurance: "e.g. 28 $/acre",
    maintenance: "e.g. 18 $/acre",
    "op-loan": "e.g. 140,000 dollars",
    "term-loan": "e.g. 260,000 dollars",
    "interest-rate": "e.g. 7.1%",
    "loan-term": "e.g. 7 years",
    investments: "Equipment, storage, irrigation, land, technology...",
    goals: "Improve cash flow, prepare for lender, reduce costs..."
  };

  const UNITS = {
    "total-acres": "acres",
    "years-op": "years",
    yield: "bu/acre",
    price: "$/unit",
    "secondary-rev": "$",
    "other-income": "$",
    "total-revenue": "$",
    seed: "$/acre",
    fertilizer: "$/acre",
    chemicals: "$/acre",
    labor: "$/acre",
    fuel: "$/acre",
    equipment: "$/acre",
    "custom-hire": "$/acre",
    water: "$/acre",
    insurance: "$/acre",
    maintenance: "$/acre",
    "op-loan": "$",
    "term-loan": "$",
    "interest-rate": "%",
    "loan-term": "years"
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numberValue(id) {
    return Number(byId(id)?.value || 0) || 0;
  }

  function money(value, digits = 0) {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits
    });
  }

  function hasAccount() {
    try {
      const profile = JSON.parse(localStorage.getItem("agridecisionProfile") || "{}");
      return Boolean(profile?.email || profile?.name);
    } catch {
      return false;
    }
  }

  function installStyles() {
    if (byId("agri-current-improvements-style")) return;
    const style = document.createElement("style");
    style.id = "agri-current-improvements-style";
    style.textContent = `
      .save-nudge, .cost-subtotal, .three-step-explainer, .ai-context-note, .cme-empty-state {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
      }
      .save-nudge {
        display: grid;
        gap: 8px;
        padding: 12px;
        margin-top: 10px;
      }
      .save-nudge strong { color: var(--green-800); }
      .save-nudge-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .cost-subtotal {
        grid-column: 1 / -1;
        display: grid;
        gap: 8px;
        padding: 14px;
      }
      .cost-subtotal strong { font-size: 22px; color: var(--green-800); }
      .cost-subtotal small { color: var(--muted); }
      .unit-label {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        margin-left: 6px;
        padding: 1px 7px;
        border-radius: 999px;
        background: #eef4ec;
        color: var(--green-800);
        font-size: 11px;
        font-weight: 700;
      }
      .three-step-explainer {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        padding: 16px;
        margin: 18px 0;
        background: #fff;
      }
      .three-step-explainer article {
        display: grid;
        gap: 6px;
        padding: 12px;
        border-radius: 8px;
        background: #f7faf5;
      }
      .three-step-explainer span {
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        border-radius: 999px;
        background: var(--green-800);
        color: #fff;
        font-weight: 800;
      }
      .ai-context-note {
        padding: 10px;
        color: var(--muted);
        background: #fff;
      }
      .cme-empty-state {
        padding: 18px;
        text-align: center;
        color: var(--muted);
      }
      .cme-empty-state a { color: var(--green-800); font-weight: 700; }
      .provider-help-hidden { display: none !important; }
      @media (max-width: 760px) {
        .three-step-explainer { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function installTabLogo() {
    if (!document.head) return;
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => link.remove());

    const href = "/agridecision_icon.svg?v=8";
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = href;
    document.head.appendChild(icon);

    const shortcut = document.createElement("link");
    shortcut.rel = "shortcut icon";
    shortcut.href = href;
    document.head.appendChild(shortcut);

    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = href;
    document.head.appendChild(apple);
  }

  function improveHeroCopy() {
    const hero = document.querySelector(".hero");
    if (!hero || hero.dataset.copyImproved === "true") return;
    const h1 = hero.querySelector("h1");
    const p = hero.querySelector("p");
    const cta = hero.querySelector(".hero-cta");
    if (h1) h1.innerHTML = "Know your numbers<br><em>before the lender does</em>";
    if (p) p.textContent = "Turn acres, yields, costs, debt, and price risk into a clear farm decision plan you can use in lender meetings, equipment decisions, and marketing conversations.";
    if (cta) cta.textContent = "Run my farm analysis";
    hero.dataset.copyImproved = "true";
  }

  function improveAnalyzeButton() {
    const button = byId("analyze-btn");
    if (button && button.textContent.includes("Generate")) button.textContent = "Get my lender-ready report";
  }

  function installThreeStepExplainer() {
    if (byId("three-step-explainer")) return;
    const dataSection = byId("data-entry");
    if (!dataSection) return;
    const explainer = document.createElement("div");
    explainer.className = "three-step-explainer";
    explainer.id = "three-step-explainer";
    explainer.innerHTML = `
      <article><span>1</span><strong>Enter your numbers</strong><p>Start with acres, yield, prices, costs, and debt. Use the demo farm if you want to see the flow first.</p></article>
      <article><span>2</span><strong>Get the analysis</strong><p>AgriDecision turns the inputs into break-even, cash-flow, risk, and lender-ready recommendations.</p></article>
      <article><span>3</span><strong>Ask follow-ups</strong><p>Use the AI advisor to pressure-test scenarios, marketing plans, and what to do next.</p></article>
    `;
    const lead = dataSection.querySelector(".section-lead");
    dataSection.insertBefore(explainer, lead?.nextSibling || dataSection.firstElementChild?.nextSibling || null);
  }

  function improveProjectEmptyState() {
    const manager = document.querySelector(".project-manager");
    const select = byId("project-select");
    const status = byId("project-status");
    if (!manager || !select || !status) return;
    const empty = !select.value && /No saved projects/i.test(select.textContent || "");
    let nudge = byId("save-nudge");
    if (!empty) {
      nudge?.remove();
      return;
    }
    if (!nudge) {
      nudge = document.createElement("div");
      nudge.className = "save-nudge";
      nudge.id = "save-nudge";
      nudge.innerHTML = `
        <strong>Create an account to save projects across devices.</strong>
        <span>Without an account, your browser can still keep this draft locally while you work.</span>
        <div class="save-nudge-actions">
          <button class="primary-btn" type="button" id="save-nudge-account">Create Account</button>
          <button class="ghost-btn" type="button" id="save-nudge-local">Keep Working Locally</button>
        </div>
      `;
      manager.append(nudge);
      byId("save-nudge-account")?.addEventListener("click", () => {
        if (typeof openAccount === "function") openAccount();
      });
      byId("save-nudge-local")?.addEventListener("click", () => {
        status.textContent = "Local draft mode is on. Create an account when you want projects to sync across devices.";
      });
    }
    status.textContent = hasAccount()
      ? "No projects saved yet. Fill the form and save your first scenario."
      : "Create an account to save projects across devices, or keep working locally in this browser.";
  }

  function addPlaceholdersAndUnits() {
    Object.entries(PLACEHOLDERS).forEach(([id, placeholder]) => {
      const input = byId(id);
      if (input && !input.placeholder) input.placeholder = placeholder;
    });
    Object.entries(UNITS).forEach(([id, unit]) => {
      const input = byId(id);
      const label = input?.closest("label");
      if (!label || label.querySelector(`[data-unit-for="${id}"]`)) return;
      const badge = document.createElement("span");
      badge.className = "unit-label";
      badge.dataset.unitFor = id;
      badge.textContent = unit;
      label.insertBefore(badge, input);
    });
  }

  function installCostSubtotal() {
    const field = byId("seed")?.closest("fieldset");
    if (!field || byId("cost-subtotal")) return;
    const subtotal = document.createElement("div");
    subtotal.className = "cost-subtotal";
    subtotal.id = "cost-subtotal";
    subtotal.innerHTML = `
      <small>Total operating cost per acre</small>
      <strong id="cost-subtotal-value">$0</strong>
      <small id="cost-subtotal-benchmark">Regional planning benchmark: $575/acre</small>
    `;
    field.append(subtotal);
    COST_FIELDS.forEach(([id]) => {
      byId(id)?.addEventListener("input", updateCostSubtotal);
      byId(id)?.addEventListener("change", updateCostSubtotal);
    });
    updateCostSubtotal();
  }

  function updateCostSubtotal() {
    const total = COST_FIELDS.reduce((sum, [id]) => sum + numberValue(id), 0);
    const target = byId("cost-subtotal-value");
    const benchmark = byId("cost-subtotal-benchmark");
    if (target) target.textContent = total ? money(total) : "$-";
    if (benchmark) {
      const diff = total ? total - 575 : 0;
      benchmark.textContent = total
        ? `Regional planning benchmark: $575/acre (${diff >= 0 ? "+" : ""}${money(diff)} vs benchmark)`
        : "Regional planning benchmark: $575/acre";
    }
  }

  function simplifyProviderUi() {
    const label = byId("ai-provider")?.closest("label");
    const help = byId("provider-help");
    const fields = byId("custom-provider-fields");
    if (label) {
      const text = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (text) text.textContent = "Powered by AgriDecision AI ";
    }
    if (help) {
      help.textContent = "";
      help.classList.add("provider-help-hidden");
    }
    if (fields && byId("ai-provider")?.value !== "custom") fields.classList.remove("visible");
    const select = byId("ai-provider");
    if (select) {
      Array.from(select.options).forEach(option => {
        option.textContent = option.textContent
          .replace(/AgriDecision AI - all configured/i, "AgriDecision AI")
          .replace(/Loading configured AIs/i, "AgriDecision AI");
      });
    }
  }

  function clarifyAiAreas() {
    const reportHeader = document.querySelector(".chatbot-card .chatbot-header h3");
    const reportHelp = document.querySelector(".chatbot-card .chatbot-header small");
    if (reportHeader) reportHeader.textContent = "Chat about this report";
    if (reportHelp) reportHelp.textContent = "Ask follow-up questions using the analysis above.";

    const aiView = byId("ai-view");
    if (!aiView || aiView.dataset.aiCopyImproved === "true") return;
    const h2 = aiView.querySelector("h2");
    const lead = aiView.querySelector(".section-lead");
    const chatTitle = aiView.querySelector(".ai-combo-card h3");
    const chatHelp = aiView.querySelector(".ai-combo-card small");
    if (h2) h2.textContent = "General farm advisor";
    if (lead) lead.textContent = "Use this for broader farm business questions, scenario thinking, lender prep, and marketing decisions. Save a project to give the advisor your farm context.";
    if (chatTitle) chatTitle.textContent = "General farm advisor";
    if (chatHelp) chatHelp.textContent = "Best for questions that are not tied to one generated report.";
    const context = byId("ai-context-summary");
    if (context && !byId("ai-context-note")) {
      const note = document.createElement("p");
      note.className = "ai-context-note";
      note.id = "ai-context-note";
      note.textContent = "Guests can ask general questions. Sign in and save a project when you want answers based on your own farm numbers across devices.";
      context.insertAdjacentElement("afterend", note);
    }
    aiView.dataset.aiCopyImproved = "true";
  }

  function improveCmeCopyAndEmptyState() {
    const cme = byId("market-watch-table");
    if (!cme) return;
    const lead = cme.querySelector(".section-lead");
    const note = byId("futures-note");
    if (lead) lead.textContent = "Delayed futures table for major ag commodities. Verify prices directly with CME Group before trading or hedging.";
    if (note) note.textContent = "Delayed data. Verify directly with CME Group before trading or hedging.";
    const body = byId("futures-body");
    if (!body) return;
    const text = body.textContent || "";
    if (/Loading futures|Could not load|No futures/i.test(text)) {
      const colspan = body.closest("table")?.querySelectorAll("thead th").length || 10;
      body.innerHTML = `<tr><td colspan="${colspan}">
        <div class="cme-empty-state">
          <strong>Futures data unavailable right now.</strong><br>
          Check <a href="https://www.cmegroup.com/markets/agriculture.html" target="_blank" rel="noopener">CME Group agriculture markets</a> directly.
        </div>
      </td></tr>`;
    }
  }

  function patchLoadProviders() {
    if (typeof loadProviders !== "function" || loadProviders.isCurrentImprovementsPatch) return;
    const base = loadProviders;
    loadProviders = async function () {
      const result = await base();
      simplifyProviderUi();
      return result;
    };
    loadProviders.isCurrentImprovementsPatch = true;
  }

  function patchRenderProjects() {
    if (typeof renderProjects !== "function" || renderProjects.isCurrentImprovementsPatch) return;
    const base = renderProjects;
    renderProjects = function () {
      const result = base();
      improveProjectEmptyState();
      return result;
    };
    renderProjects.isCurrentImprovementsPatch = true;
  }

  function patchLoadFutures() {
    if (typeof loadFutures !== "function" || loadFutures.isCurrentImprovementsPatch) return;
    const base = loadFutures;
    loadFutures = async function () {
      const result = await base();
      improveCmeCopyAndEmptyState();
      return result;
    };
    loadFutures.isCurrentImprovementsPatch = true;
  }

  function bindFormChanges() {
    COST_FIELDS.forEach(([id]) => {
      const input = byId(id);
      if (!input || input.dataset.costSubtotalBound === "true") return;
      input.dataset.costSubtotalBound = "true";
      input.addEventListener("input", updateCostSubtotal);
      input.addEventListener("change", updateCostSubtotal);
    });
  }

  function install() {
    installStyles();
    installTabLogo();
    improveHeroCopy();
    improveAnalyzeButton();
    installThreeStepExplainer();
    improveProjectEmptyState();
    addPlaceholdersAndUnits();
    installCostSubtotal();
    updateCostSubtotal();
    simplifyProviderUi();
    clarifyAiAreas();
    improveCmeCopyAndEmptyState();
    patchLoadProviders();
    patchRenderProjects();
    patchLoadFutures();
    bindFormChanges();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 400);
  setTimeout(install, 1200);
  setInterval(() => {
    improveProjectEmptyState();
    updateCostSubtotal();
    simplifyProviderUi();
    improveCmeCopyAndEmptyState();
  }, 3000);
}());