/**
 * KV Storage Utilities for Project Monitor
 * 
 * KV Key Structure:
 * - project:config:{name} - Project configuration (group, favorite, alert config)
 * - alert:{id} - Alert record
 * - alerts:active - List of active alert IDs
 * - alerts:all - List of all alert IDs
 * - config:global - Global configuration
 * - scan:latest - Latest scan data
 */

import type {
  Alert,
  AlertList,
  ProjectConfig,
  GlobalAlertConfig,
  ScanData,
  Project,
} from '../types';

// ============ KV Key Helpers ============

const KEYS = {
  projectConfig: (name: string) => `project:config:${name}`,
  alert: (id: string) => `alert:${id}`,
  alertsActive: 'alerts:active',
  alertsAll: 'alerts:all',
  globalConfig: 'config:global',
  latestScan: 'scan:latest',
  // Report keys
  report: (date: string) => `report:${date}`,
  reportsList: 'reports:list',
};

// ============ Project Config Operations ============

export async function getProjectConfig(
  kv: KVNamespace,
  name: string
): Promise<ProjectConfig | null> {
  const data = await kv.get(KEYS.projectConfig(name), 'json');
  return data as ProjectConfig | null;
}

export async function setProjectConfig(
  kv: KVNamespace,
  name: string,
  config: Partial<ProjectConfig>
): Promise<ProjectConfig> {
  const existing = await getProjectConfig(kv, name);
  const now = new Date().toISOString();
  
  const updated: ProjectConfig = {
    name,
    group: config.group ?? existing?.group,
    favorite: config.favorite ?? existing?.favorite ?? false,
    alertConfig: {
      ...existing?.alertConfig,
      ...config.alertConfig,
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  
  await kv.put(KEYS.projectConfig(name), JSON.stringify(updated));
  return updated;
}

export async function setProjectGroup(
  kv: KVNamespace,
  name: string,
  group: string
): Promise<ProjectConfig> {
  return setProjectConfig(kv, name, { group });
}

export async function setProjectFavorite(
  kv: KVNamespace,
  name: string,
  favorite: boolean
): Promise<ProjectConfig> {
  return setProjectConfig(kv, name, { favorite });
}

// ============ Alert Operations ============

function generateAlertId(type: string, projectName: string): string {
  const timestamp = Date.now();
  return `${type}-${projectName}-${timestamp}`;
}

export async function createAlert(
  kv: KVNamespace,
  alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Alert> {
  const id = generateAlertId(alert.type, alert.projectName);
  const now = new Date().toISOString();
  
  const newAlert: Alert = {
    ...alert,
    id,
    createdAt: now,
    updatedAt: now,
  };
  
  // Store alert
  await kv.put(KEYS.alert(id), JSON.stringify(newAlert));
  
  // Add to active alerts list
  const activeList = await getActiveAlertIds(kv);
  activeList.push(id);
  await kv.put(KEYS.alertsActive, JSON.stringify(activeList));
  
  // Add to all alerts list
  const allList = await getAllAlertIds(kv);
  allList.push(id);
  await kv.put(KEYS.alertsAll, JSON.stringify(allList));
  
  return newAlert;
}

export async function getAlert(kv: KVNamespace, id: string): Promise<Alert | null> {
  const data = await kv.get(KEYS.alert(id), 'json');
  return data as Alert | null;
}

export async function updateAlert(
  kv: KVNamespace,
  id: string,
  updates: Partial<Alert>
): Promise<Alert | null> {
  const existing = await getAlert(kv, id);
  if (!existing) return null;
  
  const updated: Alert = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await kv.put(KEYS.alert(id), JSON.stringify(updated));
  
  // If status changed from active, remove from active list
  if (existing.status === 'active' && updates.status && updates.status !== 'active') {
    const activeList = await getActiveAlertIds(kv);
    const index = activeList.indexOf(id);
    if (index > -1) {
      activeList.splice(index, 1);
      await kv.put(KEYS.alertsActive, JSON.stringify(activeList));
    }
  }
  
  return updated;
}

export async function acknowledgeAlert(
  kv: KVNamespace,
  id: string,
  acknowledgedBy?: string
): Promise<Alert | null> {
  const now = new Date().toISOString();
  return updateAlert(kv, id, {
    status: 'acknowledged',
    acknowledgedAt: now,
    acknowledgedBy: acknowledgedBy || 'system',
  });
}

export async function ignoreAlert(
  kv: KVNamespace,
  id: string,
  ignoredBy?: string
): Promise<Alert | null> {
  const now = new Date().toISOString();
  return updateAlert(kv, id, {
    status: 'ignored',
    ignoredAt: now,
    ignoredBy: ignoredBy || 'system',
  });
}

export async function reactivateAlert(
  kv: KVNamespace,
  id: string
): Promise<Alert | null> {
  const now = new Date().toISOString();
  return updateAlert(kv, id, {
    status: 'active',
    ignoredAt: undefined,
    ignoredBy: undefined,
  });
}

async function getActiveAlertIds(kv: KVNamespace): Promise<string[]> {
  const data = await kv.get(KEYS.alertsActive, 'json');
  return (data as string[]) || [];
}

async function getAllAlertIds(kv: KVNamespace): Promise<string[]> {
  const data = await kv.get(KEYS.alertsAll, 'json');
  return (data as string[]) || [];
}

export async function getAlerts(kv: KVNamespace): Promise<AlertList> {
  const allIds = await getAllAlertIds(kv);
  const alerts: Alert[] = [];
  
  for (const id of allIds) {
    const alert = await getAlert(kv, id);
    if (alert) alerts.push(alert);
  }
  
  // Sort by createdAt descending
  alerts.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return {
    alerts,
    total: alerts.length,
    active: alerts.filter(a => a.status === 'active').length,
    acknowledged: alerts.filter(a => a.status === 'acknowledged').length,
    ignored: alerts.filter(a => a.status === 'ignored').length,
  };
}

export async function getActiveAlerts(kv: KVNamespace): Promise<Alert[]> {
  const list = await getAlerts(kv);
  return list.alerts.filter(a => a.status === 'active');
}

// ============ Global Config Operations ============

const DEFAULT_GLOBAL_CONFIG: GlobalAlertConfig = {
  uncommittedThreshold: 24, // hours
  inactiveThreshold: 7, // days
  enabled: true,
  feishuNotification: false,
};

export async function getGlobalConfig(
  kv: KVNamespace
): Promise<GlobalAlertConfig> {
  const data = await kv.get(KEYS.globalConfig, 'json');
  return {
    ...DEFAULT_GLOBAL_CONFIG,
    ...(data as Partial<GlobalAlertConfig>),
  };
}

export async function setGlobalConfig(
  kv: KVNamespace,
  config: Partial<GlobalAlertConfig>
): Promise<GlobalAlertConfig> {
  const existing = await getGlobalConfig(kv);
  const updated = {
    ...existing,
    ...config,
  };
  await kv.put(KEYS.globalConfig, JSON.stringify(updated));
  return updated;
}

// ============ Scan Data Operations ============

export async function getLatestScan(kv: KVNamespace): Promise<ScanData | null> {
  const data = await kv.get(KEYS.latestScan, 'json');
  return data as ScanData | null;
}

export async function setLatestScan(
  kv: KVNamespace,
  scanData: ScanData
): Promise<void> {
  await kv.put(KEYS.latestScan, JSON.stringify(scanData));
}

// ============ Alert Rule Checking ============

export async function checkAlertRules(
  kv: KVNamespace,
  projects: Project[]
): Promise<Alert[]> {
  const config = await getGlobalConfig(kv);
  const newAlerts: Alert[] = [];
  const updatedAlerts: Alert[] = [];
  
  if (!config.enabled) {
    return newAlerts;
  }
  
  const now = Date.now();
  
  // Get all existing alerts once (optimization)
  const allAlerts = await getAlerts(kv);
  const alertsByProjectAndType = new Map<string, Alert>();
  allAlerts.alerts.forEach(alert => {
    const key = `${alert.projectName}:${alert.type}`;
    alertsByProjectAndType.set(key, alert);
  });
  
  for (const project of projects) {
    // Get project config for custom thresholds
    const projectConfig = await getProjectConfig(kv, project.name);
    const alertConfig = projectConfig?.alertConfig;
    
    // Check uncommitted threshold
    if (project.isDirty && project.lastCommitTime) {
      const lastCommit = new Date(project.lastCommitTime).getTime();
      const hoursSinceCommit = (now - lastCommit) / (1000 * 60 * 60);
      const threshold = alertConfig?.uncommittedThreshold ?? config.uncommittedThreshold;
      
      if (hoursSinceCommit >= threshold) {
        const alertKey = `${project.name}:uncommitted`;
        const existingAlert = alertsByProjectAndType.get(alertKey);
        
        if (!existingAlert) {
          // Create new alert
          const alert = await createAlert(kv, {
            type: 'uncommitted',
            projectName: project.name,
            projectPath: project.path,
            severity: hoursSinceCommit >= threshold * 2 ? 'error' : 'warning',
            message: `项目 ${project.name} 有未提交的更改已超过 ${Math.floor(hoursSinceCommit)} 小时`,
            details: {
              uncommittedDuration: Math.floor(hoursSinceCommit),
              lastCommitTime: project.lastCommitTime,
            },
            status: 'active',
          });
          newAlerts.push(alert);
        } else if (existingAlert.status === 'active') {
          // Only update active alerts (don't reactivate acknowledged/ignored alerts)
          const newSeverity = hoursSinceCommit >= threshold * 2 ? 'error' : 'warning';
          const updatedAlert = await updateAlert(kv, existingAlert.id, {
            severity: newSeverity,
            message: `项目 ${project.name} 有未提交的更改已超过 ${Math.floor(hoursSinceCommit)} 小时`,
            details: {
              uncommittedDuration: Math.floor(hoursSinceCommit),
              lastCommitTime: project.lastCommitTime,
            },
          });
          if (updatedAlert) {
            updatedAlerts.push(updatedAlert);
          }
        }
      }
    }
    
    // Check inactive threshold
    if (project.lastCommitTime) {
      const lastCommit = new Date(project.lastCommitTime).getTime();
      const daysSinceCommit = (now - lastCommit) / (1000 * 60 * 60 * 24);
      const threshold = alertConfig?.inactiveThreshold ?? config.inactiveThreshold;
      
      if (daysSinceCommit >= threshold) {
        const alertKey = `${project.name}:inactive`;
        const existingAlert = alertsByProjectAndType.get(alertKey);
        
        if (!existingAlert) {
          // Create new alert
          const alert = await createAlert(kv, {
            type: 'inactive',
            projectName: project.name,
            projectPath: project.path,
            severity: daysSinceCommit >= threshold * 2 ? 'critical' : 'warning',
            message: `项目 ${project.name} 已 ${Math.floor(daysSinceCommit)} 天无提交`,
            details: {
              inactiveDays: Math.floor(daysSinceCommit),
              lastActivityTime: project.lastCommitTime,
            },
            status: 'active',
          });
          newAlerts.push(alert);
        } else if (existingAlert.status === 'active') {
          // Only update active alerts (don't reactivate acknowledged/ignored alerts)
          const newSeverity = daysSinceCommit >= threshold * 2 ? 'critical' : 'warning';
          const updatedAlert = await updateAlert(kv, existingAlert.id, {
            severity: newSeverity,
            message: `项目 ${project.name} 已 ${Math.floor(daysSinceCommit)} 天无提交`,
            details: {
              inactiveDays: Math.floor(daysSinceCommit),
              lastActivityTime: project.lastCommitTime,
            },
          });
          if (updatedAlert) {
            updatedAlerts.push(updatedAlert);
          }
        }
      }
    }
  }
  
  // Log alert updates for debugging
  if (updatedAlerts.length > 0) {
    console.log(`Updated ${updatedAlerts.length} existing alerts`);
  }
  
  // Return new alerts for notification purposes
  return newAlerts;
}

// ============ Utility Functions ============

export async function getProjectWithConfig(
  kv: KVNamespace,
  project: Project
): Promise<Project & { config?: ProjectConfig }> {
  const config = await getProjectConfig(kv, project.name);
  return {
    ...project,
    config: config || undefined,
  };
}

export async function enrichProjectsWithConfig(
  kv: KVNamespace,
  projects: Project[]
): Promise<Array<Project & { config?: ProjectConfig }>> {
  return Promise.all(
    projects.map(p => getProjectWithConfig(kv, p))
  );
}

// ============ Report Operations ============

/**
 * Set report content for a specific date
 */
export async function setReportContent(
  kv: KVNamespace,
  date: string,
  content: string
): Promise<void> {
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Invalid date format. Must be YYYY-MM-DD');
  }
  
  // Store report content
  await kv.put(KEYS.report(date), content);
  
  // Update reports list
  const dates = await getReportDates(kv);
  if (!dates.includes(date)) {
    dates.push(date);
    dates.sort((a, b) => b.localeCompare(a)); // Sort descending
    await kv.put(KEYS.reportsList, JSON.stringify(dates));
  }
}

/**
 * Get report content for a specific date
 */
export async function getReportContent(
  kv: KVNamespace,
  date: string
): Promise<string | null> {
  const content = await kv.get(KEYS.report(date));
  return content;
}

/**
 * Get list of all report dates
 */
export async function getReportDates(kv: KVNamespace): Promise<string[]> {
  const data = await kv.get(KEYS.reportsList, 'json');
  return (data as string[]) || [];
}

/**
 * Delete report for a specific date
 */
export async function deleteReport(
  kv: KVNamespace,
  date: string
): Promise<boolean> {
  const content = await getReportContent(kv, date);
  if (!content) return false;
  
  // Delete report content
  await kv.delete(KEYS.report(date));
  
  // Update reports list
  const dates = await getReportDates(kv);
  const index = dates.indexOf(date);
  if (index > -1) {
    dates.splice(index, 1);
    await kv.put(KEYS.reportsList, JSON.stringify(dates));
  }
  
  return true;
}
