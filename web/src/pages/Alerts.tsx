import { useState, useEffect } from 'react';
import type { Alert, AlertStatus, AlertType } from '../types';
import { acknowledgeAlert, dismissAlert, reactivateAlert, fetchAlerts } from '../services/api';

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AlertStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const result = await fetchAlerts();
      setAlerts(result.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError('加载告警失败');
    } finally {
      setLoading(false);
    }
  };

  // Extract unique project names from alerts for filtering
  const projectNames = [...new Set(alerts.map(a => a.projectName))];

  const handleStatusChange = async (id: string, newStatus: AlertStatus | string) => {
    // Call API based on the new status
    try {
      if (newStatus === 'read') {
        await acknowledgeAlert(id);
      } else if (newStatus === 'dismissed') {
        await dismissAlert(id);
      } else if (newStatus === 'new') {
        await reactivateAlert(id);
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

  const getTypeStyle = (type: AlertType | string) => {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: AlertStatus | string) => {
    switch (status) {
      case 'new': return '新告警';
      case 'read': return '已读';
      case 'dismissed': return '已忽略';
      case 'active': return '活跃';
      case 'acknowledged': return '已确认';
      case 'ignored': return '已忽略';
      default: return status;
    }
  };

  const getTypeLabel = (type: AlertType | string) => {
    switch (type) {
      case 'error': return '错误';
      case 'warning': return '警告';
      case 'info': return '信息';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-900">告警中心</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="all">所有状态</option>
            <option value="new">新告警</option>
            <option value="read">已读</option>
            <option value="dismissed">已忽略</option>
          </select>

          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
            <option value="all">所有类型</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
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
              <li key={alert.id} className={`${alert.status === 'new' ? 'bg-indigo-50/30' : ''} hover:bg-gray-50 transition-colors`}>
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeStyle(alert.type)}`}>
                        {getTypeLabel(alert.type)}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{alert.projectName}</span>
                    </div>
                    <time className="text-xs text-gray-500">{formatDate(alert.timestamp || alert.createdAt || '')}</time>
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <p className="text-sm text-gray-600 mb-4">{alert.message}</p>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          alert.status === 'new' ? 'bg-blue-50 text-blue-600' : 
                          alert.status === 'read' ? 'bg-gray-100 text-gray-600' : 
                          'bg-gray-100 text-gray-400 line-through'
                        }`}>
                          {getStatusLabel(alert.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center space-x-2">
                      {alert.status === 'new' && (
                        <button
                          onClick={() => handleStatusChange(alert.id, 'read')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                        >
                          标记已读
                        </button>
                      )}
                      {alert.status !== 'dismissed' && (
                        <button
                          onClick={() => handleStatusChange(alert.id, 'dismissed')}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          忽略
                        </button>
                      )}
                      {alert.status === 'dismissed' && (
                        <button
                          onClick={() => handleStatusChange(alert.id, 'new')}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-600 bg-white hover:bg-gray-50"
                        >
                          重新开启
                        </button>
                      )}
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
