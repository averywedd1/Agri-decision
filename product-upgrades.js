(function () {
  const DEMO_DATA = {
    farmName: "Demo Corn Operation",
    farmType: "Row Crops (corn/soy)",
    state: "Iowa",
    totalAcres: "500",
    yearsOp: "8",
    commodities: "Corn",
    opDescription: "500-acre corn operation used as a guided demo for exploring AgriDecision AI.",
    yield: "185",
    price: "4.65",
    secondaryRev: "0",
    otherIncome: "12000",
    totalRevenue: "442125",
    seed: "112",
    fertilizer: "190",
    chemicals: "62",
    labor: "42",
    fuel: "35",
    equipment: "58",
    customHire: "20",
    water: "0",
    insurance: "28",
    maintenance: "18",
    opLoan: "140000",
    termLoan: "260000",
    interestRate: "7.1",
    loanTerm: "7",
    investments: "Possible planter upgrade and grain storage expansion.",
    goals: "Improve working capital, compare equipment timing, and prepare a lender-ready plan."
  };

  const TOOL_GROUPS = {
    be: ["be-acres", "be-yield", "be-cost", "be-overhead", "be-price"],
    cf: ["cf-revenue", "cf-costs", "cf-debt", "cf-family", "cf-capex"],
    eq: ["eq-purchase", "eq-down", "eq-rate", "eq-years", "eq-hours", "eq-maintenance", "eq-rent", "eq-resale"],
    tax: ["tax-income", "tax-depreciation", "tax-rate", "tax-se"],
    bm: ["bm-acres", "bm-yield", "bm-cost", "bm-debt", "bm-working"]
  };

  const FARM_SIGNAL_IDS = [
    "farm-name", "state", "total-acres", "commodities", "yield", "price", "total-revenue",
    "seed", "fertilizer", "chemicals", "labor", "fuel", "equipment", "op-loan", "term-loan"
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function hasValue(id) {
    const el = byId(id);
    return Boolean(el && String(el.value || "").trim());
  }

  function groupHasValues(ids) {
    return ids.some(hasValue);
  }

  function farmHasUserValues() {
    return FARM_SIGNAL_IDS.some(hasValue);
  }

  function clearToolInputs() {
    Object.values(TOOL_GROUPS).flat().forEach(id => {
      const input = byId(id);
      if (input) input.value = "";
    });
  }

  function setEmptyResult(id, label) {
    const target = byId(id);
    if (!target) return;
    target.classList.add("empty-tool-result");
    target.innerHTML = `<strong>-</strong><span>${label}</span>`;
  }

  function renderEmptyTools() {
    setEmptyResult("be-result", "Add breakeven values to calculate.");
    setEmptyResult("cf-result", "Add cash flow values to calculate.");
    setEmptyResult("eq-result", "Add equipment values to compare.");
    setEmptyResult("tax-result", "Add tax values to estimate.");
    const bm = byId("bm-result");
    if (bm) {
      bm.innerHTML = '<tr class="empty-benchmark-row"><td colspan="4">Add benchmark values to compare against regional averages.</td></tr>';
    }
  }

  function updateToolEmptyStates() {
    const hasAnyTools = Object.values(TOOL_GROUPS).some(groupHasValues);
    if (!hasAnyTools) {
      renderEmptyTools();
      return false;
    }
    Object.entries({ be: "be-result", cf: "cf-result", eq: "eq-result", tax: "tax-result" }).forEach(([key, resultId]) => {
      if (!groupHasValues(TOOL_GROUPS[key])) setEmptyResult(resultId, "Add values to calculate.");
      else byId(resultId)?.classList.remove("empty-tool-result");
    });
    if (!groupHasValues(TOOL_GROUPS.bm)) {
      const bm = byId("bm-result");
      if (bm) bm.innerHTML = '<tr class="empty-benchmark-row"><td colspan="4">Add benchmark values to compare against regional averages.</td></tr>';
    }
    return true;
  }

  function installStyles() {
    if (byId("agri-product-upgrades-style")) return;
    const style = document.createElement("style");
    style.id = "agri-product-upgrades-style";
    style.textContent = `
      .demo-onboarding {
        display: grid;
        gap: 14px;
        padding: 18px;
        margin: 0 0 18px;
        border: 1px solid rgba(26, 51, 24, 0.16);
        border-radius: 8px;
        background: #eef4ec;
      }
      .demo-onboarding h3 { margin: 0; font-size: 18px; }
      .demo-onboarding p { margin: 0; color: var(--muted); }
      .demo-actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .form-stepper {
        display: grid;
        gap: 12px;
        margin: 0 0 18px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .step-progress-track {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: #e4e8e1;
      }
      .step-progress-fill {
        height: 100%;
        width: 25%;
        border-radius: inherit;
        background: #3a8035;
        transition: width 180ms ease;
      }
      .step-tabs {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .step-tab {
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 10px 8px;
        background: #f7faf5;
        color: var(--muted);
        font: inherit;
        cursor: pointer;
      }
      .step-tab.active {
        border-color: #3a8035;
        background: #dff2db;
        color: var(--green-800);
        font-weight: 700;
      }
      .step-controls {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      #farm-form.step-mode fieldset { display: none; }
      #farm-form.step-mode fieldset.active-step { display: grid; }
      .empty-tool-result {
        background: #f0f2ef !important;
        border: 1px dashed #b9c1b5 !important;
        color: #727a6f !important;
      }
      .empty-tool-result strong { color: #7a8078 !important; }
      .empty-benchmark-row td {
        color: #727a6f;
        background: #f0f2ef;
        text-align: center;
      }
      .one-page-report-btn { white-space: nowrap; }
      .ai-scan-card {
        display: grid;
        gap: 10px;
        margin-bottom: 12px;
        padding: 12px;
        border: 1px solid rgba(26, 51, 24, 0.14);
        border-radius: 8px;
        background: #f6fbf3;
      }
      .ai-scan-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .risk-meter {
        width: 120px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(90deg, #3a8035 0 33%, #d39b2a 33% 66%, #bf4d3b 66% 100%);
        position: relative;
      }
      .risk-meter span {
        position: absolute;
        top: -4px;
        width: 16px;
        height: 16px;
        border-radius: 999px;
        background: #1a2b22;
        transform: translateX(-50%);
      }
      .ai-action-list { margin: 0; padding-left: 18px; }
      .ai-action-list li { margin: 3px 0; }
      @media (max-width: 760px) {
        .step-tabs { grid-template-columns: 1fr 1fr; }
        .step-controls { position: sticky; bottom: 0; padding: 10px 0; background: var(--cream); }
        .demo-actions { display: grid; }
        .report-actions { display: grid; }
      }
      @media print {
        .topbar, .hero, #features, #market-watch, #data-entry, .tabs, .report-actions, .chatbot-card, footer,
        #ai-view, #story-view, #cme-view, #tools-view, #tasks-view, #field-map-view { display: none !important; }
        body { background: #fff; color: #111; font-size: 11px; }
        #workspace-view, #analysis-section { display: block !important; }
        #analysis-section { padding: 0 !important; margin: 0 !important; }
        #report-farm-name { font-size: 22px; margin-bottom: 10px; }
        .tab-panel { display: block !important; page-break-inside: avoid; }
        .analysis-content { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
        .analysis-content h2, .analysis-content h3 { margin-top: 8px; font-size: 14px; }
        .analysis-content p, .analysis-content li, .analysis-content td, .analysis-content th { font-size: 10px; line-height: 1.35; }
      }
    `;
    document.head.appendChild(style);
  }

  function installDemoOnboarding() {
    const form = byId("farm-form");
    if (!form || byId("demo-onboarding")) return;
    const card = document.createElement("div");
    card.className = "demo-onboarding";
    card.id = "demo-onboarding";
    card.innerHTML = `
      <h3>Want to see it with real numbers first?</h3>
      <p>Load a 500-acre corn demo farm to see the report, tools, and AI context before entering your own operation.</p>
      <div class="demo-actions">
        <button class="primary-btn" type="button" id="load-demo-farm">Load Demo Farm</button>
        <button class="ghost-btn" type="button" id="clear-demo-farm">Start Blank</button>
      </div>
    `;
    form.parentElement?.insertBefore(card, form);
    byId("load-demo-farm")?.addEventListener("click", () => {
      if (typeof setFormData === "function") setFormData(DEMO_DATA);
      if (typeof scheduleSave === "function") scheduleSave();
      if (typeof updateAIContext === "function") updateAIContext();
      if (typeof seedToolsFromFarmData === "function") seedToolsFromFarmData();
      if (typeof calculateAllTools === "function") calculateAllTools();
      setStep(0);
    });
    byId("clear-demo-farm")?.addEventListener("click", () => {
      if (typeof setFormData === "function") setFormData({});
      clearToolInputs();
      renderEmptyTools();
      if (typeof updateAIContext === "function") updateAIContext();
      setStep(0);
    });
  }

  let currentStep = 0;

  function setStep(index) {
    const form = byId("farm-form");
    if (!form) return;
    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    if (!fieldsets.length) return;
    currentStep = Math.max(0, Math.min(index, fieldsets.length - 1));
    fieldsets.forEach((fieldset, i) => fieldset.classList.toggle("active-step", i === currentStep));
    document.querySelectorAll(".step-tab").forEach((tab, i) => tab.classList.toggle("active", i === currentStep));
    const fill = document.querySelector(".step-progress-fill");
    if (fill) fill.style.width = `${((currentStep + 1) / fieldsets.length) * 100}%`;
    const label = byId("step-count-label");
    if (label) label.textContent = `Step ${currentStep + 1} of ${fieldsets.length}`;
  }

  function installStepForm() {
    const form = byId("farm-form");
    if (!form || byId("form-stepper")) return;
    const fieldsets = Array.from(form.querySelectorAll("fieldset"));
    if (fieldsets.length < 2) return;
    form.classList.add("step-mode");
    const stepper = document.createElement("div");
    stepper.className = "form-stepper";
    stepper.id = "form-stepper";
    stepper.innerHTML = `
      <div class="step-progress-track"><div class="step-progress-fill"></div></div>
      <div class="step-tabs"></div>
      <div class="step-controls">
        <button class="ghost-btn" type="button" id="step-prev">Previous</button>
        <span id="step-count-label">Step 1 of ${fieldsets.length}</span>
        <button class="primary-btn" type="button" id="step-next">Next</button>
      </div>
    `;
    form.insertBefore(stepper, form.firstElementChild);
    const tabs = stepper.querySelector(".step-tabs");
    fieldsets.forEach((fieldset, i) => {
      const tab = document.createElement("button");
      tab.className = "step-tab";
      tab.type = "button";
      tab.textContent = fieldset.querySelector("legend")?.textContent || `Step ${i + 1}`;
      tab.addEventListener("click", () => setStep(i));
      tabs.append(tab);
    });
    byId("step-prev")?.addEventListener("click", () => setStep(currentStep - 1));
    byId("step-next")?.addEventListener("click", () => {
      if (currentStep >= fieldsets.length - 1) byId("analyze-btn")?.scrollIntoView({ behavior: "smooth", block: "center" });
      else setStep(currentStep + 1);
    });
    setStep(0);
  }

  function installToolGuards() {
    if (window.agriToolGuardsInstalled) return;
    window.agriToolGuardsInstalled = true;
    const baseSeed = window.seedToolsFromFarmData;
    const baseCalculate = window.calculateAllTools;
    if (typeof baseSeed === "function") {
      window.seedToolsFromFarmData = function () {
        if (!farmHasUserValues()) {
          clearToolInputs();
          renderEmptyTools();
          return;
        }
        baseSeed();
        if (typeof baseCalculate === "function") baseCalculate();
        updateToolEmptyStates();
      };
    }
    if (typeof baseCalculate === "function") {
      window.calculateAllTools = function () {
        if (!Object.values(TOOL_GROUPS).some(groupHasValues)) {
          renderEmptyTools();
          return;
        }
        baseCalculate();
        updateToolEmptyStates();
      };
    }
    if (!farmHasUserValues()) {
      clearToolInputs();
      renderEmptyTools();
    } else {
      updateToolEmptyStates();
    }
  }

  function stripHtml(value) {
    const div = document.createElement("div");
    div.innerHTML = String(value || "");
    return div.textContent || div.innerText || "";
  }

  function scoreRisk(text) {
    const lower = text.toLowerCase();
    let score = 35;
    ["risk", "pressure", "shortfall", "debt", "negative", "volatile", "stress", "watch"].forEach(word => {
      if (lower.includes(word)) score += 8;
    });
    ["strong", "positive", "safe", "improve", "healthy", "favorable"].forEach(word => {
      if (lower.includes(word)) score -= 5;
    });
    return Math.max(10, Math.min(90, score));
  }

  function topActions(text) {
    const lines = text
      .split(/\n|\. /)
      .map(line => line.replace(/^\s*[-*\d.)]+/, "").trim())
      .filter(line => line.length > 24 && line.length < 180);
    const actionWords = /should|priority|recommend|reduce|increase|review|compare|prepare|watch|improve|build|lock|hedge/i;
    const preferred = lines.filter(line => actionWords.test(line));
    return (preferred.length ? preferred : lines).slice(0, 3);
  }

  function enhanceAiMessage(message) {
    if (!message || message.dataset.scanEnhanced === "true" || !message.classList.contains("ai")) return;
    const text = stripHtml(message.innerHTML).replace(/\s+/g, " ").trim();
    if (text.length < 120 || /thinking|asking agridecision/i.test(text)) return;
    const actions = topActions(text);
    if (!actions.length) return;
    const risk = scoreRisk(text);
    const card = document.createElement("div");
    card.className = "ai-scan-card";
    card.innerHTML = `
      <div class="ai-scan-head">
        <strong>Quick Read</strong>
        <div class="risk-meter" title="Estimated risk level"><span style="left:${risk}%"></span></div>
      </div>
      <ol class="ai-action-list">${actions.map(action => `<li>${escapeHtml(action)}</li>`).join("")}</ol>
    `;
    message.prepend(card);
    message.dataset.scanEnhanced = "true";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installAiSummaryObserver() {
    ["chatbot-messages", "ai-combo-messages"].forEach(id => {
      const target = byId(id);
      if (!target || target.dataset.aiObserverInstalled === "true") return;
      target.dataset.aiObserverInstalled = "true";
      const observer = new MutationObserver(() => {
        target.querySelectorAll(".chat-msg.ai").forEach(enhanceAiMessage);
      });
      observer.observe(target, { childList: true, subtree: true, characterData: true });
      target.querySelectorAll(".chat-msg.ai").forEach(enhanceAiMessage);
    });
  }

  function compactTextFromHtml(html, max = 420) {
    const text = stripHtml(html).replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max).trim()}...` : text;
  }

  function buildOnePageReport() {
    const data = typeof getFormData === "function" ? getFormData() : {};
    const sections = typeof SECTIONS !== "undefined" ? SECTIONS : [];
    const content = typeof reportContent === "object" ? reportContent : {};
    const highlights = sections.slice(0, 5).map(([id, label]) => `
      <section>
        <h2>${escapeHtml(label)}</h2>
        <p>${escapeHtml(compactTextFromHtml(content[id] || "Not generated yet.", 520))}</p>
      </section>
    `).join("");
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>AgriDecision One-Page Report</title>
        <style>
          @page { size: letter; margin: 0.45in; }
          body { font-family: Arial, sans-serif; color: #172016; font-size: 10.5px; line-height: 1.35; }
          h1 { margin: 0 0 6px; font-size: 21px; color: #244d22; }
          h2 { margin: 9px 0 3px; font-size: 12px; color: #244d22; border-bottom: 1px solid #b8cdb2; }
          p { margin: 0; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 8px 0 10px; }
          .box { border: 1px solid #cddcca; border-radius: 6px; padding: 6px; background: #f7faf5; }
          .label { color: #5a5a52; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(data.farmName || "Farm Business Report")}</h1>
        <div class="meta">
          <div class="box"><div class="label">Region</div>${escapeHtml(data.state || "-")}</div>
          <div class="box"><div class="label">Acres</div>${escapeHtml(data.totalAcres || "-")}</div>
          <div class="box"><div class="label">Commodities</div>${escapeHtml(data.commodities || "-")}</div>
          <div class="box"><div class="label">Revenue</div>${escapeHtml(data.totalRevenue || "-")}</div>
        </div>
        ${highlights}
      </body>
      </html>`;
  }

  function printOnePageReport() {
    const popup = window.open("", "_blank");
    if (!popup) {
      window.print();
      return;
    }
    popup.document.open();
    popup.document.write(buildOnePageReport());
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 300);
  }

  function installReportPrintButton() {
    const actions = document.querySelector(".report-actions");
    if (!actions || byId("print-one-page-report")) return;
    const button = document.createElement("button");
    button.className = "ghost-btn one-page-report-btn";
    button.type = "button";
    button.id = "print-one-page-report";
    button.textContent = "Print One-Page PDF";
    button.addEventListener("click", printOnePageReport);
    actions.insertBefore(button, actions.firstElementChild?.nextSibling || null);
  }

  function install() {
    installStyles();
    installDemoOnboarding();
    installStepForm();
    installToolGuards();
    installAiSummaryObserver();
    installReportPrintButton();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 400);
  setTimeout(install, 1200);
}());
