import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchReport } from '../services/api';
import { mockAlerts, mockProjectsIndex } from '../data/mock';
import { StatusBadge } from '../components/StatusBadge';

export function ReportDetail() {
  const { date } = useParams<{ date: string }>();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchReport(date || '');
        setContent(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载日报失败');
      } finally {
        setLoading(false);
      }
    };
    
    if (date) {
      loadReport();
    }
  }, [date]);

  // 获取当日告警
  const dailyAlerts = useMemo(() => {
    if (!date) return [];
    return mockAlerts.filter(alert => (alert.timestamp || alert.createdAt || '').startsWith(date));
  }, [date]);

  // 获取异常或脏项目
  const exceptionProjects = useMemo(() => {
    return mockProjectsIndex.projects.filter(p => p.status === 'error' || p.status === 'dirty');
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
  };

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
          <Link to="/reports" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            返回日报列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部区域 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Link
                to="/reports"
                className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回日报列表
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{formatDate(date || '')}</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 异常项目摘要区块 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="border-l-4 border-red-500 px-4 py-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center mb-4">
              <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              异常项目摘要
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 告警统计 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 mb-1">当日告警数量</div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">{dailyAlerts.length}</span>
                  <span className="ml-2 text-sm text-gray-500">条待处理告警</span>
                </div>
                {dailyAlerts.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {dailyAlerts.slice(0, 3).map(alert => (
                      <li key={alert.id} className="text-xs text-gray-600 flex items-start">
                        <span className={`w-2 h-2 mt-1 mr-2 rounded-full flex-shrink-0 ${
                          alert.type === 'error' ? 'bg-red-500' : 
                          alert.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <span className="truncate">
                          <span className="font-semibold">[{alert.projectName}]</span> {alert.message}
                        </span>
                      </li>
                    ))}
                    {dailyAlerts.length > 3 && (
                      <li className="text-xs text-blue-600 font-medium">
                        <Link to="/alerts">查看更多 {dailyAlerts.length - 3} 条告警...</Link>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* 状态异常项目 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500 mb-1">异常/脏工作区项目</div>
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">{exceptionProjects.length}</span>
                  <span className="ml-2 text-sm text-gray-500">个项目需要关注</span>
                </div>
                {exceptionProjects.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">项目</th>
                          <th className="px-1 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-right">状态</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {exceptionProjects.map(project => (
                          <tr key={project.id}>
                            <td className="px-1 py-1 text-xs text-gray-900 truncate max-w-[120px]">
                              <Link to={`/project/${project.id}`} className="hover:text-blue-600">
                                {project.name}
                              </Link>
                            </td>
                            <td className="px-1 py-1 text-xs text-right">
                              <StatusBadge status={project.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-gray-400">暂无异常状态项目</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {content ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                项目日报详情
              </h2>
            </div>
            <div className="p-6">
              <div className="prose prose-lg max-w-none 
                prose-headings:font-semibold prose-headings:text-gray-800
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:text-gray-600 prose-p:leading-relaxed
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-code:bg-gray-100 prose-code:text-pink-600 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-normal
                prose-pre:bg-gray-800 prose-pre:text-gray-100
                prose-li:text-gray-600
                prose-strong:text-gray-800
                prose-em:text-gray-500
                prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:not-italic
                prose-table:border prose-table:border-gray-200 prose-thead:bg-gray-50 prose-thead:text-gray-700 prose-th:font-semibold prose-td:px-4 prose-td:py-2 prose-tr:border-b prose-tr:border-gray-100
                prose-th:prose-p:my-0 prose-td:prose-p:my-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">日报内容为空</h3>
            <p className="mt-1 text-sm text-gray-500">当日暂无变更记录</p>
          </div>
        )}
      </div>
    </div>
  );
}
