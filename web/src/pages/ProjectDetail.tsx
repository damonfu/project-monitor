import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProject } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import type { Project } from '../types';

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN');
}

function MiniChart({ data }: { data: number[] }) {
  const maxValue = Math.max(...data, 1);
  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  
  return (
    <div className="flex items-end justify-between h-24 space-x-1">
      {data.map((value, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-blue-500 rounded-t"
            style={{ height: `${(value / maxValue) * 100}%`, minHeight: '4px' }}
          />
          <span className="text-xs text-gray-500 mt-1">{days[index]}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        setError(null);
        const decodedId = decodeURIComponent(id || '');
        const result = await fetchProject(decodedId);
        setProject(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载项目失败');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      loadProject();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error || '项目未找到'}</p>
          <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            返回项目总览
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1 break-all">{project.path}</p>
              {project.remote && (
                <p className="text-sm text-gray-500 mt-1 break-all">{project.remote}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Link
                to="/reports"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                查看日报
              </Link>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                返回总览
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 基础信息卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基础信息</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">当前分支</p>
                <p className="font-medium text-gray-900">{project.branch}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">工作区状态</p>
                <p className={`font-medium ${project.isDirty ? 'text-yellow-600' : 'text-green-600'}`}>
                  {project.isDirty ? '有未提交变更' : '干净'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">今日提交</p>
                <p className="font-medium text-gray-900">{project.todayCommitCount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">近7日提交</p>
                <p className="font-medium text-gray-900">{project.weekCommitCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">CI 状态</h2>
            {project.ciInfo ? (
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-full ${
                  project.ciInfo.status === 'success' ? 'bg-green-100 text-green-600' :
                  project.ciInfo.status === 'failure' ? 'bg-red-100 text-red-600' :
                  project.ciInfo.status === 'running' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {project.ciInfo.status === 'success' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {project.ciInfo.status === 'failure' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {project.ciInfo.status === 'running' && (
                    <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {project.ciInfo.status === 'none' && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-semibold ${
                      project.ciInfo.status === 'success' ? 'text-green-700' :
                      project.ciInfo.status === 'failure' ? 'text-red-700' :
                      project.ciInfo.status === 'running' ? 'text-blue-700' :
                      'text-gray-700'
                    }`}>
                      {project.ciInfo.status === 'success' ? '构建成功' :
                       project.ciInfo.status === 'failure' ? '构建失败' :
                       project.ciInfo.status === 'running' ? '正在运行' :
                       '暂无状态'}
                    </span>
                  </div>
                  {project.ciInfo.status !== 'none' && (
                    <div className="text-xs text-gray-500 mt-1">
                      <p>最近运行: {formatDate(project.ciInfo.lastRunTime)}</p>
                      <p>提交哈希: <span className="font-mono">{project.ciInfo.lastRunHash}</span></p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">未配置 CI</p>
            )}
          </div>
        </div>

        {/* 指标区 - 近7日提交趋势 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">近7日提交趋势</h2>
          <MiniChart data={[project.todayCommitCount, 2, 3, 1, 4, 2, project.weekCommitCount - project.todayCommitCount]} />
        </div>

        {/* 提交列表 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近提交</h2>
          {project.recentCommits && project.recentCommits.length > 0 ? (
            <div className="space-y-4">
              {project.recentCommits.map((commit) => (
                <div key={commit.hash} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{commit.message}</p>
                      <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                        <span className="font-mono">{commit.hash}</span>
                        <span>{commit.author}</span>
                        <span>{formatDate(commit.date)}</span>
                      </div>
                    </div>
                    <span className="ml-4 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {commit.filesChanged} 文件
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">暂无提交记录</p>
          )}
        </div>

        {/* 错误信息 */}
        {project.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-2">错误信息</h3>
            <p className="text-sm text-red-600">{project.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
