#!/usr/bin/env tsx
/**
 * 扫描 ~/Codes 目录下的所有 Git 项目
 * 输出到 data/projects-index.json
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
}

interface ProjectInfo {
  name: string;
  path: string;
  branch: string | null;
  lastCommitTime: string | null;
  status: 'clean' | 'dirty' | 'error';
  statusMessage?: string;
  recentCommits: Commit[];
}

interface ProjectsIndex {
  projects: ProjectInfo[];
  lastUpdated: string;
  scanPath: string;
}

const CODES_DIR = resolve(process.env.HOME!, 'Codes');
const OUTPUT_FILE = resolve(process.cwd(), 'data/projects-index.json');

/**
 * 检测目录是否为 Git 仓库
 */
function isGitRepo(dirPath: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { 
      cwd: dirPath, 
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取当前分支名
 */
function getCurrentBranch(dirPath: string): string | null {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * 获取最近提交时间
 */
function getLastCommitTime(dirPath: string): string | null {
  try {
    const log = execSync('git log -1 --format=%ci', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return log || null;
  } catch {
    return null;
  }
}

/**
 * 获取最近提交列表
 * 逻辑：
 * - 默认获取最近 5 条 commit
 * - 检查最近 1 天是否有 commit
 * - 如果最近 1 天有 commit 且大于 5 条，则获取全部（最近 1 天内的）
 */
function getRecentCommits(dirPath: string): Commit[] {
  try {
    // 先获取最近 5 条 commit
    const logFormat = '%H|%an|%ci|%s';
    const recentLogs = execSync(`git log -5 --format="${logFormat}"`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();

    if (!recentLogs) {
      return [];
    }

    // 解析 commit 信息
    let commits = recentLogs.split('\n').map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      const message = messageParts.join('|'); // message 可能包含 |
      const filesChanged = getFilesChanged(dirPath, hash);
      return {
        hash: hash.substring(0, 7), // 短 hash
        author,
        date,
        message,
        filesChanged
      };
    });

    // 检查最近 1 天的 commit 数量
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const commitsInLastDay = commits.filter(c => {
      const commitDate = new Date(c.date);
      return commitDate >= oneDayAgo;
    });

    // 如果最近 1 天有 commit 且大于 5 条，获取全部（最近 1 天内的）
    if (commitsInLastDay.length > 0) {
      // 检查最近 1 天的 commit 总数是否大于 5
      const sinceDate = oneDayAgo.toISOString().split('T')[0];
      const countOutput = execSync(`git log --since="${sinceDate}" --oneline | wc -l`, {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8'
      }).trim();
      
      const totalCountInLastDay = parseInt(countOutput, 10);
      
      if (totalCountInLastDay > 5) {
        // 重新获取：最近 1 天内的所有 commit
        const logFormat = '%H|%an|%ci|%s';
        const allLogsInDay = execSync(`git log --since="${sinceDate}" --format="${logFormat}"`, {
          cwd: dirPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        }).trim();

        if (allLogsInDay) {
          commits = allLogsInDay.split('\n').map(line => {
            const [hash, author, date, ...messageParts] = line.split('|');
            const message = messageParts.join('|');
            const filesChanged = getFilesChanged(dirPath, hash);
            return {
              hash: hash.substring(0, 7),
              author,
              date,
              message,
              filesChanged
            };
          });
        }
      }
    }

    return commits;
  } catch {
    return [];
  }
}

/**
 * 获取指定 commit 修改的文件数量
 */
function getFilesChanged(dirPath: string, hash: string): number {
  try {
    const files = execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return files ? files.split('\n').length : 0;
  } catch {
    return 0;
  }
}

/**
 * 获取工作区状态
 */
function getWorktreeStatus(dirPath: string): 'clean' | 'dirty' {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return status.length > 0 ? 'dirty' : 'clean';
  } catch {
    return 'dirty';
  }
}

/**
 * 扫描单个项目
 */
function scanProject(projectPath: string): ProjectInfo | null {
  if (!isGitRepo(projectPath)) {
    return null;
  }

  const projectName = projectPath.split('/').pop()!;
  
  try {
    const branch = getCurrentBranch(projectPath);
    const lastCommitTime = getLastCommitTime(projectPath);
    const worktreeStatus = getWorktreeStatus(projectPath);
    const recentCommits = getRecentCommits(projectPath);

    return {
      name: projectName,
      path: projectPath,
      branch,
      lastCommitTime,
      status: worktreeStatus,
      recentCommits,
    };
  } catch (error) {
    return {
      name: projectName,
      path: projectPath,
      branch: null,
      lastCommitTime: null,
      status: 'error',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
      recentCommits: [],
    };
  }
}

/**
 * 扫描所有项目
 */
function scanAllProjects(): ProjectsIndex {
  console.log(`🔍 开始扫描目录: ${CODES_DIR}`);
  
  const projects: ProjectInfo[] = [];
  const errors: string[] = [];

  if (!existsSync(CODES_DIR)) {
    console.error(`❌ 目录不存在: ${CODES_DIR}`);
    process.exit(1);
  }

  // 读取一级子目录
  const entries = readdirSync(CODES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(CODES_DIR, entry.name));

  console.log(`📁 发现 ${dirs.length} 个一级目录`);

  // 扫描一级目录
  for (const dir of dirs) {
    const project = scanProject(dir);
    if (project) {
      projects.push(project);
      console.log(`  ✅ ${project.name} (${project.branch || 'no branch'}) - ${project.status}`);
    }

    // 也扫描二级目录（如果存在）
    try {
      const subEntries = readdirSync(dir, { withFileTypes: true });
      const subDirs = subEntries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => join(dir, entry.name));

      for (const subDir of subDirs) {
        const subProject = scanProject(subDir);
        if (subProject) {
          projects.push(subProject);
          console.log(`    ✅ ${subProject.name} (${subProject.branch || 'no branch'}) - ${subProject.status}`);
        }
      }
    } catch {
      // 忽略无权限访问的目录
    }
  }

  console.log(`\n📊 扫描完成: ${projects.length} 个 Git 项目`);

  // 按项目名排序
  projects.sort((a, b) => a.name.localeCompare(b.name));

  const index: ProjectsIndex = {
    projects,
    lastUpdated: new Date().toISOString(),
    scanPath: CODES_DIR,
  };

  // 写入文件
  writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`\n💾 已保存到: ${OUTPUT_FILE}`);

  return index;
}

// 执行扫描
scanAllProjects();
