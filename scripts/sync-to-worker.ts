/**
 * 同步本地扫描数据到 Worker
 * 
 * 用法: npx tsx sync-to-worker.ts [--token YOUR_TOKEN]
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WORKER_URL = process.env.WORKER_URL || 'https://project-monitor-api.inmanfu.workers.dev';
const SCAN_TOKEN = process.env.SCAN_TOKEN;

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
}

interface Project {
  id: string;
  name: string;
  path: string;
  remote?: string;
  branch: string;
  lastCommitTime?: string;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  hasChangesToday?: boolean;
  isDirty?: boolean;
  status: string;
  todayCommitCount?: number;
  weekCommitCount?: number;
  recentCommits?: Commit[];
  error?: string;
}

interface ScanData {
  lastScanTime: string;
  projects: Project[];
  scanDuration?: number;
  scanPath: string;
}

async function syncToWorker() {
  console.log('🚀 开始同步数据到 Worker...\n');
  
  // 读取本地扫描数据
  const projectsIndexPath = resolve(__dirname, 'data/projects-index.json');
  const snapshotPath = resolve(__dirname, 'data/snapshots', `${new Date().toISOString().split('T')[0]}.json`);
  
  if (!existsSync(projectsIndexPath)) {
    console.error('❌ 项目索引文件不存在，请先运行 scan-projects.ts');
    process.exit(1);
  }
  
  // 读取项目索引
  const projectsIndex = JSON.parse(readFileSync(projectsIndexPath, 'utf-8'));
  console.log(`📂 读取到 ${projectsIndex.projects.length} 个项目`);
  
  // 读取今日快照（如果有）
  let snapshotProjects: Map<string, any> = new Map();
  if (existsSync(snapshotPath)) {
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
    for (const project of snapshot.projects || []) {
      snapshotProjects.set(project.name, project);
    }
    console.log(`📸 读取到 ${snapshotProjects.size} 个项目快照`);
  }
  
  // 合并项目数据
  const projects: Project[] = projectsIndex.projects.map((p: any) => {
    return {
      id: p.name,
      name: p.name,
      path: p.path,
      remote: p.remote || '',
      branch: p.branch || 'main',
      lastCommitTime: p.lastCommitTime || '',
      lastCommitHash: p.recentCommits?.[0]?.hash || '',
      lastCommitMessage: p.recentCommits?.[0]?.message || '',
      hasChangesToday: p.hasChangesToday || false,
      isDirty: p.status === 'dirty',
      status: p.status === 'dirty' ? 'dirty' : p.status === 'error' ? 'error' : 'normal',
      todayCommitCount: p.todayCommitCount || 0,
      weekCommitCount: p.weekCommitCount || 0,
      recentCommits: p.recentCommits || [],
      error: p.error,
    };
  });
  
  // 构建扫描数据
  const scanData: ScanData = {
    lastScanTime: new Date().toISOString(),
    projects,
    scanPath: projectsIndex.scanPath || '~/Codes',
  };
  
  console.log(`\n📤 发送数据到: ${WORKER_URL}/api/scan`);
  
  // 发送到 Worker
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (SCAN_TOKEN) {
    headers['Authorization'] = `Bearer ${SCAN_TOKEN}`;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/api/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify(scanData),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ 同步失败:', result);
      process.exit(1);
    }
    
    console.log('\n✅ 同步成功！');
    console.log(`   - 扫描时间: ${result.scanTime}`);
    console.log(`   - 项目数量: ${result.projectCount}`);
    console.log(`   - 新告警数: ${result.newAlertsCount}`);
    console.log(`   - 活跃告警: ${result.activeAlertsCount}`);
    
    if (result.newAlerts && result.newAlerts.length > 0) {
      console.log('\n🔔 新生成的告警:');
      for (const alert of result.newAlerts) {
        console.log(`   - [${alert.severity}] ${alert.projectName}: ${alert.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 同步失败:', error);
    process.exit(1);
  }
}

// 执行同步
syncToWorker();
