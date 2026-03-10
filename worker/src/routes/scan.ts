/**
 * Scan Routes
 * 
 * POST /api/scan - Receive scan data from external scanner
 * POST /api/scan/trigger - Trigger scan check (for cron)
 * GET /api/scan/latest - Get latest scan data
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  setLatestScan,
  getLatestScan,
  checkAlertRules,
  getActiveAlerts,
  getGlobalConfig,
} from '../utils/kv';
import type {
  ScanData,
  Project,
  ScanTriggerResponse,
} from '../types';

type EnvBindings = {
  KV: KVNamespace;
  ENVIRONMENT: string;
  SCAN_TOKEN?: string;
};

export const scanRouter = new Hono<{ Bindings: EnvBindings }>();

/**
 * Validate scan token
 */
function validateToken(c: Context): boolean {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const expectedToken = c.env.SCAN_TOKEN;
  
  // If SCAN_TOKEN is not configured, allow for development
  if (!expectedToken) {
    console.warn('SCAN_TOKEN not configured, allowing scan');
    return true;
  }
  
  return token === expectedToken;
}

/**
 * POST /api/scan
 * Receive scan data from external scanner
 */
scanRouter.post('/', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for scan functionality',
    }, 503);
  }
  
  // Validate token
  if (!validateToken(c)) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid or missing authorization token',
    }, 401);
  }
  
  try {
    const body = await c.req.json<ScanData>();
    
    if (!body.projects || !Array.isArray(body.projects)) {
      return c.json({
        error: 'Invalid request',
        message: 'Projects array is required',
      }, 400);
    }
    
    const startTime = Date.now();
    
    // Store scan data
    const scanData: ScanData = {
      lastScanTime: body.lastScanTime || new Date().toISOString(),
      projects: body.projects,
      scanDuration: body.scanDuration || (Date.now() - startTime),
      scanPath: body.scanPath || '~/Codes',
    };
    
    await setLatestScan(kv, scanData);
    
    // Check alert rules and generate new alerts
    const newAlerts = await checkAlertRules(kv, scanData.projects);
    const activeAlerts = await getActiveAlerts(kv);
    const globalConfig = await getGlobalConfig(kv);
    
    const response: ScanTriggerResponse = {
      success: true,
      message: 'Scan data received and processed',
      scanTime: scanData.lastScanTime,
      alertsGenerated: newAlerts.length,
    };
    
    // Include new alerts in response for notification
    if (newAlerts.length > 0 && globalConfig.feishuNotification) {
      response.alerts = newAlerts;
    }
    
    return c.json(response);
  } catch (error) {
    console.error('Failed to process scan data:', error);
    return c.json({
      error: 'Failed to process scan data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/scan/latest
 * Get latest scan data
 */
scanRouter.get('/latest', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for scan functionality',
    }, 503);
  }
  
  try {
    const scanData = await getLatestScan(kv);
    
    if (!scanData) {
      return c.json({
        error: 'No scan data',
        message: 'No scan data available. Trigger a scan first.',
      }, 404);
    }
    
    return c.json(scanData);
  } catch (error) {
    console.error('Failed to get scan data:', error);
    return c.json({
      error: 'Failed to get scan data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/scan/trigger
 * Trigger alert rule check (for cron or manual trigger)
 */
scanRouter.post('/trigger', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for scan functionality',
    }, 503);
  }
  
  // Validate token
  if (!validateToken(c)) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid or missing authorization token',
    }, 401);
  }
  
  try {
    // Get latest scan data
    const scanData = await getLatestScan(kv);
    
    if (!scanData) {
      return c.json({
        error: 'No scan data',
        message: 'No scan data available. Submit scan data first.',
      }, 404);
    }
    
    // Check alert rules
    const newAlerts = await checkAlertRules(kv, scanData.projects);
    const activeAlerts = await getActiveAlerts(kv);
    const globalConfig = await getGlobalConfig(kv);
    
    const response: ScanTriggerResponse = {
      success: true,
      message: 'Alert check completed',
      scanTime: new Date().toISOString(),
      alertsGenerated: newAlerts.length,
      alerts: newAlerts,
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Failed to trigger alert check:', error);
    return c.json({
      error: 'Failed to trigger alert check',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/scan/status
 * Get scan system status
 */
scanRouter.get('/status', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for scan functionality',
    }, 503);
  }
  
  try {
    const scanData = await getLatestScan(kv);
    const activeAlerts = await getActiveAlerts(kv);
    const globalConfig = await getGlobalConfig(kv);
    
    return c.json({
      configured: true,
      lastScanTime: scanData?.lastScanTime || null,
      totalProjects: scanData?.projects.length || 0,
      activeAlerts: activeAlerts.length,
      alertConfig: {
        uncommittedThreshold: globalConfig.uncommittedThreshold,
        inactiveThreshold: globalConfig.inactiveThreshold,
        enabled: globalConfig.enabled,
        feishuNotification: globalConfig.feishuNotification,
      },
    });
  } catch (error) {
    console.error('Failed to get scan status:', error);
    return c.json({
      error: 'Failed to get scan status',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
