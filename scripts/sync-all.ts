#!/usr/bin/env tsx
/**
 * Project Monitor 统一同步脚本
 * 
 * 完整流程：
 * 1. 扫描项目并生成快照
 * 2. 从快照生成日报
 * 3. 同步项目数据到 Worker API
 * 4. 同步日报到 Worker API
 * 
 * 用法: npx tsx sync-all.ts [--notify]
 * 
 * 定时任务 (crontab -e):
 *   0 9 * * * cd ~/Codes/project-monitor && npx tsx scripts/sync-all.ts >> ~/logs/project-monitor.log 2>&1
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ Configuration ============

const CONFIG = {
  // Worker API URL
  API_URL: process.env.API_URL || 'https://project-monitor-api.inmanfu.workers.dev',
  // Scan token (set via SCAN_TOKEN env var or read from config)
  SCAN_TOKEN: process.env.SCAN_TOKEN || '',
  // Feishu notification settings
  FEISHU_NOTIFY: process.env.FEISHU_NOTIFY === 'true' || process.argv.includes('--notify'),
  FEISHU_WEBHOOK: process.env.FEISHU_WEBHOOK || '',
  // Scan path
  CODES_DIR: resolve(process.env.HOME!, 'Codes'),
  // Output files
  PROJECTS_INDEX: resolve(__dirname, '../data/projects-index.json'),
  SNAPSHOTS_DIR: resolve(__dirname, '../data/snapshots'),
  REPORTS_DIR: resolve(__dirname, '../reports/daily'),
};

// Load config from file if exists
const CONFIG_FILE = resolve(__dirname, '../config.json');
if (existsSync(CONFIG_FILE)) {
  try {
    const fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    Object.assign(CONFIG, fileConfig);
    console.log('📄 Loaded config from:', CONFIG_FILE);
  } catch (e) {
    console.warn('⚠️  Failed to load config file:', e);
  }
}

// ============ Types ============

interface ProjectInfo {
  name: string;
  path: string;
  remote: string;
  branch: string | null;
  lastCommitTime: string | null;
  lastCommitHash: string | null;
  lastCommitMessage: string | null;
  hasChangesToday: boolean;
  isDirty: boolean;
  status: 'normal' | 'dirty' | 'error';
  error?: string;
  todayCommitCount: number;
  weekCommitCount: number;
  recentCommits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
    filesChanged: number;
  }>;
}

interface ScanResult {
  lastScanTime: string;
  projects: ProjectInfo[];
  scanDuration: number;
  scanPath: string;
}

interface SnapshotProject {
  name: string;
  path: string;
  branch: string | null;
  status: 'clean' | 'dirty' | 'error';
  lastCommitTime: string | null;
  commits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
    filesChanged?: number;
  }>;
  fileChanges: Array<{
    status: string;
    file: string;
  }>;
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
  projects: SnapshotProject[];
}

interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

// ============ Git Helpers ============

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

function getRemoteUrl(dirPath: string): string {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return remote || '';
  } catch {
    return '';
  }
}

function getLastCommit(dirPath: string): { time: string; hash: string; message: string } | null {
  try {
    const log = execSync('git log -1 --format=%ci||%H||%s', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    
    if (!log) return null;
    
    const [time, hash, message] = log.split('||');
    return { time: time.trim(), hash: hash.trim(), message: message.trim() };
  } catch {
    return null;
  }
}

function getWorktreeStatus(dirPath: string): boolean {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

function getTodayCommitCount(dirPath: string): number {
  try {
    const today = new Date().toISOString().split('T')[0];
    const count = execSync(`git log --since="${today} 00:00:00" --oneline`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim().split('\n').filter(Boolean).length;
    return count;
  } catch {
    return 0;
  }
}

function getWeekCommitCount(dirPath: string): number {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const count = execSync(`git log --since="${weekAgo} 00:00:00" --oneline`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim().split('\n').filter(Boolean).length;
    return count;
  } catch {
    return 0;
  }
}

function getRecentCommits(dirPath: string, limit = 5): Array<{ hash: string; author: string; date: string; message: string; filesChanged: number }> {
  try {
    const log = execSync(`git log -${limit} --format=%H||%an||%ci||%s`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    
    if (!log) return [];
    
    return log.split('\n').map(line => {
      const [hash, author, date, message] = line.split('||');
      return {
        hash: hash.trim(),
        author: author.trim(),
        date: date.trim(),
        message: message.trim(),
        filesChanged: 0,
      };
    });
  } catch {
    return [];
  }
}

function getFileChanges(dirPath: string): Array<{ status: string; file: string }> {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    
    if (!status) return [];
    
    return status.split('\n').map(line => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      if (match) {
        return { status: match[1], file: match[2] };
      }
      return { status: '?', file: line.trim() };
    });
  } catch {
    return [];
  }
}

// ============ Step 1: Scan Projects ============

function scanProject(projectPath: string): ProjectInfo | null {
  if (!isGitRepo(projectPath)) {
    return null;
  }

  const projectName = projectPath.split('/').pop()!;
  
  try {
    const branch = getCurrentBranch(projectPath);
    const remote = getRemoteUrl(projectPath);
    const lastCommit = getLastCommit(projectPath);
    const isDirty = getWorktreeStatus(projectPath);
    const todayCommitCount = getTodayCommitCount(projectPath);
    const weekCommitCount = getWeekCommitCount(projectPath);
    const recentCommits = getRecentCommits(projectPath);
    
    const today = new Date().toISOString().split('T')[0];
    const hasChangesToday = lastCommit 
      ? lastCommit.time.split(' ')[0] === today
      : false;

    return {
      name: projectName,
      path: projectPath,
      remote,
      branch,
      lastCommitTime: lastCommit?.time || null,
      lastCommitHash: lastCommit?.hash || null,
      lastCommitMessage: lastCommit?.message || null,
      hasChangesToday,
      isDirty,
      status: isDirty ? 'dirty' : 'normal',
      todayCommitCount,
      weekCommitCount,
      recentCommits,
    };
  } catch (error) {
    return {
      name: projectName,
      path: projectPath,
      remote: '',
      branch: null,
      lastCommitTime: null,
      lastCommitHash: null,
      lastCommitMessage: null,
      hasChangesToday: false,
      isDirty: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      todayCommitCount: 0,
      weekCommitCount: 0,
      recentCommits: [],
    };
  }
}

function scanAllProjects(): ProjectInfo[] {
  console.log(`\n🔍 Step 1: 扫描项目`);
  console.log(`   目录: ${CONFIG.CODES_DIR}`);

  if (!existsSync(CONFIG.CODES_DIR)) {
    console.error(`❌ 目录不存在: ${CONFIG.CODES_DIR}`);
    process.exit(1);
  }

  const projects: ProjectInfo[] = [];

  // Read first-level subdirectories
  const entries = readdirSync(CONFIG.CODES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(CONFIG.CODES_DIR, entry.name));

  console.log(`   发现 ${dirs.length} 个一级目录`);

  // Scan first-level directories
  for (const dir of dirs) {
    const project = scanProject(dir);
    if (project) {
      projects.push(project);
      console.log(`   ✅ ${project.name} (${project.branch || 'no branch'}) - ${project.status}`);
    }

    // Also scan second-level directories
    try {
      const subEntries = readdirSync(dir, { withFileTypes: true });
      const subDirs = subEntries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => join(dir, entry.name));

      for (const subDir of subDirs) {
        const subProject = scanProject(subDir);
        if (subProject) {
          projects.push(subProject);
          console.log(`     ✅ ${subProject.name} (${subProject.branch || 'no branch'}) - ${subProject.status}`);
        }
      }
    } catch {
      // Ignore inaccessible directories
    }
  }

  // Sort by name
  projects.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`   📊 扫描完成: ${projects.length} 个 Git 项目`);
  
  return projects;
}

// ============ Step 2: Generate Snapshot ============

function generateSnapshot(projects: ProjectInfo[]): Snapshot {
  console.log(`\n📸 Step 2: 生成快照`);
  
  const today = new Date().toISOString().split('T')[0];
  const snapshot: Snapshot = {
    date: today,
    generatedAt: new Date().toISOString(),
    projects: projects.map(project => {
      const fileChanges = getFileChanges(project.path);
      
      return {
        name: project.name,
        path: project.path,
        branch: project.branch,
        status: project.status === 'error' ? 'error' : project.isDirty ? 'dirty' : 'clean',
        lastCommitTime: project.lastCommitTime,
        commits: project.recentCommits.map(c => ({
          hash: c.hash,
          author: c.author,
          date: c.date,
          message: c.message,
          filesChanged: c.filesChanged,
        })),
        fileChanges,
        stats: {
          commitsToday: project.todayCommitCount,
          filesModified: fileChanges.filter(f => f.status === 'M').length,
          filesAdded: fileChanges.filter(f => f.status === 'A' || f.status === '?').length,
          filesDeleted: fileChanges.filter(f => f.status === 'D').length,
        },
        error: project.error,
      };
    }),
  };
  
  // Save snapshot
  if (!existsSync(CONFIG.SNAPSHOTS_DIR)) {
    execSync(`mkdir -p ${CONFIG.SNAPSHOTS_DIR}`);
  }
  
  const snapshotPath = join(CONFIG.SNAPSHOTS_DIR, `${today}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`   ✅ 快照已保存: ${snapshotPath}`);
  
  return snapshot;
}

// ============ Step 3: Generate Report ============

function generateReport(snapshot: Snapshot): string {
  console.log(`\n📝 Step 3: 生成日报`);
  
  const today = snapshot.date;
  
  // Statistics
  const totalProjects = snapshot.projects.length;
  const activeProjects = snapshot.projects.filter(p => p.stats.commitsToday > 0).length;
  const dirtyProjects = snapshot.projects.filter(p => p.status === 'dirty').length;
  const cleanProjects = snapshot.projects.filter(p => p.status === 'clean').length;
  const errorProjects = snapshot.projects.filter(p => p.status === 'error').length;
  const totalCommitsToday = snapshot.projects.reduce((sum, p) => sum + p.stats.commitsToday, 0);

  // Generate Markdown
  let markdown = `# 📊 项目日报 - ${formatDateCN(today)}\n\n`;
  
  // Overview
  markdown += `## 📈 概览\n\n`;
  markdown += `| 指标 | 数量 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总项目数 | ${totalProjects} |\n`;
  markdown += `| 今日有提交 | ${activeProjects} |\n`;
  markdown += `| 总提交数 | ${totalCommitsToday} |\n`;
  markdown += `| 脏工作区 | ${dirtyProjects} |\n`;
  markdown += `| 干净工作区 | ${cleanProjects} |\n`;
  markdown += `| 扫描异常 | ${errorProjects} |\n\n`;
  
  // Active projects
  if (activeProjects > 0) {
    markdown += `## 🔥 今日活跃项目\n\n`;
    const active = snapshot.projects.filter(p => p.stats.commitsToday > 0);
    active.forEach(project => {
      markdown += generateProjectSection(project);
    });
  }
  
  // All projects
  markdown += `## 📦 所有项目\n\n`;
  snapshot.projects.forEach(project => {
    markdown += generateProjectSection(project);
  });
  
  // Footer
  markdown += `\n---\n\n`;
  markdown += `*报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*\n`;
  
  // Save report
  if (!existsSync(CONFIG.REPORTS_DIR)) {
    execSync(`mkdir -p ${CONFIG.REPORTS_DIR}`);
  }
  
  const reportPath = join(CONFIG.REPORTS_DIR, `${today}.md`);
  writeFileSync(reportPath, markdown, 'utf-8');
  console.log(`   ✅ 日报已保存: ${reportPath}`);
  
  return markdown;
}

function formatDateCN(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[date.getDay()];
  
  return `${year}年${month}月${day}日 星期${weekday}`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'clean':
      return '✅';
    case 'dirty':
      return '🔧';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

function getFileChangeIcon(status: string): string {
  switch (status) {
    case 'A':
      return '➕';
    case 'M':
      return '📝';
    case 'D':
      return '🗑️';
    case 'R':
      return '🔄';
    case '?':
      return '❓';
    default:
      return '📄';
  }
}

function generateProjectSection(project: SnapshotProject): string {
  const icon = getStatusIcon(project.status);
  const branch = project.branch || 'N/A';
  const todayCommits = project.stats.commitsToday;
  
  let section = `### ${icon} ${project.name}\n\n`;
  section += `**路径**: \`${project.path}\`\n\n`;
  section += `**分支**: \`${branch}\` | **状态**: ${project.status} | **今日提交**: ${todayCommits}\n\n`;
  
  // File changes
  if (project.fileChanges.length > 0) {
    section += `**工作区变更** (${project.fileChanges.length} 个文件):\n`;
    project.fileChanges.slice(0, 10).forEach(change => {
      const changeIcon = getFileChangeIcon(change.status);
      section += `- ${changeIcon} \`${change.status}\` ${change.file}\n`;
    });
    if (project.fileChanges.length > 10) {
      section += `- ... 还有 ${project.fileChanges.length - 10} 个文件\n`;
    }
    section += '\n';
  }
  
  // Today's commits
  if (todayCommits > 0) {
    const todayCommitsList = project.commits.filter(c => {
      const commitDate = c.date.split(' ')[0];
      const today = new Date().toISOString().split('T')[0];
      return commitDate === today;
    });
    
    section += `**今日提交** (${todayCommits}):\n`;
    todayCommitsList.forEach(commit => {
      const time = commit.date.split(' ')[1].split(':').slice(0, 2).join(':');
      section += `- \`${commit.hash}\` [${time}] ${commit.message}\n`;
    });
    section += '\n';
  }
  
  // Recent commits (if no today commits)
  if (todayCommits === 0 && project.commits.length > 0) {
    section += `**最近提交**:\n`;
    project.commits.slice(0, 3).forEach(commit => {
      const date = commit.date.split(' ')[0];
      const time = commit.date.split(' ')[1].split(':').slice(0, 2).join(':');
      section += `- \`${commit.hash}\` [${date} ${time}] ${commit.message}\n`;
    });
    section += '\n';
  }
  
  // Error
  if (project.error) {
    section += `**错误**: ${project.error}\n\n`;
  }
  
  section += '---\n\n';
  return section;
}

// ============ Step 4: Sync to Worker API ============

async function syncToWorker(projects: ProjectInfo[], report: string): Promise<SyncResult> {
  console.log(`\n📤 Step 4: 同步到 Worker API`);
  console.log(`   API: ${CONFIG.API_URL}`);
  
  const today = new Date().toISOString().split('T')[0];
  
  // Sync scan data
  console.log(`   📡 同步项目数据...`);
  const scanData = {
    lastScanTime: new Date().toISOString(),
    projects: projects.map(p => ({
      id: p.name,
      name: p.name,
      path: p.path,
      branch: p.branch || 'main',
      status: p.status,
      lastCommitTime: p.lastCommitTime,
      commits: p.recentCommits,
      fileChanges: [],
    })),
    scanDuration: 0,
    scanPath: CONFIG.CODES_DIR,
  };
  
  try {
    const scanResponse = await fetch(`${CONFIG.API_URL}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SCAN_TOKEN}`,
      },
      body: JSON.stringify(scanData),
    });
    
    if (!scanResponse.ok) {
      const error = await scanResponse.text();
      throw new Error(`Failed to sync scan data: ${scanResponse.status} ${error}`);
    }
    
    const scanResult = await scanResponse.json();
    console.log(`   ✅ 项目数据同步成功 (${projects.length} 个项目)`);
    
    if (scanResult.alertsGenerated > 0) {
      console.log(`   ⚠️  产生 ${scanResult.alertsGenerated} 个新告警`);
    }
  } catch (error) {
    console.error(`   ❌ 项目数据同步失败:`, error);
    return {
      success: false,
      message: 'Failed to sync scan data',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // Sync report
  console.log(`   📄 同步日报...`);
  try {
    const reportResponse = await fetch(`${CONFIG.API_URL}/api/reports/${today}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Authorization': `Bearer ${CONFIG.SCAN_TOKEN}`,
      },
      body: report,
    });
    
    if (!reportResponse.ok) {
      const error = await reportResponse.text();
      throw new Error(`Failed to sync report: ${reportResponse.status} ${error}`);
    }
    
    const reportResult = await reportResponse.json();
    console.log(`   ✅ 日报同步成功 (${report.length} bytes)`);
  } catch (error) {
    console.error(`   ❌ 日报同步失败:`, error);
    return {
      success: false,
      message: 'Failed to sync report',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  return {
    success: true,
    message: 'Sync completed successfully',
  };
}

// ============ Feishu Notification ============

async function sendFeishuNotification(projects: ProjectInfo[]): Promise<void> {
  if (!CONFIG.FEISHU_NOTIFY) {
    console.log('\nℹ️  飞书通知未启用');
    return;
  }

  if (!CONFIG.FEISHU_WEBHOOK) {
    console.warn('\n⚠️  飞书 Webhook 未配置');
    return;
  }

  console.log('\n📢 发送飞书通知...');

  const dirtyProjects = projects.filter(p => p.isDirty);
  const activeProjects = projects.filter(p => p.todayCommitCount > 0);

  const payload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `📊 Project Monitor 日报`,
        },
        template: 'blue',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**扫描时间**: ${new Date().toLocaleString('zh-CN')}\n**总项目数**: ${projects.length}\n**今日活跃**: ${activeProjects.length}\n**脏工作区**: ${dirtyProjects.length}`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '查看详情',
              },
              type: 'primary',
              url: 'https://d9751dc6.project-monitor.pages.dev/',
            },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(CONFIG.FEISHU_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Feishu webhook failed: ${response.status}`);
    }

    console.log('✅ 飞书通知发送成功');
  } catch (error) {
    console.error('❌ 飞书通知发送失败:', error);
  }
}

// ============ Main ============

async function main() {
  console.log('🚀 Project Monitor 统一同步脚本 v1.0.0');
  console.log('='.repeat(60));
  console.log(`📡 API URL: ${CONFIG.API_URL}`);
  console.log(`📁 Scan Path: ${CONFIG.CODES_DIR}`);
  console.log(`🔔 Feishu Notify: ${CONFIG.FEISHU_NOTIFY}`);
  console.log('='.repeat(60));

  // Check token
  if (!CONFIG.SCAN_TOKEN) {
    console.error('❌ SCAN_TOKEN 未配置');
    console.log('   设置方式: export SCAN_TOKEN=your_token');
    console.log('   或在 config.json 中配置');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Step 1: Scan projects
    const projects = scanAllProjects();
    
    // Step 2: Generate snapshot
    const snapshot = generateSnapshot(projects);
    
    // Step 3: Generate report
    const report = generateReport(snapshot);
    
    // Step 4: Sync to Worker API
    const syncResult = await syncToWorker(projects, report);
    
    if (!syncResult.success) {
      console.error('\n❌ 同步失败:', syncResult.error);
      process.exit(1);
    }
    
    // Send Feishu notification
    await sendFeishuNotification(projects);
    
    const duration = Date.now() - startTime;
    console.log('\n' + '='.repeat(60));
    console.log(`✨ 完成！总耗时: ${duration}ms`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ 执行失败:', error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
