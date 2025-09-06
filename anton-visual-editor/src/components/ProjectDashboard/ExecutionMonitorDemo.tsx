'use client';

import React, { useState, useEffect } from 'react';
import EnhancedExecutionMonitor from './EnhancedExecutionMonitor';

// Demo data generators
const generateMockExecution = (index: number) => ({
  id: `exec-${index}`,
  nodeId: `node-${index}`,
  name: `Agent ${index + 1}`,
  category: ['setup', 'execution', 'testing', 'integration', 'review', 'utility'][index % 6],
  status: (['pending', 'running', 'completed', 'failed', 'retrying', 'paused', 'queued'][Math.floor(Math.random() * 7)]) as any,
  startTime: new Date(Date.now() - Math.random() * 3600000),
  endTime: Math.random() > 0.5 ? new Date(Date.now() - Math.random() * 1800000) : undefined,
  estimatedDuration: Math.floor(Math.random() * 60) + 10,
  actualDuration: Math.random() > 0.5 ? Math.floor(Math.random() * 60) + 5 : undefined,
  progress: Math.floor(Math.random() * 100),
  dependencies: Math.random() > 0.7 ? [`node-${Math.floor(Math.random() * index)}`] : [],
  resourceUsage: {
    cpu: Math.floor(Math.random() * 100),
    memory: Math.floor(Math.random() * 1000) + 100,
    tokens: Math.floor(Math.random() * 10000) + 1000
  },
  error: Math.random() > 0.8 ? 'Sample error message for testing' : undefined,
  retryCount: Math.floor(Math.random() * 3),
  logs: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => ({
    timestamp: new Date(Date.now() - i * 60000),
    level: (['info', 'warn', 'error', 'debug'][Math.floor(Math.random() * 4)]) as any,
    message: `Log message ${i + 1} for agent ${index + 1}`
  })),
  metrics: {
    throughput: Math.random() * 100,
    latency: Math.random() * 1000,
    errorRate: Math.random() * 10
  }
});

const generateMockHistory = (count: number) => Array.from({ length: count }, (_, i) => ({
  id: `history-${i}`,
  name: `Execution ${i + 1}`,
  startTime: new Date(Date.now() - Math.random() * 86400000 * 30),
  endTime: new Date(Date.now() - Math.random() * 86400000 * 29),
  duration: Math.floor(Math.random() * 120) + 10,
  status: (['completed', 'failed', 'aborted'][Math.floor(Math.random() * 3)]) as any,
  nodeCount: Math.floor(Math.random() * 20) + 5,
  successRate: Math.floor(Math.random() * 100),
  totalCost: parseFloat((Math.random() * 10).toFixed(4)),
  tokenUsage: Math.floor(Math.random() * 50000) + 5000,
  triggerType: (['manual', 'scheduled', 'webhook', 'api'][Math.floor(Math.random() * 4)]) as any,
  user: Math.random() > 0.5 ? 'user@example.com' : undefined,
  version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
  tags: Math.random() > 0.6 ? ['production', 'critical'] : undefined
}));

const generateMockErrors = (count: number) => Array.from({ length: count }, (_, i) => ({
  id: `error-${i}`,
  nodeId: `node-${i}`,
  nodeName: `Agent ${i + 1}`,
  category: ['setup', 'execution', 'testing', 'integration', 'review', 'utility'][i % 6],
  timestamp: new Date(Date.now() - Math.random() * 86400000),
  errorType: (['validation', 'runtime', 'timeout', 'network', 'permission', 'resource', 'logic'][Math.floor(Math.random() * 7)]) as any,
  severity: (['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)]) as any,
  message: `Error message ${i + 1}: Something went wrong during execution`,
  stackTrace: Math.random() > 0.5 ? `Error: Sample error\n  at function1 (file1.js:10:5)\n  at function2 (file2.js:20:10)\n  at main (index.js:5:2)` : undefined,
  context: {
    inputData: { param1: 'value1', param2: 'value2' },
    environment: 'production',
    dependencies: ['dep1', 'dep2'],
    resourceUsage: {
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 1000),
      tokens: Math.floor(Math.random() * 5000)
    }
  },
  suggestions: [
    'Try reducing the input data size',
    'Check network connectivity',
    'Verify authentication credentials'
  ].slice(0, Math.floor(Math.random() * 3) + 1),
  relatedErrors: [],
  retryCount: Math.floor(Math.random() * 3),
  maxRetries: 3,
  isResolved: Math.random() > 0.7,
  resolution: Math.random() > 0.5 ? {
    method: (['retry', 'manual', 'auto'][Math.floor(Math.random() * 3)]) as any,
    timestamp: new Date(Date.now() - Math.random() * 3600000),
    notes: 'Issue resolved after retry'
  } : undefined
}));

const generateMockAnalytics = () => {
  const executions = Array.from({ length: 50 }, (_, i) => ({
    id: `analytics-${i}`,
    name: `Execution ${i + 1}`,
    startTime: new Date(Date.now() - Math.random() * 86400000 * 7),
    duration: Math.floor(Math.random() * 120) + 10,
    status: (['completed', 'failed', 'aborted'][Math.floor(Math.random() * 3)]) as any,
    nodeCount: Math.floor(Math.random() * 15) + 3,
    cost: parseFloat((Math.random() * 5).toFixed(4)),
    tokenUsage: Math.floor(Math.random() * 20000) + 2000,
    category: ['setup', 'execution', 'testing', 'integration', 'review', 'utility'][i % 6]
  }));

  const totalCost = executions.reduce((sum, e) => sum + e.cost, 0);
  const totalTokens = executions.reduce((sum, e) => sum + e.tokenUsage, 0);
  const completed = executions.filter(e => e.status === 'completed').length;
  const avgDuration = executions.reduce((sum, e) => sum + e.duration, 0) / executions.length;

  return {
    timeRange: '7d' as const,
    executions,
    metrics: {
      totalExecutions: executions.length,
      successRate: (completed / executions.length) * 100,
      avgDuration: Math.round(avgDuration),
      totalCost,
      totalTokens,
      peakConcurrency: Math.floor(Math.random() * 10) + 5,
      errorRate: ((executions.length - completed) / executions.length) * 100,
      throughput: executions.length / 7
    }
  };
};

export default function ExecutionMonitorDemo() {
  const [executions, setExecutions] = useState(Array.from({ length: 12 }, (_, i) => generateMockExecution(i)));
  const [executionHistory] = useState(generateMockHistory(25));
  const [errors] = useState(generateMockErrors(8));
  const [analyticsData] = useState(generateMockAnalytics());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(1);

  // Simulate real-time updates
  useEffect(() => {
    if (isRunning && !isPaused) {
      const interval = setInterval(() => {
        setExecutions(prev => prev.map(exec => {
          if (exec.status === 'running' && exec.progress < 100) {
            return {
              ...exec,
              progress: Math.min(exec.progress + Math.floor(Math.random() * 10), 100),
              resourceUsage: {
                ...exec.resourceUsage!,
                cpu: Math.max(0, exec.resourceUsage!.cpu + (Math.random() - 0.5) * 20),
                memory: Math.max(0, exec.resourceUsage!.memory + (Math.random() - 0.5) * 100)
              }
            };
          }
          if (exec.status === 'running' && exec.progress >= 100) {
            return { ...exec, status: 'completed' as const, endTime: new Date() };
          }
          return exec;
        }));
      }, 2000 / currentSpeed);

      return () => clearInterval(interval);
    }
  }, [isRunning, isPaused, currentSpeed]);

  const handleRun = () => {
    setIsRunning(true);
    setIsPaused(false);
    // Start some executions
    setExecutions(prev => prev.map(exec => 
      exec.status === 'pending' || exec.status === 'queued' 
        ? { ...exec, status: 'running', startTime: new Date() }
        : exec
    ));
  };

  const handlePause = () => {
    setIsPaused(true);
    setExecutions(prev => prev.map(exec => 
      exec.status === 'running' ? { ...exec, status: 'paused' } : exec
    ));
  };

  const handleResume = () => {
    setIsPaused(false);
    setExecutions(prev => prev.map(exec => 
      exec.status === 'paused' ? { ...exec, status: 'running' } : exec
    ));
  };

  const handleStop = () => {
    setIsRunning(false);
    setIsPaused(false);
    setExecutions(prev => prev.map(exec => 
      exec.status === 'running' || exec.status === 'paused' 
        ? { ...exec, status: 'completed', endTime: new Date() }
        : exec
    ));
  };

  const handleRestart = () => {
    setIsRunning(false);
    setIsPaused(false);
    setExecutions(Array.from({ length: 12 }, (_, i) => generateMockExecution(i)));
  };

  const handleRetryNode = (nodeId: string) => {
    setExecutions(prev => prev.map(exec => 
      exec.nodeId === nodeId 
        ? { 
            ...exec, 
            status: 'running', 
            progress: 0, 
            retryCount: exec.retryCount + 1,
            startTime: new Date(),
            error: undefined
          }
        : exec
    ));
  };

  return (
    <div className="h-screen bg-black">
      <EnhancedExecutionMonitor
        executions={executions}
        projectName="Demo Project"
        executionHistory={executionHistory}
        errors={errors}
        analyticsData={analyticsData}
        isRunning={isRunning}
        isPaused={isPaused}
        currentSpeed={currentSpeed}
        onRun={handleRun}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onRestart={handleRestart}
        onSpeedChange={setCurrentSpeed}
        onNodeClick={(nodeId) => console.log('Node clicked:', nodeId)}
        onStepMode={(enabled) => console.log('Step mode:', enabled)}
        onDebugMode={(enabled) => console.log('Debug mode:', enabled)}
        onRetryNode={handleRetryNode}
        onExportReport={() => console.log('Export report')}
        onViewExecution={(id) => console.log('View execution:', id)}
        onCompareExecutions={(ids) => console.log('Compare executions:', ids)}
        onRerunExecution={(id) => console.log('Rerun execution:', id)}
        onDeleteExecution={(id) => console.log('Delete execution:', id)}
        onExportHistory={() => console.log('Export history')}
        onTimeRangeChange={(range) => console.log('Time range changed:', range)}
        onExportAnalytics={() => console.log('Export analytics')}
        onRefreshAnalytics={() => console.log('Refresh analytics')}
        onViewNodeDetails={(nodeId) => console.log('View node details:', nodeId)}
        onResolveError={(errorId, method, notes) => console.log('Resolve error:', errorId, method, notes)}
        onExportErrors={() => console.log('Export errors')}
      />
    </div>
  );
}