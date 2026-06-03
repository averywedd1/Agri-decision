(function () {
  function normalizeProviderUi() {
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

  function installProviderUiCleanup() {
    const select = document.getElementById("ai-provider");
    const help = document.getElementById("provider-help");

    if (typeof updateProviderHelp === "function" && !updateProviderHelp.isProviderUiCleanup) {
      updateProviderHelp = function () {
        const providerId = document.getElementById("ai-provider")?.value || "";
        document.getElementById("custom-provider-fields")?.classList.toggle("visible", providerId === "custom");
        normalizeProviderUi();
      };
      updateProviderHelp.isProviderUiCleanup = true;
    }

    normalizeProviderUi();
    if (select && !select.dataset.providerCleanupObserver) {
      select.dataset.providerCleanupObserver = "true";
      new MutationObserver(normalizeProviderUi).observe(select, { childList: true, subtree: true });
      select.addEventListener("change", () => setTimeout(normalizeProviderUi, 0));
    }
    if (help && !help.dataset.providerCleanupObserver) {
      help.dataset.providerCleanupObserver = "true";
      new MutationObserver(normalizeProviderUi).observe(help, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProviderUiCleanup);
  } else {
    installProviderUiCleanup();
  }
}());
