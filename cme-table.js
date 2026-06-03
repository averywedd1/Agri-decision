function formatCmeUpdated(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ensureCmeTableView() {
  const menu = document.getElementById("site-menu-panel");
  if (menu && !menu.querySelector('[data-app-tab="cme"]')) {
    const cmeButton = document.createElement("button");
    cmeButton.className = "workspace-tab";
    cmeButton.type = "button";
    cmeButton.dataset.appTab = "cme";
    cmeButton.textContent = "CME Group";
    cmeButton.addEventListener("click", () => cmeButton.closest("details")?.removeAttribute("open"));
    const aiButton = menu.querySelector('[data-app-tab="ai"]');
    menu.insertBefore(cmeButton, aiButton || null);
  }

  if (!document.getElementById("cme-view")) {
    const cmeView = document.createElement("section");
    cmeView.className = "app-view cme-view";
    cmeView.id = "cme-view";
    cmeView.innerHTML = `
      <div class="section cme-section" id="market-watch-table">
        <div class="section-kicker">CME Group</div>
        <h2>Commodity futures prices</h2>
        <p class="section-lead">Delayed futures table for major ag commodities. This view uses CME Group quotes when available and fills missing rows with a backup delayed futures feed.</p>
        <div class="table-shell cme-table-shell">
          <table>
            <thead>
              <tr>
                <th>Group</th>
                <th>Commodity</th>
                <th>Contract</th>
                <th>Last</th>
                <th>Settle</th>
                <th>Prior</th>
                <th>Change</th>
                <th>Volume</th>
                <th>Updated</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody id="futures-body"><tr><td colspan="10">Loading futures...</td></tr></tbody>
          </table>
        </div>
        <p class="fineprint" id="futures-note">Market data is delayed and should be checked directly with CME Group before trading or hedging decisions.</p>
      </div>
    `;
    const aiView = document.getElementById("ai-view");
    document.body.insertBefore(cmeView, aiView || document.querySelector("footer"));
  }
}

loadFutures = async function () {
  ensureCmeTableView();
  try {
    const response = await fetch("/api/commodities");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Unable to load futures data.");

    const rows = data.quotes || [];
    $("futures-body").innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td>${esc(row.category || "Agriculture")}</td>
        <td>${esc(row.commodity)}</td>
        <td>${esc(row.contract || "-")}</td>
        <td>${esc(row.last || row.settle || row.priorSettle || "-")}</td>
        <td>${esc(row.settle || "-")}</td>
        <td>${esc(row.priorSettle || "-")}</td>
        <td>${esc(row.change || "-")}</td>
        <td>${esc(row.volume || "-")}</td>
        <td>${esc(formatCmeUpdated(row.updated))}</td>
        <td><a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">${esc(row.sourceLabel || "CME")}</a></td>
      </tr>
    `).join("") : '<tr><td colspan="10">No futures quotes returned right now.</td></tr>';

    $("futures-note").textContent = data.note || $("futures-note").textContent;
  } catch (error) {
    $("futures-body").innerHTML = '<tr><td colspan="10">Could not load CME futures right now.</td></tr>';
    $("futures-note").textContent = error.message;
  }
};

switchAppTab = function (tabName) {
  ensureCmeTableView();
  document.querySelectorAll(".workspace-tab").forEach(button => button.classList.toggle("active", button.dataset.appTab === tabName));
  $("workspace-view").classList.toggle("active", tabName === "workspace");
  $("cme-view").classList.toggle("active", tabName === "cme");
  $("ai-view").classList.toggle("active", tabName === "ai");
  $("story-view").classList.toggle("active", tabName === "story");
  if (tabName === "ai") {
    saveProject({ silent: true, skipPrompt: true });
    updateAIContext();
  }
  if (tabName === "cme") loadFutures();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.addEventListener("DOMContentLoaded", ensureCmeTableView);
