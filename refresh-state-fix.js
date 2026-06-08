(function () {
  const TAB_KEY = "agridecisionActiveTab";
  const VALID_TABS = new Set([
    "workspace",
    "cme",
    "field-map",
    "tools",
    "tasks",
    "ai",
    "calendar",
    "scenarios",
    "story"
  ]);

  function savedTab() {
    const value = localStorage.getItem(TAB_KEY) || "workspace";
    return VALID_TABS.has(value) ? value : "workspace";
  }

  function remember(tabName) {
    if (VALID_TABS.has(tabName)) localStorage.setItem(TAB_KEY, tabName);
  }

  function patchSwitcher() {
    if (typeof window.switchAppTab !== "function" || window.switchAppTab.refreshStateFix) return;
    const base = window.switchAppTab;
    window.switchAppTab = function (tabName) {
      remember(tabName);
      return base.apply(this, arguments);
    };
    window.switchAppTab.refreshStateFix = true;
  }

  function restoreTab() {
    patchSwitcher();
    const tabName = savedTab();
    const button = document.querySelector(`.workspace-tab[data-app-tab="${tabName}"]`);
    const view = document.getElementById(`${tabName}-view`);
    if (tabName === "workspace" || (button && view)) {
      window.switchAppTab?.(tabName);
      return true;
    }
    return false;
  }

  document.addEventListener("click", event => {
    const brand = event.target.closest?.(".brand");
    if (brand) {
      event.preventDefault();
      remember("workspace");
      window.switchAppTab?.("workspace");
      document.getElementById("home")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("site-menu")?.removeAttribute("open");
      return;
    }
    const button = event.target.closest?.(".workspace-tab[data-app-tab]");
    if (button) remember(button.dataset.appTab);
  }, true);

  function install() {
    patchSwitcher();
    restoreTab();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  [120, 450, 900, 1600, 2600, 4200].forEach(delay => {
    setTimeout(install, delay);
  });
}());
