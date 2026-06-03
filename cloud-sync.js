(function () {
  const scripts = ["/tools.js", "/enhancements.js"];
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
