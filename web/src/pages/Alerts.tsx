import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Alert } from '../types';
import { acknowledgeAlert, dismissAlert, fetchAlerts } from '../services/api';

// 自动刷新间隔（60秒）
const AUTO_REFRESH_INTERVAL = 60000;

// 格式化刷新时间
function formatRefreshTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'acknowledged' | 'ignored'>('all');
  const [filterType, setFilterType] = useState<'all' | 'uncommitted' | 'inactive'>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
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

  const loadAlerts = useCallback(async () => {
    // 网络断开时不发起请求
    if (!navigator.onLine) {
      setError('网络已断开，请检查网络连接');
      return;
    }
    
    try {
      setLoading(true);
      const result = await fetchAlerts();
      setAlerts(result.alerts || []);
      setError(null);
      setLastRefreshTime(new Date());
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError(navigator.onLine ? '加载告警失败' : '网络已断开，请检查网络连接');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // 自动刷新机制
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        loadAlerts();
      }
    }, AUTO_REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [loadAlerts]);

  // Extract unique project names from alerts for filtering
  const projectNames = [...new Set(alerts.map(a => a.projectName))];

  const handleStatusChange = async (id: string, newStatus: 'active' | 'acknowledged' | 'ignored') => {
    // Call API based on the new status
    try {
      if (newStatus === 'acknowledged') {
        await acknowledgeAlert(id);
      } else if (newStatus === 'ignored') {
        await dismissAlert(id);
      }
      
      // Update local state after API call succeeds
      setAlerts(prev => prev.map(alert => 
        alert.id === id ? { ...alert, status: newStatus } : alert
      ));
    } catch (error) {
      console.error('Failed to update alert status:', error);
      alert('操作失败，请重试');
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    const typeMatch = filterType === 'all' || alert.type === filterType;
    const projectMatch = filterProject === 'all' || alert.projectName === filterProject;
    return statusMatch && typeMatch && projectMatch;
  });

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'uncommitted': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '活跃';
      case 'acknowledged': return '已确认';
      case 'ignored': return '已忽略';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'uncommitted': return '未提交';
      case 'inactive': return '长期无活动';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={loadAlerts} 
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 离线提示横幅 */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
          <span className="text-sm text-yellow-800">网络已断开，显示可能不是最新数据</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">告警中心</h1>
          {lastRefreshTime && (
            <p className="text-sm text-gray-500 mt-1">
              最后刷新: {formatRefreshTime(lastRefreshTime)}
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* 自动刷新状态指示 */}
          <span className="text-xs text-gray-500">
            自动刷新中
          </span>
          
          <button
            onClick={loadAlerts}
            disabled={loading || !isOnline}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isOnline ? '网络已断开' : '手动刷新'}
          >
            <svg className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="all">所有状态</option>
            <option value="active">活跃</option>
            <option value="acknowledged">已确认</option>
            <option value="ignored">已忽略</option>
          </select>

          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="all">所有类型</option>
            <option value="uncommitted">未提交</option>
            <option value="inactive">长期无活动</option>
          </select>

          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="all">所有项目</option>
            {projectNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <li key={alert.id} className={`${alert.status === 'active' ? 'bg-red-50/30' : ''} hover:bg-gray-50 transition-colors`}>
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeStyle(alert.type)}`}>
                        {getTypeLabel(alert.type)}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{alert.projectName}</span>
                      {alert.severity === 'critical' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          严重
                        </span>
                      )}
                      {alert.severity === 'warning' && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                          警告
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-gray-500">{formatDate(alert.timestamp || alert.createdAt || '')}</time>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <p className="text-sm text-gray-600 mb-4">{alert.message}</p>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          alert.status === 'active' ? 'bg-red-50 text-red-600' : 
                          alert.status === 'acknowledged' ? 'bg-blue-50 text-blue-600' : 
                          'bg-gray-100 text-gray-400 line-through'
                        }`}>
                          {getStatusLabel(alert.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center space-x-2">
                      {alert.status === 'active' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(alert.id, 'acknowledged')}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                          >
                            确认
                          </button>
                          <button
                            onClick={() => handleStatusChange(alert.id, 'ignored')}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                          >
                            忽略
                          </button>
                        </>
                      )}
                      {alert.status === 'acknowledged' && (
                        <button
                          onClick={() => handleStatusChange(alert.id, 'ignored')}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          忽略
                        </button>
                      )}
                      {alert.status === 'ignored' && (
                        <button
                          onClick={() => handleStatusChange(alert.id, 'acknowledged')}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-600 bg-white hover:bg-gray-50"
                        >
                          重新确认
                        </button>
                      )}
                      <Link
                        to={`/project/${encodeURIComponent(alert.projectName)}`}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        查看项目
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))
          ) : (
            <li className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500">没有符合条件的告警</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
