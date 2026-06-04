(function () {
  function currentProfile() {
    try { return JSON.parse(localStorage.getItem("agridecisionProfile") || "{}") || {}; }
    catch { return {}; }
  }

  function hasAccountProfile() {
    const profile = currentProfile();
    return Boolean(profile.email || profile.name);
  }

  function showSignedOutUi() {
    const nav = document.getElementById("account-nav-btn");
    const signOut = document.getElementById("sign-out-account");
    const createMode = document.getElementById("auth-create-mode");
    const signInMode = document.getElementById("auth-signin-mode");
    const title = document.getElementById("account-title");
    const help = document.getElementById("account-help");
    const action = document.getElementById("save-account");
    const status = document.getElementById("account-sync-status");

    if (nav) nav.textContent = "Create Account";
    if (signOut) signOut.style.display = "none";
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
    if (action) action.textContent = "Sign In";
    if (status) status.textContent = "Signed out. Sign in again to sync across devices.";
  }

  function refreshSignOutButton() {
    const signOut = document.getElementById("sign-out-account");
    if (!signOut) return;
    signOut.style.display = hasAccountProfile() ? "inline-flex" : "none";
    signOut.textContent = "Sign Out";
  }

  function installSignOutFix() {
    if (window.agriSignOutFixInstalled) return;
    window.agriSignOutFixInstalled = true;

    document.addEventListener("click", event => {
      if (!event.target.closest?.("#account-nav-btn")) return;
      setTimeout(refreshSignOutButton, 40);
      setTimeout(refreshSignOutButton, 250);
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
      }, 350);
    });

    refreshSignOutButton();
    setInterval(refreshSignOutButton, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installSignOutFix);
  } else {
    installSignOutFix();
  }
}());
