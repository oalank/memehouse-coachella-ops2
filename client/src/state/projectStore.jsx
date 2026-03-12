import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { getProjectById, getAllProjects, addProject as addProjectStorage, touchProject as touchProjectStorage, updateProjectStatus as updateProjectStatusStorage, removeProject as removeProjectStorage, updateProject as updateProjectStorage } from "../data/projectStorage";

const STORAGE_KEY = "memehouse-ops-selected-project";

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projectId, setProjectIdState] = useState(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });
  const [projectsVersion, setProjectsVersion] = useState(0);

  const setProjectId = useCallback((id) => {
    setProjectIdState(id);
    if (typeof window !== "undefined") {
      if (id) {
        window.localStorage.setItem(STORAGE_KEY, id);
        touchProject(id);
        setProjectsVersion((v) => v + 1);
      } else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const project = projectId ? getProjectById(projectId) : null;
  const projects = useMemo(() => getAllProjects(), [projectsVersion]);
  const refreshProjects = useCallback(() => setProjectsVersion((v) => v + 1), []);

  // Clear stale selection when current projectId no longer exists (e.g. deleted in another tab or after refresh)
  useEffect(() => {
    if (projectId && !getProjectById(projectId)) {
      setProjectIdState(null);
      if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [projectId, projectsVersion]);

  const addProject = useCallback((data) => {
    const created = addProjectStorage(data);
    setProjectsVersion((v) => v + 1);
    return created;
  }, []);

  /** Bump project's updatedAt so it sorts first in the list (call after operator/shift/cred changes). */
  const touchProject = useCallback((id) => {
    if (!id) return;
    touchProjectStorage(id);
    setProjectsVersion((v) => v + 1);
  }, []);

  /** Set project status to completed or archived; refreshes list. */
  const updateProjectStatus = useCallback((id, status) => {
    const updated = updateProjectStatusStorage(id, status);
    setProjectsVersion((v) => v + 1);
    return updated;
  }, []);

  /** Update project configuration (name, budget, dates, zones, etc.). Refreshes list and current project. Does not affect operators, shifts, expenses. */
  const updateProject = useCallback((id, updates) => {
    const updated = updateProjectStorage(id, updates);
    if (updated) setProjectsVersion((v) => v + 1);
    return updated;
  }, []);

  /** Permanently remove a project; refreshes list and clears selection if deleted id was current. Returns true if it was in custom list. */
  const removeProject = useCallback((id) => {
    const removed = removeProjectStorage(id);
    setProjectsVersion((v) => v + 1);
    if (projectId === id) setProjectId(null);
    return removed;
  }, [projectId, setProjectId]);

  const value = {
    projectId,
    project,
    setProjectId,
    projects,
    addProject,
    refreshProjects,
    touchProject,
    updateProjectStatus,
    updateProject,
    removeProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

export function getStoredProjectId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
