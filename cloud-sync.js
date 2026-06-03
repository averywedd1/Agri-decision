(function () {
  const tags = '<script src="/cloud-sync-original.js"></script><script src="/cme-table.js"></script><script src="/tools.js"></script>';

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

  ["/cloud-sync-original.js", "/cme-table.js", "/tools.js"]
    .reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
    .catch(error => console.error("AgriDecision script loader failed", error));
}());
