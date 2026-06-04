(function () {
  const REFRESH_MS = 30000;
  let refreshTimer = null;

  function nowContext() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      local: now.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
      }),
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local browser time"
    };
  }

  function installTimeContext() {
    if (typeof systemPrompt === "function" && !systemPrompt.isAgriTimeFix) {
      const baseSystemPrompt = systemPrompt;
      systemPrompt = function () {
        const time = nowContext();
        return `${baseSystemPrompt()} Current date and time context: ${time.local}. ISO timestamp: ${time.iso}. Browser time zone: ${time.zone}. If the user asks for today's date, the day of week, or current time, answer from this context directly and do not guess.`;
      };
      systemPrompt.isAgriTimeFix = true;
    }

    if (typeof callAI === "function" && !callAI.isAgriTimeFix) {
      const baseCallAI = callAI;
      callAI = function (provider, userPrompt, ...rest) {
        const time = nowContext();
        const prompt = `Current date/time for this request: ${time.local} (${time.zone}); ISO ${time.iso}.\n\n${userPrompt}`;
        return baseCallAI(provider, prompt, ...rest);
      };
      callAI.isAgriTimeFix = true;
    }
  }

  function installCmeLiveRefresh() {
    if (window.agriCmeLiveRefreshInstalled) return;
    window.agriCmeLiveRefreshInstalled = true;

    if (window.fetch && !window.fetch.isAgriLiveCmeFetch) {
      const baseFetch = window.fetch.bind(window);
      const liveFetch = function (input, init = {}) {
        if (typeof input === "string" && input.startsWith("/api/commodities")) {
          const separator = input.includes("?") ? "&" : "?";
          input = `${input}${separator}live=${Date.now()}`;
          init = { ...init, cache: "no-store", headers: { ...(init.headers || {}), "Cache-Control": "no-cache" } };
        }
        return baseFetch(input, init);
      };
      liveFetch.isAgriLiveCmeFetch = true;
      window.fetch = liveFetch;
    }

    function isCmeActive() {
      return document.getElementById("cme-view")?.classList.contains("active");
    }

    function refresh(silent = true) {
      if (typeof loadFutures === "function" && isCmeActive()) loadFutures({ silent, live: true });
    }

    if (typeof switchAppTab === "function" && !switchAppTab.isAgriCmeLiveFix) {
      const baseSwitchAppTab = switchAppTab;
      switchAppTab = function (tabName) {
        const result = baseSwitchAppTab(tabName);
        if (tabName === "cme") setTimeout(() => refresh(false), 150);
        return result;
      };
      switchAppTab.isAgriCmeLiveFix = true;
    }

    refreshTimer = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", () => refresh(true));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh(true);
    });
  }

  function installAll() {
    installTimeContext();
    installCmeLiveRefresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAll);
  } else {
    installAll();
  }

  window.addEventListener("beforeunload", () => {
    if (typeof saveProject === "function") saveProject({ silent: true, skipPrompt: true });
    if (refreshTimer) clearInterval(refreshTimer);
  });
}());
