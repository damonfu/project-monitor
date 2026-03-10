#!/usr/bin/env tsx
/**
 * 同步本地日报到 Worker API
 * 
 * 用法: npx tsx sync-reports-to-worker.ts [--date YYYY-MM-DD] [--token YOUR_TOKEN]
 * 
 * 选项:
 *   --date   指定要同步的日期（默认：今天）
 *   --token  API token（或设置 SCAN_TOKEN 环境变量）
 *   --all    同步所有日报（而不仅仅是今天）
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';

const WORKER_URL = process.env.WORKER_URL || 'https://project-monitor-api.inmanfu.workers.dev';
const SCAN_TOKEN = process.env.SCAN_TOKEN;

const REPORTS_DIR = resolve(process.cwd(), 'reports/daily');

interface SyncResult {
  date: string;
  success: boolean;
  size?: number;
  error?: string;
}

/**
 * 验证日期格式 (YYYY-MM-DD)
 */
function isValidDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * 获取所有可用的日报日期
 */
function getAvailableReports(): string[] {
  if (!existsSync(REPORTS_DIR)) {
    return [];
  }
  
  const files = readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => basename(f, '.md'))
    .filter(date => isValidDate(date))
    .sort((a, b) => b.localeCompare(a)); // 降序排列
  
  return files;
}

/**
 * 同步单个日报到 Worker API
 */
async function syncReport(date: string, token?: string): Promise<SyncResult> {
  const reportPath = resolve(REPORTS_DIR, `${date}.md`);
  
  if (!existsSync(reportPath)) {
    return {
      date,
      success: false,
      error: `Report file not found: ${reportPath}`,
    };
  }
  
  const content = readFileSync(reportPath, 'utf-8');
  
  if (!content || content.trim().length === 0) {
    return {
      date,
      success: false,
      error: 'Report file is empty',
    };
  }
  
  console.log(`📄 同步日报: ${date}`);
  console.log(`   文件: ${reportPath}`);
  console.log(`   大小: ${content.length} bytes`);
  
  const headers: Record<string, string> = {
    'Content-Type': 'text/markdown; charset=utf-8',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(`${WORKER_URL}/api/reports/${date}`, {
      method: 'POST',
      headers,
      body: content,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return {
        date,
        success: false,
        error: result.message || `HTTP ${response.status}`,
      };
    }
    
    return {
      date,
      success: true,
      size: content.length,
    };
  } catch (error) {
    return {
      date,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始同步日报到 Worker API...\n');
  console.log(`📡 Worker URL: ${WORKER_URL}`);
  console.log(`📂 日报目录: ${REPORTS_DIR}\n`);
  
  // 解析命令行参数
  const args = process.argv.slice(2);
  let targetDate: string | undefined;
  let syncAll = false;
  let token: string | undefined = SCAN_TOKEN;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--date' && args[i + 1]) {
      targetDate = args[i + 1];
      i++;
    } else if (arg === '--token' && args[i + 1]) {
      token = args[i + 1];
      i++;
    } else if (arg === '--all') {
      syncAll = true;
    }
  }
  
  // 确定要同步的日期
  let datesToSync: string[];
  
  if (targetDate) {
    // 同步指定日期
    if (!isValidDate(targetDate)) {
      console.error(`❌ 无效的日期格式: ${targetDate}`);
      console.error('   日期格式应为: YYYY-MM-DD');
      process.exit(1);
    }
    datesToSync = [targetDate];
  } else if (syncAll) {
    // 同步所有日报
    datesToSync = getAvailableReports();
    if (datesToSync.length === 0) {
      console.log('ℹ️  没有找到任何日报文件');
      process.exit(0);
    }
    console.log(`📋 找到 ${datesToSync.length} 个日报文件\n`);
  } else {
    // 默认：同步今天的日报
    targetDate = new Date().toISOString().split('T')[0];
    datesToSync = [targetDate];
  }
  
  // 同步日报
  const results: SyncResult[] = [];
  
  for (const date of datesToSync) {
    const result = await syncReport(date, token);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${date} 同步成功 (${result.size} bytes)\n`);
    } else {
      console.error(`❌ ${date} 同步失败: ${result.error}\n`);
    }
    
    // 避免请求过快
    if (datesToSync.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // 汇总结果
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('━'.repeat(50));
  console.log('📊 同步结果汇总:\n');
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${failCount}`);
  console.log(`   📄 总计: ${results.length}`);
  
  if (failCount > 0) {
    console.log('\n❌ 失败的日报:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.date}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log('\n🎉 所有日报同步成功！');
}

// 执行
main().catch(error => {
  console.error('❌ 同步失败:', error);
  process.exit(1);
});
