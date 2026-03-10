/**
 * Alert System Routes
 * 
 * GET /api/alerts - Get all alerts
 * GET /api/alerts/active - Get active alerts only
 * GET /api/alerts/config - Get alert configuration
 * PUT /api/alerts/config - Update alert configuration
 * GET /api/alerts/:id - Get a specific alert
 * POST /api/alerts/:id/acknowledge - Acknowledge an alert
 * POST /api/alerts/:id/ignore - Ignore an alert
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  getAlerts,
  getAlert,
  acknowledgeAlert,
  ignoreAlert,
  reactivateAlert,
  getGlobalConfig,
  setGlobalConfig,
} from '../utils/kv';
import type {
  GlobalAlertConfig,
  AcknowledgeAlertRequest,
  IgnoreAlertRequest,
  UpdateAlertConfigRequest,
} from '../types';

type EnvBindings = {
  KV: KVNamespace;
  ENVIRONMENT: string;
};

export const alertsRouter = new Hono<{ Bindings: EnvBindings }>();

/**
 * GET /api/alerts
 * Get all alerts with statistics
 */
alertsRouter.get('/', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const alertList = await getAlerts(kv);
    return c.json(alertList);
  } catch (error) {
    console.error('Failed to get alerts:', error);
    return c.json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/alerts/active
 * Get active alerts only
 */
alertsRouter.get('/active', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const alertList = await getAlerts(kv);
    const activeAlerts = alertList.alerts.filter(a => a.status === 'active');
    return c.json({
      alerts: activeAlerts,
      total: activeAlerts.length,
    });
  } catch (error) {
    console.error('Failed to get active alerts:', error);
    return c.json({
      error: 'Failed to get active alerts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/alerts/config
 * Get alert configuration
 * IMPORTANT: This must be defined before /:id to avoid route conflicts
 */
alertsRouter.get('/config', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const config = await getGlobalConfig(kv);
    return c.json(config);
  } catch (error) {
    console.error('Failed to get alert config:', error);
    return c.json({
      error: 'Failed to get alert config',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * PUT /api/alerts/config
 * Update alert configuration
 * IMPORTANT: This must be defined before /:id to avoid route conflicts
 */
alertsRouter.put('/config', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const body = await c.req.json<UpdateAlertConfigRequest>();
    const config = await setGlobalConfig(kv, body);
    
    return c.json({
      success: true,
      message: 'Alert configuration updated',
      config,
    });
  } catch (error) {
    console.error('Failed to update alert config:', error);
    return c.json({
      error: 'Failed to update alert config',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/alerts/:id
 * Get a specific alert
 */
alertsRouter.get('/:id', async (c: Context) => {
  const kv = c.env.KV;
  const id = c.req.param('id');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const alert = await getAlert(kv, id);
    
    if (!alert) {
      return c.json({
        error: 'Alert not found',
        message: `Alert '${id}' not found`,
      }, 404);
    }
    
    return c.json(alert);
  } catch (error) {
    console.error('Failed to get alert:', error);
    return c.json({
      error: 'Failed to get alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
alertsRouter.post('/:id/acknowledge', async (c: Context) => {
  const kv = c.env.KV;
  const id = c.req.param('id');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    let body: AcknowledgeAlertRequest;
    try {
      body = await c.req.json<AcknowledgeAlertRequest>();
    } catch {
      body = { acknowledgedBy: 'system' };
    }
    const alert = await acknowledgeAlert(kv, id, body.acknowledgedBy);
    
    if (!alert) {
      return c.json({
        error: 'Alert not found',
        message: `Alert '${id}' not found`,
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Alert acknowledged',
      alert,
    });
  } catch (error) {
    console.error('Failed to acknowledge alert:', error);
    return c.json({
      error: 'Failed to acknowledge alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/alerts/:id/ignore
 * Ignore an alert
 */
alertsRouter.post('/:id/ignore', async (c: Context) => {
  const kv = c.env.KV;
  const id = c.req.param('id');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    let body: IgnoreAlertRequest;
    try {
      body = await c.req.json<IgnoreAlertRequest>();
    } catch {
      body = { ignoredBy: 'system' };
    }
    const alert = await ignoreAlert(kv, id, body.ignoredBy);
    
    if (!alert) {
      return c.json({
        error: 'Alert not found',
        message: `Alert '${id}' not found`,
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Alert ignored',
      alert,
    });
  } catch (error) {
    console.error('Failed to ignore alert:', error);
    return c.json({
      error: 'Failed to ignore alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/alerts/:id/dismiss
 * Dismiss an alert (alias for ignore)
 */
alertsRouter.post('/:id/dismiss', async (c: Context) => {
  const kv = c.env.KV;
  const id = c.req.param('id');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    let body: IgnoreAlertRequest;
    try {
      body = await c.req.json<IgnoreAlertRequest>();
    } catch {
      body = { ignoredBy: 'system' };
    }
    const alert = await ignoreAlert(kv, id, body.ignoredBy);
    
    if (!alert) {
      return c.json({
        error: 'Alert not found',
        message: `Alert '${id}' not found`,
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Alert dismissed',
      alert,
    });
  } catch (error) {
    console.error('Failed to dismiss alert:', error);
    return c.json({
      error: 'Failed to dismiss alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/alerts/:id/reactivate
 * Reactivate a dismissed/ignored alert
 */
alertsRouter.post('/:id/reactivate', async (c: Context) => {
  const kv = c.env.KV;
  const id = c.req.param('id');
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for alerts functionality',
    }, 503);
  }
  
  try {
    const alert = await reactivateAlert(kv, id);
    
    if (!alert) {
      return c.json({
        error: 'Alert not found',
        message: `Alert '${id}' not found`,
      }, 404);
    }
    
    return c.json({
      success: true,
      message: 'Alert reactivated',
      alert,
    });
  } catch (error) {
    console.error('Failed to reactivate alert:', error);
    return c.json({
      error: 'Failed to reactivate alert',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
