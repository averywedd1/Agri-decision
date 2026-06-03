(function () {
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUiFixes);
  } else {
    installUiFixes();
  }
}());
