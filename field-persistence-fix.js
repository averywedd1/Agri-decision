(function () {
  const FIELD_KEY = "agriFieldBoundary";
  const POLYGON_KEY = "agridecisionFieldPolygons";

  function cleanPoints(points) {
    return (Array.isArray(points) ? points : [])
      .map(point => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
      .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  function cleanFields(fields) {
    return (Array.isArray(fields) ? fields : [])
      .map((field, index) => ({
        ...field,
        id: field?.id || `field-${index + 1}`,
        name: field?.name || `Field ${index + 1}`,
        tenure: field?.tenure === "leased" ? "leased" : "owned",
        points: cleanPoints(field?.points)
      }))
      .filter(field => field.points.length >= 3);
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "");
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readFields() {
    return cleanFields(readJson(POLYGON_KEY, []));
  }

  function readDraft() {
    return cleanPoints(readJson(FIELD_KEY, []));
  }

  function notify(fields, draft) {
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", {
      detail: { fields, points: draft }
    }));
  }

  function writeMapState(fields, draft = []) {
    const cleanedFields = cleanFields(fields);
    const cleanedDraft = cleanPoints(draft);
    localStorage.setItem(POLYGON_KEY, JSON.stringify(cleanedFields));
    localStorage.setItem(FIELD_KEY, JSON.stringify(cleanedDraft));
    notify(cleanedFields, cleanedDraft);
  }

  function projectFields(project) {
    const candidates = [
      project?.fieldPolygons,
      project?.farmData?.fieldBoundaries,
      project?.farmData?.fieldPolygons
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return cleanFields(candidate);
    }
    const single = project?.farmData?.fieldBoundary;
    return single?.points?.length >= 3 ? cleanFields([single]) : [];
  }

  function projectDraft(project) {
    return cleanPoints(
      project?.fieldDraftBoundary ||
      project?.farmData?.fieldDraftBoundary ||
      []
    );
  }

  function activeSavedProject() {
    try {
      if (typeof getStore !== "function") return null;
      const store = getStore();
      return store.projects?.find(project => project.id === store.activeProjectId) || null;
    } catch {
      return null;
    }
  }

  function restoreProject(project, options = {}) {
    if (!project) return false;
    const fields = projectFields(project);
    const draft = projectDraft(project);
    const projectHasMapState =
      Array.isArray(project.fieldPolygons) ||
      Array.isArray(project.farmData?.fieldBoundaries) ||
      Array.isArray(project.farmData?.fieldPolygons) ||
      Array.isArray(project.fieldDraftBoundary) ||
      Array.isArray(project.farmData?.fieldDraftBoundary) ||
      Boolean(project.farmData?.fieldBoundary?.points?.length);

    if (!projectHasMapState && options.preserveLocal !== false) return false;
    writeMapState(fields, draft);
    return true;
  }

  function addMapState(snapshot) {
    const fields = readFields();
    const draft = readDraft();
    const farmData = { ...(snapshot.farmData || {}) };

    snapshot.fieldPolygons = fields;
    snapshot.fieldDraftBoundary = draft;
    farmData.fieldBoundaries = fields;
    farmData.fieldPolygons = fields;
    farmData.fieldDraftBoundary = draft;

    if (draft.length >= 3) {
      farmData.fieldBoundary = {
        ...(farmData.fieldBoundary || {}),
        source: "field map",
        points: draft
      };
    } else if (fields.length) {
      farmData.fieldBoundary = { ...fields[0], source: "field map" };
    } else {
      delete farmData.fieldBoundary;
    }

    snapshot.farmData = farmData;
    return snapshot;
  }

  function patchProjectSnapshot() {
    if (typeof projectSnapshot !== "function" || projectSnapshot.fieldPersistenceFix) return;
    const base = projectSnapshot;
    projectSnapshot = function (existing = {}) {
      return addMapState(base.apply(this, arguments));
    };
    projectSnapshot.fieldPersistenceFix = true;
  }

  function patchLoadProject() {
    if (typeof loadProject !== "function" || loadProject.fieldPersistenceFix) return;
    const base = loadProject;
    loadProject = function (projectId) {
      const result = base.apply(this, arguments);
      try {
        const store = typeof getStore === "function" ? getStore() : { projects: [] };
        const project = store.projects.find(item => item.id === projectId);
        restoreProject(project, { preserveLocal: false });
      } catch {}
      return result;
    };
    loadProject.fieldPersistenceFix = true;
  }

  function persistCurrentProjectCopy() {
    try {
      if (typeof getStore !== "function" || typeof saveStore !== "function") return;
      const store = getStore();
      const index = store.projects.findIndex(project => project.id === store.activeProjectId);
      if (index < 0) return;
      store.projects[index] = addMapState({ ...store.projects[index] });
      saveStore(store);
    } catch {}
  }

  function bindMapSaves() {
    if (document.documentElement.dataset.fieldPersistenceBound === "true") return;
    document.documentElement.dataset.fieldPersistenceBound = "true";
    window.addEventListener("agri-field-boundary-updated", persistCurrentProjectCopy);
    window.addEventListener("beforeunload", persistCurrentProjectCopy);
  }

  function install() {
    patchProjectSnapshot();
    patchLoadProject();
    bindMapSaves();
    restoreProject(activeSavedProject(), { preserveLocal: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
  setTimeout(install, 600);
  setTimeout(install, 1800);
  setTimeout(install, 3500);
}());
