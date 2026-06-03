(function () {
  function moveExpenseChartToTools() {
    const card = document.getElementById("expense-chart-card");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!card || !toolsSection || toolsSection.contains(card)) return;

    const toolGrid = toolsSection.querySelector(".tool-grid");
    toolsSection.insertBefore(card, toolGrid || null);
    if (typeof updateExpensePieChart === "function") updateExpensePieChart();
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

    applyUiFixes();
    setTimeout(applyUiFixes, 0);
    setTimeout(applyUiFixes, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUiFixes);
  } else {
    installUiFixes();
  }
}());
