import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects } from '../services/api';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import type { Project, ProjectsIndex } from '../types';

type GroupBy = 'recent' | 'status';

// 自动刷新间隔（60秒）
const AUTO_REFRESH_INTERVAL = 60000;

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return date.toLocaleDateString('zh-CN');
}

// 格式化时间为 HH:MM:SS
function formatRefreshTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

export function ProjectList() {
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [groupBy, setGroupBy] = useState<GroupBy>('recent');
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('project-monitor-favorites');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [data, setData] = useState<ProjectsIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // 检测网络状态
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setError('网络已断开，请检查网络连接');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    // 网络断开时不发起请求
    if (!navigator.onLine) {
      setError('网络已断开，请检查网络连接');
      return;
    }
    
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const result = await fetchProjects();
      setData(result);
      setLastRefreshTime(new Date());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '加载数据失败';
      setError(navigator.onLine ? errorMsg : '网络已断开，请检查网络连接');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 初始加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 自动刷新机制
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (navigator.onLine && !refreshing) {
        loadData(true);
      }
    }, AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [loadData, refreshing]);

  useEffect(() => {
    localStorage.setItem('project-monitor-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('project-monitor-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleRefresh = () => {
    loadData(true);
  };

  const groupedProjects = useMemo(() => {
    if (!data) return [];

    const allProjects = [...data.projects];
    const favProjects = allProjects.filter(p => favorites.includes(p.id));
    const otherProjects = allProjects.filter(p => !favorites.includes(p.id));

    // Sort helper
    const sortByRecent = (a: Project, b: Project) => 
      new Date(b.lastCommitTime).getTime() - new Date(a.lastCommitTime).getTime();

    // Initial sort for non-favorites (always sort by recent)
    otherProjects.sort(sortByRecent);

    const groups: { title: string; projects: Project[] }[] = [];

    // Always put favorites at the top if they exist
    if (favProjects.length > 0) {
      groups.push({
        title: '已收藏',
        projects: favProjects.sort(sortByRecent)
      });
    }

    if (groupBy === 'status') {
      const statusOrder: Project['status'][] = ['error', 'dirty', 'normal'];
      const statusMap: Record<Project['status'], string> = {
        error: '异常项目',
        dirty: '未提交改动',
        normal: '运行正常'
      };

      statusOrder.forEach(status => {
        const projects = otherProjects.filter(p => p.status === status);
        if (projects.length > 0) {
          groups.push({ title: statusMap[status], projects });
        }
      });
    } else {
      // Recent grouping (default)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterday = today - 86400000;
      const thisWeek = today - 86400000 * 7;

      const timeGroups = [
        { title: '今天', filter: (p: Project) => new Date(p.lastCommitTime).getTime() >= today },
        { title: '昨天', filter: (p: Project) => {
          const time = new Date(p.lastCommitTime).getTime();
          return time >= yesterday && time < today;
        }},
        { title: '本周', filter: (p: Project) => {
          const time = new Date(p.lastCommitTime).getTime();
          return time >= thisWeek && time < yesterday;
        }},
        { title: '更早以前', filter: (p: Project) => new Date(p.lastCommitTime).getTime() < thisWeek },
      ];

      timeGroups.forEach(group => {
        const projects = otherProjects.filter(group.filter);
        if (projects.length > 0) {
          groups.push({ title: group.title, projects });
        }
      });
    }

    return groups;
  }, [data, favorites, groupBy]);

  const renderFavoriteButton = (project: Project) => {
    const isFav = favorites.includes(project.id);
    return (
      <button
        onClick={(e) => toggleFavorite(e, project.id)}
        className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-300'}`}
        title={isFav ? "取消收藏" : "收藏项目"}
      >
        <svg className="w-5 h-5" fill={isFav ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    );
  };

  const renderProjectCard = (project: Project) => (
    <Link
      key={project.id}
      to={`/project/${encodeURIComponent(project.name)}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 sm:p-6 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
            {renderFavoriteButton(project)}
          </div>
          <p className="text-sm text-gray-500 truncate mt-1">{project.path}</p>
          <div className="flex items-center mt-3 space-x-4 text-sm text-gray-600">
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {project.branch}
            </span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(project.lastCommitTime)}
            </span>
          </div>
        </div>
        <div className="ml-4">
          <StatusBadge status={project.status} />
        </div>
      </div>
      {project.lastCommitMessage && (
        <p className="mt-3 text-sm text-gray-600 line-clamp-2">{project.lastCommitMessage}</p>
      )}
      {project.error && (
        <p className="mt-2 text-sm text-red-600">{project.error}</p>
      )}
    </Link>
  );

  const renderProjectTableRow = (project: Project) => (
    <tr key={project.id} className="hover:bg-gray-50">
      <td className="px-4 py-3 sm:px-6">
        <div className="flex items-center space-x-2">
          {renderFavoriteButton(project)}
          <Link to={`/project/${encodeURIComponent(project.name)}`} className="font-medium text-gray-900 hover:text-blue-600">
            {project.name}
          </Link>
        </div>
      </td>
      <td className="px-4 py-3 sm:px-6 text-gray-600 hidden md:table-cell">{project.branch}</td>
      <td className="px-4 py-3 sm:px-6 text-gray-600 hidden lg:table-cell">{formatTime(project.lastCommitTime)}</td>
      <td className="px-4 py-3 sm:px-6">
        <StatusBadge status={project.status} />
      </td>
    </tr>
  );

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 离线提示横幅 */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm text-yellow-800">网络已断开，显示可能不是最新数据</span>
        </div>
      )}

      {/* 顶部区域 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">项目总览</h1>
              <p className="text-sm text-gray-500 mt-1">
                {lastRefreshTime ? (
                  <>最后刷新: {formatRefreshTime(lastRefreshTime)} · 扫描时间: {new Date(data.lastScanTime).toLocaleString('zh-CN')}</>
                ) : (
                  <>最近更新: {new Date(data.lastScanTime).toLocaleString('zh-CN')}</>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {/* 自动刷新状态指示 */}
              <span className="text-xs text-gray-500 hidden sm:inline">
                自动刷新中
              </span>
              <button
                onClick={handleRefresh}
                disabled={refreshing || !isOnline}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isOnline ? '网络已断开' : '手动刷新数据'}
              >
                <svg className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? '刷新中...' : '刷新'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="项目总数"
            value={data.totalProjects}
            color="blue"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <StatCard
            title="今日有改动"
            value={data.projectsWithChangesToday}
            color="green"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            }
          />
          <StatCard
            title="脏工作区"
            value={data.dirtyProjects}
            color="yellow"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <StatCard
            title="扫描异常"
            value={data.errorProjects}
            color="red"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* 项目列表控制区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">项目列表</h2>
            <div className="flex bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setGroupBy('recent')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${groupBy === 'recent' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                最近
              </button>
              <button
                onClick={() => setGroupBy('status')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${groupBy === 'status' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                状态
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md ${viewMode === 'card' ? 'bg-white shadow-sm text-blue-600 border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600 border border-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 项目列表渲染 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="space-y-8">
          {groupedProjects.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                {group.title}
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                  {group.projects.length}
                </span>
              </h3>
              
              {viewMode === 'card' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.projects.map(renderProjectCard)}
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">项目名</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 hidden md:table-cell">分支</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 hidden lg:table-cell">最近提交</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6">状态</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {group.projects.map(renderProjectTableRow)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {groupedProjects.length === 0 && (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">未找到相关项目</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
