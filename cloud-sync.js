(function () {
  const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
  let client = null;
  let session = null;
  let configured = false;
  let authMode = "create";
  let cloudProjectsLoaded = false;

  function setCloudStatus(message) {
    const target = document.getElementById("account-sync-status");
    if (target) target.textContent = message;
  }

  function setAuthMode(mode) {
    authMode = mode;
    document.getElementById("auth-create-mode")?.classList.toggle("active", mode === "create");
    document.getElementById("auth-signin-mode")?.classList.toggle("active", mode === "signin");
    const title = document.getElementById("account-title");
    const action = document.getElementById("save-account");
    const nameLabel = document.getElementById("account-name")?.closest("label");
    const farmLabel = document.getElementById("account-farm")?.closest("label");
    if (title) title.textContent = mode === "signin" ? "Sign in to AgriDecision" : "Create your AgriDecision account";
    if (action) action.textContent = mode === "signin" ? "Sign In" : "Create Account";
    if (nameLabel) nameLabel.style.display = mode === "signin" ? "none" : "flex";
    if (farmLabel) farmLabel.style.display = mode === "signin" ? "none" : "flex";
  }

  function currentProject() {
    const store = getStore();
    return activeProject(store);
  }

  async function initCloudSync() {
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      const supabase = config?.supabase || {};
      configured = Boolean(supabase.configured && supabase.url && supabase.anonKey);
      if (!configured) {
        setCloudStatus("Cloud sync is not configured yet. Projects will save on this device.");
        return;
      }

      const module = await import(SUPABASE_CDN);
      client = module.createClient(supabase.url, supabase.anonKey);
      const sessionResult = await client.auth.getSession();
      session = sessionResult.data?.session || null;
      client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        if (session?.user) handleSignedIn(session.user);
        else {
          cloudProjectsLoaded = false;
          applyProfile();
          renderProjects();
          setCloudStatus("Signed out. Local saves are still available on this device.");
        }
      });

      if (session?.user) await handleSignedIn(session.user);
      else setCloudStatus("Cloud sync is ready. Create an account or sign in.");
    } catch (error) {
      configured = false;
      setCloudStatus(`Cloud sync could not start: ${error.message}`);
    }
  }

  async function handleSignedIn(user) {
    await loadCloudProfile(user);
    await loadCloudProjects();
    applyProfile();
    renderProjects();
    updateAIContext();
    setCloudStatus(`Signed in as ${user.email}. Cloud sync is on.`);
  }

  async function loadCloudProfile(user) {
    if (!client || !user) return;
    const { data, error } = await client
      .from("agridecision_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      setCloudStatus(`Profile sync needs database setup: ${error.message}`);
      return;
    }

    const local = profile();
    const next = {
      ...local,
      name: data?.name || user.user_metadata?.name || local.name || user.email?.split("@")[0] || "",
      email: user.email || local.email || "",
      farmName: data?.farm_name || local.farmName || "",
      lastFarmData: data?.last_farm_data || local.lastFarmData || {},
      updatedAt: data?.updated_at || local.updatedAt || new Date().toISOString()
    };
    localStorage.setItem("agridecisionProfile", JSON.stringify(next));
    if (next.lastFarmData && !getStore().activeProjectId) setFormData(next.lastFarmData);
  }

  async function saveCloudProfile() {
    if (!client || !session?.user) return;
    const p = profile();
    const payload = {
      id: session.user.id,
      email: session.user.email,
      name: p.name || session.user.email?.split("@")[0] || "",
      farm_name: p.farmName || document.getElementById("farm-name")?.value.trim() || "",
      last_farm_data: getFormData(),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("agridecision_profiles").upsert(payload);
    if (error) setCloudStatus(`Profile cloud save failed: ${error.message}`);
  }

  async function loadCloudProjects() {
    if (!client || !session?.user) return;
    const { data, error } = await client
      .from("agridecision_projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setCloudStatus(`Project sync needs database setup: ${error.message}`);
      return;
    }

    const cloudProjects = (data || []).map(row => ({
      ...(row.payload || {}),
      id: row.id,
      name: row.name || row.payload?.name || "Untitled Project",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    const local = getStore();
    const byId = new Map(local.projects.map(project => [project.id, project]));
    cloudProjects.forEach(project => byId.set(project.id, project));
    const projects = Array.from(byId.values()).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    saveStore({ activeProjectId: local.activeProjectId || projects[0]?.id || "", projects });
    cloudProjectsLoaded = true;
    if (projects.length && !local.activeProjectId) loadProject(projects[0].id);
    syncLocalProjectsToCloud();
  }

  async function syncProjectToCloud(project) {
    if (!client || !session?.user || !project) return;
    const payload = {
      id: project.id,
      user_id: session.user.id,
      name: project.name || "Untitled Project",
      payload: project,
      created_at: project.createdAt || new Date().toISOString(),
      updated_at: project.updatedAt || new Date().toISOString()
    };
    const { error } = await client.from("agridecision_projects").upsert(payload);
    if (error) setCloudStatus(`Project cloud save failed: ${error.message}`);
    else setCloudStatus(`Saved ${project.name} to cloud.`);
  }

  function syncLocalProjectsToCloud() {
    if (!client || !session?.user || !cloudProjectsLoaded) return;
    getStore().projects.forEach(project => syncProjectToCloud(project));
  }

  async function deleteProjectFromCloud(projectId) {
    if (!client || !session?.user || !projectId) return;
    const { error } = await client.from("agridecision_projects").delete().eq("id", projectId);
    if (error) setCloudStatus(`Cloud delete failed: ${error.message}`);
  }

  const localOpenAccount = openAccount;
  openAccount = function () {
    localOpenAccount();
    setAuthMode(session?.user ? "signin" : authMode);
    const password = document.getElementById("account-password");
    const signOut = document.getElementById("sign-out-account");
    if (password) password.value = "";
    if (signOut) signOut.style.display = session?.user ? "inline-flex" : "none";
    setCloudStatus(configured
      ? session?.user ? `Signed in as ${session.user.email}.` : "Cloud sync is ready. Create an account or sign in."
      : "Cloud sync is not configured yet. This will save locally on this device.");
  };

  const localSaveAccount = saveAccount;
  saveAccount = async function () {
    const p = profile();
    const name = document.getElementById("account-name")?.value.trim() || p.name || "";
    const email = document.getElementById("account-email")?.value.trim() || "";
    const farmName = document.getElementById("account-farm")?.value.trim() || p.farmName || "";
    const password = document.getElementById("account-password")?.value || "";

    if (!configured || !client) return localSaveAccount();
    if (!email) return alert("Please enter your email.");
    if (authMode === "create" && !name) return alert("Please enter your name.");
    if (!password || password.length < 6) return alert("Please enter a password with at least 6 characters.");

    setCloudStatus(authMode === "signin" ? "Signing in..." : "Creating account...");
    const result = authMode === "signin"
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { data: { name, farm_name: farmName } } });

    if (result.error) {
      setCloudStatus(result.error.message);
      return alert(result.error.message);
    }

    session = result.data?.session || session;
    const nextProfile = {
      ...p,
      name: name || result.data?.user?.user_metadata?.name || email.split("@")[0],
      email,
      farmName,
      lastFarmData: getFormData(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("agridecisionProfile", JSON.stringify(nextProfile));

    if (!session && authMode === "create") {
      applyProfile();
      closeAccount();
      setCloudStatus("Account created. Check your email to confirm sign-in, then return to sync projects.");
      return;
    }

    applyProfile();
    ensureFirstProject(farmName);
    saveProject({ silent: true, skipPrompt: true });
    await saveCloudProfile();
    await loadCloudProjects();
    renderProjects();
    updateAIContext();
    closeAccount();
  };

  const localSaveProject = saveProject;
  saveProject = function (options = {}) {
    const result = localSaveProject(options);
    if (result) {
      saveCloudProfile();
      syncProjectToCloud(currentProject());
    }
    return result;
  };

  const localCreateProject = createProject;
  createProject = function () {
    localCreateProject();
    syncProjectToCloud(currentProject());
  };

  const localDeleteProject = deleteProject;
  deleteProject = function () {
    const projectId = currentProject()?.id;
    localDeleteProject();
    deleteProjectFromCloud(projectId);
  };

  const localApplyProfile = applyProfile;
  applyProfile = function () {
    localApplyProfile();
    const p = profile();
    const label = p.name || session?.user?.email || "";
    const button = document.getElementById("account-nav-btn");
    if (button && label) button.textContent = `Hi, ${label.split(" ")[0].split("@")[0]}`;
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("auth-create-mode")?.addEventListener("click", () => setAuthMode("create"));
    document.getElementById("auth-signin-mode")?.addEventListener("click", () => setAuthMode("signin"));
    document.getElementById("sign-out-account")?.addEventListener("click", async () => {
      if (client) await client.auth.signOut();
      session = null;
      cloudProjectsLoaded = false;
      setCloudStatus("Signed out. Local browser saves are still available on this device.");
      applyProfile();
      renderProjects();
      closeAccount();
    });
    setAuthMode("create");
    initCloudSync();
  });
}());
