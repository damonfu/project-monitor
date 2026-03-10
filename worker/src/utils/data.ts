import type { ProjectsIndex, SnapshotData, DailyReport, Project, Commit, FileChange } from '../types';

// Data directory path for Cloudflare Workers
// In production, we'll use environment variables or KV/R2
// For MVP, data is embedded or fetched from external source

// Type for environment bindings
type EnvBindings = {
  DATA_URL?: string;
  ASSETS?: Fetcher; // Cloudflare Workers Assets binding
};

/**
 * Fetch data from external URL, Workers Assets, or return embedded fallback
 */
async function fetchData<T>(path: string, fallback: T, env?: EnvBindings): Promise<T> {
  // If DATA_URL is configured, fetch from there
  if (env?.DATA_URL) {
    try {
      const response = await fetch(`${env.DATA_URL}/${path}`);
      if (response.ok) {
        return await response.json() as T;
      }
    } catch (error) {
      console.error(`Failed to fetch ${path} from DATA_URL:`, error);
    }
  }
  
  // Try to fetch from Workers Assets binding
  if (env?.ASSETS) {
    try {
      const url = new URL(`https://assets.local/${path}`);
      const response = await env.ASSETS.fetch(url);
      if (response.ok) {
        return await response.json() as T;
      }
    } catch (error) {
      console.log(`Failed to fetch ${path} from ASSETS binding:`, error);
    }
  }
  
  // Return embedded fallback data
  return fallback;
}

/**
 * Fetch text content from external URL, Workers Assets, or return embedded fallback
 */
async function fetchText(path: string, fallback: string, env?: EnvBindings): Promise<string> {
  // If DATA_URL is configured, fetch from there
  if (env?.DATA_URL) {
    try {
      const response = await fetch(`${env.DATA_URL}/${path}`);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.error(`Failed to fetch ${path} from DATA_URL:`, error);
    }
  }
  
  // Try to fetch from Workers Assets binding
  if (env?.ASSETS) {
    try {
      const url = new URL(`https://assets.local/${path}`);
      const response = await env.ASSETS.fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.log(`Failed to fetch ${path} from ASSETS binding:`, error);
    }
  }
  
  // Return embedded fallback data
  return fallback;
}

// Embedded data for MVP - will be updated on deployment
// These are loaded at build time

// Projects index data
let projectsIndexData: ProjectsIndex | null = null;

// Snapshot data cache
const snapshotsCache = new Map<string, SnapshotData>();

// Report content cache
const reportsCache = new Map<string, string>();

/**
 * Initialize data from embedded files
 */
export async function initializeData(env?: EnvBindings): Promise<void> {
  // Projects index
  projectsIndexData = await fetchData<ProjectsIndex>(
    'data/projects-index.json',
    getEmbeddedProjectsIndex(),
    env
  );
  
  // Initialize snapshots
  const snapshotDates = ['2026-03-04', '2026-03-05', '2026-03-06']; // Add more dates as needed
  for (const date of snapshotDates) {
    const data = await fetchData<SnapshotData | null>(
      `data/snapshots/${date}.json`,
      getEmbeddedSnapshot(date),
      env
    );
    if (data) {
      snapshotsCache.set(date, data);
    }
  }
  
  // Initialize reports
  const reportDates = ['2026-03-04', '2026-03-05', '2026-03-06']; // Add more dates as needed
  for (const date of reportDates) {
    const content = await fetchText(
      `data/reports/${date}.md`,
      getEmbeddedReport(date),
      env
    );
    reportsCache.set(date, content);
  }
}

/**
 * Get projects index
 */
export function getProjectsIndex(): ProjectsIndex {
  return projectsIndexData || getEmbeddedProjectsIndex();
}

/**
 * Get a single project by name
 */
export function getProject(name: string): Project | null {
  const index = getProjectsIndex();
  return index.projects.find(p => p.name === name || p.id === name) || null;
}

/**
 * Get snapshot data for a specific date
 */
export function getSnapshot(date: string): SnapshotData | null {
  return snapshotsCache.get(date) || getEmbeddedSnapshot(date);
}

/**
 * Get list of available snapshot dates
 */
export function getSnapshotDates(): string[] {
  return Array.from(snapshotsCache.keys());
}

/**
 * Get daily report content for a specific date
 */
export function getReportContent(date: string): string | null {
  return reportsCache.get(date) || getEmbeddedReport(date);
}

/**
 * Get list of available report dates
 */
export function getReportDates(): string[] {
  return Array.from(reportsCache.keys());
}

/**
 * Get daily reports summary
 */
export function getDailyReports(): DailyReport[] {
  const dates = getReportDates();
  return dates.map(date => {
    const snapshot = getSnapshot(date);
    return {
      date,
      totalProjects: snapshot?.projects.length || 0,
      totalCommits: snapshot?.projects.reduce((sum, p) => sum + p.commits.length, 0) || 0,
      projects: []  // Summary doesn't include detailed project data
    };
  });
}

// ============ Embedded Data Fallbacks ============

// Raw projects data from scan (embedded at build time)
const rawProjectsData = {
  "projects": [
    {
      "name": "ai-middleware",
      "path": "/Users/inman/Codes/gitee/ai-middleware",
      "branch": "master",
      "lastCommitTime": "2026-03-04 15:49:19 +0800",
      "status": "clean",
      "commits": [
        {"hash": "6b2946e", "author": "fujianguo", "date": "2026-03-04 15:49:19 +0800", "message": "修复模型切换缓存匹配并更新playground说明"},
        {"hash": "e5d6f5f", "author": "fujianguo", "date": "2026-03-04 14:49:56 +0800", "message": "补齐自动化测试并修复兼容性"},
        {"hash": "5281646", "author": "fujianguo", "date": "2026-03-04 14:22:00 +0800", "message": "完善chat/completions会话参数覆盖并增强cleanup内网限制"},
        {"hash": "7f3c27b", "author": "fujianguo", "date": "2026-03-04 12:58:53 +0800", "message": "feat: 重构chat/completions参数并升级playground模型切换"},
        {"hash": "32bf4f9", "author": "fujianguo", "date": "2026-03-04 10:44:53 +0800", "message": "chat/completions优化&增加session会话管理"}
      ]
    },
    {
      "name": "code-server",
      "path": "/Users/inman/Codes/older/code-server",
      "branch": "user",
      "lastCommitTime": "2025-12-10 14:02:23 +0800",
      "status": "dirty",
      "commits": []
    },
    {
      "name": "go-todo-app",
      "path": "/Users/inman/Codes/gitee/go-todo-app",
      "branch": "main",
      "lastCommitTime": "2026-03-02 10:57:45 +0800",
      "status": "dirty",
      "commits": [
        {"hash": "1840f73", "author": "fujianguo", "date": "2026-03-02 10:13:00 +0800", "message": "增加用户&配置管理"}
      ]
    },
    {
      "name": "login-page",
      "path": "/Users/inman/Codes/github/login-page",
      "branch": "main",
      "lastCommitTime": "2026-03-03 10:17:03 +0800",
      "status": "dirty",
      "commits": [
        {"hash": "c350964", "author": "fujianguo", "date": "2026-03-03 10:17:03 +0800", "message": "feat: redesign with clean tech style"}
      ]
    },
    {
      "name": "product-showcase",
      "path": "/Users/inman/Codes/github/product-showcase",
      "branch": "main",
      "lastCommitTime": "2026-02-27 16:48:56 +0800",
      "status": "clean",
      "commits": []
    },
    {
      "name": "web",
      "path": "/Users/inman/Codes/project-monitor/web",
      "branch": "main",
      "lastCommitTime": "2026-03-04 15:13:43 +0800",
      "status": "dirty",
      "commits": [
        {"hash": "191e805", "author": "fujianguo", "date": "2026-03-04 15:13:43 +0800", "message": "fix: 修复项目列表和详情页的数据处理问题"}
      ]
    }
  ],
  "lastUpdated": "2026-03-04T09:05:00.000Z",
  "scanPath": "/Users/inman/Codes"
} as const;

/**
 * Transform raw projects data to full ProjectsIndex format
 */
function transformProjectsIndex(raw: typeof rawProjectsData): ProjectsIndex {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const projects: Project[] = raw.projects.map(p => {
    const lastCommitDate = p.lastCommitTime ? p.lastCommitTime.split(' ')[0] : null;
    const hasChangesToday = lastCommitDate === today;
    const isDirty = p.status === 'dirty';
    
    // Convert status: "clean" -> "normal", "dirty" -> "dirty", "error" -> "error"
    let normalizedStatus: 'normal' | 'dirty' | 'error' = 'normal';
    const rawStatus = p.status as string;
    if (rawStatus === 'dirty' || rawStatus === 'error') {
      normalizedStatus = rawStatus;
    }
    
    return {
      id: p.name,
      name: p.name,
      path: p.path,
      remote: '',
      branch: p.branch || 'main',
      lastCommitTime: p.lastCommitTime || '',
      lastCommitHash: p.commits?.[0]?.hash || '',
      lastCommitMessage: p.commits?.[0]?.message || '',
      hasChangesToday,
      isDirty,
      status: normalizedStatus,
      error: undefined,
      todayCommitCount: hasChangesToday ? 1 : 0,
      weekCommitCount: 0,
      recentCommits: (p.commits || []).map(c => ({
        hash: c.hash,
        author: c.author,
        date: c.date,
        message: c.message,
        filesChanged: (c as any).filesChanged || 0
      }))
    };
  });
  
  return {
    lastScanTime: raw.lastUpdated || now.toISOString(),
    totalProjects: projects.length,
    projectsWithChangesToday: projects.filter(p => p.hasChangesToday).length,
    dirtyProjects: projects.filter(p => p.isDirty).length,
    errorProjects: projects.filter(p => p.status === 'error').length,
    projects
  };
}

function getEmbeddedProjectsIndex(): ProjectsIndex {
  // Use embedded data with 6 projects (updated from worker/data/projects-index.json)
  return transformProjectsIndex(rawProjectsData);
}

function getEmbeddedSnapshot(date: string): SnapshotData | null {
  // For dates other than 2026-03-04, we'll return null and let the caller handle it
  // The actual data will be loaded from assets at runtime via fetchData
  if (date === '2026-03-04') {
    return {
      "date": "2026-03-04",
      "generatedAt": "2026-03-04T03:47:10.706Z",
      "projects": [
        {
          "name": "ai-middleware",
          "path": "/Users/inman/Codes/gitee/ai-middleware",
          "branch": "master",
          "status": "dirty",
          "lastCommitTime": "2026-03-04 10:44:53 +0800",
          "commits": [
            {"hash": "32bf4f9", "author": "fujianguo", "date": "2026-03-04 10:44:53 +0800", "message": "chat/completions优化&增加session会话管理", "filesChanged": 7},
            {"hash": "1e3933c", "author": "fujianguo", "date": "2026-03-04 09:31:27 +0800", "message": "perf: 为会话日志新增关键查询索引", "filesChanged": 2}
          ],
          "fileChanges": [
            {"status": "M", "file": "pp/api/v1/chat.py"},
            {"status": "M", "file": "app/engine/factory.py"},
            {"status": "M", "file": "app/schemas/chat.py"}
          ]
        }
      ]
    };
  }
  // For other dates, return null - fetchData will try to load from assets
  return null;
}

function getEmbeddedReport(date: string): string {
  if (date === '2026-03-04') {
    return `# 📊 项目日报 - 2026年3月4日 星期二

## 📈 概览

| 指标 | 数量 |
|------|------|
| 总项目数 | 5 |
| 今日有提交 | 1 |
| 总提交数 | 2 |
| 脏工作区 | 4 |
| 干净工作区 | 1 |
| 扫描异常 | 0 |

## 🔥 今日活跃项目

### 🔧 ai-middleware

**路径**: \`/Users/inman/Codes/gitee/ai-middleware\`

**分支**: \`master\` | **状态**: dirty | **今日提交**: 2

**工作区变更** (12 个文件):
- 📝 \`M\` pp/api/v1/chat.py
- 📝 \`M\` app/engine/factory.py
- 📝 \`M\` app/schemas/chat.py

**今日提交** (2):
- \`32bf4f9\` [10:44] chat/completions优化&增加session会话管理
- \`1e3933c\` [09:31] perf: 为会话日志新增关键查询索引

---

## 📦 所有项目

### 🔧 ai-middleware
**路径**: \`/Users/inman/Codes/gitee/ai-middleware\`
**分支**: \`master\` | **状态**: dirty | **今日提交**: 2

### 🔧 code-server
**路径**: \`/Users/inman/Codes/older/code-server\`
**分支**: \`user\` | **状态**: dirty | **今日提交**: 0

### 🔧 go-todo-app
**路径**: \`/Users/inman/Codes/gitee/go-todo-app\`
**分支**: \`main\` | **状态**: dirty | **今日提交**: 0

### 🔧 login-page
**路径**: \`/Users/inman/Codes/github/login-page\`
**分支**: \`main\` | **状态**: dirty | **今日提交**: 0

### ✅ product-showcase
**路径**: \`/Users/inman/Codes/github/product-showcase\`
**分支**: \`main\` | **状态**: clean | **今日提交**: 0

---

*报告生成时间: 2026/3/4 11:48:30*`;
  }
  return `# Report not found for ${date}`;
}
