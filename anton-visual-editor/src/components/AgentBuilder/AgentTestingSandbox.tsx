'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Settings,
  Terminal,
  FileText,
  Clock,
  Cpu,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Upload,
  Copy,
  Maximize2,
  Minimize2,
  ChevronRight,
  Bug,
  Zap,
  Activity,
  Eye
} from 'lucide-react';

interface TestRun {
  id: string;
  timestamp: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  input: any;
  output?: any;
  error?: string;
  duration?: number;
  tokensUsed?: number;
  logs: LogEntry[];
  metrics: {
    startTime: Date;
    endTime?: Date;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  data?: any;
}

interface AgentTestingSandboxProps {
  agentConfig: any;
  onUpdateConfig?: (config: any) => void;
}

export default function AgentTestingSandbox({ agentConfig, onUpdateConfig }: AgentTestingSandboxProps) {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null);
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null);
  const [inputData, setInputData] = useState('{\n  "example": "input"\n}');
  const [expectedOutput, setExpectedOutput] = useState('{\n  "success": true\n}');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'logs' | 'metrics'>('input');
  
  const [testSettings, setTestSettings] = useState({
    timeout: 60000,
    maxRetries: 1,
    mockMode: false,
    debugMode: true,
    validateOutput: true,
    collectMetrics: true
  });

  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Auto-scroll terminal to bottom
    if (terminalRef.current && currentRun) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentRun?.logs]);

  const runTest = async () => {
    if (isRunning) return;

    let parsedInput;
    try {
      parsedInput = JSON.parse(inputData);
    } catch (error) {
      addLog('error', 'Invalid JSON input');
      return;
    }

    const run: TestRun = {
      id: `run_${Date.now()}`,
      timestamp: new Date(),
      status: 'running',
      input: parsedInput,
      logs: [],
      metrics: {
        startTime: new Date()
      }
    };

    setCurrentRun(run);
    setSelectedRun(run);
    setIsRunning(true);
    setActiveTab('logs');
    
    abortControllerRef.current = new AbortController();

    // Add initial logs
    run.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Test run started',
      data: { input: parsedInput }
    });

    try {
      // Simulate agent execution
      if (testSettings.mockMode) {
        await simulateMockExecution(run);
      } else {
        await executeRealAgent(run);
      }

      // Validate output if enabled
      if (testSettings.validateOutput && expectedOutput) {
        validateOutput(run);
      }

      run.status = 'completed';
      run.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Test run completed successfully'
      });
    } catch (error: any) {
      run.status = 'failed';
      run.error = error.message;
      run.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: 'Test run failed',
        data: { error: error.message }
      });
    } finally {
      run.metrics.endTime = new Date();
      run.duration = run.metrics.endTime.getTime() - run.metrics.startTime.getTime();
      
      setIsRunning(false);
      setTestRuns([run, ...testRuns]);
      setCurrentRun(null);
      abortControllerRef.current = null;
    }
  };

  const simulateMockExecution = async (run: TestRun) => {
    // Simulate processing steps
    const steps = [
      'Initializing agent...',
      'Loading instructions...',
      'Processing input...',
      'Executing logic...',
      'Generating output...'
    ];

    for (const step of steps) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Test cancelled');
      }

      run.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: step
      });

      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      // Update metrics
      run.metrics.cpuUsage = Math.random() * 100;
      run.metrics.memoryUsage = Math.random() * 500;
      
      setCurrentRun({ ...run });
    }

    // Generate mock output
    run.output = {
      success: true,
      result: 'Mock execution completed',
      timestamp: new Date().toISOString()
    };
    
    run.tokensUsed = Math.floor(Math.random() * 5000) + 1000;
  };

  const executeRealAgent = async (run: TestRun) => {
    // This would call the actual agent execution API
    run.logs.push({
      timestamp: new Date(),
      level: 'warning',
      message: 'Real agent execution not implemented in sandbox'
    });
    
    // Fallback to mock for demo
    await simulateMockExecution(run);
  };

  const validateOutput = (run: TestRun) => {
    try {
      const expected = JSON.parse(expectedOutput);
      const actual = run.output;
      
      run.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Validating output against expected schema...'
      });

      // Simple deep equality check (would be more sophisticated in real implementation)
      const isValid = JSON.stringify(expected) === JSON.stringify(actual);
      
      if (isValid) {
        run.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: 'Output validation passed'
        });
      } else {
        run.logs.push({
          timestamp: new Date(),
          level: 'warning',
          message: 'Output validation failed - does not match expected',
          data: { expected, actual }
        });
      }
    } catch (error) {
      run.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: 'Failed to validate output',
        data: { error }
      });
    }
  };

  const cancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      if (currentRun) {
        currentRun.status = 'cancelled';
        currentRun.logs.push({
          timestamp: new Date(),
          level: 'warning',
          message: 'Test run cancelled by user'
        });
        setTestRuns([currentRun, ...testRuns]);
        setCurrentRun(null);
      }
      setIsRunning(false);
    }
  };

  const clearHistory = () => {
    setTestRuns([]);
    setSelectedRun(null);
  };

  const exportResults = () => {
    const data = JSON.stringify(testRuns, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addLog = (level: LogEntry['level'], message: string, data?: any) => {
    if (currentRun) {
      currentRun.logs.push({
        timestamp: new Date(),
        level,
        message,
        data
      });
      setCurrentRun({ ...currentRun });
    }
  };

  const getStatusColor = (status: TestRun['status']) => {
    switch (status) {
      case 'running':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'cancelled':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: TestRun['status']) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'text-gray-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'debug':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const displayRun = selectedRun || currentRun;

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : ''} bg-black flex flex-col h-full`}>
      {/* Header */}
      <div className="border-b border-[#262626] p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Agent Testing Sandbox</h2>
          <p className="text-sm text-gray-400 mt-1">Test your agent with sample data</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 border rounded-lg transition-colors ${
              showSettings 
                ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                : 'border-[#262626] text-gray-400 hover:text-white hover:border-[#404040]'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={exportResults}
            disabled={testRuns.length === 0}
            className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={clearHistory}
            disabled={testRuns.length === 0}
            className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-[#262626] p-4 bg-[#0A0A0A]">
          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testSettings.mockMode}
                onChange={(e) => setTestSettings({ ...testSettings, mockMode: e.target.checked })}
                className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-gray-400">Mock Mode</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testSettings.debugMode}
                onChange={(e) => setTestSettings({ ...testSettings, debugMode: e.target.checked })}
                className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-gray-400">Debug Mode</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testSettings.validateOutput}
                onChange={(e) => setTestSettings({ ...testSettings, validateOutput: e.target.checked })}
                className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-gray-400">Validate Output</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testSettings.collectMetrics}
                onChange={(e) => setTestSettings({ ...testSettings, collectMetrics: e.target.checked })}
                className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded focus:ring-[#3B82F6]"
              />
              <span className="text-sm text-gray-400">Collect Metrics</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Timeout:</span>
              <input
                type="number"
                value={testSettings.timeout / 1000}
                onChange={(e) => setTestSettings({ ...testSettings, timeout: parseInt(e.target.value) * 1000 })}
                className="w-20 px-2 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
              />
              <span className="text-xs text-gray-500">seconds</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Max Retries:</span>
              <input
                type="number"
                value={testSettings.maxRetries}
                onChange={(e) => setTestSettings({ ...testSettings, maxRetries: parseInt(e.target.value) })}
                className="w-20 px-2 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Test History Sidebar */}
        <div className="w-64 border-r border-[#262626] overflow-y-auto bg-[#0A0A0A]">
          <div className="p-3 border-b border-[#262626]">
            <h3 className="text-sm font-medium text-gray-400">Test History</h3>
          </div>
          
          {testRuns.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No test runs yet
            </div>
          ) : (
            <div className="p-2 space-y-2">
              {testRuns.map(run => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRun(run)}
                  className={`w-full p-3 bg-black border rounded-lg text-left transition-colors ${
                    selectedRun?.id === run.id 
                      ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                      : 'border-[#262626] hover:border-[#404040]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`flex items-center gap-1 ${getStatusColor(run.status)}`}>
                      {getStatusIcon(run.status)}
                      <span className="text-sm font-medium capitalize">{run.status}</span>
                    </span>
                    {run.duration && (
                      <span className="text-xs text-gray-500">{run.duration}ms</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(run.timestamp).toLocaleTimeString()}
                  </p>
                  {run.error && (
                    <p className="text-xs text-red-400 mt-1 truncate">{run.error}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Test Interface */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="border-b border-[#262626] px-4 flex items-center gap-4">
            {['input', 'output', 'logs', 'metrics'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-1 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-[#3B82F6] text-[#3B82F6]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'input' && (
              <div className="h-full flex flex-col p-4">
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Input Data (JSON)
                    </label>
                    <textarea
                      value={inputData}
                      onChange={(e) => setInputData(e.target.value)}
                      className="w-full h-48 px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                      placeholder="Enter test input JSON"
                    />
                  </div>

                  {testSettings.validateOutput && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Expected Output (JSON)
                      </label>
                      <textarea
                        value={expectedOutput}
                        onChange={(e) => setExpectedOutput(e.target.value)}
                        className="w-full h-32 px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                        placeholder="Enter expected output for validation"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'output' && displayRun && (
              <div className="h-full p-4">
                <pre className="h-full p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm overflow-auto">
                  {displayRun.output 
                    ? JSON.stringify(displayRun.output, null, 2)
                    : displayRun.status === 'running' 
                      ? 'Test is running...'
                      : 'No output available'}
                </pre>
              </div>
            )}

            {activeTab === 'logs' && (
              <div 
                ref={terminalRef}
                className="h-full p-4 bg-black font-mono text-sm overflow-auto"
              >
                {displayRun ? (
                  displayRun.logs.map((log, index) => (
                    <div key={index} className="mb-1 flex items-start gap-3">
                      <span className="text-gray-600 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`uppercase text-xs ${getLogLevelColor(log.level)}`}>
                        [{log.level}]
                      </span>
                      <span className="text-gray-300 flex-1">{log.message}</span>
                      {log.data && (
                        <span className="text-gray-500 text-xs">
                          {JSON.stringify(log.data)}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No logs available</p>
                )}
              </div>
            )}

            {activeTab === 'metrics' && displayRun && (
              <div className="h-full p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Duration</span>
                      <Clock className="w-4 h-4 text-[#3B82F6]" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {displayRun.duration ? `${displayRun.duration}ms` : '-'}
                    </p>
                  </div>

                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Tokens Used</span>
                      <Zap className="w-4 h-4 text-yellow-400" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {displayRun.tokensUsed || '-'}
                    </p>
                  </div>

                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">CPU Usage</span>
                      <Cpu className="w-4 h-4 text-purple-400" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {displayRun.metrics.cpuUsage ? `${displayRun.metrics.cpuUsage.toFixed(1)}%` : '-'}
                    </p>
                  </div>

                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Memory Usage</span>
                      <Activity className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {displayRun.metrics.memoryUsage ? `${displayRun.metrics.memoryUsage.toFixed(0)}MB` : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Run Controls */}
          <div className="border-t border-[#262626] p-4 flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              {isRunning && (
                <>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                    Running test...
                  </span>
                  <span>{currentRun?.logs.length || 0} logs</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isRunning ? (
                <button
                  onClick={cancelTest}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={runTest}
                  className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Run Test
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}