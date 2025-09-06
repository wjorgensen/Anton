'use client';

import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Search,
  BarChart3,
  DollarSign,
  Zap,
  Target,
  Users,
  Play,
  ArrowRight,
  MoreHorizontal,
  Download,
  Eye,
  RefreshCw,
  Trash2,
  Star
} from 'lucide-react';

interface ExecutionHistory {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'completed' | 'failed' | 'aborted';
  nodeCount: number;
  successRate: number;
  totalCost: number;
  tokenUsage: number;
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'api';
  user?: string;
  version?: string;
  tags?: string[];
}

interface ExecutionHistoryProps {
  history: ExecutionHistory[];
  onViewExecution?: (id: string) => void;
  onCompareExecutions?: (ids: string[]) => void;
  onRerunExecution?: (id: string) => void;
  onDeleteExecution?: (id: string) => void;
  onExportHistory?: () => void;
}

export default function ExecutionHistory({
  history,
  onViewExecution,
  onCompareExecutions,
  onRerunExecution,
  onDeleteExecution,
  onExportHistory
}: ExecutionHistoryProps) {
  const [selectedExecutions, setSelectedExecutions] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('7d');
  const [sortBy, setSortBy] = useState<'startTime' | 'duration' | 'successRate' | 'cost'>('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort executions
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = history.filter(execution => {
      const matchesSearch = !searchTerm || 
        execution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        execution.user?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || execution.status === statusFilter;
      
      // Time filter
      const now = new Date();
      const timeThreshold = new Date();
      switch (timeFilter) {
        case '24h':
          timeThreshold.setHours(now.getHours() - 24);
          break;
        case '7d':
          timeThreshold.setDate(now.getDate() - 7);
          break;
        case '30d':
          timeThreshold.setDate(now.getDate() - 30);
          break;
        case '90d':
          timeThreshold.setDate(now.getDate() - 90);
          break;
        default:
          timeThreshold.setFullYear(2000); // Show all
      }
      
      const matchesTime = execution.startTime >= timeThreshold;
      
      return matchesSearch && matchesStatus && matchesTime;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime();
          break;
        case 'duration':
          comparison = (a.duration || 0) - (b.duration || 0);
          break;
        case 'successRate':
          comparison = a.successRate - b.successRate;
          break;
        case 'cost':
          comparison = a.totalCost - b.totalCost;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [history, searchTerm, statusFilter, timeFilter, sortBy, sortOrder]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const total = filteredAndSortedHistory.length;
    const completed = filteredAndSortedHistory.filter(e => e.status === 'completed').length;
    const failed = filteredAndSortedHistory.filter(e => e.status === 'failed').length;
    const aborted = filteredAndSortedHistory.filter(e => e.status === 'aborted').length;
    
    const avgDuration = filteredAndSortedHistory.reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(total, 1);
    const avgSuccessRate = filteredAndSortedHistory.reduce((sum, e) => sum + e.successRate, 0) / Math.max(total, 1);
    const totalCost = filteredAndSortedHistory.reduce((sum, e) => sum + e.totalCost, 0);
    const totalTokens = filteredAndSortedHistory.reduce((sum, e) => sum + e.tokenUsage, 0);

    return {
      total,
      completed,
      failed,
      aborted,
      avgDuration: Math.round(avgDuration),
      avgSuccessRate: Math.round(avgSuccessRate),
      totalCost: totalCost.toFixed(4),
      totalTokens: Math.round(totalTokens / 1000)
    };
  }, [filteredAndSortedHistory]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'aborted':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'aborted':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'manual':
        return <Users className="w-3 h-3" />;
      case 'scheduled':
        return <Clock className="w-3 h-3" />;
      case 'webhook':
        return <Zap className="w-3 h-3" />;
      case 'api':
        return <Target className="w-3 h-3" />;
      default:
        return <Play className="w-3 h-3" />;
    }
  };

  const handleExecutionSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedExecutions);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedExecutions(newSelected);
  };

  const handleCompare = () => {
    if (selectedExecutions.size >= 2) {
      onCompareExecutions?.(Array.from(selectedExecutions));
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header with Summary Stats */}
      <div className="border-b border-[#262626] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Execution History</h2>
            <p className="text-sm text-gray-400 mt-1">Track and analyze past executions</p>
          </div>
          
          <div className="flex items-center gap-3">
            {selectedExecutions.size >= 2 && (
              <button
                onClick={handleCompare}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Compare ({selectedExecutions.size})
              </button>
            )}
            <button
              onClick={onExportHistory}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Total</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.total}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Completed</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.completed}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Failed</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.failed}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Avg Duration</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.avgDuration}m</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Success Rate</span>
              <Target className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.avgSuccessRate}%</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Total Cost</span>
              <DollarSign className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">${summaryStats.totalCost}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Tokens Used</span>
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{summaryStats.totalTokens}k</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Avg Nodes</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {Math.round(filteredAndSortedHistory.reduce((sum, e) => sum + e.nodeCount, 0) / Math.max(filteredAndSortedHistory.length, 1))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="border-b border-[#262626] p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search executions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="aborted">Aborted</option>
          </select>

          {/* Time Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="startTime">Start Time</option>
            <option value="duration">Duration</option>
            <option value="successRate">Success Rate</option>
            <option value="cost">Cost</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Execution List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {filteredAndSortedHistory.map((execution) => (
            <div
              key={execution.id}
              className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-[#404040] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedExecutions.has(execution.id)}
                    onChange={(e) => handleExecutionSelect(execution.id, e.target.checked)}
                    className="w-4 h-4 text-blue-500 bg-[#0A0A0A] border-gray-600 rounded focus:ring-blue-500"
                  />

                  {/* Execution Info */}
                  <div className="flex items-center gap-3">
                    {getStatusIcon(execution.status)}
                    <div>
                      <h3 className="text-white font-medium">{execution.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                        <span>{execution.startTime.toLocaleString()}</span>
                        <div className="flex items-center gap-1">
                          {getTriggerIcon(execution.triggerType)}
                          <span className="capitalize">{execution.triggerType}</span>
                        </div>
                        {execution.user && <span>by {execution.user}</span>}
                        {execution.version && <span>v{execution.version}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status and Metrics */}
                <div className="flex items-center gap-6">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(execution.status)}`}>
                    {execution.status}
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white">{formatDuration(execution.duration || 0)}</div>
                    <div className="text-xs text-gray-400">{execution.nodeCount} nodes</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white">{execution.successRate}%</div>
                    <div className="text-xs text-gray-400">success</div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-white">${execution.totalCost.toFixed(4)}</div>
                    <div className="text-xs text-gray-400">{Math.round(execution.tokenUsage / 1000)}k tokens</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewExecution?.(execution.id)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRerunExecution?.(execution.id)}
                      className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                      title="Rerun"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteExecution?.(execution.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {execution.tags && execution.tags.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {execution.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-[#141414] border border-[#262626] rounded text-xs text-gray-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredAndSortedHistory.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No executions found</p>
              <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or search terms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}