#!/usr/bin/env tsx
/**
 * 基于快照生成日报 Markdown
 * 输出到 reports/daily/YYYY-MM-DD.md
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface Commit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface FileChange {
  status: string;
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

const SNAPSHOTS_DIR = resolve(process.cwd(), 'data/snapshots');
const REPORTS_DIR = resolve(process.cwd(), 'reports/daily');

/**
 * 格式化日期为中文
 */
function formatDateCN(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[date.getDay()];
  
  return `${year}年${month}月${day}日 星期${weekday}`;
}

/**
 * 生成状态图标
 */
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

/**
 * 生成文件变更图标
 */
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

/**
 * 生成项目报告部分
 */
function generateProjectSection(project: ProjectSnapshot): string {
  const icon = getStatusIcon(project.status);
  const branch = project.branch || 'N/A';
  const todayCommits = project.stats.commitsToday;
  
  let section = `### ${icon} ${project.name}\n\n`;
  section += `**路径**: \`${project.path}\`\n\n`;
  section += `**分支**: \`${branch}\` | **状态**: ${project.status} | **今日提交**: ${todayCommits}\n\n`;
  
  // 文件变更
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
  
  // 今日提交
  if (todayCommits > 0) {
    const todayCommitsList = project.commits.filter(c => {
      const commitDate = new Date(c.date).toISOString().split('T')[0];
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
  
  // 最近提交（如果没有今日提交，显示最近3条）
  if (todayCommits === 0 && project.commits.length > 0) {
    section += `**最近提交**:\n`;
    project.commits.slice(0, 3).forEach(commit => {
      const date = commit.date.split(' ')[0];
      const time = commit.date.split(' ')[1].split(':').slice(0, 2).join(':');
      section += `- \`${commit.hash}\` [${date} ${time}] ${commit.message}\n`;
    });
    section += '\n';
  }
  
  // 错误信息
  if (project.error) {
    section += `**错误**: ${project.error}\n\n`;
  }
  
  section += '---\n\n';
  return section;
}

/**
 * 生成完整报告
 */
function generateReport(): void {
  console.log('📝 开始生成日报...');

  // 获取今日快照
  const today = new Date().toISOString().split('T')[0];
  const snapshotFile = resolve(SNAPSHOTS_DIR, `${today}.json`);

  if (!existsSync(snapshotFile)) {
    console.error('❌ 今日快照不存在，请先运行 generate-snapshot.ts');
    process.exit(1);
  }

  const snapshot: Snapshot = JSON.parse(
    readFileSync(snapshotFile, 'utf-8')
  );

  console.log(`📊 读取快照: ${snapshotFile}`);
  console.log(`   日期: ${snapshot.date}`);
  console.log(`   项目数: ${snapshot.projects.length}`);

  // 统计数据
  const totalProjects = snapshot.projects.length;
  const activeProjects = snapshot.projects.filter(p => p.stats.commitsToday > 0).length;
  const dirtyProjects = snapshot.projects.filter(p => p.status === 'dirty').length;
  const cleanProjects = snapshot.projects.filter(p => p.status === 'clean').length;
  const errorProjects = snapshot.projects.filter(p => p.status === 'error').length;
  const totalCommitsToday = snapshot.projects.reduce((sum, p) => sum + p.stats.commitsToday, 0);

  // 生成 Markdown
  let markdown = `# 📊 项目日报 - ${formatDateCN(snapshot.date)}\n\n`;
  
  // 概览
  markdown += `## 📈 概览\n\n`;
  markdown += `| 指标 | 数量 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 总项目数 | ${totalProjects} |\n`;
  markdown += `| 今日有提交 | ${activeProjects} |\n`;
  markdown += `| 总提交数 | ${totalCommitsToday} |\n`;
  markdown += `| 脏工作区 | ${dirtyProjects} |\n`;
  markdown += `| 干净工作区 | ${cleanProjects} |\n`;
  markdown += `| 扫描异常 | ${errorProjects} |\n\n`;
  
  // 活跃项目
  if (activeProjects > 0) {
    markdown += `## 🔥 今日活跃项目\n\n`;
    const active = snapshot.projects.filter(p => p.stats.commitsToday > 0);
    active.forEach(project => {
      markdown += generateProjectSection(project);
    });
  }
  
  // 所有项目详情
  markdown += `## 📦 所有项目\n\n`;
  snapshot.projects.forEach(project => {
    markdown += generateProjectSection(project);
  });
  
  // 页脚
  markdown += `\n---\n\n`;
  markdown += `*报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*\n`;

  // 写入文件
  const outputFile = resolve(REPORTS_DIR, `${today}.md`);
  writeFileSync(outputFile, markdown, 'utf-8');

  console.log(`\n✅ 日报已生成: ${outputFile}`);
  console.log(`📊 统计:`);
  console.log(`   - 总项目数: ${totalProjects}`);
  console.log(`   - 今日活跃: ${activeProjects}`);
  console.log(`   - 总提交数: ${totalCommitsToday}`);
  console.log(`   - 脏工作区: ${dirtyProjects}`);
}

// 执行
generateReport();
