// Type definitions matching the frontend types

export interface Project {
  id: string;
  name: string;
  path: string;
  remote: string;
  branch: string;
  lastCommitTime: string;
  lastCommitHash: string;
  lastCommitMessage: string;
  hasChangesToday: boolean;
  isDirty: boolean;
  status: 'normal' | 'dirty' | 'error';
  error?: string;
  todayCommitCount: number;
  weekCommitCount: number;
  recentCommits: Commit[];
}

export interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
}

export interface FileChange {
  type: 'added' | 'modified' | 'deleted';
  path: string;
}

export interface DailyReport {
  date: string;
  projects: ReportProject[];
  totalCommits: number;
  totalProjects: number;
}

export interface ReportProject {
  name: string;
  path: string;
  commits: Commit[];
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  changes: FileChange[];
}

export interface ProjectsIndex {
  lastScanTime: string;
  totalProjects: number;
  projectsWithChangesToday: number;
  dirtyProjects: number;
  errorProjects: number;
  projects: Project[];
}

export interface SnapshotData {
  date: string;
  generatedAt: string;
  projects: SnapshotProject[];
}

export interface SnapshotProject {
  name: string;
  path: string;
  branch: string;
  status: string;
  lastCommitTime: string;
  commits: Commit[];
  fileChanges: FileChangeStatus[];
}

export interface FileChangeStatus {
  status: string;
  file: string;
}

// ============ P0: Alert System Types ============

export type AlertType = 'uncommitted' | 'inactive';
export type AlertSeverity = 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'ignored';

export interface Alert {
  id: string;
  type: AlertType;
  projectName: string;
  projectPath: string;
  severity: AlertSeverity;
  message: string;
  details: {
    // For uncommitted alerts
    uncommittedDuration?: number; // hours
    lastCommitTime?: string;
    // For inactive alerts
    inactiveDays?: number;
    lastActivityTime?: string;
  };
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  ignoredAt?: string;
  ignoredBy?: string;
}

export interface AlertList {
  alerts: Alert[];
  total: number;
  active: number;
  acknowledged: number;
  ignored: number;
}

// ============ P0: Project Config Types ============

export interface ProjectConfig {
  name: string;
  group?: string;
  favorite?: boolean;
  alertConfig?: AlertConfig;
  createdAt: string;
  updatedAt: string;
}

export interface AlertConfig {
  uncommittedThreshold?: number; // hours, default 24
  inactiveThreshold?: number; // days, default 7
  enabled?: boolean; // default true
}

// ============ P0: Global Config Types ============

export interface GlobalAlertConfig {
  uncommittedThreshold: number; // hours, default 24
  inactiveThreshold: number; // days, default 7
  enabled: boolean;
  feishuNotification: boolean;
  feishuWebhook?: string;
}

// ============ P0: Scan Data Types ============

export interface ScanData {
  lastScanTime: string;
  projects: Project[];
  scanDuration: number;
  scanPath: string;
}

// ============ P0: API Request/Response Types ============

export interface AcknowledgeAlertRequest {
  acknowledgedBy?: string;
}

export interface IgnoreAlertRequest {
  ignoredBy?: string;
  reason?: string;
}

export interface SetProjectGroupRequest {
  group: string;
}

export interface SetProjectFavoriteRequest {
  favorite: boolean;
}

export interface UpdateAlertConfigRequest {
  uncommittedThreshold?: number;
  inactiveThreshold?: number;
  enabled?: boolean;
}

export interface ScanTriggerResponse {
  success: boolean;
  message: string;
  scanTime: string;
  alertsGenerated: number;
  alerts?: Alert[];
}
