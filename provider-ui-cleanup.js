(function () {
  function normalizeProviderUi() {
    const select = document.getElementById("ai-provider");
    if (select) {
      Array.from(select.options).forEach(option => {
        const shouldRename = option.value === "all" || /all configured/i.test(option.textContent);
        if (shouldRename && option.textContent !== "AgriDecision AI") {
          option.textContent = "AgriDecision AI";
        }
      });
    }

    const help = document.getElementById("provider-help");
    if (help) {
      if (help.textContent) help.textContent = "";
      if (!help.hidden) help.hidden = true;
    }
  }

  function installProviderUiCleanup() {
    if (typeof updateProviderHelp === "function" && !updateProviderHelp.isProviderUiCleanup) {
      updateProviderHelp = function () {
        const providerId = document.getElementById("ai-provider")?.value || "";
        document.getElementById("custom-provider-fields")?.classList.toggle("visible", providerId === "custom");
        normalizeProviderUi();
      };
      updateProviderHelp.isProviderUiCleanup = true;
    }

    normalizeProviderUi();
    setTimeout(normalizeProviderUi, 250);
    setTimeout(normalizeProviderUi, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProviderUiCleanup);
  } else {
    installProviderUiCleanup();
  }
}());
