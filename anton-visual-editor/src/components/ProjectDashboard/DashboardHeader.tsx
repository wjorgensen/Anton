'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  BarChart3,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { DashboardStats } from '@/store/dashboardStore';

interface DashboardHeaderProps {
  stats: DashboardStats;
  isLoading: boolean;
  onCreateProject: () => void;
  onRefresh: () => void;
  onToggleFilterPanel: () => void;
  showFilterPanel: boolean;
  hasActiveFilters: boolean;
}

// Animated counter component
const AnimatedCounter = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + difference * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
};

// Mini chart component for success rate
const MiniChart = ({ data, color = '#3B82F6' }: { data: number[]; color?: string }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.map((value, index) => {
        const height = ((value - min) / range) * 20 + 2;
        return (
          <div
            key={index}
            className="w-1 rounded-sm transition-all duration-300"
            style={{
              height: `${height}px`,
              backgroundColor: color,
              opacity: 0.7 + (value / max) * 0.3
            }}
          />
        );
      })}
    </div>
  );
};

export default function DashboardHeader({
  stats,
  isLoading,
  onCreateProject,
  onRefresh,
  onToggleFilterPanel,
  showFilterPanel,
  hasActiveFilters
}: DashboardHeaderProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const getStatusChange = (current: number, total: number) => {
    if (total === 0) return { value: 0, isPositive: true };
    const percentage = (current / total) * 100;
    // Mock comparison with previous period
    const change = Math.random() * 20 - 10; // -10 to +10
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  // Generate mock chart data for demonstration
  const chartData = [65, 78, 82, 71, 85, 88, 92, 87, 90, 94, 89, 96];

  return (
    <div className="border-b border-[#262626] bg-gradient-to-r from-black via-[#0A0A0A] to-black">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Project Dashboard
            </h1>
            <p className="text-gray-400 mt-1">
              Monitor and manage your AI orchestration workflows
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-[#1a1a1a] border border-[#404040] rounded-lg 
                         text-gray-400 hover:text-white hover:border-[#606060] 
                         transition-all duration-200 hover:scale-105"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={onToggleFilterPanel}
              className={`
                p-2.5 border rounded-lg transition-all duration-200 hover:scale-105 relative
                ${showFilterPanel 
                  ? 'bg-[#3B82F6] border-[#3B82F6] text-white' 
                  : 'bg-[#1a1a1a] border-[#404040] text-gray-400 hover:text-white hover:border-[#606060]'
                }
              `}
            >
              <Filter className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
            
            <button
              className="p-2.5 bg-[#1a1a1a] border border-[#404040] rounded-lg 
                         text-gray-400 hover:text-white hover:border-[#606060] 
                         transition-all duration-200 hover:scale-105"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <button
              onClick={onCreateProject}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] 
                         text-white rounded-lg font-medium hover:from-[#60A5FA] hover:to-[#3B82F6] 
                         transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Projects */}
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#1a1a1a] border border-[#262626] 
                          rounded-xl p-5 hover:border-[#404040] transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <MiniChart data={chartData} color="#3B82F6" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedCounter value={stats?.totalProjects || 0} />
            </div>
            <p className="text-sm text-gray-400">Total Projects</p>
          </div>

          {/* Active Projects */}
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#1a1a1a] border border-[#262626] 
                          rounded-xl p-5 hover:border-[#404040] transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <Activity className="w-5 h-5 text-green-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-1 text-xs">
                {getStatusChange(stats?.activeProjects || 0, stats?.totalProjects || 0).isPositive ? (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`font-medium ${
                  getStatusChange(stats?.activeProjects || 0, stats?.totalProjects || 0).isPositive 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {getStatusChange(stats?.activeProjects || 0, stats?.totalProjects || 0).value.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedCounter value={stats?.activeProjects || 0} />
            </div>
            <p className="text-sm text-gray-400">Active Projects</p>
          </div>

          {/* Success Rate */}
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#1a1a1a] border border-[#262626] 
                          rounded-xl p-5 hover:border-[#404040] transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="w-8 h-8 relative">
                {/* Circular progress */}
                <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    className="stroke-gray-700"
                    strokeWidth="3"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    className="stroke-emerald-400"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 12}`}
                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - (stats?.averageSuccessRate || 0))}`}
                    style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                  />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              <AnimatedCounter value={Math.round((stats?.averageSuccessRate || 0) * 100)} />%
            </div>
            <p className="text-sm text-gray-400">Success Rate</p>
          </div>

          {/* Total Execution Time */}
          <div className="bg-gradient-to-br from-[#0F0F0F] to-[#1a1a1a] border border-[#262626] 
                          rounded-xl p-5 hover:border-[#404040] transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-400">
                <Zap className="w-3 h-3" />
                <span className="font-medium">avg</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {formatTime(stats?.totalExecutionTime || 0)}
            </div>
            <p className="text-sm text-gray-400">Total Runtime</p>
          </div>
        </div>

        {/* Recent Activity Preview */}
        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-[#0F0F0F]/50 to-[#1a1a1a]/50 
                          border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Recent Activity
              </h3>
              <span className="text-xs text-gray-500">
                Last {stats.recentActivity.length} events
              </span>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto">
              {stats.recentActivity.slice(0, 5).map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex-shrink-0 flex items-center gap-2 text-xs text-gray-400 
                             bg-[#1a1a1a]/50 px-3 py-1.5 rounded-lg border border-[#262626]"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'project_completed' ? 'bg-green-400' : 
                    activity.type === 'project_failed' ? 'bg-red-400' : 'bg-blue-400'
                  } animate-pulse`} />
                  <span className="truncate max-w-[200px]">{activity.message}</span>
                  <span className="text-gray-500">
                    {Math.floor((Date.now() - activity.timestamp.getTime()) / 60000)}m ago
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-3 text-white">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#3B82F6] border-t-transparent" />
              <span>Loading dashboard...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}