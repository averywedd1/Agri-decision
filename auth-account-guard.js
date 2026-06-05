(function () {
  const PROFILE_KEY = "agridecisionProfile";

  function byId(id) {
    return document.getElementById(id);
  }

  function projectKey(email) {
    return `agridecisionProjects:${String(email || "guest").trim().toLowerCase()}`;
  }

  function setStatus(message) {
    const target = byId("account-sync-status");
    if (target) target.textContent = message;
  }

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  async function currentSession() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      const supabase = config?.supabase || {};
      if (!supabase.configured || !supabase.url || !supabase.anonKey) return null;
      const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const client = module.createClient(supabase.url, supabase.anonKey);
      const result = await client.auth.getSession();
      return result.data?.session || null;
    } catch {
      return null;
    }
  }

  function restorePreviousProfile(previousRaw, email) {
    const next = readProfile();
    const sameAttempt = String(next.email || "").trim().toLowerCase() === String(email || "").trim().toLowerCase();
    if (!sameAttempt) return;
    if (previousRaw) localStorage.setItem(PROFILE_KEY, previousRaw);
    else localStorage.removeItem(PROFILE_KEY);
    if (!previousRaw) localStorage.removeItem(projectKey(email));
  }

  function setSigninMode() {
    if (typeof setAuthMode === "function") setAuthMode("signin");
    else {
      byId("auth-create-mode")?.classList.remove("active");
      byId("auth-signin-mode")?.classList.add("active");
      if (byId("account-title")) byId("account-title").textContent = "Sign in to AgriDecision";
      if (byId("save-account")) byId("save-account").textContent = "Sign In";
    }
  }

  function watchCreateAttempts() {
    if (window.__agriAccountGuardBound) return;
    window.__agriAccountGuardBound = true;
    document.addEventListener("click", event => {
      const button = event.target.closest?.("#save-account");
      if (!button) return;
      const creating = byId("auth-create-mode")?.classList.contains("active") || /create/i.test(button.textContent || "");
      if (!creating) return;
      const email = byId("account-email")?.value.trim() || "";
      const previousRaw = localStorage.getItem(PROFILE_KEY);
      window.setTimeout(async () => {
        const session = await currentSession();
        if (session?.user) return;
        restorePreviousProfile(previousRaw, email);
        setSigninMode();
        setStatus("That email was not signed in. If the account already exists, use Sign In. If it is new, confirm your email first.");
        if (typeof applyProfile === "function") applyProfile();
        if (typeof renderProjects === "function") renderProjects();
      }, 2200);
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchCreateAttempts);
  else watchCreateAttempts();
}());
