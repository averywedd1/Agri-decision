(function () {
  const PROFILE_KEY = "agridecisionProfile";
  let client = null;
  let session = null;
  let configured = false;
  let ready = false;

  const $ = id => document.getElementById(id);

  function setCloudStatus(message) {
    const target = $("account-sync-status");
    if (target) target.textContent = message;
  }

  function setProjectStatus(message) {
    const target = $("project-status");
    if (target) target.textContent = message;
  }

  function readProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function projectKey(email) {
    return `agridecisionProjects:${String(email || "guest").trim().toLowerCase()}`;
  }

  function getStore(email) {
    try {
      const parsed = JSON.parse(localStorage.getItem(projectKey(email || readProfile().email)) || "{}") || {};
      return {
        activeProjectId: parsed.activeProjectId || "",
        projects: Array.isArray(parsed.projects) ? parsed.projects : []
      };
    } catch {
      return { activeProjectId: "", projects: [] };
    }
  }

  function saveStore(store, email) {
    localStorage.setItem(projectKey(email || readProfile().email), JSON.stringify({
      activeProjectId: store.activeProjectId || "",
      projects: store.projects || []
    }));
  }

  async function initClient() {
    if (ready) return Boolean(client && session?.user);
    ready = true;
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      const supabase = config?.supabase || {};
      configured = Boolean(supabase.configured && supabase.url && supabase.anonKey);
      if (!configured) {
        setCloudStatus("Cloud sync is not connected. This device is saving locally only.");
        return false;
      }
      const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      client = module.createClient(supabase.url, supabase.anonKey);
      const result = await client.auth.getSession();
      session = result.data?.session || null;
      client.auth.onAuthStateChange((_event, nextSession) => {
        session = nextSession;
        if (session?.user) pullCloudProjects();
      });
      if (!session?.user) {
        setCloudStatus("Sign in on both devices with the same email to sync projects.");
        return false;
      }
      await pullCloudProjects();
      return true;
    } catch (error) {
      setCloudStatus(`Cloud sync could not start: ${error.message}`);
      return false;
    }
  }

  async function saveCloudProfile() {
    if (!client || !session?.user || typeof getFormData !== "function") return;
    const p = readProfile();
    const payload = {
      id: session.user.id,
      email: session.user.email,
      name: p.name || session.user.email.split("@")[0],
      farm_name: p.farmName || $("farm-name")?.value || "",
      last_farm_data: getFormData(),
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from("agridecision_profiles").upsert(payload);
    if (error) setCloudStatus(`Cloud profile save failed. Run the Supabase database setup. ${error.message}`);
  }

  async function saveCloudProject(project) {
    if (!client || !session?.user || !project) return false;
    const now = new Date().toISOString();
    const payload = {
      id: project.id,
      user_id: session.user.id,
      name: project.name || "Untitled Project",
      payload: project,
      created_at: project.createdAt || now,
      updated_at: project.updatedAt || now
    };
    const { error } = await client.from("agridecision_projects").upsert(payload);
    if (error) {
      setCloudStatus(`Cloud project save failed. Run the Supabase database setup. ${error.message}`);
      return false;
    }
    setCloudStatus(`Cloud synced as ${session.user.email}.`);
    return true;
  }

  async function pullCloudProjects() {
    if (!client || !session?.user) return;
    const { data, error } = await client.from("agridecision_projects").select("*").eq("user_id", session.user.id).order("updated_at", { ascending: false });
    if (error) {
      setCloudStatus(`Cloud project load failed. Run the Supabase database setup. ${error.message}`);
      return;
    }
    const email = session.user.email;
    const cloud = (data || []).map(row => ({ ...(row.payload || {}), id: row.id, name: row.name || row.payload?.name || "Untitled Project", createdAt: row.created_at || row.payload?.createdAt, updatedAt: row.updated_at || row.payload?.updatedAt }));
    const local = getStore(email);
    const merged = new Map(local.projects.map(project => [project.id, project]));
    cloud.forEach(project => merged.set(project.id, project));
    const projects = Array.from(merged.values()).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    saveStore({ activeProjectId: local.activeProjectId || projects[0]?.id || "", projects }, email);
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...readProfile(), email, name: readProfile().name || email.split("@")[0], updatedAt: new Date().toISOString() }));
    if (typeof renderProjects === "function") renderProjects();
    if (projects.length && !local.activeProjectId && typeof loadProject === "function") loadProject(projects[0].id);
    for (const project of local.projects) await saveCloudProject(project);
    setCloudStatus(`Cloud sync is on as ${email}. ${projects.length} project${projects.length === 1 ? "" : "s"} available.`);
  }

  function patchAuthGate() {
    if (typeof window.hasProfile === "function" && !window.hasProfile.__cloudRepairWrapped) {
      const original = window.hasProfile;
      window.hasProfile = function () {
        if (configured) return Boolean(session?.user);
        return original.apply(this, arguments);
      };
      window.hasProfile.__cloudRepairWrapped = true;
    }
  }

  function patchSaveProject() {
    if (typeof window.saveProject === "function" && !window.saveProject.__cloudRepairWrapped) {
      const original = window.saveProject;
      window.saveProject = function (options = {}) {
        const result = original.apply(this, arguments);
        if (!session?.user) {
          if (!options.silent) setProjectStatus("This device saved locally. Sign in to sync it across devices.");
          return result;
        }
        const store = getStore(session.user.email);
        const active = store.projects.find(project => project.id === store.activeProjectId) || store.projects[0];
        saveCloudProfile();
        saveCloudProject(active);
        return result;
      };
      window.saveProject.__cloudRepairWrapped = true;
    }
  }

  async function run() {
    await initClient();
    patchAuthGate();
    patchSaveProject();
    if (configured && !session?.user) {
      const p = readProfile();
      if (p.email) setProjectStatus("Saved locally on this device. Sign in with that same email on both devices to turn on cloud sync.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}());
