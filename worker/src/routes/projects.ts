import { Hono } from 'hono';
import type { Context } from 'hono';
import { getProjectsIndex, getProject } from '../utils/data';
import { getLatestScan } from '../utils/kv';
import type { Project, ProjectsIndex } from '../types';

type EnvBindings = {
  KV: KVNamespace;
  ENVIRONMENT: string;
};

export const projectsRouter = new Hono<{ Bindings: EnvBindings }>();

/**
 * Calculate statistics from projects
 */
function calculateStats(projects: Project[]): {
  totalProjects: number;
  projectsWithChangesToday: number;
  dirtyProjects: number;
  errorProjects: number;
} {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    totalProjects: projects.length,
    projectsWithChangesToday: projects.filter(p => {
      if (!p.lastCommitTime) return false;
      return p.lastCommitTime.split(' ')[0] === today || 
             p.lastCommitTime.split('T')[0] === today;
    }).length,
    dirtyProjects: projects.filter(p => p.isDirty).length,
    errorProjects: projects.filter(p => p.status === 'error').length,
  };
}

/**
 * GET /api/projects
 * Get all projects (from embedded data first, KV as backup)
 */
projectsRouter.get('/', async (c: Context) => {
  const kv = c.env.KV;
  
  // First try to get embedded data (from assets) - this is our primary source
  let embeddedData: ProjectsIndex | null = null;
  try {
    embeddedData = getProjectsIndex();
  } catch (error) {
    console.error('Failed to get embedded data:', error);
  }
  
  // Try to get latest scan data from KV (as backup)
  let kvData: any = null;
  if (kv) {
    try {
      kvData = await getLatestScan(kv);
    } catch (error) {
      console.error('Failed to get scan data from KV:', error);
    }
  }
  
  // Use embedded data as primary source, prefer KV only if it has newer data
  if (embeddedData && embeddedData.projects) {
    // Check if KV has newer data than embedded
    const embeddedTime = new Date(embeddedData.lastScanTime || 0);
    const kvTime = kvData?.lastScanTime ? new Date(kvData.lastScanTime) : null;
    
    // If KV data is newer, use it; otherwise use embedded data
    if (kvTime && kvTime > embeddedTime && kvData.projects && kvData.projects.length > 0) {
      // Use KV data
      const kvProjects = kvData.projects as Project[];
      const stats = calculateStats(kvProjects);
      
      const response = {
        lastScanTime: kvData.lastScanTime || embeddedData.lastScanTime,
        ...stats,
        projects: kvProjects.map(p => ({
          id: p.name,
          name: p.name,
          path: p.path,
          remote: p.remote || '',
          branch: p.branch,
          lastCommitTime: p.lastCommitTime,
          lastCommitHash: p.lastCommitHash,
          lastCommitMessage: p.lastCommitMessage,
          hasChangesToday: p.hasChangesToday,
          isDirty: p.isDirty,
          status: p.status,
          error: p.error,
          todayCommitCount: p.todayCommitCount,
          weekCommitCount: p.weekCommitCount,
          recentCommits: p.recentCommits || []
        }))
      };
      
      return c.json(response);
    }
    
    // Use embedded data
    const stats = calculateStats(embeddedData.projects);
    
    const response = {
      lastScanTime: embeddedData.lastScanTime || new Date().toISOString(),
      ...stats,
      projects: embeddedData.projects.map(p => ({
        id: p.name,
        name: p.name,
        path: p.path,
        remote: p.remote || '',
        branch: p.branch,
        lastCommitTime: p.lastCommitTime,
        lastCommitHash: p.lastCommitHash,
        lastCommitMessage: p.lastCommitMessage,
        hasChangesToday: p.hasChangesToday,
        isDirty: p.isDirty,
        status: p.status,
        error: p.error,
        todayCommitCount: p.todayCommitCount,
        weekCommitCount: p.weekCommitCount,
        recentCommits: p.recentCommits || []
      }))
    };
    
    return c.json(response);
  }
  
  // Fallback to KV only if no embedded data
  if (kvData && kvData.projects && kvData.projects.length > 0) {
    const kvProjects = kvData.projects as Project[];
    const stats = calculateStats(kvProjects);
    
    const response = {
      lastScanTime: kvData.lastScanTime || new Date().toISOString(),
      ...stats,
      projects: kvProjects.map(p => ({
        id: p.name,
        name: p.name,
        path: p.path,
        remote: p.remote || '',
        branch: p.branch,
        lastCommitTime: p.lastCommitTime,
        lastCommitHash: p.lastCommitHash,
        lastCommitMessage: p.lastCommitMessage,
        hasChangesToday: p.hasChangesToday,
        isDirty: p.isDirty,
        status: p.status,
        error: p.error,
        todayCommitCount: p.todayCommitCount,
        weekCommitCount: p.weekCommitCount,
        recentCommits: p.recentCommits || []
      }))
    };
    
    return c.json(response);
  }
  
  // No data available
  return c.json({
    lastScanTime: new Date().toISOString(),
    totalProjects: 0,
    projectsWithChangesToday: 0,
    dirtyProjects: 0,
    errorProjects: 0,
    projects: []
  });
});

/**
 * GET /api/projects/:name
 * Get a single project by name (from embedded data first, KV as backup)
 */
projectsRouter.get('/:name', async (c: Context) => {
  const name = c.req.param('name');
  const kv = c.env.KV;
  
  // First try embedded data
  let project = getProject(name);
  
  // Try to get KV data
  let kvProject: Project | null = null;
  if (kv) {
    try {
      const kvData = await getLatestScan(kv);
      if (kvData?.projects) {
        kvProject = kvData.projects.find(p => p.name === name || p.id === name) || null;
      }
    } catch (error) {
      console.error('Failed to get scan data from KV:', error);
    }
  }
  
  // Use KV project if it exists and has commits (always prefer KV with actual scan data)
  if (kvProject) {
    // Always prefer KV data since it contains the latest scan results
    // KV data is from the scanner, embedded data is static/hardcoded
    if (kvProject.recentCommits && kvProject.recentCommits.length > 0) {
      project = kvProject;
    }
  }
  
  if (!project) {
    return c.json({ error: 'Project not found', message: `Project '${name}' not found` }, 404);
  }
  
  // Transform to match frontend expected format
  const response = {
    id: project.name,
    name: project.name,
    path: project.path,
    remote: project.remote || '',
    branch: project.branch,
    lastCommitTime: project.lastCommitTime,
    lastCommitHash: project.lastCommitHash,
    lastCommitMessage: project.lastCommitMessage,
    hasChangesToday: project.hasChangesToday,
    isDirty: project.isDirty,
    status: project.status,
    error: project.error,
    todayCommitCount: project.todayCommitCount,
    weekCommitCount: project.weekCommitCount,
    recentCommits: project.recentCommits || []
  };
  
  return c.json(response);
});
