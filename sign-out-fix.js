(function () {
  function currentProfile() {
    try { return JSON.parse(localStorage.getItem("agridecisionProfile") || "{}") || {}; }
    catch { return {}; }
  }

  function hasAccountProfile() {
    const profile = currentProfile();
    return Boolean(profile.email || profile.name);
  }

  function accountLabels() {
    return ["account-name", "account-email", "account-password", "account-farm"]
      .map(id => document.getElementById(id)?.closest("label"))
      .filter(Boolean);
  }

  function showSignedInUi() {
    const p = currentProfile();
    const authMode = document.querySelector(".auth-mode");
    const signOut = document.getElementById("sign-out-account");
    const save = document.getElementById("save-account");
    const cancel = document.getElementById("cancel-account");
    const title = document.getElementById("account-title");
    const help = document.getElementById("account-help");
    const status = document.getElementById("account-sync-status");
    const nav = document.getElementById("account-nav-btn");

    if (nav && p.name) nav.textContent = `Hi, ${String(p.name).split(" ")[0]}`;
    if (authMode) authMode.style.display = "none";
    accountLabels().forEach(label => { label.style.display = "none"; });
    if (save) save.style.display = "none";
    if (signOut) {
      signOut.style.display = "inline-flex";
      signOut.hidden = false;
      signOut.textContent = "Sign Out";
    }
    if (cancel) cancel.textContent = "Cancel";
    if (title) title.textContent = "Your AgriDecision account";
    if (help) help.textContent = "You are signed in. Use Sign Out to leave this account on this device.";
    if (status) status.textContent = p.email ? `Signed in as ${p.email}.` : "Signed in.";
  }

  function showSignedOutUi() {
    const nav = document.getElementById("account-nav-btn");
    const signOut = document.getElementById("sign-out-account");
    const authMode = document.querySelector(".auth-mode");
    const createMode = document.getElementById("auth-create-mode");
    const signInMode = document.getElementById("auth-signin-mode");
    const title = document.getElementById("account-title");
    const help = document.getElementById("account-help");
    const action = document.getElementById("save-account");
    const status = document.getElementById("account-sync-status");

    if (nav) nav.textContent = "Create Account";
    if (signOut) signOut.style.display = "none";
    if (authMode) authMode.style.display = "grid";
    accountLabels().forEach(label => { label.style.display = "flex"; });
    if (createMode) {
      createMode.hidden = false;
      createMode.classList.remove("active");
    }
    if (signInMode) {
      signInMode.hidden = false;
      signInMode.classList.add("active");
      signInMode.textContent = "Sign In";
    }
    if (title) title.textContent = "Sign in to AgriDecision";
    if (help) help.textContent = "Sign in to sync your profile, projects, reports, and chat history across devices.";
    if (action) {
      action.style.display = "inline-flex";
      action.textContent = "Sign In";
    }
    if (status) status.textContent = "Signed out. Sign in again to sync across devices.";
  }

  function refreshAccountUi() {
    if (hasAccountProfile()) showSignedInUi();
    else showSignedOutUi();
  }

  function installSignOutFix() {
    if (window.agriSignOutFixInstalledV2) return;
    window.agriSignOutFixInstalledV2 = true;

    document.addEventListener("click", event => {
      if (!event.target.closest?.("#account-nav-btn")) return;
      setTimeout(refreshAccountUi, 40);
      setTimeout(refreshAccountUi, 250);
      setTimeout(refreshAccountUi, 900);
    }, true);

    document.addEventListener("click", event => {
      const button = event.target.closest?.("#sign-out-account");
      if (!button) return;
      button.disabled = true;
      button.textContent = "Signing Out...";
      setTimeout(() => {
        localStorage.removeItem("agridecisionProfile");
        showSignedOutUi();
        if (typeof renderProjects === "function") renderProjects();
        if (typeof updateAIContext === "function") updateAIContext();
        button.disabled = false;
      }, 400);
    });

    refreshAccountUi();
    setInterval(refreshAccountUi, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installSignOutFix);
  } else {
    installSignOutFix();
  }
}());
