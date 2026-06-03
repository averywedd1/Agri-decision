const EXPENSE_FIELDS = [
  ["seed", "Seed", "#3a8035"],
  ["fertilizer", "Fertilizer", "#d39b2a"],
  ["chemicals", "Chemicals", "#6a9f58"],
  ["labor", "Labor", "#2f6f86"],
  ["fuel", "Fuel", "#9b6b34"],
  ["equipment", "Equipment", "#5f6f52"],
  ["customHire", "Custom Hire", "#8a7f43"],
  ["water", "Water / Irrigation", "#4b8da8"],
  ["insurance", "Insurance", "#7a6a9c"],
  ["maintenance", "Maintenance", "#b05d42"]
];

const CME_UNITS = [
  [/corn|soybean|wheat|oats/i, "cents per bushel"],
  [/soybean meal/i, "dollars per short ton"],
  [/soybean oil|cattle|hog|cotton|sugar|coffee/i, "cents per pound"],
  [/cocoa/i, "dollars per metric ton"],
  [/milk/i, "dollars per hundredweight"]
];

const REGION_BENCHMARKS = [
  { match: /iowa|\bia\b|illinois|\bil\b|indiana|\bin\b|corn belt/i, label: "Corn Belt", yield: 205, cost: 610, debt: 520, working: 24 },
  { match: /minnesota|\bmn\b|wisconsin|\bwi\b|michigan|\bmi\b|upper midwest/i, label: "Upper Midwest", yield: 190, cost: 590, debt: 500, working: 23 },
  { match: /kansas|\bks\b|nebraska|\bne\b|south dakota|\bsd\b|north dakota|\bnd\b|plains/i, label: "Great Plains", yield: 150, cost: 470, debt: 420, working: 21 },
  { match: /texas|\btx\b|oklahoma|\bok\b|new mexico|\bnm\b|southwest/i, label: "Southern Plains", yield: 125, cost: 445, debt: 390, working: 19 },
  { match: /arkansas|\bar\b|mississippi|\bms\b|louisiana|\bla\b|missouri|\bmo\b|delta/i, label: "Delta / Mid-South", yield: 170, cost: 560, debt: 455, working: 20 },
  { match: /georgia|\bga\b|alabama|\bal\b|florida|\bfl\b|carolina|southeast/i, label: "Southeast", yield: 145, cost: 540, debt: 435, working: 18 },
  { match: /california|\bca\b|oregon|\bor\b|washington|\bwa\b|pacific|west/i, label: "Pacific / West", yield: 180, cost: 690, debt: 610, working: 20 }
];

let cmeRefreshTimer = null;
let cmeLastRows = [];
let cmeLoading = false;

function ensureEnhancementStyles() {
  if (document.getElementById("agri-enhancement-styles")) return;
  const style = document.createElement("style");
  style.id = "agri-enhancement-styles";
  style.textContent = `
    .cme-snapshot-panel,.expense-card,.task-output{border:1px solid var(--line);border-radius:8px;background:#fff;box-shadow:var(--shadow)}
    .cme-snapshot-panel{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:22px 0 14px;padding:18px}
    .cme-snapshot-panel h3,.expense-card h3{margin:0 0 6px}
    .cme-snapshot-panel p{margin:0;color:var(--muted)}
    .cme-snapshot-shell{margin-bottom:18px}
    .expense-card{margin:24px 0;padding:22px}
    .expense-chart-layout{display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:22px;align-items:center;margin-top:16px}
    .expense-pie{display:grid;place-items:center;width:min(100%,240px);aspect-ratio:1;border-radius:50%;border:1px solid var(--line)}
    .expense-pie span{display:grid;place-items:center;width:58%;aspect-ratio:1;border-radius:50%;background:white;color:var(--green-900);font-weight:700;text-align:center;box-shadow:0 0 0 1px var(--line)}
    .expense-pie small{display:block;color:var(--muted);font-size:12px;font-weight:500}
    .expense-legend{display:grid;gap:8px}
    .expense-legend-row{display:grid;grid-template-columns:14px minmax(100px,1fr) auto auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
    .expense-legend-row span{width:14px;height:14px;border-radius:50%}
    .expense-legend-row em,.expense-legend-row small{color:var(--muted);font-style:normal}
    .tasks-view{min-height:calc(100vh - 60px);padding-top:44px;background:#f7faf5}
    .tasks-section{max-width:1120px}
    .tasks-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}
    .task-output{min-height:260px;padding:22px}
    .task-output table{width:100%;border-collapse:collapse}
    .task-output th,.task-output td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
    .error-text{color:#a03b2f}
    @media (max-width:820px){.cme-snapshot-panel{align-items:flex-start;flex-direction:column}.expense-chart-layout{grid-template-columns:1fr}.expense-legend-row{grid-template-columns:14px 1fr}.expense-legend-row em,.expense-legend-row small{grid-column:2}}
  `;
  document.head.appendChild(style);
}

function saveWorkspaceDraftNow() {
  if (typeof getFormData !== "function") return;
  localStorage.setItem("agridecisionWorkspaceDraft", JSON.stringify({
    farmData: getFormData(),
    updatedAt: new Date().toISOString()
  }));
}

if (typeof projectName === "function") {
  projectName = function (fallback = "Untitled Project") {
    const data = typeof getFormData === "function" ? getFormData() : {};
    const farmName = String(data.farmName || "").trim();
    const commodities = String(data.commodities || "").trim();
    return farmName && farmName !== "Your Farm" ? farmName : commodities || fallback;
  };
}

if (typeof projectSnapshot === "function") {
  const baseProjectSnapshot = projectSnapshot;
  projectSnapshot = function (existing = {}) {
    const snapshot = baseProjectSnapshot(existing);
    snapshot.taskContent = window.agriTaskContent !== undefined ? window.agriTaskContent : existing.taskContent || "";
    return snapshot;
  };
}

if (typeof saveProject === "function") {
  const baseSaveProject = saveProject;
  saveProject = function (options = {}) {
    saveWorkspaceDraftNow();
    return baseSaveProject(options);
  };
}

if (typeof scheduleSave === "function") {
  const baseScheduleSave = scheduleSave;
  scheduleSave = function () {
    saveWorkspaceDraftNow();
    updateExpensePieChart();
    if (typeof refreshRegionalBenchmarks === "function") refreshRegionalBenchmarks();
    if (typeof refreshCmeSnapshotFromWorkspace === "function") refreshCmeSnapshotFromWorkspace();
    return baseScheduleSave();
  };
}

if (typeof loadProject === "function") {
  const baseLoadProject = loadProject;
  loadProject = function (projectId) {
    const result = baseLoadProject(projectId);
    try {
      const project = getStore().projects.find(item => item.id === projectId);
      window.agriTaskContent = project?.taskContent || "";
      renderTaskContent();
    } catch {}
    updateExpensePieChart();
    if (typeof refreshRegionalBenchmarks === "function") refreshRegionalBenchmarks();
    if (typeof refreshCmeSnapshotFromWorkspace === "function") refreshCmeSnapshotFromWorkspace();
    return result;
  };
}

function quoteUnit(row) {
  const name = `${row?.commodity || ""} ${row?.category || ""}`;
  return row?.priceUnit || CME_UNITS.find(([pattern]) => pattern.test(name))?.[1] || "contract quote units";
}

function quotePrice(row) {
  return row?.last || row?.settle || row?.priorSettle || "-";
}

function workspaceCommodityTerms() {
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

function quoteMatchesWorkspace(row, terms) {
  if (!terms.length) return false;
  const name = `${row.commodity || ""} ${row.category || ""}`.toLowerCase();
  return terms.some(term => name.includes(term) || term.includes(name.split(" ")[0]));
}

function cmeMarkup() {
  return `
    <div class="section cme-section" id="market-watch-table">
      <div class="section-kicker">CME Group</div>
      <h2>Commodity futures snapshot</h2>
      <p class="section-lead">Delayed futures prices with a farm-workspace snapshot, quote units, and automatic refresh while this tab is open.</p>
      <div class="cme-snapshot-panel">
        <div>
          <h3>From your farm workspace</h3>
          <p id="futures-snapshot-summary">Enter commodities in the farm workspace to focus this snapshot.</p>
        </div>
        <button class="ghost-btn" type="button" id="refresh-futures">Refresh Futures</button>
      </div>
      <div class="table-shell cme-snapshot-shell">
        <table>
          <thead><tr><th>Commodity</th><th>Contract</th><th>Price</th><th>Priced In</th><th>Updated</th></tr></thead>
          <tbody id="futures-snapshot-body"><tr><td colspan="5">Loading futures snapshot...</td></tr></tbody>
        </table>
      </div>
      <div class="table-shell cme-table-shell">
        <table>
          <thead>
            <tr><th>Group</th><th>Commodity</th><th>Contract</th><th>Price</th><th>Priced In</th><th>Last</th><th>Settle</th><th>Prior</th><th>Change</th><th>Volume</th><th>Updated</th><th>Source</th></tr>
          </thead>
          <tbody id="futures-body"><tr><td colspan="12">Loading futures...</td></tr></tbody>
        </table>
      </div>
      <p class="fineprint" id="futures-note">Market data is delayed, auto-refreshes every 60 seconds while this tab is open, and should be checked directly with CME Group before trading or hedging decisions.</p>
    </div>
  `;
}

function ensureEnhancedCmeView() {
  const view = document.getElementById("cme-view");
  if (!view) return;
  if (!document.getElementById("futures-snapshot-body")) view.innerHTML = cmeMarkup();
  const refresh = document.getElementById("refresh-futures");
  if (refresh && !refresh.dataset.bound) {
    refresh.dataset.bound = "true";
    refresh.addEventListener("click", () => loadFutures());
  }
  if (!cmeRefreshTimer) {
    cmeRefreshTimer = setInterval(() => {
      if (document.getElementById("cme-view")?.classList.contains("active")) loadFutures({ silent: true });
    }, 60000);
  }
}

function renderCmeSnapshot(rows = cmeLastRows) {
  const target = document.getElementById("futures-snapshot-body");
  const summary = document.getElementById("futures-snapshot-summary");
  if (!target) return;
  const terms = workspaceCommodityTerms();
  const matches = rows.filter(row => quoteMatchesWorkspace(row, terms));
  const snapshotRows = (matches.length ? matches : rows).slice(0, matches.length ? 8 : 6);
  if (summary) {
    summary.textContent = matches.length
      ? "Showing futures that match the commodities entered in the farm workspace."
      : "No exact workspace commodity match yet, so the snapshot shows the first major agricultural futures.";
  }
  target.innerHTML = snapshotRows.length ? snapshotRows.map(row => `
    <tr>
      <td>${esc(row.commodity)}</td>
      <td>${esc(row.contract || "-")}</td>
      <td>${esc(quotePrice(row))}</td>
      <td>${esc(quoteUnit(row))}</td>
      <td>${esc(typeof formatUpdated === "function" ? formatUpdated(row.updated) : row.updated || "-")}</td>
    </tr>
  `).join("") : '<tr><td colspan="5">Enter commodities in the farm workspace, then refresh futures.</td></tr>';
}

window.refreshCmeSnapshotFromWorkspace = function () {
  ensureEnhancedCmeView();
  renderCmeSnapshot();
};

if (typeof loadFutures === "function") {
  loadFutures = async function (options = {}) {
    ensureEnhancedCmeView();
    if (cmeLoading) return;
    cmeLoading = true;
    const refresh = document.getElementById("refresh-futures");
    if (refresh && !options.silent) refresh.textContent = "Refreshing...";
    try {
      const response = await fetch("/api/commodities");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load futures data.");
      const rows = data.quotes || [];
      cmeLastRows = rows;
      renderCmeSnapshot(rows);
      document.getElementById("futures-body").innerHTML = rows.length ? rows.map(row => `
        <tr>
          <td>${esc(row.category || "Agriculture")}</td>
          <td>${esc(row.commodity)}</td>
          <td>${esc(row.contract || "-")}</td>
          <td>${esc(quotePrice(row))}</td>
          <td>${esc(quoteUnit(row))}</td>
          <td>${esc(row.last || row.settle || row.priorSettle || "-")}</td>
          <td>${esc(row.settle || "-")}</td>
          <td>${esc(row.priorSettle || "-")}</td>
          <td>${esc(row.change || "-")}</td>
          <td>${esc(row.volume || "-")}</td>
          <td>${esc(typeof formatUpdated === "function" ? formatUpdated(row.updated) : row.updated || "-")}</td>
          <td><a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">${esc(row.sourceLabel || "CME")}</a></td>
        </tr>
      `).join("") : '<tr><td colspan="12">No futures quotes returned right now.</td></tr>';
      document.getElementById("futures-note").textContent = `${data.note || "Delayed commodity futures snapshot."} Auto-refresh is on every 60 seconds while this tab is open. Last checked ${new Date().toLocaleTimeString()}.`;
    } catch (error) {
      document.getElementById("futures-body").innerHTML = '<tr><td colspan="12">Could not load CME futures right now.</td></tr>';
      document.getElementById("futures-note").textContent = error.message;
    } finally {
      cmeLoading = false;
      if (refresh) refresh.textContent = "Refresh Futures";
    }
  };
}

function regionalBenchmark() {
  const region = String(document.getElementById("state")?.value || "").trim();
  return REGION_BENCHMARKS.find(item => item.match.test(region)) || { label: region || "National starter average", yield: 178, cost: 575, debt: 460, working: 22 };
}

if (typeof calculateBenchmarking === "function") {
  calculateBenchmarking = function () {
    const regional = regionalBenchmark();
    const label = document.getElementById("bm-region-label");
    if (label) label.textContent = `Regional averages shown for ${regional.label}. Replace starter benchmarks with lender, extension, or farm-management association data when available.`;
    const rows = [
      ["Yield / acre", toolNumber("bm-yield"), regional.yield, "higher"],
      ["Cost / acre", toolNumber("bm-cost"), regional.cost, "lower"],
      ["Debt / acre", toolNumber("bm-debt"), regional.debt, "lower"],
      ["Working capital %", toolNumber("bm-working"), regional.working, "higher"]
    ];
    const body = document.getElementById("bm-result");
    if (!body) return;
    body.innerHTML = rows.map(([name, actual, average, better]) => {
      const favorable = better === "higher" ? actual >= average : actual <= average;
      const suffix = name.includes("%") ? "%" : "";
      return `<tr><td>${name}</td><td>${toolPlain(actual, 1)}${suffix}</td><td>${toolPlain(average, 1)}${suffix}</td><td>${favorable ? "Above target" : "Watch list"}</td></tr>`;
    }).join("");
  };
}

window.refreshRegionalBenchmarks = function () {
  if (typeof calculateAllTools === "function") calculateAllTools();
};

function expenseMoney(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function ensureExpensePieChart() {
  if (document.getElementById("expense-chart-card")) return;
  const form = document.getElementById("farm-form");
  const analyze = document.getElementById("analyze-btn");
  if (!form || !analyze) return;
  const card = document.createElement("section");
  card.className = "expense-card";
  card.id = "expense-chart-card";
  card.innerHTML = `
    <div>
      <div class="section-kicker">Expense Mix</div>
      <h3>Operating cost pie chart</h3>
      <p class="fineprint">Updates from the operating cost per acre fields in the farm workspace.</p>
    </div>
    <div class="expense-chart-layout">
      <div class="expense-pie" id="expense-pie" aria-label="Expense pie chart"></div>
      <div class="expense-legend" id="expense-legend"></div>
    </div>
  `;
  form.insertBefore(card, analyze);
  updateExpensePieChart();
}

window.updateExpensePieChart = function () {
  const pie = document.getElementById("expense-pie");
  const legend = document.getElementById("expense-legend");
  if (!pie || !legend || typeof getFormData !== "function") return;
  const data = getFormData();
  const rows = EXPENSE_FIELDS.map(([key, label, color]) => ({
    key,
    label,
    color,
    value: Number(data[key]) || 0
  })).filter(row => row.value > 0);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (!total) {
    pie.style.background = "#eef4e8";
    pie.innerHTML = "<span>No costs yet</span>";
    legend.innerHTML = '<p class="fineprint">Enter operating cost numbers to see the expense mix.</p>';
    return;
  }
  let cursor = 0;
  pie.innerHTML = `<span>${expenseMoney(total)}<small>/ acre</small></span>`;
  pie.style.background = `conic-gradient(${rows.map(row => {
    const start = cursor;
    const end = cursor + row.value / total * 100;
    cursor = end;
    return `${row.color} ${start}% ${end}%`;
  }).join(", ")})`;
  legend.innerHTML = rows.map(row => {
    const percent = row.value / total * 100;
    return `<div class="expense-legend-row">
      <span style="background:${row.color}"></span>
      <strong>${esc(row.label)}</strong>
      <em>${expenseMoney(row.value)} / acre</em>
      <small>${percent.toFixed(1)}%</small>
    </div>`;
  }).join("");
};

function ensureTasksView() {
  const menu = document.getElementById("site-menu-panel");
  if (menu && !menu.querySelector('[data-app-tab="tasks"]')) {
    const tasksButton = document.createElement("button");
    tasksButton.className = "workspace-tab";
    tasksButton.type = "button";
    tasksButton.dataset.appTab = "tasks";
    tasksButton.textContent = "Tasks";
    tasksButton.addEventListener("click", () => {
      tasksButton.closest("details")?.removeAttribute("open");
      switchAppTab("tasks");
    });
    const toolsButton = menu.querySelector('[data-app-tab="tools"]');
    const aiButton = menu.querySelector('[data-app-tab="ai"]');
    menu.insertBefore(tasksButton, toolsButton?.nextSibling || aiButton || null);
  }

  if (document.getElementById("tasks-view")) return;
  const view = document.createElement("section");
  view.className = "app-view tasks-view";
  view.id = "tasks-view";
  view.innerHTML = `
    <div class="section tasks-section">
      <div class="section-kicker">AI Tasks</div>
      <h2>Farm improvement task list</h2>
      <p class="section-lead">Generate practical tasks from the current farm workspace, costs, debt, goals, region, and saved report context.</p>
      <div class="tasks-toolbar">
        <button class="primary-btn" type="button" id="generate-tasks">Generate Tasks</button>
        <button class="ghost-btn" type="button" id="save-tasks">Save Tasks</button>
      </div>
      <div class="task-output" id="task-output">
        <p>Generate tasks after entering or loading a farm project.</p>
      </div>
    </div>
  `;
  const storyView = document.getElementById("story-view");
  document.body.insertBefore(view, storyView || document.querySelector("footer"));
  document.getElementById("generate-tasks")?.addEventListener("click", generateFarmTasks);
  document.getElementById("save-tasks")?.addEventListener("click", () => {
    if (typeof saveProject === "function") saveProject();
  });
  renderTaskContent();
}

window.renderTaskContent = function () {
  const output = document.getElementById("task-output");
  if (!output) return;
  if (window.agriTaskContent) output.innerHTML = window.agriTaskContent;
};

function taskProvider() {
  if (typeof getProvider === "function") {
    const selected = getProvider();
    if (selected?.id) return selected;
  }
  return { id: "all", name: "AgriDecision AI" };
}

async function generateFarmTasks() {
  const output = document.getElementById("task-output");
  const button = document.getElementById("generate-tasks");
  if (!output || typeof callAI !== "function" || typeof buildContext !== "function") return;
  const provider = taskProvider();
  if (!provider.id) return alert("No configured AI providers were found in Vercel.");
  if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  button.disabled = true;
  button.textContent = "Generating...";
  output.innerHTML = "<p>Building task list from the current farm workspace...</p>";
  const prompt = `
Create a practical farm systems improvement task list from this current workspace.
Use clean HTML only. Do not use markdown asterisks.
Group the tasks by: Finance, Operations, Marketing/Risk, Equipment, Data/Management, and Next 30 Days.
For each task include priority, why it matters, owner, and timing.

Farm context:
${buildContext(getFormData())}
  `.trim();
  try {
    const html = typeof cleanAI === "function"
      ? cleanAI(await callAI(provider, prompt, 2200, 0.35))
      : await callAI(provider, prompt, 2200, 0.35);
    window.agriTaskContent = html;
    renderTaskContent();
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
  } catch (error) {
    output.innerHTML = `<p class="error-text">Task generation failed: ${esc(error.message)}</p>`;
  } finally {
    button.disabled = false;
    button.textContent = "Generate Tasks";
  }
}

const baseSwitchAppTab = typeof switchAppTab === "function" ? switchAppTab : null;
if (baseSwitchAppTab) {
  switchAppTab = function (tabName) {
    ensureTasksView();
    baseSwitchAppTab(tabName);
    const tasksView = document.getElementById("tasks-view");
    if (tasksView) tasksView.classList.toggle("active", tabName === "tasks");
    if (tabName === "tasks") renderTaskContent();
  };
}

const baseSetFormData = typeof setFormData === "function" ? setFormData : null;
if (baseSetFormData) {
  setFormData = function (data = {}) {
    baseSetFormData(data);
    setTimeout(() => {
      updateExpensePieChart();
      if (typeof refreshRegionalBenchmarks === "function") refreshRegionalBenchmarks();
      if (typeof refreshCmeSnapshotFromWorkspace === "function") refreshCmeSnapshotFromWorkspace();
    }, 0);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ensureEnhancementStyles();
    ensureEnhancedCmeView();
    ensureExpensePieChart();
    ensureTasksView();
  });
} else {
  ensureEnhancementStyles();
  ensureEnhancedCmeView();
  ensureExpensePieChart();
  ensureTasksView();
}
