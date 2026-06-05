(function () {
  const scripts = [
    "/overlap-fix.js",
    "/cloud-sync-original.js",
    "/tools.js",
    "/enhancements.js",
    "/ui-fixes.js",
    "/chat-events-fix.js",
    "/logo-update.js",
    "/live-fixes.js",
    "/field-boundary-only.js",
    "/sign-out-fix.js",
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
    "/cloud-sync-repair.js"
  ];

  function loadScript(src) {
    return new Promise((resolve) => {
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

  loadAll();
}());
