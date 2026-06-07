(function () {
  const scripts = [
    "/field-map-world.js",
    "/field-persistence-fix.js",
    "/refresh-state-fix.js",
    "/overlap-fix.js",
    "/tools.js",
    "/enhancements.js",
    "/auth-account-guard.js",
    "/product-upgrades.js",
    "/decision-support.js",
    "/current-improvements.js",
    "/calendar-data-fix.js",
    "/experience-polish.js",
    "/agri-context.js",
    "/qc-fixes.js",
    "/tooltip-tools-fix.js",
    "/farm-ui-polish.js",
    "/mobile-scroll-fix.js",
    "/cloud-sync-repair.js",
    "/qc-pass-fixes.js",
    "/field-point-order-fix.js",
    "/account-sync-controller.js",
    "/tools-map-placement-fix.js",
    "/ai-chat-map-fixes.js",
    "/cme-single-table-fix.js"
  ];

  function loadScript(src) {
    return new Promise(resolve => {
      const loaded = window.__agriLoadedScripts || (window.__agriLoadedScripts = new Set());
      if (loaded.has(src) || document.querySelector(`script[src="${src}"]`)) {
        loaded.add(src);
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.onload = () => {
        loaded.add(src);
        resolve();
      };
      script.onerror = () => {
        console.warn(`AgriDecision helper could not load: ${src}`);
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  async function loadAll() {
    document.documentElement.dataset.agriHelpers = "loading";
    for (const src of scripts) {
      await loadScript(src);
    }
    document.documentElement.dataset.agriHelpers = "ready";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAll, { once: true });
  } else {
    loadAll();
  }
}());
