(function () {
  const POLYGON_KEY = "agridecisionFieldPolygons";
  const EXTRA_ACRES_KEY = "agridecisionExtraAcres";
  const ALERTS_KEY = "agridecisionPriceAlerts";
  const ACTIVE_TAB_KEY = "agridecisionActiveTab";

  const USDA_BENCHMARKS = {
    corn: { label: "Corn", costPerAcre: 620, grossMargin: 235, dscr: 1.35 },
    soy: { label: "Soybeans", costPerAcre: 430, grossMargin: 185, dscr: 1.30 },
    wheat: { label: "Wheat", costPerAcre: 360, grossMargin: 145, dscr: 1.25 },
    mixed: { label: "Mixed crop operation", costPerAcre: 515, grossMargin: 195, dscr: 1.30 }
  };

  const TOOLTIP_TEXT = {
    "total-acres": "Total acres includes mapped field acres plus any additional acres you enter that are not drawn on the map.",
    "price": "Expected crop price per unit, such as dollars per bushel.",
    "yield": "Expected production per acre, such as bushels per acre.",
    "total-revenue": "Total yearly income before expenses.",
    "op-loan": "Short-term operating debt used for inputs, rent, fuel, labor, and seasonal expenses.",
    "term-loan": "Longer-term debt such as land, building, or equipment loans.",
    dscr: "Debt service coverage ratio. Above 1.25x is generally stronger because cash flow covers debt payments with room to spare.",
    npv: "Net present value. A way to compare future returns against money spent today.",
    "gross margin": "Revenue minus direct operating costs, before overhead and debt payments.",
    "cost per acre": "Operating cost divided by acres. Useful for comparing efficiency across farms.",
    hedge: "A price-risk plan using futures, options, forward contracts, or basis contracts.",
    basis: "The difference between local cash price and the futures price."
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function money(value, digits = 0) {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits
    });
  }

  function num(value, digits = 1) {
    return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits });
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getData() {
    return typeof getFormData === "function" ? getFormData() : {};
  }

  function readPolygons() {
    try { return JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]").filter(Boolean); }
    catch { return []; }
  }

  function mappedAcres() {
    return readPolygons().reduce((sum, poly) => sum + (Number(poly.acres) || 0), 0);
  }

  function extraAcres() {
    return Number(localStorage.getItem(EXTRA_ACRES_KEY) || 0) || 0;
  }

  function directCostPerAcre(data = getData()) {
    return ["seed", "fertilizer", "chemicals", "labor", "fuel", "equipment", "customHire", "water", "insurance", "maintenance"]
      .reduce((sum, key) => sum + (Number(data[key]) || 0), 0);
  }

  function debtService(data = getData()) {
    const debt = (Number(data.opLoan) || 0) + (Number(data.termLoan) || 0);
    const rate = Math.max((Number(data.interestRate) || 7) / 100, 0);
    const years = Math.max(Number(data.loanTerm) || 7, 1);
    if (!debt) return 0;
    return debt * (rate / (1 - Math.pow(1 + rate, -years)));
  }

  function farmMetrics(data = getData()) {
    const acres = Math.max(Number(data.totalAcres) || 0, 0);
    const revenue = Number(data.totalRevenue) || ((Number(data.yield) || 0) * (Number(data.price) || 0) * acres);
    const costPerAcre = directCostPerAcre(data);
    const totalCost = costPerAcre * acres;
    const grossMargin = acres ? (revenue - totalCost) / acres : 0;
    const ds = debtService(data);
    const dscr = ds ? (revenue - totalCost) / ds : 0;
    return { acres, revenue, costPerAcre, totalCost, grossMargin, debtService: ds, dscr };
  }

  function commodityBenchmark(data = getData()) {
    const text = `${data.commodities || ""} ${data.farmType || ""}`.toLowerCase();
    if (/soy|bean/.test(text)) return USDA_BENCHMARKS.soy;
    if (/wheat/.test(text)) return USDA_BENCHMARKS.wheat;
    if (/corn/.test(text)) return USDA_BENCHMARKS.corn;
    return USDA_BENCHMARKS.mixed;
  }

  function installStyles() {
    if (byId("agri-decision-support-style")) return;
    const style = document.createElement("style");
    style.id = "agri-decision-support-style";
    style.textContent = `
      .acre-sync-panel, .decision-card, .alert-panel {
        display: grid;
        gap: 10px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .acre-sync-panel {
        grid-column: 1 / -1;
        background: #f7faf5;
      }
      .acre-sync-row, .decision-metrics, .alert-form, .scenario-select-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .acre-sync-value, .metric-box {
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
      }
      .acre-sync-value strong, .metric-box strong { display: block; font-size: 20px; color: var(--green-800); }
      .agri-tip {
        display: inline-grid;
        place-items: center;
        width: 18px;
        height: 18px;
        margin-left: 6px;
        border: 1px solid var(--line-strong);
        border-radius: 999px;
        color: var(--green-800);
        background: #eef4ec;
        font-size: 12px;
        font-weight: 800;
        cursor: help;
        vertical-align: middle;
      }
      .app-view.calendar-view, .app-view.scenario-view { min-height: calc(100vh - 60px); padding-top: 44px; background: #f7faf5; }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .calendar-month {
        display: grid;
        gap: 8px;
        min-height: 190px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .calendar-month.current { border-color: #3a8035; box-shadow: 0 0 0 2px rgba(58,128,53,.12); }
      .calendar-month h3 { margin: 0; font-size: 17px; }
      .calendar-month ul { margin: 0; padding-left: 18px; }
      .scenario-table td, .scenario-table th { vertical-align: top; }
      .scenario-win { color: #0F6E56; font-weight: 800; }
      .alert-list { display: grid; gap: 8px; }
      .alert-item {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
      }
      .alert-hit { border-color: #d39b2a; background: #fff8e6; }
      @media (max-width: 860px) {
        .acre-sync-row, .decision-metrics, .alert-form, .scenario-select-row, .calendar-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function installTooltips() {
    Object.entries(TOOLTIP_TEXT).forEach(([key, text]) => {
      let targets = [];
      const input = byId(key);
      if (input) targets.push(input.closest("label"));
      if (!input) {
        document.querySelectorAll("h2, h3, th, label, small, span").forEach(el => {
          if (el.textContent?.toLowerCase().includes(key)) targets.push(el);
        });
      }
      targets.filter(Boolean).slice(0, 8).forEach(target => {
        if (target.querySelector?.(`[data-tip-key="${CSS.escape(key)}"]`)) return;
        const tip = document.createElement("span");
        tip.className = "agri-tip";
        tip.dataset.tipKey = key;
        tip.textContent = "?";
        tip.title = text;
        target.append(tip);
      });
    });
  }

  function installAcreSync() {
    const total = byId("total-acres");
    if (!total || byId("acre-sync-panel")) return;
    const panel = document.createElement("div");
    panel.className = "acre-sync-panel";
    panel.id = "acre-sync-panel";
    panel.innerHTML = `
      <strong>Mapped acres</strong>
      <div class="acre-sync-row">
        <div class="acre-sync-value"><small>From Field Map</small><strong id="mapped-acres-value">0.0</strong></div>
        <label>Additional acres not mapped<input id="extra-acres-input" type="number" min="0" step="0.1" placeholder="0"></label>
        <div class="acre-sync-value"><small>Total acres used</small><strong id="synced-acres-value">0.0</strong></div>
      </div>
      <p class="fineprint">Drawn field boundaries update the total acres automatically. Add rented, pasture, or other acres here if they are not on the map.</p>
    `;
    total.closest("fieldset")?.append(panel);
    const extra = byId("extra-acres-input");
    if (extra) {
      extra.value = localStorage.getItem(EXTRA_ACRES_KEY) || "";
      extra.addEventListener("input", () => {
        localStorage.setItem(EXTRA_ACRES_KEY, extra.value || "0");
        updateAcreSync(true);
      });
    }
    updateAcreSync(false);
  }

  let lastMappedSignature = "";

  function updateAcreSync(force = false) {
    const total = byId("total-acres");
    const mapped = mappedAcres();
    const extra = extraAcres();
    const signature = `${mapped.toFixed(2)}:${extra.toFixed(2)}`;
    byId("mapped-acres-value") && (byId("mapped-acres-value").textContent = num(mapped, 1));
    byId("synced-acres-value") && (byId("synced-acres-value").textContent = num(mapped + extra, 1));
    if (total && (force || signature !== lastMappedSignature) && (mapped > 0 || extra > 0)) {
      total.value = (mapped + extra).toFixed(1);
      total.dispatchEvent(new Event("input", { bubbles: true }));
    }
    lastMappedSignature = signature;
  }

  function installPeerBenchmarking() {
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!toolsSection || byId("peer-benchmark-card")) return;
    const card = document.createElement("article");
    card.className = "decision-card";
    card.id = "peer-benchmark-card";
    card.innerHTML = `
      <div>
        <div class="section-kicker">Peer Benchmarking</div>
        <h2>Competitive position</h2>
        <p class="section-lead">Compare your cost per acre, gross margin, and DSCR against USDA-style regional/commodity planning averages.</p>
      </div>
      <div class="decision-metrics" id="peer-benchmark-metrics"></div>
      <p class="fineprint">Benchmarks are planning baselines modeled from USDA ERS/ARMS-style crop cost and return categories. Replace with your local extension or lender data when available.</p>
    `;
    const grid = toolsSection.querySelector(".tool-grid");
    toolsSection.insertBefore(card, grid || null);
    updatePeerBenchmarking();
  }

  function metricPosition(actual, benchmark, lowerBetter = false) {
    if (!actual) return "Add values";
    const favorable = lowerBetter ? actual <= benchmark : actual >= benchmark;
    const diff = benchmark ? ((actual - benchmark) / benchmark) * 100 : 0;
    return `${favorable ? "Competitive" : "Watch list"} (${diff >= 0 ? "+" : ""}${diff.toFixed(0)}%)`;
  }

  function updatePeerBenchmarking() {
    const target = byId("peer-benchmark-metrics");
    if (!target) return;
    const data = getData();
    const metric = farmMetrics(data);
    const bench = commodityBenchmark(data);
    target.innerHTML = `
      <div class="metric-box"><small>Cost per acre vs ${esc(bench.label)}</small><strong>${money(metric.costPerAcre)}</strong><span>${metricPosition(metric.costPerAcre, bench.costPerAcre, true)} vs ${money(bench.costPerAcre)}</span></div>
      <div class="metric-box"><small>Gross margin / acre</small><strong>${money(metric.grossMargin)}</strong><span>${metricPosition(metric.grossMargin, bench.grossMargin)} vs ${money(bench.grossMargin)}</span></div>
      <div class="metric-box"><small>DSCR</small><strong>${metric.dscr ? `${num(metric.dscr, 2)}x` : "-"}</strong><span>${metricPosition(metric.dscr, bench.dscr)} vs ${num(bench.dscr, 2)}x</span></div>
    `;
  }

  function calendarTasks(month, data = getData()) {
    const crop = `${data.commodities || data.farmType || ""}`.toLowerCase();
    const cornSoy = /corn|soy|bean|row/.test(crop);
    const wheat = /wheat/.test(crop);
    const base = {
      0: ["Finalize cash flow plan", "Review operating loan renewal", "Update breakeven price targets"],
      1: ["Lock early fertilizer needs", "Review crop insurance options", "Set first hedge trigger levels"],
      2: ["Finalize planting budget", "Confirm seed and chemical plan", "Check lender covenant targets"],
      3: ["Planting readiness check", "Watch new-crop futures rallies", "Update fuel and labor schedule"],
      4: ["Planting progress review", "Reprice inputs if markets move", "Check working capital after spring spend"],
      5: ["Post-emerge cost review", "Evaluate first marketing tranche", "Update yield scenarios"],
      6: ["Mid-season yield check", "Review crop condition and insurance notes", "Set harvest cash-flow plan"],
      7: ["Prepare storage and trucking plan", "Review basis opportunities", "Stress test lower yield"],
      8: ["Harvest readiness", "Lock harvest delivery needs", "Review equipment repair exposure"],
      9: ["Harvest cash-flow update", "Compare storage vs sell decisions", "Plan fall fertilizer"],
      10: ["Year-end tax estimate", "Review machinery replacement timing", "Update lender package"],
      11: ["Finalize year-end books", "Plan next-year acreage mix", "Renew marketing plan"]
    };
    const tasks = [...base[month]];
    if (cornSoy && [1, 5, 7, 9].includes(month)) tasks.push("Review corn/soy hedge targets");
    if (wheat && [5, 6, 7].includes(month)) tasks.push("Review wheat harvest and basis plan");
    return tasks.slice(0, 5);
  }

  function ensureMenuButton(tab, label, beforeTab = "story") {
    const menu = byId("site-menu-panel");
    if (!menu || menu.querySelector(`[data-app-tab="${tab}"]`)) return;
    const button = document.createElement("button");
    button.className = "workspace-tab";
    button.type = "button";
    button.dataset.appTab = tab;
    button.textContent = label;
    button.addEventListener("click", () => {
      button.closest("details")?.removeAttribute("open");
      if (typeof switchAppTab === "function") switchAppTab(tab);
    });
    menu.insertBefore(button, menu.querySelector(`[data-app-tab="${beforeTab}"]`) || null);
  }

  function installCalendarView() {
    ensureMenuButton("calendar", "Calendar", "story");
    if (byId("calendar-view")) return;
    const view = document.createElement("section");
    view.className = "app-view calendar-view";
    view.id = "calendar-view";
    view.innerHTML = `
      <div class="section">
        <div class="section-kicker">Seasonal Decision Calendar</div>
        <h2>Time-sensitive farm decisions</h2>
        <p class="section-lead">A month-by-month view for hedging, input locks, operating loans, crop insurance, harvest planning, and lender updates.</p>
        <div class="calendar-grid" id="decision-calendar-grid"></div>
      </div>
    `;
    document.body.insertBefore(view, byId("story-view") || document.querySelector("footer"));
    updateCalendar();
  }

  function updateCalendar() {
    const grid = byId("decision-calendar-grid");
    if (!grid) return;
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1));
    grid.innerHTML = months.map(date => {
      const month = date.getMonth();
      return `<article class="calendar-month ${month === now.getMonth() ? "current" : ""}">
        <h3>${date.toLocaleString(undefined, { month: "long" })}</h3>
        <ul>${calendarTasks(month).map(task => `<li>${esc(task)}</li>`).join("")}</ul>
      </article>`;
    }).join("");
  }

  function installScenarioView() {
    ensureMenuButton("scenarios", "Scenarios", "story");
    if (byId("scenario-view")) return;
    const view = document.createElement("section");
    view.className = "app-view scenario-view";
    view.id = "scenario-view";
    view.innerHTML = `
      <div class="section">
        <div class="section-kicker">Scenario Comparison</div>
        <h2>Should I or shouldn't I?</h2>
        <p class="section-lead">Compare two saved projects side by side, such as buying equipment versus expanding acres.</p>
        <div class="decision-card">
          <div class="scenario-select-row">
            <label>Scenario A<select id="scenario-a"></select></label>
            <label>Scenario B<select id="scenario-b"></select></label>
            <button class="primary-btn" type="button" id="refresh-scenarios">Compare</button>
          </div>
          <div class="table-shell scenario-table">
            <table>
              <thead><tr><th>Metric</th><th>Scenario A</th><th>Scenario B</th><th>Read</th></tr></thead>
              <tbody id="scenario-results"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.body.insertBefore(view, byId("story-view") || document.querySelector("footer"));
    byId("refresh-scenarios")?.addEventListener("click", updateScenarioOptions);
    updateScenarioOptions();
  }

  function projectMetric(project) {
    return farmMetrics(project?.farmData || {});
  }

  function updateScenarioOptions() {
    const a = byId("scenario-a");
    const b = byId("scenario-b");
    if (!a || !b || typeof getStore !== "function") return;
    const projects = getStore().projects || [];
    [a, b].forEach(select => {
      const current = select.value;
      select.innerHTML = projects.length ? projects.map(project => `<option value="${esc(project.id)}">${esc(project.name || "Untitled Project")}</option>`).join("") : '<option value="">Save projects first</option>';
      if (projects.some(project => project.id === current)) select.value = current;
    });
    if (!b.value && projects[1]) b.value = projects[1].id;
    renderScenarioComparison();
  }

  function compareCell(a, b, higherBetter = true) {
    if (!a && !b) return "-";
    if (Math.abs(a - b) < 0.01) return "Similar";
    const winner = higherBetter ? (a > b ? "A" : "B") : (a < b ? "A" : "B");
    return `<span class="scenario-win">Scenario ${winner}</span>`;
  }

  function renderScenarioComparison() {
    const target = byId("scenario-results");
    if (!target || typeof getStore !== "function") return;
    const projects = getStore().projects || [];
    const pa = projects.find(project => project.id === byId("scenario-a")?.value);
    const pb = projects.find(project => project.id === byId("scenario-b")?.value);
    if (!pa || !pb) {
      target.innerHTML = '<tr><td colspan="4">Save at least two projects to compare scenarios.</td></tr>';
      return;
    }
    const ma = projectMetric(pa);
    const mb = projectMetric(pb);
    target.innerHTML = [
      ["Acres", num(ma.acres, 1), num(mb.acres, 1), compareCell(ma.acres, mb.acres)],
      ["Revenue", money(ma.revenue), money(mb.revenue), compareCell(ma.revenue, mb.revenue)],
      ["Cost per acre", money(ma.costPerAcre), money(mb.costPerAcre), compareCell(ma.costPerAcre, mb.costPerAcre, false)],
      ["Gross margin / acre", money(ma.grossMargin), money(mb.grossMargin), compareCell(ma.grossMargin, mb.grossMargin)],
      ["DSCR", ma.dscr ? `${num(ma.dscr, 2)}x` : "-", mb.dscr ? `${num(mb.dscr, 2)}x` : "-", compareCell(ma.dscr, mb.dscr)]
    ].map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join("");
  }

  function readAlerts() {
    try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]").filter(Boolean); }
    catch { return []; }
  }

  function saveAlerts(alerts) {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }

  function parsePrice(value) {
    const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
    return Number(cleaned);
  }

  function currentQuotes() {
    return Array.from(document.querySelectorAll("#futures-body tr")).map(row => {
      const cells = row.querySelectorAll("td");
      return {
        commodity: cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || "",
        contract: cells[2]?.textContent?.trim() || "",
        price: parsePrice(cells[3]?.textContent)
      };
    }).filter(row => row.commodity && Number.isFinite(row.price));
  }

  function installPriceAlerts() {
    const cmeSection = byId("market-watch-table");
    if (!cmeSection || byId("price-alert-panel")) return;
    const panel = document.createElement("div");
    panel.className = "alert-panel";
    panel.id = "price-alert-panel";
    panel.innerHTML = `
      <div>
        <div class="section-kicker">Price Alerts & Hedge Triggers</div>
        <h2>Watch target prices</h2>
        <p class="section-lead">Set local price triggers from the CME table. The site checks them when futures refresh.</p>
      </div>
      <div class="alert-form">
        <label>Commodity<input id="alert-commodity" type="text" placeholder="Corn"></label>
        <label>Target price<input id="alert-price" type="number" step="0.01" placeholder="4.80"></label>
        <label>Trigger<select id="alert-direction"><option value="above">At or above</option><option value="below">At or below</option></select></label>
      </div>
      <button class="primary-btn" type="button" id="add-price-alert">Add Alert</button>
      <div class="alert-list" id="price-alert-list"></div>
    `;
    cmeSection.insertBefore(panel, cmeSection.querySelector(".table-shell"));
    byId("add-price-alert")?.addEventListener("click", () => {
      const commodity = byId("alert-commodity")?.value.trim();
      const target = Number(byId("alert-price")?.value);
      const direction = byId("alert-direction")?.value || "above";
      if (!commodity || !Number.isFinite(target)) return;
      const alerts = readAlerts();
      alerts.push({ id: `alert-${Date.now()}`, commodity, target, direction, createdAt: new Date().toISOString() });
      saveAlerts(alerts);
      renderAlerts();
    });
    renderAlerts();
  }

  function renderAlerts() {
    const target = byId("price-alert-list");
    if (!target) return;
    const quotes = currentQuotes();
    const alerts = readAlerts();
    target.innerHTML = alerts.length ? alerts.map(alert => {
      const quote = quotes.find(item => item.commodity.toLowerCase().includes(alert.commodity.toLowerCase()));
      const hit = quote && (alert.direction === "above" ? quote.price >= alert.target : quote.price <= alert.target);
      return `<div class="alert-item ${hit ? "alert-hit" : ""}">
        <span><strong>${esc(alert.commodity)}</strong> ${alert.direction === "above" ? "at or above" : "at or below"} ${num(alert.target, 2)}${quote ? `, now ${num(quote.price, 2)}` : ""}</span>
        <button class="ghost-btn" type="button" data-remove-alert="${esc(alert.id)}">Remove</button>
      </div>`;
    }).join("") : '<p class="fineprint">No price alerts yet.</p>';
    target.querySelectorAll("[data-remove-alert]").forEach(button => {
      button.addEventListener("click", () => {
        saveAlerts(readAlerts().filter(alert => alert.id !== button.dataset.removeAlert));
        renderAlerts();
      });
    });
  }

  function patchSwitchTabs() {
    if (typeof switchAppTab !== "function" || switchAppTab.isDecisionSupportPatch) return;
    const base = switchAppTab;
    switchAppTab = function (tabName) {
      installCalendarView();
      installScenarioView();
      const result = base(tabName);
      const calendar = byId("calendar-view");
      const scenarios = byId("scenario-view");
      if (calendar) calendar.classList.toggle("active", tabName === "calendar");
      if (scenarios) scenarios.classList.toggle("active", tabName === "scenarios");
      if (tabName === "calendar") updateCalendar();
      if (tabName === "scenarios") updateScenarioOptions();
      localStorage.setItem(ACTIVE_TAB_KEY, tabName);
      return result;
    };
    switchAppTab.isDecisionSupportPatch = true;
  }

  function patchLoadFutures() {
    if (typeof loadFutures !== "function" || loadFutures.isDecisionSupportPatch) return;
    const base = loadFutures;
    loadFutures = async function () {
      const result = await base();
      installPriceAlerts();
      renderAlerts();
      return result;
    };
    loadFutures.isDecisionSupportPatch = true;
  }

  function bindInputs() {
    document.querySelectorAll("#farm-form input, #farm-form select, #farm-form textarea").forEach(input => {
      if (input.dataset.decisionSupportBound === "true") return;
      input.dataset.decisionSupportBound = "true";
      input.addEventListener("input", () => {
        updatePeerBenchmarking();
        updateCalendar();
      });
      input.addEventListener("change", () => {
        updatePeerBenchmarking();
        updateCalendar();
      });
    });
  }

  function restoreActiveTab() {
    const tab = localStorage.getItem(ACTIVE_TAB_KEY);
    if (tab && typeof switchAppTab === "function" && document.querySelector(`[data-app-tab="${tab}"]`)) {
      setTimeout(() => switchAppTab(tab), 120);
    }
  }

  function install() {
    installStyles();
    installTooltips();
    installAcreSync();
    installPeerBenchmarking();
    installCalendarView();
    installScenarioView();
    installPriceAlerts();
    patchSwitchTabs();
    patchLoadFutures();
    bindInputs();
    updateAcreSync(false);
    updatePeerBenchmarking();
    renderAlerts();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 400);
  setTimeout(() => { install(); restoreActiveTab(); }, 1200);
  setInterval(() => {
    updateAcreSync(false);
    renderAlerts();
  }, 2500);
}());
