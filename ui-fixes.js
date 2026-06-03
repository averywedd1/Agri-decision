(function () {
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

  function applyUiFixes() {
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
    setTimeout(applyUiFixes, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUiFixes);
  } else {
    installUiFixes();
  }
}());
