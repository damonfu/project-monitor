#!/usr/bin/env tsx
/**
 * 为每个项目生成当日快照
 * 输出到 data/snapshots/YYYY-MM-DD.json
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface FileChange {
  status: 'A' | 'M' | 'D' | 'R' | '?' | string;
  file: string;
}

interface ProjectSnapshot {
  name: string;
  path: string;
  branch: string | null;
  status: 'clean' | 'dirty' | 'error';
  lastCommitTime: string | null;
  commits: Commit[];
  fileChanges: FileChange[];
  stats: {
    commitsToday: number;
    filesModified: number;
    filesAdded: number;
    filesDeleted: number;
  };
  error?: string;
}

interface Snapshot {
  date: string;
  generatedAt: string;
  projects: ProjectSnapshot[];
}

const PROJECTS_INDEX_FILE = resolve(process.cwd(), 'data/projects-index.json');
const SNAPSHOTS_DIR = resolve(process.cwd(), 'data/snapshots');

/**
 * 获取今日提交（从当天00:00开始）
 */
function getTodayCommits(dirPath: string): Commit[] {
  try {
    // 获取今天的日期（YYYY-MM-DD）
    const today = new Date().toISOString().split('T')[0];
    const since = `${today} 00:00:00`;
    
    const log = execSync(
      `git log --since="${since}" --pretty=format:"%H|%an|%ai|%s"`,
      {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      }
    ).trim();

    if (!log) return [];

    return log.split('\n').map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      return {
        hash: hash.substring(0, 7), // 短哈希
        author,
        date,
        message: messageParts.join('|'),
      };
    });
  } catch (error) {
    return [];
  }
}

/**
 * 获取最近N条提交
 */
function getRecentCommits(dirPath: string, count: number = 10): Commit[] {
  try {
    const log = execSync(
      `git log -${count} --pretty=format:"%H|%an|%ai|%s"`,
      {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }
    ).trim();

    if (!log) return [];

    return log.split('\n').map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      return {
        hash: hash.substring(0, 7),
        author,
        date,
        message: messageParts.join('|'),
      };
    });
  } catch (error) {
    return [];
  }
}

/**
 * 获取文件变更状态
 */
function getFileChanges(dirPath: string): FileChange[] {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();

    if (!status) return [];

    return status.split('\n').map(line => {
      const statusChar = line.substring(0, 2).trim();
      const file = line.substring(3);
      return {
        status: statusChar || '?',
        file,
      };
    });
  } catch (error) {
    return [];
  }
}

/**
 * 获取今日文件变更统计（从今天00:00开始）
 */
function getTodayFileStats(dirPath: string): { added: number; modified: number; deleted: number } {
  try {
    const today = new Date().toISOString().split('T')[0];
    const since = `${today} 00:00:00`;
    
    // 获取今天的提交
    const log = execSync(
      `git log --since="${since}" --pretty=format:"%H"`,
      {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8',
      }
    ).trim();

    if (!log) {
      return { added: 0, modified: 0, deleted: 0 };
    }

    const commits = log.split('\n');
    let added = 0;
    let modified = 0;
    let deleted = 0;

    // 统计每个提交的文件变更
    for (const commit of commits) {
      if (!commit) continue;
      
      try {
        const diff = execSync(
          `git show --stat --pretty=format: ${commit}`,
          {
            cwd: dirPath,
            stdio: 'pipe',
            encoding: 'utf-8',
          }
        ).trim();

        if (!diff) continue;

        // 解析统计信息
        const lines = diff.split('\n');
        for (const line of lines) {
          if (line.includes('insertion') || line.includes('deletion')) {
            // 简化统计：只计算修改的文件数
            const match = line.match(/(\d+) files? changed/);
            if (match) {
              modified += parseInt(match[1]);
            }
          }
        }
      } catch {
        // 忽略单个提交的错误
      }
    }

    return { added, modified, deleted };
  } catch (error) {
    return { added: 0, modified: 0, deleted: 0 };
  }
}

/**
 * 为单个项目生成快照
 */
function snapshotProject(project: any): ProjectSnapshot {
  const { name, path, branch, status, lastCommitTime } = project;

  try {
    const commits = getRecentCommits(path, 10);
    const todayCommits = getTodayCommits(path);
    const fileChanges = getFileChanges(path);
    const fileStats = getTodayFileStats(path);

    return {
      name,
      path,
      branch,
      status,
      lastCommitTime,
      commits,
      fileChanges,
      stats: {
        commitsToday: todayCommits.length,
        filesModified: fileStats.modified,
        filesAdded: fileStats.added,
        filesDeleted: fileStats.deleted,
      },
    };
  } catch (error) {
    return {
      name,
      path,
      branch,
      status: 'error',
      lastCommitTime,
      commits: [],
      fileChanges: [],
      stats: {
        commitsToday: 0,
        filesModified: 0,
        filesAdded: 0,
        filesDeleted: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 生成快照
 */
function generateSnapshot(): void {
  console.log('📸 开始生成项目快照...');

  // 读取项目索引
  if (!existsSync(PROJECTS_INDEX_FILE)) {
    console.error('❌ 项目索引文件不存在，请先运行 scan-projects.ts');
    process.exit(1);
  }

  const projectsIndex = JSON.parse(
    readFileSync(PROJECTS_INDEX_FILE, 'utf-8')
  );

  console.log(`📊 找到 ${projectsIndex.projects.length} 个项目`);

  // 生成快照
  const snapshots: ProjectSnapshot[] = [];
  
  for (const project of projectsIndex.projects) {
    console.log(`  📦 正在快照: ${project.name}`);
    const snapshot = snapshotProject(project);
    snapshots.push(snapshot);
    
    const todayCommits = snapshot.stats.commitsToday;
    const statusIcon = snapshot.status === 'clean' ? '✅' : snapshot.status === 'dirty' ? '🔧' : '❌';
    console.log(`    ${statusIcon} ${snapshot.status} | ${todayCommits} commits today`);
  }

  // 生成输出
  const today = new Date().toISOString().split('T')[0];
  const snapshot: Snapshot = {
    date: today,
    generatedAt: new Date().toISOString(),
    projects: snapshots,
  };

  // 写入文件
  const outputFile = resolve(SNAPSHOTS_DIR, `${today}.json`);
  writeFileSync(outputFile, JSON.stringify(snapshot, null, 2), 'utf-8');

  console.log(`\n✅ 快照已生成: ${outputFile}`);
  console.log(`📊 统计:`);
  console.log(`   - 总项目数: ${snapshots.length}`);
  console.log(`   - 今日有提交: ${snapshots.filter(s => s.stats.commitsToday > 0).length}`);
  console.log(`   - 脏工作区: ${snapshots.filter(s => s.status === 'dirty').length}`);
}

// 执行
generateSnapshot();
