'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  LineChart,
  Clock,
  DollarSign,
  Zap,
  Target,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Maximize2,
  Brain,
  Layers,
  Gauge,
  MapPin
} from 'lucide-react';

interface ExecutionAnalyticsData {
  timeRange: '24h' | '7d' | '30d' | '90d';
  executions: Array<{
    id: string;
    name: string;
    startTime: Date;
    duration: number;
    status: 'completed' | 'failed' | 'aborted';
    nodeCount: number;
    cost: number;
    tokenUsage: number;
    category: string;
  }>;
  metrics: {
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
    totalCost: number;
    totalTokens: number;
    peakConcurrency: number;
    errorRate: number;
    throughput: number;
  };
}

interface ExecutionAnalyticsProps {
  data: ExecutionAnalyticsData;
  onTimeRangeChange?: (range: '24h' | '7d' | '30d' | '90d') => void;
  onExportAnalytics?: () => void;
  onRefreshData?: () => void;
}

export default function ExecutionAnalytics({
  data,
  onTimeRangeChange,
  onExportAnalytics,
  onRefreshData
}: ExecutionAnalyticsProps) {
  const [selectedChart, setSelectedChart] = useState<'overview' | 'performance' | 'costs' | 'trends'>('overview');

  // Process data for different chart types
  const chartData = useMemo(() => {
    const { executions } = data;
    
    // Status distribution
    const statusDistribution = {
      completed: executions.filter(e => e.status === 'completed').length,
      failed: executions.filter(e => e.status === 'failed').length,
      aborted: executions.filter(e => e.status === 'aborted').length
    };

    // Category performance
    const categoryStats = executions.reduce((acc, exec) => {
      if (!acc[exec.category]) {
        acc[exec.category] = {
          total: 0,
          completed: 0,
          avgDuration: 0,
          totalCost: 0,
          durations: []
        };
      }
      
      acc[exec.category].total++;
      if (exec.status === 'completed') acc[exec.category].completed++;
      acc[exec.category].totalCost += exec.cost;
      acc[exec.category].durations.push(exec.duration);
      
      return acc;
    }, {} as any);

    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category];
      stats.successRate = (stats.completed / stats.total) * 100;
      stats.avgDuration = stats.durations.reduce((a: number, b: number) => a + b, 0) / stats.durations.length;
    });

    // Hourly execution pattern (for trends)
    const hourlyPattern = Array.from({ length: 24 }, (_, hour) => {
      const executionsInHour = executions.filter(exec => 
        exec.startTime.getHours() === hour
      ).length;
      return { hour, count: executionsInHour };
    });

    // Daily execution trends (last 7 days)
    const dailyTrends = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date();
      date.setDate(date.getDate() - dayIndex);
      const dayExecutions = executions.filter(exec => 
        exec.startTime.toDateString() === date.toDateString()
      );
      
      return {
        date: date.toLocaleDateString(),
        total: dayExecutions.length,
        completed: dayExecutions.filter(e => e.status === 'completed').length,
        failed: dayExecutions.filter(e => e.status === 'failed').length,
        avgDuration: dayExecutions.reduce((sum, e) => sum + e.duration, 0) / Math.max(dayExecutions.length, 1),
        totalCost: dayExecutions.reduce((sum, e) => sum + e.cost, 0)
      };
    }).reverse();

    // Cost breakdown by category
    const costByCategory = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      cost: stats.totalCost,
      percentage: (stats.totalCost / data.metrics.totalCost) * 100
    }));

    // Performance insights
    const performanceInsights = {
      slowestCategory: Object.entries(categoryStats).reduce((slowest, [category, stats]) => 
        stats.avgDuration > slowest.duration ? { category, duration: stats.avgDuration } : slowest,
        { category: '', duration: 0 }
      ),
      mostExpensiveCategory: costByCategory.reduce((expensive, current) => 
        current.cost > expensive.cost ? current : expensive,
        { category: '', cost: 0, percentage: 0 }
      ),
      mostReliableCategory: Object.entries(categoryStats).reduce((reliable, [category, stats]) => 
        stats.successRate > reliable.rate ? { category, rate: stats.successRate } : reliable,
        { category: '', rate: 0 }
      )
    };

    return {
      statusDistribution,
      categoryStats,
      hourlyPattern,
      dailyTrends,
      costByCategory,
      performanceInsights
    };
  }, [data]);

  const renderOverviewCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Status Distribution Pie Chart */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Execution Status</h3>
          <PieChart className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-32 h-32">
            {/* Simplified pie chart representation */}
            <div className="absolute inset-0 rounded-full border-8 border-green-500 border-opacity-80"
                 style={{ 
                   background: `conic-gradient(
                     #22c55e 0deg ${(chartData.statusDistribution.completed / data.metrics.totalExecutions) * 360}deg,
                     #ef4444 ${(chartData.statusDistribution.completed / data.metrics.totalExecutions) * 360}deg ${((chartData.statusDistribution.completed + chartData.statusDistribution.failed) / data.metrics.totalExecutions) * 360}deg,
                     #f59e0b ${((chartData.statusDistribution.completed + chartData.statusDistribution.failed) / data.metrics.totalExecutions) * 360}deg 360deg
                   )` 
                 }}
            />
            <div className="absolute inset-2 bg-[#0A0A0A] rounded-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{data.metrics.successRate.toFixed(0)}%</div>
                <div className="text-xs text-gray-400">Success</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Completed</span>
            </div>
            <span className="text-sm text-white">{chartData.statusDistribution.completed}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Failed</span>
            </div>
            <span className="text-sm text-white">{chartData.statusDistribution.failed}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-sm text-gray-300">Aborted</span>
            </div>
            <span className="text-sm text-white">{chartData.statusDistribution.aborted}</span>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Category Performance</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-3">
          {Object.entries(chartData.categoryStats).map(([category, stats]: [string, any]) => (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 capitalize">{category}</span>
                <span className="text-sm text-white">{stats.successRate.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-[#141414] rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{stats.total} executions</span>
                <span>{stats.avgDuration.toFixed(0)}m avg</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Trends */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Daily Execution Trends</h3>
          <LineChart className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="relative h-48">
          {/* Simplified line chart */}
          <div className="absolute inset-0 flex items-end justify-between px-4">
            {chartData.dailyTrends.map((day, index) => {
              const maxCount = Math.max(...chartData.dailyTrends.map(d => d.total));
              const height = (day.total / Math.max(maxCount, 1)) * 100;
              
              return (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div className="text-xs text-gray-400">{day.total}</div>
                  <div
                    className="w-8 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-400 hover:to-blue-300"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  <div className="text-xs text-gray-500 -rotate-45">{day.date.split('/').slice(0, 2).join('/')}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#262626]">
          <div className="text-center">
            <div className="text-lg font-semibold text-white">
              {chartData.dailyTrends.reduce((sum, day) => sum + day.total, 0)}
            </div>
            <div className="text-xs text-gray-400">Total Executions</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-400">
              {chartData.dailyTrends.reduce((sum, day) => sum + day.completed, 0)}
            </div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-400">
              {chartData.dailyTrends.reduce((sum, day) => sum + day.failed, 0)}
            </div>
            <div className="text-xs text-gray-400">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-400">
              ${chartData.dailyTrends.reduce((sum, day) => sum + day.totalCost, 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">Total Cost</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPerformanceInsights = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Key Performance Indicators */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Performance KPIs</h3>
          <Gauge className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Success Rate</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{data.metrics.successRate.toFixed(1)}%</div>
              <div className="text-xs text-green-400">↑ 2.3%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">Avg Duration</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{data.metrics.avgDuration.toFixed(0)}m</div>
              <div className="text-xs text-red-400">↓ 5.2%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-300">Throughput</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{data.metrics.throughput.toFixed(1)}/h</div>
              <div className="text-xs text-green-400">↑ 8.7%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#141414] rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-300">Peak Concurrency</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-white">{data.metrics.peakConcurrency}</div>
              <div className="text-xs text-blue-400">↑ 1.2%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Insights & Recommendations */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Insights</h3>
          <Brain className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-4">
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">Best Performer</span>
            </div>
            <p className="text-xs text-gray-300">
              <span className="capitalize font-medium">{chartData.performanceInsights.mostReliableCategory.category}</span> category has {chartData.performanceInsights.mostReliableCategory.rate.toFixed(0)}% success rate
            </p>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">Slowest Category</span>
            </div>
            <p className="text-xs text-gray-300">
              <span className="capitalize font-medium">{chartData.performanceInsights.slowestCategory.category}</span> takes {chartData.performanceInsights.slowestCategory.duration.toFixed(0)}m on average
            </p>
          </div>

          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Cost Driver</span>
            </div>
            <p className="text-xs text-gray-300">
              <span className="capitalize font-medium">{chartData.performanceInsights.mostExpensiveCategory.category}</span> accounts for {chartData.performanceInsights.mostExpensiveCategory.percentage.toFixed(0)}% of costs
            </p>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">Recommendation</span>
            </div>
            <p className="text-xs text-gray-300">
              Optimize {chartData.performanceInsights.slowestCategory.category} workflows to improve overall throughput
            </p>
          </div>
        </div>
      </div>

      {/* Hourly Usage Pattern */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Usage Pattern</h3>
          <Activity className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-2">
          {chartData.hourlyPattern.filter((_, index) => index % 4 === 0).map((hour) => {
            const maxCount = Math.max(...chartData.hourlyPattern.map(h => h.count));
            const width = (hour.count / Math.max(maxCount, 1)) * 100;
            
            return (
              <div key={hour.hour} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-8">{hour.hour}:00</span>
                <div className="flex-1 bg-[#141414] rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <span className="text-xs text-white w-8 text-right">{hour.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderCostAnalysis = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Cost Breakdown */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Cost Breakdown</h3>
          <DollarSign className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-3">
          {chartData.costByCategory.map((item) => (
            <div key={item.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300 capitalize">{item.category}</span>
                <span className="text-sm text-white">${item.cost.toFixed(4)}</span>
              </div>
              <div className="w-full bg-[#141414] rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">
                {item.percentage.toFixed(1)}% of total cost
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Metrics */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Cost Metrics</h3>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-[#141414] rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">${data.metrics.totalCost.toFixed(4)}</div>
            <div className="text-sm text-gray-400 mb-2">Total Cost ({data.timeRange})</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400">12% decrease from last period</span>
            </div>
          </div>

          <div className="p-4 bg-[#141414] rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">
              ${(data.metrics.totalCost / Math.max(data.metrics.totalExecutions, 1)).toFixed(4)}
            </div>
            <div className="text-sm text-gray-400 mb-2">Cost per Execution</div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400">8% decrease</span>
            </div>
          </div>

          <div className="p-4 bg-[#141414] rounded-lg">
            <div className="text-2xl font-bold text-white mb-1">
              {(data.metrics.totalTokens / 1000).toFixed(1)}k
            </div>
            <div className="text-sm text-gray-400 mb-2">Total Tokens Used</div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-400">15% increase</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Execution Analytics</h2>
            <p className="text-sm text-gray-400 mt-1">Performance insights and trends</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <select
              value={data.timeRange}
              onChange={(e) => onTimeRangeChange?.(e.target.value as any)}
              className="px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            
            <button
              onClick={onRefreshData}
              className="p-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            
            <button
              onClick={onExportAnalytics}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Executions</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.totalExecutions}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Success Rate</span>
              <Target className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.successRate.toFixed(1)}%</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Avg Duration</span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.avgDuration.toFixed(0)}m</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Total Cost</span>
              <DollarSign className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">${data.metrics.totalCost.toFixed(4)}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Throughput</span>
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.throughput.toFixed(1)}/h</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Error Rate</span>
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.errorRate.toFixed(1)}%</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Peak Concurrency</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.metrics.peakConcurrency}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Tokens</span>
              <Brain className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{(data.metrics.totalTokens / 1000).toFixed(0)}k</div>
          </div>
        </div>
      </div>

      {/* Chart Selection Tabs */}
      <div className="border-b border-[#262626] px-6 py-4">
        <div className="flex bg-[#0A0A0A] border border-[#262626] rounded-lg p-1">
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'performance', label: 'Performance', icon: TrendingUp },
            { key: 'costs', label: 'Costs', icon: DollarSign },
            { key: 'trends', label: 'Trends', icon: LineChart }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                selectedChart === key
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedChart === 'overview' && renderOverviewCharts()}
        {selectedChart === 'performance' && renderPerformanceInsights()}
        {selectedChart === 'costs' && renderCostAnalysis()}
        {selectedChart === 'trends' && renderOverviewCharts()}
      </div>
    </div>
  );
}