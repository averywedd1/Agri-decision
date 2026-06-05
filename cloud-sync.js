(function () {
  const scripts = [
    "/overlap-fix.js",
    "/cloud-sync-original.js",
    "/cme-table.js",
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
    "/auth-account-guard.js",
    "/farm-ui-polish.js"
  ];

  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
  }

  async function loadAll() {
    for (const src of scripts) {
      await loadScript(src);
    }
  }

  loadAll();
}());
