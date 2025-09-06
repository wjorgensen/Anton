'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ExecutionHistory from './ExecutionHistory';
import ExecutionAnalytics from './ExecutionAnalytics';
import ErrorHandling from './ErrorHandling';
import {
  Activity,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Square,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Cpu,
  DollarSign,
  Timer,
  ChevronDown,
  ChevronUp,
  Settings,
  Eye,
  Zap,
  Target,
  Filter,
  Download,
  BarChart3,
  LineChart,
  PieChart,
  Search,
  ArrowRight,
  ArrowDown,
  Sparkles,
  FlameKindling,
  Gauge,
  Brain,
  Layers,
  MapPin
} from 'lucide-react';

interface AgentExecution {
  id: string;
  nodeId: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'paused' | 'queued';
  startTime?: Date;
  endTime?: Date;
  estimatedDuration: number;
  actualDuration?: number;
  progress: number;
  dependencies: string[];
  resourceUsage?: {
    cpu: number;
    memory: number;
    tokens: number;
  };
  error?: string;
  retryCount?: number;
  logs?: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
  }>;
  metrics?: {
    throughput: number;
    latency: number;
    errorRate: number;
  };
}

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
}

interface EnhancedExecutionMonitorProps {
  executions: AgentExecution[];
  projectName: string;
  executionHistory?: ExecutionHistory[];
  isRunning?: boolean;
  isPaused?: boolean;
  currentSpeed?: number;
  onRun?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onSpeedChange?: (speed: number) => void;
  onNodeClick?: (nodeId: string) => void;
  onStepMode?: (enabled: boolean) => void;
  onDebugMode?: (enabled: boolean) => void;
  onRetryNode?: (nodeId: string) => void;
  onExportReport?: () => void;
}

export default function EnhancedExecutionMonitor({
  executions,
  projectName,
  executionHistory = [],
  isRunning = false,
  isPaused = false,
  currentSpeed = 1,
  onRun,
  onPause,
  onResume,
  onStop,
  onRestart,
  onSpeedChange,
  onNodeClick,
  onStepMode,
  onDebugMode,
  onRetryNode,
  onExportReport
}: EnhancedExecutionMonitorProps) {
  // State management
  const [selectedView, setSelectedView] = useState<'monitor' | 'history' | 'analytics'>('monitor');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [timeScale, setTimeScale] = useState<'minutes' | 'hours'>('minutes');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Refs
  const ganttRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  // Calculate timeline bounds
  const { startTime, endTime, totalDuration } = useMemo(() => {
    const runningExecutions = executions.filter(e => e.startTime);
    if (runningExecutions.length === 0) {
      return { startTime: new Date(), endTime: new Date(), totalDuration: 0 };
    }

    const start = new Date(Math.min(...runningExecutions.map(e => e.startTime!.getTime())));
    const ends = executions.map(e => {
      if (e.endTime) return e.endTime.getTime();
      if (e.startTime) return e.startTime.getTime() + e.estimatedDuration * 60000;
      return Date.now() + e.estimatedDuration * 60000;
    });
    const end = new Date(Math.max(...ends));
    
    return {
      startTime: start,
      endTime: end,
      totalDuration: end.getTime() - start.getTime()
    };
  }, [executions]);

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    const paused = executions.filter(e => e.status === 'paused').length;
    const queued = executions.filter(e => e.status === 'queued').length;
    const pending = executions.filter(e => e.status === 'pending').length;
    
    const totalProgress = executions.reduce((sum, e) => sum + e.progress, 0) / Math.max(executions.length, 1);
    const totalTokens = executions.reduce((sum, e) => sum + (e.resourceUsage?.tokens || 0), 0);
    const estimatedCost = totalTokens * 0.00002;
    
    const avgCpu = executions
      .filter(e => e.resourceUsage?.cpu)
      .reduce((sum, e) => sum + (e.resourceUsage?.cpu || 0), 0) / Math.max(executions.filter(e => e.resourceUsage?.cpu).length, 1);
    
    const avgMemory = executions
      .filter(e => e.resourceUsage?.memory)
      .reduce((sum, e) => sum + (e.resourceUsage?.memory || 0), 0) / Math.max(executions.filter(e => e.resourceUsage?.memory).length, 1);

    const successRate = executions.length > 0 ? (completed / (completed + failed)) * 100 : 0;
    const throughput = running > 0 ? running / (Date.now() - startTime.getTime()) * 60000 : 0;

    return {
      completed,
      failed,
      running,
      paused,
      queued,
      pending,
      totalProgress: Math.round(totalProgress),
      totalTokens,
      estimatedCost: estimatedCost.toFixed(4),
      avgCpu: Math.round(avgCpu),
      avgMemory: Math.round(avgMemory),
      successRate: Math.round(successRate),
      throughput: throughput.toFixed(2)
    };
  }, [executions, startTime]);

  // Auto-scroll animation
  useEffect(() => {
    if (autoScroll && ganttRef.current && isRunning) {
      const animate = () => {
        if (ganttRef.current) {
          const now = Date.now();
          const elapsed = now - startTime.getTime();
          const scrollPosition = (elapsed / totalDuration) * ganttRef.current.scrollWidth;
          ganttRef.current.scrollLeft = scrollPosition - ganttRef.current.clientWidth / 2;
        }
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [autoScroll, isRunning, startTime, totalDuration]);

  // Filter executions
  const filteredExecutions = useMemo(() => {
    return executions.filter(execution => {
      const matchesFilter = !filter || 
        execution.name.toLowerCase().includes(filter.toLowerCase()) ||
        execution.category.toLowerCase().includes(filter.toLowerCase());
      
      const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(execution.category);
      
      return matchesFilter && matchesCategory;
    });
  }, [executions, filter, selectedCategories]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set(executions.map(e => e.category));
    return Array.from(cats);
  }, [executions]);

  const getStatusColor = (status: AgentExecution['status']) => {
    switch (status) {
      case 'running':
        return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'completed':
        return 'bg-gradient-to-r from-green-500 to-green-600';
      case 'failed':
        return 'bg-gradient-to-r from-red-500 to-red-600';
      case 'retrying':
        return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
      case 'paused':
        return 'bg-gradient-to-r from-orange-500 to-orange-600';
      case 'queued':
        return 'bg-gradient-to-r from-purple-500 to-purple-600';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const getStatusIcon = (status: AgentExecution['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="w-3 h-3 text-blue-400 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-400" />;
      case 'paused':
        return <Pause className="w-3 h-3 text-orange-400" />;
      case 'queued':
        return <Clock className="w-3 h-3 text-purple-400" />;
      default:
        return <Timer className="w-3 h-3 text-gray-400" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      setup: 'border-purple-500 bg-purple-500/10',
      execution: 'border-blue-500 bg-blue-500/10',
      testing: 'border-green-500 bg-green-500/10',
      integration: 'border-yellow-500 bg-yellow-500/10',
      review: 'border-pink-500 bg-pink-500/10',
      utility: 'border-gray-500 bg-gray-500/10'
    };
    return colors[category] || 'border-gray-500 bg-gray-500/10';
  };

  const calculatePosition = (execution: AgentExecution) => {
    if (!execution.startTime) return { left: '0%', width: '2%' };
    
    const start = execution.startTime;
    const duration = execution.actualDuration || execution.estimatedDuration;
    const left = ((start.getTime() - startTime.getTime()) / totalDuration) * 100;
    const width = Math.max((duration * 60000 / totalDuration) * 100, 2);
    
    return { left: `${Math.max(left, 0)}%`, width: `${width}%` };
  };

  const renderTimeScale = () => {
    const intervals = timeScale === 'minutes' ? 15 : 4;
    const marks = [];
    const intervalDuration = totalDuration / intervals;

    for (let i = 0; i <= intervals; i++) {
      const time = new Date(startTime.getTime() + i * intervalDuration);
      marks.push(
        <div key={i} className="absolute flex flex-col items-center" style={{ left: `${(i / intervals) * 100}%` }}>
          <div className="w-px h-2 bg-gray-600" />
          <span className="text-xs text-gray-400 mt-1">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      );
    }
    return marks;
  };

  const renderControlPanel = () => (
    <div className="bg-gradient-to-r from-[#0A0A0A] to-[#141414] border border-[#262626] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          {/* Main Run Button */}
          <div className="relative">
            <button
              onClick={isRunning ? (isPaused ? onResume : onPause) : onRun}
              disabled={!onRun && !onPause && !onResume}
              className={`relative p-4 rounded-full text-white font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRunning 
                  ? isPaused 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/25 hover:shadow-green-500/40' 
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-500/25 hover:shadow-orange-500/40'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/25 hover:shadow-blue-500/40'
              } shadow-lg`}
            >
              {isRunning ? (
                isPaused ? (
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    <span className="text-sm">Resume</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Pause className="w-5 h-5" />
                    <span className="text-sm">Pause</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  <span className="text-sm">Run</span>
                </div>
              )}
              
              {/* Animated ring for running state */}
              {isRunning && !isPaused && (
                <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
              )}
            </button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onStop}
              disabled={!isRunning || !onStop}
              className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/30 transition-all disabled:opacity-50"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={onRestart}
              disabled={!onRestart}
              className="p-3 bg-gray-500/20 border border-gray-500/30 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-gray-500/30 transition-all disabled:opacity-50"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced Controls */}
        <div className="flex items-center gap-4">
          {/* Speed Control */}
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400">Speed</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={currentSpeed}
              onChange={(e) => onSpeedChange?.(parseFloat(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-xs text-white min-w-[30px]">{currentSpeed}x</span>
          </div>

          {/* Mode Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStepMode(!stepMode);
                onStepMode?.(!stepMode);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                stepMode 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
            >
              <Target className="w-3 h-3 mr-1 inline" />
              Step
            </button>
            <button
              onClick={() => {
                setDebugMode(!debugMode);
                onDebugMode?.(!debugMode);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                debugMode 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
            >
              <Brain className="w-3 h-3 mr-1 inline" />
              Debug
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Overall Progress</span>
          <span className="text-sm text-white font-medium">{stats.totalProgress}%</span>
        </div>
        <div className="w-full bg-[#1A1A1A] rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full relative overflow-hidden"
            style={{ width: `${stats.totalProgress}%` }}
          >
            {isRunning && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatsGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
      {/* Progress */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-blue-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Progress</span>
          <TrendingUp className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-white mb-1">{stats.totalProgress}%</div>
        <div className="w-full bg-[#141414] rounded-full h-1">
          <div
            className="bg-blue-500 h-1 rounded-full transition-all"
            style={{ width: `${stats.totalProgress}%` }}
          />
        </div>
      </div>

      {/* Running */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-green-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Running</span>
          <div className="relative">
            <Activity className="w-4 h-4 text-green-400" />
            {stats.running > 0 && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
        </div>
        <div className="text-2xl font-bold text-white">{stats.running}</div>
        <div className="text-xs text-gray-400">agents</div>
      </div>

      {/* Completed */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-green-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Completed</span>
          <CheckCircle className="w-4 h-4 text-green-400" />
        </div>
        <div className="text-2xl font-bold text-white">{stats.completed}</div>
        <div className="text-xs text-gray-400">/ {executions.length}</div>
      </div>

      {/* Failed */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-red-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Failed</span>
          <XCircle className="w-4 h-4 text-red-400" />
        </div>
        <div className="text-2xl font-bold text-white">{stats.failed}</div>
        <div className="text-xs text-red-400">{stats.failed > 0 ? 'errors' : 'none'}</div>
      </div>

      {/* Success Rate */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-purple-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Success Rate</span>
          <Target className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-white">{stats.successRate}%</div>
        <div className="text-xs text-gray-400">accuracy</div>
      </div>

      {/* Tokens */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-yellow-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Tokens</span>
          <Cpu className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="text-2xl font-bold text-white">
          {(stats.totalTokens / 1000).toFixed(1)}k
        </div>
        <div className="text-xs text-gray-400">used</div>
      </div>

      {/* Cost */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-green-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Est. Cost</span>
          <DollarSign className="w-4 h-4 text-green-400" />
        </div>
        <div className="text-2xl font-bold text-white">${stats.estimatedCost}</div>
        <div className="text-xs text-gray-400">USD</div>
      </div>

      {/* Throughput */}
      <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4 hover:border-blue-500/30 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Throughput</span>
          <Zap className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-white">{stats.throughput}</div>
        <div className="text-xs text-gray-400">nodes/min</div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">{projectName}</h1>
            </div>
            <div className="text-sm text-gray-400 bg-[#0A0A0A] px-3 py-1 rounded-full border border-[#262626]">
              Execution Monitor
            </div>
          </div>
          
          {/* View Tabs */}
          <div className="flex bg-[#0A0A0A] border border-[#262626] rounded-lg p-1">
            {['monitor', 'history', 'analytics'].map((view) => (
              <button
                key={view}
                onClick={() => setSelectedView(view as any)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all capitalize ${
                  selectedView === view
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>

        {selectedView === 'monitor' && (
          <>
            {renderControlPanel()}
            {renderStatsGrid()}
          </>
        )}
      </div>

      {/* Main Content */}
      {selectedView === 'monitor' && (
        <div className="flex-1 flex flex-col">
          {/* Filters and Controls */}
          <div className="border-b border-[#262626] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  multiple
                  value={Array.from(selectedCategories)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedCategories(new Set(selected));
                  }}
                  className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Zoom and Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-400 min-w-[50px] text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={onExportReport}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Gantt Chart */}
          <div className="flex-1 flex">
            {/* Agent Names Panel */}
            <div className="w-64 border-r border-[#262626] overflow-y-auto bg-[#0A0A0A]">
              <div className="sticky top-0 bg-[#0A0A0A] border-b border-[#262626] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">AGENTS</span>
                  <span className="text-xs text-gray-500">{filteredExecutions.length}</span>
                </div>
              </div>
              
              {filteredExecutions.map((execution) => (
                <div
                  key={execution.id}
                  className={`p-3 border-b border-[#262626] cursor-pointer hover:bg-[#141414] transition-all group ${
                    selectedExecution === execution.id ? 'bg-[#141414] border-l-2 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedExecution(execution.id)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    {getStatusIcon(execution.status)}
                    <span className="text-sm text-white truncate font-medium">{execution.name}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(execution.category)}`}>
                      {execution.category}
                    </span>
                    <span className="text-xs text-gray-400">{execution.progress}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[#1A1A1A] rounded-full h-1 mt-2">
                    <div
                      className={`h-1 rounded-full transition-all ${getStatusColor(execution.status)}`}
                      style={{ width: `${execution.progress}%` }}
                    />
                  </div>

                  {/* Error indicator */}
                  {execution.error && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                      {execution.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Timeline Panel */}
            <div className="flex-1 overflow-auto" ref={ganttRef}>
              <div className="relative min-w-[1200px]" style={{ width: `${zoomLevel * 12}px` }}>
                {/* Time Scale */}
                <div className="sticky top-0 bg-black border-b border-[#262626] h-12 relative z-10">
                  {renderTimeScale()}
                </div>

                {/* Current Time Indicator */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
                  style={{
                    left: `${((Date.now() - startTime.getTime()) / totalDuration) * 100}%`
                  }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-red-500 text-xs text-white rounded shadow-lg">
                    Now
                  </div>
                </div>

                {/* Execution Bars */}
                <div className="relative">
                  {filteredExecutions.map((execution) => {
                    const position = calculatePosition(execution);
                    
                    return (
                      <div
                        key={execution.id}
                        className="relative h-16 border-b border-[#262626] group hover:bg-[#0A0A0A]/50 transition-colors"
                        onClick={() => onNodeClick?.(execution.nodeId)}
                      >
                        {/* Execution Bar */}
                        <div
                          className={`absolute top-2 h-12 rounded-lg border-2 overflow-hidden cursor-pointer transition-all group-hover:shadow-lg ${getCategoryColor(execution.category)}`}
                          style={{ ...position, minWidth: '60px' }}
                        >
                          <div className={`h-full ${getStatusColor(execution.status)} relative overflow-hidden`}>
                            {/* Progress indicator */}
                            {execution.status === 'running' && (
                              <div
                                className="absolute top-0 left-0 h-full bg-white/20 transition-all"
                                style={{ width: `${execution.progress}%` }}
                              />
                            )}

                            {/* Shimmer effect for running */}
                            {execution.status === 'running' && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                            )}

                            {/* Status overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                              {getStatusIcon(execution.status)}
                            </div>
                          </div>
                        </div>

                        {/* Tooltip */}
                        <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-black border border-[#262626] rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap shadow-xl">
                          <p className="text-xs text-white font-medium mb-1">{execution.name}</p>
                          <p className="text-xs text-gray-400">Status: {execution.status}</p>
                          <p className="text-xs text-gray-400">Progress: {execution.progress}%</p>
                          {execution.resourceUsage && (
                            <>
                              <p className="text-xs text-gray-400">CPU: {execution.resourceUsage.cpu}%</p>
                              <p className="text-xs text-gray-400">Memory: {execution.resourceUsage.memory}MB</p>
                              <p className="text-xs text-gray-400">Tokens: {execution.resourceUsage.tokens}</p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected Execution Details Panel */}
      {selectedExecution && (
        <div className="border-t border-[#262626] bg-[#0A0A0A]">
          {(() => {
            const execution = executions.find(e => e.id === selectedExecution);
            if (!execution) return null;

            return (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(execution.status)}
                      <h3 className="text-white font-semibold text-lg">{execution.name}</h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(execution.category)}`}>
                      {execution.category}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {execution.status === 'failed' && (
                      <button
                        onClick={() => onRetryNode?.(execution.nodeId)}
                        className="px-3 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors text-sm font-medium"
                      >
                        <RotateCw className="w-4 h-4 mr-1 inline" />
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4 mr-1 inline" />
                      Logs
                    </button>
                  </div>
                </div>

                {/* Execution Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-[#141414] border border-[#262626] rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Progress</div>
                    <div className="text-lg font-semibold text-white">{execution.progress}%</div>
                    <div className="w-full bg-[#1A1A1A] rounded-full h-1 mt-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all"
                        style={{ width: `${execution.progress}%` }}
                      />
                    </div>
                  </div>

                  {execution.resourceUsage && (
                    <>
                      <div className="bg-[#141414] border border-[#262626] rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">CPU Usage</div>
                        <div className="text-lg font-semibold text-white">{execution.resourceUsage.cpu}%</div>
                      </div>
                      <div className="bg-[#141414] border border-[#262626] rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Memory</div>
                        <div className="text-lg font-semibold text-white">{execution.resourceUsage.memory}MB</div>
                      </div>
                      <div className="bg-[#141414] border border-[#262626] rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">Tokens</div>
                        <div className="text-lg font-semibold text-white">{execution.resourceUsage.tokens}</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Error Display */}
                {execution.error && (
                  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 font-medium">Error</span>
                    </div>
                    <p className="text-sm text-red-300">{execution.error}</p>
                  </div>
                )}

                {/* Logs Panel */}
                {showLogs && execution.logs && (
                  <div className="mt-4 bg-[#141414] border border-[#262626] rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-300">Execution Logs</span>
                    </div>
                    <div className="space-y-1">
                      {execution.logs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <span className="text-gray-500 min-w-[60px]">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={`min-w-[40px] font-medium ${
                            log.level === 'error' ? 'text-red-400' :
                            log.level === 'warn' ? 'text-yellow-400' :
                            log.level === 'debug' ? 'text-purple-400' :
                            'text-gray-300'
                          }`}>
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-gray-300">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}