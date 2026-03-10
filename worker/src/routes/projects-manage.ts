/**
 * Project Management Routes
 * 
 * POST /api/projects/:name/group - Set project group
 * POST /api/projects/:name/favorite - Set project favorite
 * GET /api/projects/:name/config - Get project config
 * PUT /api/projects/:name/config - Update project config
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getProjectConfig,
  setProjectConfig,
  setProjectGroup,
  setProjectFavorite,
  enrichProjectsWithConfig,
} from '../utils/kv';
import { getProject, getProjectsIndex } from '../utils/data';
import type {
  ProjectConfig,
  AlertConfig,
  SetProjectGroupRequest,
  SetProjectFavoriteRequest,
} from '../types';

type EnvBindings = {
  KV: KVNamespace;
  ENVIRONMENT: string;
};

export const projectsManageRouter = new Hono<{ Bindings: EnvBindings }>();

/**
 * POST /api/projects/:name/group
 * Set project group
 */
projectsManageRouter.post('/:name/group', async (c: Context) => {
  const kv = c.env.KV;
  const name = c.req.param('name');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for project management',
    }, 503);
  }
  
  try {
    // Verify project exists
    const project = getProject(name);
    if (!project) {
      return c.json({
        error: 'Project not found',
        message: `Project '${name}' not found`,
      }, 404);
    }
    
    const body = await c.req.json<SetProjectGroupRequest>();
    
    if (!body.group || typeof body.group !== 'string') {
      return c.json({
        error: 'Invalid request',
        message: 'Group name is required',
      }, 400);
    }
    
    const config = await setProjectGroup(kv, name, body.group);
    
    return c.json({
      success: true,
      message: `Project '${name}' added to group '${body.group}'`,
      config,
    });
  } catch (error) {
    console.error('Failed to set project group:', error);
    return c.json({
      error: 'Failed to set project group',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/projects/:name/favorite
 * Set project favorite status
 */
projectsManageRouter.post('/:name/favorite', async (c: Context) => {
  const kv = c.env.KV;
  const name = c.req.param('name');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for project management',
    }, 503);
  }
  
  try {
    // Verify project exists
    const project = getProject(name);
    if (!project) {
      return c.json({
        error: 'Project not found',
        message: `Project '${name}' not found`,
      }, 404);
    }
    
    const body = await c.req.json<SetProjectFavoriteRequest>();
    
    if (typeof body.favorite !== 'boolean') {
      return c.json({
        error: 'Invalid request',
        message: 'Favorite must be a boolean',
      }, 400);
    }
    
    const config = await setProjectFavorite(kv, name, body.favorite);
    
    return c.json({
      success: true,
      message: body.favorite 
        ? `Project '${name}' added to favorites`
        : `Project '${name}' removed from favorites`,
      config,
    });
  } catch (error) {
    console.error('Failed to set project favorite:', error);
    return c.json({
      error: 'Failed to set project favorite',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/projects/:name/config
 * Get project configuration
 */
projectsManageRouter.get('/:name/config', async (c: Context) => {
  const kv = c.env.KV;
  const name = c.req.param('name');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for project management',
    }, 503);
  }
  
  try {
    // Verify project exists
    const project = getProject(name);
    if (!project) {
      return c.json({
        error: 'Project not found',
        message: `Project '${name}' not found`,
      }, 404);
    }
    
    const config = await getProjectConfig(kv, name);
    
    return c.json(config || {
      name,
      favorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get project config:', error);
    return c.json({
      error: 'Failed to get project config',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PUT /api/projects/:name/config
 * Update project configuration
 */
projectsManageRouter.put('/:name/config', async (c: Context) => {
  const kv = c.env.KV;
  const name = c.req.param('name');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for project management',
    }, 503);
  }
  
  try {
    // Verify project exists
    const project = getProject(name);
    if (!project) {
      return c.json({
        error: 'Project not found',
        message: `Project '${name}' not found`,
      }, 404);
    }
    
    const body = await c.req.json<Partial<ProjectConfig>>();
    const config = await setProjectConfig(kv, name, body);
    
    return c.json({
      success: true,
      message: 'Project configuration updated',
      config,
    });
  } catch (error) {
    console.error('Failed to update project config:', error);
    return c.json({
      error: 'Failed to update project config',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/projects/groups
 * Get all project groups
 */
projectsManageRouter.get('/groups', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for project management',
    }, 503);
  }
  
  try {
    const index = getProjectsIndex();
    const enrichedProjects = await enrichProjectsWithConfig(kv, index.projects);
    
    // Group projects by group name
    const groups: Record<string, typeof enrichedProjects> = {};
    const favorites: typeof enrichedProjects = [];
    const ungrouped: typeof enrichedProjects = [];
    
    for (const project of enrichedProjects) {
      if (project.config?.favorite) {
        favorites.push(project);
      } else if (project.config?.group) {
        if (!groups[project.config.group]) {
          groups[project.config.group] = [];
        }
        groups[project.config.group].push(project);
      } else {
        ungrouped.push(project);
      }
    }
    
    return c.json({
      groups,
      favorites,
      ungrouped,
      totalProjects: index.totalProjects,
    });
  } catch (error) {
    console.error('Failed to get project groups:', error);
    return c.json({
      error: 'Failed to get project groups',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
