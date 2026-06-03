function toolNumber(id) {
  const value = Number(document.getElementById(id)?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function toolMoney(value, digits = 0) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits
  });
}

function toolPlain(value, digits = 0) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

function currentToolDefaults() {
  const data = typeof getFormData === "function" ? getFormData() : {};
  const acres = Number(data.totalAcres) || 1000;
  const totalRevenue = Number(data.totalRevenue) || 0;
  const primaryPrice = Number(data.price) || 4.75;
  const primaryYield = Number(data.yield) || 185;
  const totalDebt = (Number(data.opLoan) || 0) + (Number(data.termLoan) || 0);
  const costPerAcre = ["seed", "fertilizer", "chemicals", "labor", "fuel", "equipment", "customHire", "water", "insurance", "maintenance"]
    .reduce((sum, key) => sum + (Number(data[key]) || 0), 0) || 540;

  return { acres, totalRevenue, primaryPrice, primaryYield, totalDebt, costPerAcre };
}

function setToolValue(id, value) {
  const input = document.getElementById(id);
  if (input && !input.value) input.value = value;
}

function seedToolsFromFarmData() {
  const d = currentToolDefaults();
  setToolValue("be-acres", d.acres);
  setToolValue("be-yield", d.primaryYield);
  setToolValue("be-cost", d.costPerAcre);
  setToolValue("be-overhead", 125);
  setToolValue("be-price", d.primaryPrice);

  setToolValue("cf-revenue", d.totalRevenue || d.acres * d.primaryYield * d.primaryPrice);
  setToolValue("cf-costs", d.acres * d.costPerAcre);
  setToolValue("cf-debt", Math.max(d.totalDebt * 0.12, 0));
  setToolValue("cf-family", 85000);
  setToolValue("cf-capex", 50000);

  setToolValue("eq-purchase", 280000);
  setToolValue("eq-down", 15);
  setToolValue("eq-rate", 7.5);
  setToolValue("eq-years", 5);
  setToolValue("eq-hours", 350);
  setToolValue("eq-maintenance", 28);
  setToolValue("eq-rent", 115);
  setToolValue("eq-resale", 45);

  setToolValue("tax-income", Math.max((d.totalRevenue || d.acres * d.primaryYield * d.primaryPrice) - d.acres * d.costPerAcre, 0));
  setToolValue("tax-depreciation", 45000);
  setToolValue("tax-rate", 24);
  setToolValue("tax-se", 15.3);

  setToolValue("bm-acres", d.acres);
  setToolValue("bm-yield", d.primaryYield);
  setToolValue("bm-cost", d.costPerAcre);
  setToolValue("bm-debt", d.totalDebt && d.acres ? d.totalDebt / d.acres : 420);
  setToolValue("bm-working", 18);
}

function ensureToolsView() {
  const menu = document.getElementById("site-menu-panel");
  if (menu && !menu.querySelector('[data-app-tab="tools"]')) {
    const toolsButton = document.createElement("button");
    toolsButton.className = "workspace-tab";
    toolsButton.type = "button";
    toolsButton.dataset.appTab = "tools";
    toolsButton.textContent = "Tools";
    toolsButton.addEventListener("click", () => {
      toolsButton.closest("details")?.removeAttribute("open");
      switchAppTab("tools");
    });
    const cmeButton = menu.querySelector('[data-app-tab="cme"]');
    const aiButton = menu.querySelector('[data-app-tab="ai"]');
    menu.insertBefore(toolsButton, cmeButton?.nextSibling || aiButton || null);
  }

  if (document.getElementById("tools-view")) return;

  const view = document.createElement("section");
  view.className = "app-view tools-view";
  view.id = "tools-view";
  view.innerHTML = `
    <div class="section tools-section">
      <div class="section-kicker">Decision Tools</div>
      <h2>Farm planning calculators</h2>
      <p class="section-lead">Run quick estimates for breakeven, cash flow, equipment, tax planning, and regional benchmarking from one workspace.</p>

      <div class="tools-actions">
        <button class="ghost-btn" type="button" id="tools-load-farm">Use current farm numbers</button>
      </div>

      <div class="tool-grid">
        <article class="tool-card">
          <h3>Breakeven Analysis</h3>
          <div class="tool-inputs">
            <label>Acres<input id="be-acres" type="number"></label>
            <label>Yield / acre<input id="be-yield" type="number" step="0.01"></label>
            <label>Variable cost / acre<input id="be-cost" type="number" step="0.01"></label>
            <label>Overhead / acre<input id="be-overhead" type="number" step="0.01"></label>
            <label>Expected price<input id="be-price" type="number" step="0.01"></label>
          </div>
          <div class="tool-result" id="be-result"></div>
        </article>

        <article class="tool-card">
          <h3>Cash Flow Projection</h3>
          <div class="tool-inputs">
            <label>Annual revenue<input id="cf-revenue" type="number"></label>
            <label>Operating costs<input id="cf-costs" type="number"></label>
            <label>Debt payments<input id="cf-debt" type="number"></label>
            <label>Family living / draws<input id="cf-family" type="number"></label>
            <label>Capital purchases<input id="cf-capex" type="number"></label>
          </div>
          <div class="tool-result" id="cf-result"></div>
        </article>

        <article class="tool-card">
          <h3>Equipment Ownership vs Rental</h3>
          <div class="tool-inputs">
            <label>Purchase price<input id="eq-purchase" type="number"></label>
            <label>Down payment %<input id="eq-down" type="number" step="0.1"></label>
            <label>Interest rate %<input id="eq-rate" type="number" step="0.1"></label>
            <label>Loan years<input id="eq-years" type="number"></label>
            <label>Annual hours<input id="eq-hours" type="number"></label>
            <label>Maintenance / hour<input id="eq-maintenance" type="number" step="0.01"></label>
            <label>Rental rate / hour<input id="eq-rent" type="number" step="0.01"></label>
            <label>Resale value %<input id="eq-resale" type="number" step="0.1"></label>
          </div>
          <div class="tool-result" id="eq-result"></div>
        </article>

        <article class="tool-card">
          <h3>Tax Planning Estimate</h3>
          <div class="tool-inputs">
            <label>Net farm income<input id="tax-income" type="number"></label>
            <label>Depreciation / Section 179<input id="tax-depreciation" type="number"></label>
            <label>Income tax rate %<input id="tax-rate" type="number" step="0.1"></label>
            <label>Self-employment tax %<input id="tax-se" type="number" step="0.1"></label>
          </div>
          <div class="tool-result" id="tax-result"></div>
          <p class="fineprint">Tax numbers are planning estimates only. Review final decisions with a CPA.</p>
        </article>

        <article class="tool-card wide-tool">
          <h3>Regional Benchmarking</h3>
          <div class="tool-inputs">
            <label>Acres<input id="bm-acres" type="number"></label>
            <label>Yield / acre<input id="bm-yield" type="number" step="0.01"></label>
            <label>Cost / acre<input id="bm-cost" type="number" step="0.01"></label>
            <label>Debt / acre<input id="bm-debt" type="number" step="0.01"></label>
            <label>Working capital %<input id="bm-working" type="number" step="0.1"></label>
          </div>
          <div class="table-shell benchmark-shell">
            <table>
              <thead><tr><th>Metric</th><th>Your Farm</th><th>Regional Avg.</th><th>Position</th></tr></thead>
              <tbody id="bm-result"></tbody>
            </table>
          </div>
          <p class="fineprint">Regional averages are starter benchmarks for planning. Replace them with your lender, extension, or farm-management association data when available.</p>
        </article>
      </div>
    </div>
  `;

  const cmeView = document.getElementById("cme-view");
  const aiView = document.getElementById("ai-view");
  document.body.insertBefore(view, cmeView || aiView || document.querySelector("footer"));

  document.getElementById("tools-load-farm")?.addEventListener("click", () => {
    document.querySelectorAll("#tools-view input").forEach(input => input.value = "");
    seedToolsFromFarmData();
    calculateAllTools();
  });
  document.querySelectorAll("#tools-view input").forEach(input => input.addEventListener("input", calculateAllTools));
  seedToolsFromFarmData();
  calculateAllTools();
}

function calculateBreakeven() {
  const acres = toolNumber("be-acres");
  const yieldPerAcre = toolNumber("be-yield");
  const cost = toolNumber("be-cost");
  const overhead = toolNumber("be-overhead");
  const price = toolNumber("be-price");
  const totalCostPerAcre = cost + overhead;
  const breakevenPrice = yieldPerAcre ? totalCostPerAcre / yieldPerAcre : 0;
  const breakevenYield = price ? totalCostPerAcre / price : 0;
  const marginPerAcre = yieldPerAcre * price - totalCostPerAcre;
  document.getElementById("be-result").innerHTML = `
    <strong>${toolMoney(breakevenPrice, 2)}</strong><span>breakeven price</span>
    <strong>${toolPlain(breakevenYield, 1)}</strong><span>breakeven yield / acre</span>
    <strong>${toolMoney(marginPerAcre * acres)}</strong><span>estimated whole-farm margin</span>
  `;
}

function calculateCashFlow() {
  const revenue = toolNumber("cf-revenue");
  const outflows = toolNumber("cf-costs") + toolNumber("cf-debt") + toolNumber("cf-family") + toolNumber("cf-capex");
  const net = revenue - outflows;
  const coverage = outflows ? revenue / outflows : 0;
  const status = net >= 0 ? "Cash flow positive" : "Cash flow shortfall";
  document.getElementById("cf-result").innerHTML = `
    <strong>${toolMoney(net)}</strong><span>${status}</span>
    <strong>${toolPlain(coverage, 2)}x</strong><span>cash coverage ratio</span>
    <strong>${toolMoney(outflows)}</strong><span>total projected outflows</span>
  `;
}

function calculateEquipment() {
  const purchase = toolNumber("eq-purchase");
  const down = purchase * toolNumber("eq-down") / 100;
  const principal = Math.max(purchase - down, 0);
  const years = Math.max(toolNumber("eq-years"), 1);
  const rate = toolNumber("eq-rate") / 100 / 12;
  const months = years * 12;
  const payment = rate ? principal * rate / (1 - Math.pow(1 + rate, -months)) : principal / months;
  const annualDebt = payment * 12;
  const hours = Math.max(toolNumber("eq-hours"), 1);
  const maintenance = toolNumber("eq-maintenance") * hours;
  const resaleCredit = purchase * toolNumber("eq-resale") / 100 / years;
  const ownAnnual = annualDebt + maintenance - resaleCredit;
  const ownHourly = ownAnnual / hours;
  const rentHourly = toolNumber("eq-rent");
  const rentAnnual = rentHourly * hours;
  const recommendation = ownHourly <= rentHourly ? "Ownership pencils better" : "Rental pencils better";
  document.getElementById("eq-result").innerHTML = `
    <strong>${toolMoney(ownHourly, 2)}</strong><span>ownership cost / hour</span>
    <strong>${toolMoney(rentHourly, 2)}</strong><span>rental cost / hour</span>
    <strong>${recommendation}</strong><span>${toolMoney(Math.abs(rentAnnual - ownAnnual))} annual difference</span>
  `;
}

function calculateTax() {
  const income = toolNumber("tax-income");
  const depreciation = toolNumber("tax-depreciation");
  const taxable = Math.max(income - depreciation, 0);
  const incomeTax = taxable * toolNumber("tax-rate") / 100;
  const seTax = taxable * toolNumber("tax-se") / 100;
  const total = incomeTax + seTax;
  document.getElementById("tax-result").innerHTML = `
    <strong>${toolMoney(taxable)}</strong><span>estimated taxable farm income</span>
    <strong>${toolMoney(total)}</strong><span>estimated tax reserve</span>
    <strong>${toolMoney(depreciation * (toolNumber("tax-rate") + toolNumber("tax-se")) / 100)}</strong><span>estimated depreciation tax effect</span>
  `;
}

function calculateBenchmarking() {
  const benchmarks = [
    ["Yield / acre", toolNumber("bm-yield"), 178, "higher"],
    ["Cost / acre", toolNumber("bm-cost"), 575, "lower"],
    ["Debt / acre", toolNumber("bm-debt"), 460, "lower"],
    ["Working capital %", toolNumber("bm-working"), 22, "higher"]
  ];
  document.getElementById("bm-result").innerHTML = benchmarks.map(([label, actual, average, better]) => {
    const favorable = better === "higher" ? actual >= average : actual <= average;
    const suffix = label.includes("%") ? "%" : "";
    return `<tr>
      <td>${label}</td>
      <td>${toolPlain(actual, 1)}${suffix}</td>
      <td>${toolPlain(average, 1)}${suffix}</td>
      <td>${favorable ? "Above target" : "Watch list"}</td>
    </tr>`;
  }).join("");
}

function calculateAllTools() {
  if (!document.getElementById("tools-view")) return;
  calculateBreakeven();
  calculateCashFlow();
  calculateEquipment();
  calculateTax();
  calculateBenchmarking();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureToolsView);
} else {
  ensureToolsView();
}
