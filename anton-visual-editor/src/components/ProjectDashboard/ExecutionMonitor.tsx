'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Cpu,
  DollarSign,
  Timer
} from 'lucide-react';

interface AgentExecution {
  id: string;
  nodeId: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
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
}

interface ExecutionMonitorProps {
  executions: AgentExecution[];
  projectName: string;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onNodeClick?: (nodeId: string) => void;
}

export default function ExecutionMonitor({ 
  executions, 
  projectName,
  onPause, 
  onResume, 
  onRestart,
  onNodeClick 
}: ExecutionMonitorProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState<'minutes' | 'hours'>('minutes');
  const ganttRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

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

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const running = executions.filter(e => e.status === 'running').length;
    const totalProgress = executions.reduce((sum, e) => sum + e.progress, 0) / executions.length;
    const totalTokens = executions.reduce((sum, e) => sum + (e.resourceUsage?.tokens || 0), 0);
    const estimatedCost = totalTokens * 0.00002; // Example pricing

    return {
      completed,
      failed,
      running,
      pending: executions.filter(e => e.status === 'pending').length,
      totalProgress: Math.round(totalProgress),
      totalTokens,
      estimatedCost: estimatedCost.toFixed(2)
    };
  }, [executions]);

  // Auto-scroll to current time
  useEffect(() => {
    if (autoScroll && ganttRef.current) {
      const now = Date.now();
      const elapsed = now - startTime.getTime();
      const scrollPosition = (elapsed / totalDuration) * ganttRef.current.scrollWidth;
      ganttRef.current.scrollLeft = scrollPosition - ganttRef.current.clientWidth / 2;
    }
  }, [autoScroll, startTime, totalDuration]);

  const getStatusColor = (status: AgentExecution['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'retrying':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      setup: 'border-purple-500',
      execution: 'border-blue-500',
      testing: 'border-green-500',
      integration: 'border-yellow-500',
      review: 'border-pink-500',
      utility: 'border-gray-500'
    };
    return colors[category] || 'border-gray-500';
  };

  const calculatePosition = (execution: AgentExecution) => {
    const start = execution.startTime || new Date();
    const duration = execution.actualDuration || execution.estimatedDuration;
    const left = ((start.getTime() - startTime.getTime()) / totalDuration) * 100;
    const width = (duration * 60000 / totalDuration) * 100;
    
    return { left: `${left}%`, width: `${width}%` };
  };

  const renderTimeScale = () => {
    const intervals = timeScale === 'minutes' ? 15 : 4; // 15 min or 4 hour intervals
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

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{projectName} - Execution Monitor</h2>
            <p className="text-sm text-gray-400 mt-1">Real-time execution tracking and resource monitoring</p>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPause}
              className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={onResume}
              className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors"
            >
              <Play className="w-4 h-4" />
            </button>
            <button
              onClick={onRestart}
              className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Progress</span>
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">{stats.totalProgress}%</span>
            </div>
            <div className="w-full bg-[#141414] rounded-full h-1 mt-2">
              <div
                className="bg-[#3B82F6] h-1 rounded-full transition-all"
                style={{ width: `${stats.totalProgress}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Running</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">{stats.running}</span>
              <span className="text-xs text-gray-400 ml-1">agents</span>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Completed</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">{stats.completed}</span>
              <span className="text-xs text-gray-400 ml-1">/ {executions.length}</span>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Failed</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">{stats.failed}</span>
              <span className="text-xs text-gray-400 ml-1">errors</span>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Tokens Used</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">
                {(stats.totalTokens / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Est. Cost</span>
              <DollarSign className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-semibold text-white">${stats.estimatedCost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart Controls */}
      <div className="border-b border-[#262626] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[50px] text-center">{zoomLevel}%</span>
          <button
            onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="p-1 text-gray-400 hover:text-white transition-colors ml-2"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeScale}
            onChange={(e) => setTimeScale(e.target.value as 'minutes' | 'hours')}
            className="px-3 py-1 bg-[#0A0A0A] border border-[#262626] rounded text-sm text-white focus:border-[#3B82F6] focus:outline-none"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#262626] rounded focus:ring-[#3B82F6]"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 flex">
        {/* Agent Names */}
        <div className="w-48 border-r border-[#262626] overflow-y-auto bg-[#0A0A0A]">
          <div className="sticky top-0 bg-[#0A0A0A] border-b border-[#262626] p-2">
            <span className="text-xs font-medium text-gray-400">AGENTS</span>
          </div>
          {executions.map((execution) => (
            <div
              key={execution.id}
              className={`p-2 border-b border-[#262626] cursor-pointer hover:bg-[#141414] transition-colors ${
                selectedExecution === execution.id ? 'bg-[#141414]' : ''
              }`}
              onClick={() => setSelectedExecution(execution.id)}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(execution.status)}`} />
                <span className="text-sm text-white truncate">{execution.name}</span>
              </div>
              <span className="text-xs text-gray-500">{execution.category}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-auto" ref={ganttRef}>
          <div className="relative min-w-[1200px]" style={{ width: `${zoomLevel * 12}px` }}>
            {/* Time Scale */}
            <div className="sticky top-0 bg-black border-b border-[#262626] h-10 relative z-10">
              {renderTimeScale()}
            </div>

            {/* Current Time Indicator */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500 z-20"
              style={{
                left: `${((Date.now() - startTime.getTime()) / totalDuration) * 100}%`
              }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1 py-px bg-red-500 text-xs text-white rounded">
                Now
              </div>
            </div>

            {/* Gantt Bars */}
            <div className="relative">
              {executions.map((execution, index) => {
                const position = execution.startTime ? calculatePosition(execution) : null;
                
                return (
                  <div
                    key={execution.id}
                    className="relative h-12 border-b border-[#262626] group"
                    onClick={() => onNodeClick?.(execution.nodeId)}
                  >
                    {/* Dependency Lines */}
                    {execution.dependencies.map((depId) => {
                      const depIndex = executions.findIndex(e => e.nodeId === depId);
                      if (depIndex === -1) return null;
                      
                      return (
                        <svg
                          key={depId}
                          className="absolute inset-0 pointer-events-none"
                          style={{ zIndex: 0 }}
                        >
                          <line
                            x1="0"
                            y1={24}
                            x2="100%"
                            y2={24}
                            stroke="#262626"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                          />
                        </svg>
                      );
                    })}

                    {/* Execution Bar */}
                    {position && (
                      <div
                        className={`absolute top-2 h-8 rounded-lg ${getCategoryColor(execution.category)} border-2 overflow-hidden cursor-pointer group-hover:shadow-lg transition-shadow`}
                        style={{ ...position, minWidth: '40px' }}
                      >
                        <div className={`h-full ${getStatusColor(execution.status)} bg-opacity-30`}>
                          {/* Progress Bar */}
                          {execution.status === 'running' && (
                            <div
                              className={`h-full ${getStatusColor(execution.status)} transition-all`}
                              style={{ width: `${execution.progress}%` }}
                            />
                          )}
                        </div>

                        {/* Hover Tooltip */}
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-black border border-[#262626] rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap">
                          <p className="text-xs text-white font-medium">{execution.name}</p>
                          <p className="text-xs text-gray-400">Status: {execution.status}</p>
                          <p className="text-xs text-gray-400">Progress: {execution.progress}%</p>
                          {execution.actualDuration && (
                            <p className="text-xs text-gray-400">Duration: {execution.actualDuration}m</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Execution Details */}
      {selectedExecution && (
        <div className="border-t border-[#262626] p-4 bg-[#0A0A0A]">
          {(() => {
            const execution = executions.find(e => e.id === selectedExecution);
            if (!execution) return null;

            return (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">{execution.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {execution.category} • {execution.status} • {execution.progress}% complete
                  </p>
                  {execution.error && (
                    <p className="text-sm text-red-400 mt-1">Error: {execution.error}</p>
                  )}
                </div>

                {execution.resourceUsage && (
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-400">CPU:</span>
                      <span className="text-white ml-1">{execution.resourceUsage.cpu}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Memory:</span>
                      <span className="text-white ml-1">{execution.resourceUsage.memory}MB</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Tokens:</span>
                      <span className="text-white ml-1">{execution.resourceUsage.tokens}</span>
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