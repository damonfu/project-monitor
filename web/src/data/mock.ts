import type { ProjectsIndex, DailyReport, Project, Alert } from '../types';

export const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'error',
    projectId: 'claude-code-tools',
    projectName: 'claude-code-tools',
    message: 'Git repository not found at path: /Users/inman/Codes/claude-code-tools',
    timestamp: '2026-03-04T10:00:00Z',
    status: 'new'
  },
  {
    id: '2',
    type: 'warning',
    projectId: 'ai-middleware',
    projectName: 'ai-middleware',
    message: 'Repository is dirty with uncommitted changes for 2 days.',
    timestamp: '2026-03-04T09:30:00Z',
    status: 'new'
  },
  {
    id: '3',
    type: 'info',
    projectId: 'project-monitor',
    projectName: 'project-monitor',
    message: 'New project "project-monitor" has been added to tracking.',
    timestamp: '2026-03-04T08:00:00Z',
    status: 'read'
  },
  {
    id: '4',
    type: 'error',
    projectId: 'go-todo-app',
    projectName: 'go-todo-app',
    message: 'Authentication failed for remote repository.',
    timestamp: '2026-03-03T15:20:00Z',
    status: 'dismissed'
  },
  {
    id: '5',
    type: 'warning',
    projectId: 'data-processor',
    projectName: 'data-processor',
    message: 'Unusually large commit (6 files changed, 2000+ lines).',
    timestamp: '2026-03-03T20:30:00Z',
    status: 'read'
  }
];

const mockProjects: Project[] = [
  {
    id: 'ai-middleware',
    name: 'ai-middleware',
    path: '/Users/inman/Codes/ai-middleware',
    remote: 'https://github.com/inman/ai-middleware.git',
    branch: 'main',
    lastCommitTime: '2026-03-04T10:30:00Z',
    lastCommitHash: 'a1b2c3d',
    lastCommitMessage: 'feat: add OpenAI API integration',
    hasChangesToday: true,
    isDirty: true,
    status: 'dirty',
    todayCommitCount: 3,
    weekCommitCount: 12,
    recentCommits: [
      { hash: 'a1b2c3d', author: 'inman', date: '2026-03-04T10:30:00Z', message: 'feat: add OpenAI API integration', filesChanged: 5 },
      { hash: 'e4f5g6h', author: 'inman', date: '2026-03-04T09:15:00Z', message: 'fix: resolve authentication issue', filesChanged: 2 },
      { hash: 'i7j8k9l', author: 'inman', date: '2026-03-03T16:45:00Z', message: 'refactor: optimize middleware pipeline', filesChanged: 8 },
    ],
    ciInfo: {
      status: 'success',
      lastRunTime: '2026-03-04T10:35:00Z',
      lastRunHash: 'a1b2c3d'
    }
  },
  {
    id: 'go-todo-app',
    name: 'go-todo-app',
    path: '/Users/inman/Codes/go-todo-app',
    remote: 'https://github.com/inman/go-todo-app.git',
    branch: 'develop',
    lastCommitTime: '2026-03-04T08:20:00Z',
    lastCommitHash: 'm0n1o2p',
    lastCommitMessage: 'feat: add todo priority sorting',
    hasChangesToday: true,
    isDirty: false,
    status: 'normal',
    todayCommitCount: 1,
    weekCommitCount: 7,
    recentCommits: [
      { hash: 'm0n1o2p', author: 'inman', date: '2026-03-04T08:20:00Z', message: 'feat: add todo priority sorting', filesChanged: 3 },
      { hash: 'q3r4s5t', author: 'inman', date: '2026-03-03T14:30:00Z', message: 'fix: database connection pool', filesChanged: 1 },
    ],
    ciInfo: {
      status: 'failure',
      lastRunTime: '2026-03-04T08:25:00Z',
      lastRunHash: 'm0n1o2p'
    }
  },
  {
    id: 'product-showcase',
    name: 'product-showcase',
    path: '/Users/inman/Codes/product-showcase',
    remote: 'https://github.com/inman/product-showcase.git',
    branch: 'main',
    lastCommitTime: '2026-03-02T18:00:00Z',
    lastCommitHash: 'u6v7w8x',
    lastCommitMessage: 'chore: update dependencies',
    hasChangesToday: false,
    isDirty: false,
    status: 'normal',
    todayCommitCount: 0,
    weekCommitCount: 4,
    recentCommits: [
      { hash: 'u6v7w8x', author: 'inman', date: '2026-03-02T18:00:00Z', message: 'chore: update dependencies', filesChanged: 12 },
    ],
    ciInfo: {
      status: 'none',
      lastRunTime: '',
      lastRunHash: ''
    }
  },
  {
    id: 'project-monitor',
    name: 'project-monitor',
    path: '/Users/inman/Codes/project-monitor',
    remote: 'https://github.com/inman/project-monitor.git',
    branch: 'main',
    lastCommitTime: '2026-03-04T11:00:00Z',
    lastCommitHash: 'y9z0a1b',
    lastCommitMessage: 'feat: add daily report generation',
    hasChangesToday: true,
    isDirty: true,
    status: 'dirty',
    todayCommitCount: 5,
    weekCommitCount: 15,
    recentCommits: [
      { hash: 'y9z0a1b', author: 'inman', date: '2026-03-04T11:00:00Z', message: 'feat: add daily report generation', filesChanged: 10 },
      { hash: 'c2d3e4f', author: 'inman', date: '2026-03-04T10:00:00Z', message: 'feat: add project scanning', filesChanged: 8 },
      { hash: 'g5h6i7j', author: 'inman', date: '2026-03-04T09:00:00Z', message: 'feat: initial commit', filesChanged: 15 },
    ],
    ciInfo: {
      status: 'running',
      lastRunTime: '2026-03-04T11:05:00Z',
      lastRunHash: 'y9z0a1b'
    }
  },
  {
    id: 'claude-code-tools',
    name: 'claude-code-tools',
    path: '/Users/inman/Codes/claude-code-tools',
    remote: '',
    branch: 'main',
    lastCommitTime: '2026-02-28T12:00:00Z',
    lastCommitHash: 'k8l9m0n',
    lastCommitMessage: 'fix: resolve CLI output parsing',
    hasChangesToday: false,
    isDirty: false,
    status: 'error',
    error: 'Git repository not found',
    todayCommitCount: 0,
    weekCommitCount: 2,
    recentCommits: []
  },
  {
    id: 'data-processor',
    name: 'data-processor',
    path: '/Users/inman/Codes/data-processor',
    remote: 'https://github.com/inman/data-processor.git',
    branch: 'feature/async',
    lastCommitTime: '2026-03-03T20:30:00Z',
    lastCommitHash: 'o1p2q3r',
    lastCommitMessage: 'feat: add async data processing',
    hasChangesToday: false,
    isDirty: true,
    status: 'dirty',
    todayCommitCount: 0,
    weekCommitCount: 9,
    recentCommits: [
      { hash: 'o1p2q3r', author: 'inman', date: '2026-03-03T20:30:00Z', message: 'feat: add async data processing', filesChanged: 6 },
    ],
    ciInfo: {
      status: 'success',
      lastRunTime: '2026-03-03T20:40:00Z',
      lastRunHash: 'o1p2q3r'
    }
  }
];

export const mockProjectsIndex: ProjectsIndex = {
  lastScanTime: '2026-03-04T11:40:00Z',
  totalProjects: 6,
  projectsWithChangesToday: 3,
  dirtyProjects: 3,
  errorProjects: 1,
  projects: mockProjects
};

export const mockDailyReports: DailyReport[] = [
  {
    date: '2026-03-04',
    totalProjects: 3,
    totalCommits: 9,
    projects: [
      {
        name: 'ai-middleware',
        path: '/Users/inman/Codes/ai-middleware',
        commits: [
          { hash: 'a1b2c3d', author: 'inman', date: '2026-03-04T10:30:00Z', message: 'feat: add OpenAI API integration', filesChanged: 5 },
          { hash: 'e4f5g6h', author: 'inman', date: '2026-03-04T09:15:00Z', message: 'fix: resolve authentication issue', filesChanged: 2 },
        ],
        filesAdded: 3,
        filesModified: 4,
        filesDeleted: 1,
        changes: [
          { type: 'added', path: 'src/openai.ts' },
          { type: 'added', path: 'src/types.ts' },
          { type: 'added', path: 'tests/openai.test.ts' },
          { type: 'modified', path: 'src/index.ts' },
          { type: 'modified', path: 'package.json' },
          { type: 'modified', path: 'src/auth.ts' },
          { type: 'modified', path: 'src/config.ts' },
          { type: 'deleted', path: 'src/old-api.ts' },
        ]
      },
      {
        name: 'project-monitor',
        path: '/Users/inman/Codes/project-monitor',
        commits: [
          { hash: 'y9z0a1b', author: 'inman', date: '2026-03-04T11:00:00Z', message: 'feat: add daily report generation', filesChanged: 10 },
        ],
        filesAdded: 8,
        filesModified: 2,
        filesDeleted: 0,
        changes: [
          { type: 'added', path: 'src/types/index.ts' },
          { type: 'added', path: 'src/data/mock.ts' },
          { type: 'added', path: 'src/pages/ProjectList.tsx' },
          { type: 'added', path: 'src/pages/ProjectDetail.tsx' },
          { type: 'added', path: 'src/pages/Reports.tsx' },
          { type: 'added', path: 'src/pages/ReportDetail.tsx' },
          { type: 'added', path: 'src/components/StatCard.tsx' },
          { type: 'added', path: 'src/components/Navbar.tsx' },
          { type: 'modified', path: 'src/App.tsx' },
          { type: 'modified', path: 'package.json' },
        ]
      },
      {
        name: 'go-todo-app',
        path: '/Users/inman/Codes/go-todo-app',
        commits: [
          { hash: 'm0n1o2p', author: 'inman', date: '2026-03-04T08:20:00Z', message: 'feat: add todo priority sorting', filesChanged: 3 },
        ],
        filesAdded: 1,
        filesModified: 2,
        filesDeleted: 0,
        changes: [
          { type: 'added', path: 'internal/model/priority.go' },
          { type: 'modified', path: 'internal/handler/todo.go' },
          { type: 'modified', path: 'internal/service/todo.go' },
        ]
      }
    ]
  },
  {
    date: '2026-03-03',
    totalProjects: 4,
    totalCommits: 14,
    projects: [
      {
        name: 'ai-middleware',
        path: '/Users/inman/Codes/ai-middleware',
        commits: [
          { hash: 'i7j8k9l', author: 'inman', date: '2026-03-03T16:45:00Z', message: 'refactor: optimize middleware pipeline', filesChanged: 8 },
        ],
        filesAdded: 2,
        filesModified: 6,
        filesDeleted: 0,
        changes: []
      },
      {
        name: 'go-todo-app',
        path: '/Users/inman/Codes/go-todo-app',
        commits: [
          { hash: 'q3r4s5t', author: 'inman', date: '2026-03-03T14:30:00Z', message: 'fix: database connection pool', filesChanged: 1 },
        ],
        filesAdded: 0,
        filesModified: 1,
        filesDeleted: 0,
        changes: []
      },
      {
        name: 'data-processor',
        path: '/Users/inman/Codes/data-processor',
        commits: [
          { hash: 'o1p2q3r', author: 'inman', date: '2026-03-03T20:30:00Z', message: 'feat: add async data processing', filesChanged: 6 },
        ],
        filesAdded: 4,
        filesModified: 2,
        filesDeleted: 0,
        changes: []
      },
      {
        name: 'product-showcase',
        path: '/Users/inman/Codes/product-showcase',
        commits: [
          { hash: 'u6v7w8x', author: 'inman', date: '2026-03-02T18:00:00Z', message: 'chore: update dependencies', filesChanged: 12 },
        ],
        filesAdded: 0,
        filesModified: 12,
        filesDeleted: 0,
        changes: []
      }
    ]
  },
  {
    date: '2026-03-02',
    totalProjects: 2,
    totalCommits: 6,
    projects: []
  },
  {
    date: '2026-03-01',
    totalProjects: 3,
    totalCommits: 8,
    projects: []
  }
];

export const mockReportMarkdown = `# 项目日报 - 2026-03-04

## 概览

- **涉及项目数**: 3
- **提交总数**: 9

---

## ai-middleware

**路径**: \`~/Codes/ai-middleware\`  
**分支**: main

### 提交记录 (2)

| 时间 | Hash | 提交信息 | 文件数 |
|------|------|----------|--------|
| 10:30 | \`a1b2c3d\` | feat: add OpenAI API integration | 5 |
| 09:15 | \`e4f5g6h\` | fix: resolve authentication issue | 2 |

### 文件变更

- **新增** (3): \`src/openai.ts\`, \`src/types.ts\`, \`tests/openai.test.ts\`
- **修改** (4): \`src/index.ts\`, \`package.json\`, \`src/auth.ts\`, \`src/config.ts\`
- **删除** (1): \`src/old-api.ts\`

---

## project-monitor

**路径**: \`~/Codes/project-monitor\`  
**分支**: main

### 提交记录 (1)

| 时间 | Hash | 提交信息 | 文件数 |
|------|------|----------|--------|
| 11:00 | \`y9z0a1b\` | feat: add daily report generation | 10 |

### 文件变更

- **新增** (8): \`src/types/index.ts\`, \`src/data/mock.ts\`, \`src/pages/ProjectList.tsx\`, \`src/pages/ProjectDetail.tsx\`, \`src/pages/Reports.tsx\`, \`src/pages/ReportDetail.tsx\`, \`src/components/StatCard.tsx\`, \`src/components/Navbar.tsx\`
- **修改** (2): \`src/App.tsx\`, \`package.json\`

---

## go-todo-app

**路径**: \`~/Codes/go-todo-app\`  
**分支**: develop

### 提交记录 (1)

| 时间 | Hash | 提交信息 | 文件数 |
|------|------|----------|--------|
| 08:20 | \`m0n1o2p\` | feat: add todo priority sorting | 3 |

### 文件变更

- **新增** (1): \`internal/model/priority.go\`
- **修改** (2): \`internal/handler/todo.go\`, \`internal/service/todo.go\`

---
*Generated at 2026-03-04 11:40:00 CST*
`;
