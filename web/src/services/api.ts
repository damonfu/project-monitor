import type { Project, ProjectsIndex, Alert } from '../types';

// API Service - Connect to Cloudflare Workers
const API_BASE = 'https://project-monitor-api.inmanfu.workers.dev';

// Safe array check for objects
function safeObjectArray<T>(arr: unknown): arr is T[] {
  return Array.isArray(arr);
}

// Safe array check for strings
function safeStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every(item => typeof item === 'string');
}

export interface Snapshot {
  date: string;
  projects: Array<{
    name: string;
    path: string;
    branch: string;
    commits: Array<{
      hash: string;
      author: string;
      date: string;
      message: string;
      filesChanged: number;
    }>;
    fileStats: {
      added: number;
      modified: number;
      deleted: number;
    };
    files: Array<{
      status: string;
      path: string;
    }>;
  }>;
}

export interface Report {
  date: string;
  content: string;
}

// Fetch project list
export async function fetchProjects(): Promise<ProjectsIndex> {
  const response = await fetch(`${API_BASE}/api/projects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status}`);
  }
  const data = await response.json();
  // Defensive: ensure all required fields exist
  return {
    lastScanTime: data?.lastScanTime ?? new Date().toISOString(),
    totalProjects: data?.totalProjects ?? 0,
    projectsWithChangesToday: data?.projectsWithChangesToday ?? 0,
    dirtyProjects: data?.dirtyProjects ?? 0,
    errorProjects: data?.errorProjects ?? 0,
    projects: safeObjectArray(data?.projects) ? data.projects : [],
  };
}

// Fetch single project
export async function fetchProject(name: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project: ${response.status}`);
  }
  const data = await response.json();
  // Defensive: return minimal valid project structure
  return {
    id: data?.id ?? name,
    name: data?.name ?? name,
    path: data?.path ?? '',
    remote: data?.remote ?? '',
    branch: data?.branch ?? 'main',
    lastCommitTime: data?.lastCommitTime ?? '',
    lastCommitHash: data?.lastCommitHash ?? '',
    lastCommitMessage: data?.lastCommitMessage ?? '',
    hasChangesToday: data?.hasChangesToday ?? false,
    isDirty: data?.isDirty ?? false,
    status: data?.status ?? 'normal',
    todayCommitCount: data?.todayCommitCount ?? 0,
    weekCommitCount: data?.weekCommitCount ?? 0,
    recentCommits: safeObjectArray(data?.recentCommits) ? data.recentCommits : [],
    ciInfo: data?.ciInfo ?? { status: 'none', lastRunTime: '', lastRunHash: '' },
  };
}

// Fetch snapshot dates
export async function fetchSnapshotDates(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/api/snapshots`);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot dates: ${response.status}`);
  }
  const data = await response.json();
  return safeStringArray(data) ? data : [];
}

// Fetch snapshot by date
export async function fetchSnapshot(date: string): Promise<Snapshot> {
  const response = await fetch(`${API_BASE}/api/snapshots/${date}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch snapshot: ${response.status}`);
  }
  const data = await response.json();
  // Defensive: ensure valid snapshot structure
  return {
    date: data?.date ?? date,
    projects: safeObjectArray(data?.projects) ? data.projects : [],
  };
}

// Fetch report list
export async function fetchReports(): Promise<{ reports: ReportSummary[]; count: number }> {
  const response = await fetch(`${API_BASE}/api/reports`);
  if (!response.ok) {
    throw new Error(`Failed to fetch reports: ${response.status}`);
  }
  const data = await response.json();
  return {
    reports: safeObjectArray(data?.reports) ? data.reports : [],
    count: data?.count ?? 0,
  };
}

export interface ReportSummary {
  date: string;
  totalProjects: number;
  totalCommits: number;
  projects: Array<{ name: string; commits: number }>;
}

// Fetch report content
export async function fetchReport(date: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/reports/${date}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch report: ${response.status}`);
  }
  return response.text();
}

// Trigger scan (admin only)
export async function triggerScan(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to trigger scan: ${response.status}`);
  }
}

// Acknowledge an alert (mark as read)
export async function acknowledgeAlert(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/alerts/${id}/acknowledge`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to acknowledge alert: ${response.status}`);
  }
}

// Fetch alerts from API
export async function fetchAlerts(): Promise<{ alerts: Alert[]; total: number }> {
  const response = await fetch(`${API_BASE}/api/alerts`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`);
  }
  const data = await response.json();
  // Defensive: ensure alerts is always an array
  return {
    alerts: safeObjectArray(data?.alerts) ? data.alerts : [],
    total: data?.total ?? 0,
  };
}

// Dismiss an alert
export async function dismissAlert(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/alerts/${id}/dismiss`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to dismiss alert: ${response.status}`);
  }
}

// Reactivate an alert
export async function reactivateAlert(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/alerts/${id}/reactivate`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to reactivate alert: ${response.status}`);
  }
}
