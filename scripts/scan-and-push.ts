/**
 * Project Monitor Scanner
 * 
 * 扫描 ~/Codes 目录下的 Git 项目，推送到 Worker API，并发送飞书通知
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
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
  // Output file (for debugging)
  OUTPUT_FILE: resolve(__dirname, '../data/projects-index.json'),
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
    // 先获取最近 limit 条 commit
    const log = execSync(`git log -${limit} --format=%H||%an||%ci||%s`, {
      cwd: dirPath,
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim();
    
    if (!log) return [];
    
    let commits = log.split('\n').map(line => {
      const [hash, author, date, message] = line.split('||');
      const filesChanged = getFilesChanged(dirPath, hash.trim());
      return {
        hash: hash.trim().substring(0, 7), // 短 hash
        author: author.trim(),
        date: date.trim(),
        message: message.trim(),
        filesChanged,
      };
    });
    
    // 检查最近 1 天的 commit 数量
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const commitsInLastDay = commits.filter(c => {
      const commitDate = new Date(c.date);
      return commitDate >= oneDayAgo;
    });
    
    // 如果最近 1 天有 commit 且大于 limit 条，获取全部（最近 1 天内的）
    if (commitsInLastDay.length > 0) {
      // 检查最近 1 天的 commit 总数是否大于 limit
      const sinceDate = oneDayAgo.toISOString().split('T')[0];
      const countOutput = execSync(`git log --since="${sinceDate}" --oneline | wc -l`, {
        cwd: dirPath,
        stdio: 'pipe',
        encoding: 'utf-8'
      }).trim();
      
      const totalCountInLastDay = parseInt(countOutput, 10);
      
      if (totalCountInLastDay > limit) {
        // 重新获取：最近 1 天内的所有 commit
        const allLogsInDay = execSync(`git log --since="${sinceDate}" --format=%H||%an||%ci||%s`, {
          cwd: dirPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        }).trim();
        
        if (allLogsInDay) {
          commits = allLogsInDay.split('\n').map(line => {
            const [hash, author, date, message] = line.split('||');
            const filesChanged = getFilesChanged(dirPath, hash.trim());
            return {
              hash: hash.trim().substring(0, 7),
              author: author.trim(),
              date: date.trim(),
              message: message.trim(),
              filesChanged,
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

// ============ Scanner ============

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

function scanAllProjects(): ScanResult {
  console.log(`🔍 开始扫描目录: ${CONFIG.CODES_DIR}`);
  
  const startTime = Date.now();
  const projects: ProjectInfo[] = [];

  if (!existsSync(CONFIG.CODES_DIR)) {
    console.error(`❌ 目录不存在: ${CONFIG.CODES_DIR}`);
    process.exit(1);
  }

  // Read first-level subdirectories
  const entries = readdirSync(CONFIG.CODES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => join(CONFIG.CODES_DIR, entry.name));

  console.log(`📁 发现 ${dirs.length} 个一级目录`);

  // Scan first-level directories
  for (const dir of dirs) {
    const project = scanProject(dir);
    if (project) {
      projects.push(project);
      console.log(`  ✅ ${project.name} (${project.branch || 'no branch'}) - ${project.status}`);
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
          console.log(`    ✅ ${subProject.name} (${subProject.branch || 'no branch'}) - ${subProject.status}`);
        }
      }
    } catch {
      // Ignore inaccessible directories
    }
  }

  // Sort by name
  projects.sort((a, b) => a.name.localeCompare(b.name));

  const scanDuration = Date.now() - startTime;
  console.log(`\n📊 扫描完成: ${projects.length} 个 Git 项目 (耗时: ${scanDuration}ms)`);

  // Write to output file for debugging
  const result: ScanResult = {
    lastScanTime: new Date().toISOString(),
    projects,
    scanDuration,
    scanPath: CONFIG.CODES_DIR,
  };

  writeFileSync(CONFIG.OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`💾 已保存到: ${CONFIG.OUTPUT_FILE}`);

  return result;
}

// ============ API Client ============

async function pushScanData(scanResult: ScanResult): Promise<any> {
  console.log(`\n📤 推送扫描数据到: ${CONFIG.API_URL}/api/scan`);
  
  const response = await fetch(`${CONFIG.API_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.SCAN_TOKEN}`,
    },
    body: JSON.stringify(scanResult),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to push scan data: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log('✅ 扫描数据推送成功');
  
  if (data.alertsGenerated > 0) {
    console.log(`⚠️  产生 ${data.alertsGenerated} 个新告警`);
  }
  
  return data;
}

async function getActiveAlerts(): Promise<any[]> {
  console.log(`\n📥 获取活跃告警...`);
  
  const response = await fetch(`${CONFIG.API_URL}/api/alerts/active`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.SCAN_TOKEN}`,
    },
  });

  if (!response.ok) {
    console.warn('⚠️  获取告警失败:', response.status);
    return [];
  }

  const data = await response.json();
  return data.alerts || [];
}

// ============ Feishu Notification ============

async function sendFeishuNotification(alerts: any[]): Promise<void> {
  if (!CONFIG.FEISHU_NOTIFY) {
    console.log('ℹ️  飞书通知未启用');
    return;
  }

  if (!CONFIG.FEISHU_WEBHOOK) {
    console.warn('⚠️  飞书 Webhook 未配置');
    return;
  }

  console.log(`\n📢 发送飞书通知 (${alerts.length} 个活跃告警)`);

  // Build message card
  const cards = alerts.map(alert => ({
    tag: 'div',
    text: `⚠️ **${alert.severity.toUpperCase()}** - ${alert.message}`,
  }));

  const payload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `🚨 Project Monitor 告警 (${alerts.length})`,
        },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**活跃告警数**: ${alerts.length}\n**扫描时间**: ${new Date().toLocaleString('zh-CN')}`,
          },
        },
        ...cards.slice(0, 5).map(card => ({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: card.text.content,
          },
        })),
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
              url: 'https://d9751dc6.project-monitor.pages.dev/alerts',
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
  console.log('🚀 Project Monitor Scanner v2.0.0');
  console.log('='.repeat(50));
  console.log(`📡 API URL: ${CONFIG.API_URL}`);
  console.log(`📁 Scan Path: ${CONFIG.CODES_DIR}`);
  console.log(`🔔 Feishu Notify: ${CONFIG.FEISHU_NOTIFY}`);
  console.log('='.repeat(50));

  // Check API URL and token
  if (!CONFIG.SCAN_TOKEN) {
    console.error('❌ SCAN_TOKEN 未配置');
    console.log('   设置方式: export SCAN_TOKEN=your_token');
    console.log('   或在 config.json 中配置');
    process.exit(1);
  }

  // Scan projects
  const scanResult = scanAllProjects();

  // Push to API
  try {
    const result = await pushScanData(scanResult);
    
    // Get active alerts and send notification
    if (CONFIG.FEISHU_NOTIFY && result.alertsGenerated > 0) {
      const alerts = await getActiveAlerts();
      await sendFeishuNotification(alerts);
    }
  } catch (error) {
    console.error('❌ 推送失败:', error);
    process.exit(1);
  }

  console.log('\n✨ 完成!');
}

// Run
main().catch(console.error);
