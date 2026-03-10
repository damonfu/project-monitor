export type CIStatus = 'success' | 'failure' | 'running' | 'none';

export interface CIInfo {
  status: CIStatus;
  lastRunTime: string;
  lastRunHash: string;
}

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
  ciInfo?: CIInfo;
}

export type AlertType = 'error' | 'warning' | 'info' | 'inactive' | 'uncommitted';
export type AlertStatus = 'active' | 'acknowledged' | 'ignored';

export interface Alert {
  id: string;
  type: AlertType | string; // Allow string for flexibility
  projectId?: string;
  projectName: string;
  projectPath?: string;
  severity?: string;
  details?: Record<string, any>;
  message: string;
  timestamp?: string;
  createdAt?: string;
  updatedAt?: string;
  status: AlertStatus | string; // Allow string for flexibility
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

export interface SearchResult {
  type: 'project' | 'commit' | 'file';
  id: string; // project id or path
  title: string;
  subtitle: string;
  url: string;
}
