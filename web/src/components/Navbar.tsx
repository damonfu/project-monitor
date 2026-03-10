import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchProjects } from '../services/api';
import type { SearchResult } from '../types';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    const handleSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { projects } = await fetchProjects();
        const results: SearchResult[] = [];

        projects.forEach(project => {
          // Search project name
          if (project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            results.push({
              type: 'project',
              id: project.id,
              title: project.name,
              subtitle: project.path,
              url: `/project/${encodeURIComponent(project.id)}`
            });
          }

          // Search commit messages
          project.recentCommits?.forEach(commit => {
            if (commit.message.toLowerCase().includes(searchQuery.toLowerCase())) {
              results.push({
                type: 'commit',
                id: `${project.id}-${commit.hash}`,
                title: commit.message,
                subtitle: `${project.name} @ ${commit.hash.substring(0, 7)}`,
                url: `/project/${encodeURIComponent(project.id)}`
              });
            }
          });
        });

        setSearchResults(results.slice(0, 8)); // Limit to 8 results
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (url: string) => {
    setShowResults(false);
    setSearchQuery('');
    navigate(url);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center flex-1">
            <Link to="/" className="flex items-center shrink-0">
              <span className="text-xl font-bold text-gray-900">Project Monitor</span>
            </Link>

            {/* Global Search */}
            <div className="ml-8 flex-1 max-w-md relative" ref={searchRef}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                  placeholder="搜索项目、提交信息..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                />
                {isSearching && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && (searchQuery.length >= 2) && (
                <div className="absolute mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden">
                  {searchResults.length > 0 ? (
                    <ul className="max-h-80 overflow-y-auto">
                      {searchResults.map((result) => (
                        <li key={result.id}>
                          <button
                            onClick={() => handleResultClick(result.url)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-col transition-colors border-b border-gray-50 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900 truncate">{result.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                                result.type === 'project' ? 'bg-blue-100 text-blue-700' : 
                                result.type === 'commit' ? 'bg-purple-100 text-purple-700' : 
                                'bg-green-100 text-green-700'
                              }`}>
                                {result.type === 'project' ? '项目' : result.type === 'commit' ? '提交' : '文件'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 truncate mt-0.5">{result.subtitle}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                      {isSearching ? '正在搜索...' : '未找到相关结果'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/') && location.pathname === '/'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              项目总览
            </Link>
            <Link
              to="/reports"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/reports')
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              日报
            </Link>
            <Link
              to="/alerts"
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/alerts')
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              告警
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
