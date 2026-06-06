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
    window.agriCloudSyncStatus = {
      ...(window.agriCloudSyncStatus || {}),
      message,
      updatedAt: new Date().toISOString()
    };
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

  function newerProject(a, b) {
    const aTime = Date.parse(a?.updatedAt || a?.createdAt || "") || 0;
    const bTime = Date.parse(b?.updatedAt || b?.createdAt || "") || 0;
    return aTime >= bTime ? a : b;
  }

  function mergeProjectList(target, projects) {
    (projects || []).forEach(project => {
      if (!project?.id) return;
      target.set(project.id, target.has(project.id) ? newerProject(target.get(project.id), project) : project);
    });
  }

  function hasUsefulData(data) {
    return Object.values(data || {}).some(value => String(value || "").trim());
  }

  function draftProject() {
    if (typeof getFormData !== "function") return null;
    const data = getFormData();
    if (!hasUsefulData(data)) return null;
    const now = new Date().toISOString();
    const name = String(data.farmName || data.commodities || "Farm Workspace").trim() || "Farm Workspace";
    const base = { id: `project-${Date.now()}-${Math.random().toString(16).slice(2)}`, name, createdAt: now };
    if (typeof projectSnapshot === "function") return projectSnapshot(base);
    return { ...base, farmData: data, updatedAt: now };
  }

  async function initClient() {
    if (ready) return Boolean(client && session?.user);
    ready = true;
    try {
      const response = await fetch("/api/config");
      const config = await response.json();
      const supabase = config?.supabase || {};
      configured = Boolean(supabase.configured && supabase.url && supabase.anonKey);
      window.agriCloudSyncStatus = {
        configured,
        hasUrl: Boolean(supabase.url),
        hasKey: Boolean(supabase.anonKey),
        updatedAt: new Date().toISOString()
      };
      if (!configured) {
        setCloudStatus("Cloud sync is not connected. Add the Supabase URL and publishable key in Vercel to sync across devices.");
        return false;
      }
      const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      client = module.createClient(supabase.url, supabase.anonKey);
      const result = await client.auth.getSession();
      session = result.data?.session || null;
      client.auth.onAuthStateChange(async (_event, nextSession) => {
        session = nextSession;
        if (session?.user && await checkCloudTables()) pullCloudProjects();
      });
      if (!session?.user) {
        setCloudStatus("Sign in on both devices with the same email to sync projects.");
        return false;
      }
      const tablesReady = await checkCloudTables();
      if (!tablesReady) return false;
      await pullCloudProjects();
      return true;
    } catch (error) {
      setCloudStatus(`Cloud sync could not start: ${error.message}`);
      return false;
    }
  }

  function setupMessage(error) {
    const details = error?.message ? ` ${error.message}` : "";
    return `Cloud database setup is incomplete. Run supabase-schema.sql in Supabase so profiles and projects can sync.${details}`;
  }

  async function checkCloudTables() {
    if (!client || !session?.user) return false;
    const profileCheck = await client.from("agridecision_profiles").select("id").eq("id", session.user.id).limit(1);
    if (profileCheck.error) {
      setCloudStatus(setupMessage(profileCheck.error));
      return false;
    }
    const projectCheck = await client.from("agridecision_projects").select("id").eq("user_id", session.user.id).limit(1);
    if (projectCheck.error) {
      setCloudStatus(setupMessage(projectCheck.error));
      return false;
    }
    return true;
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
    if (error) setCloudStatus(setupMessage(error));
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
      setCloudStatus(setupMessage(error));
      return false;
    }
    setCloudStatus(`Cloud synced as ${session.user.email}.`);
    return true;
  }

  async function pullCloudProjects() {
    if (!client || !session?.user) return;
    const { data, error } = await client
      .from("agridecision_projects")
      .select("*")
      .eq("user_id", session.user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      setCloudStatus(setupMessage(error));
      return;
    }
    const email = session.user.email;
    const cloud = (data || []).map(row => ({
      ...(row.payload || {}),
      id: row.id,
      name: row.name || row.payload?.name || "Untitled Project",
      createdAt: row.created_at || row.payload?.createdAt,
      updatedAt: row.updated_at || row.payload?.updatedAt
    }));
    const profileBefore = readProfile();
    const local = getStore(email);
    const guest = getStore("guest");
    const previous = profileBefore.email && profileBefore.email !== email ? getStore(profileBefore.email) : { activeProjectId: "", projects: [] };
    const merged = new Map();
    mergeProjectList(merged, previous.projects);
    mergeProjectList(merged, guest.projects);
    mergeProjectList(merged, local.projects);
    mergeProjectList(merged, cloud);
    if (!merged.size) {
      const draft = draftProject();
      if (draft) merged.set(draft.id, draft);
    }
    const projects = Array.from(merged.values()).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const activeProjectId = local.activeProjectId || previous.activeProjectId || guest.activeProjectId || projects[0]?.id || "";
    saveStore({ activeProjectId, projects }, email);
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      ...profileBefore,
      email,
      name: profileBefore.name || email.split("@")[0],
      updatedAt: new Date().toISOString()
    }));
    if (typeof renderProjects === "function") renderProjects();
    if (projects.length && typeof loadProject === "function") loadProject(activeProjectId || projects[0].id);
    for (const project of projects) await saveCloudProject(project);
    await saveCloudProfile();
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
