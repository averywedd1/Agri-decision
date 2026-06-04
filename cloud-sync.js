(function () {
  const scripts = ["/cloud-sync-original.js", "/cme-table.js", "/tools.js", "/enhancements.js", "/ui-fixes.js", "/chat-events-fix.js", "/logo-update.js", "/live-fixes.js"];
  const tags = scripts.map(src => `<script src="${src}"></script>`).join("");

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  if (document.readyState === "loading") {
    document.write(tags);
    return;
  }

  scripts
    .reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
    .catch(error => console.error("AgriDecision enhancement loader failed", error));
}());
