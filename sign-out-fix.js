(function () {
  function currentProfile() {
    try { return JSON.parse(localStorage.getItem("agridecisionProfile") || "{}") || {}; }
    catch { return {}; }
  }

  function hasAccountProfile() {
    const profile = currentProfile();
    return Boolean(profile.email || profile.name);
  }

  function labelFor(id) {
    return document.getElementById(id)?.closest("label");
  }

  function setLabel(id, display) {
    const label = labelFor(id);
    if (label) label.style.display = display;
  }

  function forceSignInMode() {
    const signInMode = document.getElementById("auth-signin-mode");
    if (signInMode && !signInMode.classList.contains("active")) signInMode.click();
    setLabel("account-name", "none");
    setLabel("account-farm", "none");
    setLabel("account-email", "flex");
    setLabel("account-password", "flex");
    const save = document.getElementById("save-account");
    if (save) {
      save.style.display = "inline-flex";
      save.textContent = "Sign In";
    }
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
    ["account-name", "account-email", "account-password", "account-farm"].forEach(id => setLabel(id, "none"));
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
    const status = document.getElementById("account-sync-status");

    if (nav) nav.textContent = "Create Account";
    if (signOut) signOut.style.display = "none";
    if (authMode) authMode.style.display = "grid";
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
    if (help) help.textContent = "Sign in with email and password. Use Create only for a new account.";
    if (status) status.textContent = "Enter your email and password to sign in.";
    forceSignInMode();
  }

  function refreshAccountUi() {
    if (hasAccountProfile()) showSignedInUi();
    else showSignedOutUi();
  }

  function installSignOutFix() {
    if (window.agriSignOutFixInstalledV3) return;
    window.agriSignOutFixInstalledV3 = true;

    document.addEventListener("click", event => {
      if (event.target.closest?.("#auth-signin-mode")) {
        setTimeout(forceSignInMode, 0);
        setTimeout(forceSignInMode, 60);
      }
      if (event.target.closest?.("#auth-create-mode")) {
        setTimeout(() => {
          setLabel("account-name", "flex");
          setLabel("account-farm", "flex");
          setLabel("account-email", "flex");
          setLabel("account-password", "flex");
          const save = document.getElementById("save-account");
          if (save) save.textContent = "Create Account";
        }, 0);
      }
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
