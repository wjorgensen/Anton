'use client';

import React, { useState } from 'react';
import {
  Bot,
  Code2,
  Settings,
  FileText,
  TestTube,
  Package,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Cpu,
  Clock,
  Tag,
  GitBranch,
  Shield,
  Zap
} from 'lucide-react';

interface AgentWizardProps {
  onComplete: (agent: any) => void;
  onCancel: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  icon: React.ElementType;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 'basic', title: 'Basic Information', icon: Bot },
  { id: 'behavior', title: 'Instructions & ClaudeMD', icon: Code2 },
  { id: 'interface', title: 'Inputs & Outputs', icon: Settings },
  { id: 'resources', title: 'Resources & Limits', icon: Cpu },
  { id: 'hooks', title: 'Event Handlers', icon: GitBranch },
  { id: 'test', title: 'Test Agent', icon: TestTube },
  { id: 'publish', title: 'Save & Publish', icon: Package },
];

const AGENT_CATEGORIES = [
  'setup',
  'execution',
  'testing',
  'integration',
  'review',
  'utility'
];

export default function AgentCreationWizard({ onComplete, onCancel }: AgentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [agentData, setAgentData] = useState({
    // Basic Info
    name: '',
    category: '',
    type: '',
    version: '1.0.0',
    description: '',
    icon: '',
    color: '#3B82F6',
    tags: [] as string[],
    
    // Behavior
    instructions: {
      base: '',
      contextual: ''
    },
    claudeMD: '',
    
    // Interface
    inputs: [] as any[],
    outputs: [] as any[],
    
    // Resources
    resources: {
      estimatedTime: 30,
      estimatedTokens: 10000,
      requiresGPU: false,
      maxRetries: 3,
      timeout: 600
    },
    
    // Hooks
    hooks: {
      onStart: '',
      onStop: '',
      onError: '',
      postToolUse: []
    },
    
    // Publishing
    visibility: 'private' as 'private' | 'public' | 'team',
    license: 'MIT',
    documentation: ''
  });

  const [testResults, setTestResults] = useState<any>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < WIZARD_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = (): boolean => {
    const errors: string[] = [];
    
    switch (WIZARD_STEPS[currentStep].id) {
      case 'basic':
        if (!agentData.name) errors.push('Agent name is required');
        if (!agentData.category) errors.push('Category is required');
        if (!agentData.description) errors.push('Description is required');
        break;
      case 'behavior':
        if (!agentData.instructions.base) errors.push('Base instructions are required');
        break;
      case 'interface':
        if (agentData.inputs.length === 0) errors.push('At least one input is recommended');
        if (agentData.outputs.length === 0) errors.push('At least one output is recommended');
        break;
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const runTest = async () => {
    setIsTestRunning(true);
    try {
      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, 3000));
      setTestResults({
        success: true,
        executionTime: 2500,
        tokensUsed: 5432,
        outputValid: true,
        errors: []
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const handlePublish = () => {
    if (validateCurrentStep()) {
      onComplete(agentData);
    }
  };

  const renderStepContent = () => {
    switch (WIZARD_STEPS[currentStep].id) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={agentData.name}
                  onChange={(e) => setAgentData({ ...agentData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  placeholder="My Custom Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Version
                </label>
                <input
                  type="text"
                  value={agentData.version}
                  onChange={(e) => setAgentData({ ...agentData, version: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Category *
                </label>
                <select
                  value={agentData.category}
                  onChange={(e) => setAgentData({ ...agentData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                >
                  <option value="">Select Category</option>
                  {AGENT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Type Identifier
                </label>
                <input
                  type="text"
                  value={agentData.type}
                  onChange={(e) => setAgentData({ ...agentData, type: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  placeholder="custom-agent-type"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Description *
              </label>
              <textarea
                value={agentData.description}
                onChange={(e) => setAgentData({ ...agentData, description: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-24 resize-none"
                placeholder="Describe what your agent does..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Icon (Emoji or URL)
                </label>
                <input
                  type="text"
                  value={agentData.icon}
                  onChange={(e) => setAgentData({ ...agentData, icon: e.target.value })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  placeholder="🤖 or https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Color Theme
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={agentData.color}
                    onChange={(e) => setAgentData({ ...agentData, color: e.target.value })}
                    className="w-12 h-10 bg-[#0A0A0A] border border-[#262626] rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={agentData.color}
                    onChange={(e) => setAgentData({ ...agentData, color: e.target.value })}
                    className="flex-1 px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={agentData.tags.join(', ')}
                onChange={(e) => setAgentData({ 
                  ...agentData, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                placeholder="api, backend, nodejs"
              />
            </div>
          </div>
        );

      case 'behavior':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Base Instructions *
              </label>
              <textarea
                value={agentData.instructions.base}
                onChange={(e) => setAgentData({
                  ...agentData,
                  instructions: { ...agentData.instructions, base: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-48 resize-none"
                placeholder="You are a specialized agent that..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Contextual Instructions Template
              </label>
              <textarea
                value={agentData.instructions.contextual}
                onChange={(e) => setAgentData({
                  ...agentData,
                  instructions: { ...agentData.instructions, contextual: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-32 resize-none"
                placeholder="Additional context: {{context}}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use {'{{variable}}'} syntax for template variables
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Claude.md Content
              </label>
              <textarea
                value={agentData.claudeMD}
                onChange={(e) => setAgentData({ ...agentData, claudeMD: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-48 resize-none"
                placeholder="# Agent Guidelines&#10;&#10;## Purpose&#10;..."
              />
            </div>

            <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">Instruction Templates</h4>
              <div className="grid grid-cols-2 gap-2">
                {['API Developer', 'Frontend Builder', 'Test Runner', 'Code Reviewer'].map(template => (
                  <button
                    key={template}
                    className="px-3 py-2 text-left text-sm text-gray-400 hover:text-white bg-[#141414] hover:bg-[#1A1A1A] rounded transition-colors"
                  >
                    Use {template} Template
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'interface':
        return (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-400">
                  Input Schema
                </label>
                <button
                  className="px-3 py-1 bg-[#3B82F6] text-white text-sm rounded hover:bg-[#60A5FA] transition-colors"
                >
                  Add Input
                </button>
              </div>
              <div className="space-y-2">
                {agentData.inputs.length === 0 ? (
                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg text-center">
                    <p className="text-sm text-gray-500">No inputs defined yet</p>
                  </div>
                ) : (
                  agentData.inputs.map((input, index) => (
                    <div key={index} className="p-3 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                      {/* Input field editor would go here */}
                      <p className="text-sm text-white">Input {index + 1}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-400">
                  Output Schema
                </label>
                <button
                  className="px-3 py-1 bg-[#3B82F6] text-white text-sm rounded hover:bg-[#60A5FA] transition-colors"
                >
                  Add Output
                </button>
              </div>
              <div className="space-y-2">
                {agentData.outputs.length === 0 ? (
                  <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg text-center">
                    <p className="text-sm text-gray-500">No outputs defined yet</p>
                  </div>
                ) : (
                  agentData.outputs.map((output, index) => (
                    <div key={index} className="p-3 bg-[#0A0A0A] border border-[#262626] rounded-lg">
                      {/* Output field editor would go here */}
                      <p className="text-sm text-white">Output {index + 1}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400">Schema Best Practices</p>
                  <ul className="mt-1 text-xs text-blue-300 space-y-0.5">
                    <li>• Define clear, descriptive field names</li>
                    <li>• Mark required fields appropriately</li>
                    <li>• Provide helpful descriptions for each field</li>
                    <li>• Use appropriate data types</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'resources':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={agentData.resources.estimatedTime}
                  onChange={(e) => setAgentData({
                    ...agentData,
                    resources: { ...agentData.resources, estimatedTime: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Estimated Tokens
                </label>
                <input
                  type="number"
                  value={agentData.resources.estimatedTokens}
                  onChange={(e) => setAgentData({
                    ...agentData,
                    resources: { ...agentData.resources, estimatedTokens: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Max Retries
                </label>
                <input
                  type="number"
                  value={agentData.resources.maxRetries}
                  onChange={(e) => setAgentData({
                    ...agentData,
                    resources: { ...agentData.resources, maxRetries: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={agentData.resources.timeout}
                  onChange={(e) => setAgentData({
                    ...agentData,
                    resources: { ...agentData.resources, timeout: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agentData.resources.requiresGPU}
                  onChange={(e) => setAgentData({
                    ...agentData,
                    resources: { ...agentData.resources, requiresGPU: e.target.checked }
                  })}
                  className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#262626] rounded focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-white">Requires GPU acceleration</span>
              </label>
            </div>

            <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
              <h4 className="text-sm font-medium text-white mb-3">Resource Estimation</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Estimated Cost:</span>
                  <span className="text-white">
                    ${((agentData.resources.estimatedTokens * 0.00002) + 0.01).toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Performance Level:</span>
                  <span className="text-yellow-400">Medium</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Concurrency Limit:</span>
                  <span className="text-white">10 instances</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'hooks':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                On Start Hook
              </label>
              <input
                type="text"
                value={agentData.hooks.onStart}
                onChange={(e) => setAgentData({
                  ...agentData,
                  hooks: { ...agentData.hooks, onStart: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                placeholder="./hooks/start.sh"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                On Stop Hook
              </label>
              <input
                type="text"
                value={agentData.hooks.onStop}
                onChange={(e) => setAgentData({
                  ...agentData,
                  hooks: { ...agentData.hooks, onStop: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                placeholder="./hooks/stop.sh"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                On Error Hook
              </label>
              <input
                type="text"
                value={agentData.hooks.onError}
                onChange={(e) => setAgentData({
                  ...agentData,
                  hooks: { ...agentData.hooks, onError: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                placeholder="./hooks/error.sh"
              />
            </div>

            <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">Hook Templates</h4>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white bg-[#141414] hover:bg-[#1A1A1A] rounded transition-colors">
                  📥 File Tracking Hooks
                </button>
                <button className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white bg-[#141414] hover:bg-[#1A1A1A] rounded transition-colors">
                  📊 Progress Reporting Hooks
                </button>
                <button className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:text-white bg-[#141414] hover:bg-[#1A1A1A] rounded transition-colors">
                  🔔 Notification Hooks
                </button>
              </div>
            </div>
          </div>
        );

      case 'test':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-lg">
              <h3 className="text-white font-medium mb-4">Test Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Test Input Data
                  </label>
                  <textarea
                    className="w-full px-4 py-2 bg-black border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-32 resize-none"
                    placeholder='{"key": "value"}'
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Expected Output Pattern
                  </label>
                  <textarea
                    className="w-full px-4 py-2 bg-black border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-32 resize-none"
                    placeholder='{"success": true}'
                  />
                </div>
              </div>
            </div>

            {!isTestRunning && !testResults && (
              <button
                onClick={runTest}
                className="w-full px-4 py-3 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center justify-center gap-2"
              >
                <TestTube className="w-5 h-5" />
                Run Test
              </button>
            )}

            {isTestRunning && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-400">Running test agent...</p>
              </div>
            )}

            {testResults && (
              <div className={`p-4 rounded-lg ${
                testResults.success 
                  ? 'bg-green-900/20 border border-green-800/50' 
                  : 'bg-red-900/20 border border-red-800/50'
              }`}>
                <div className="flex items-start gap-3">
                  {testResults.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  )}
                  
                  <div className="flex-1">
                    <h4 className={`font-medium ${testResults.success ? 'text-green-400' : 'text-red-400'}`}>
                      Test {testResults.success ? 'Passed' : 'Failed'}
                    </h4>
                    
                    <div className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Execution Time:</span>
                        <span className="text-white">{testResults.executionTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tokens Used:</span>
                        <span className="text-white">{testResults.tokensUsed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Output Valid:</span>
                        <span className="text-white">{testResults.outputValid ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    
                    {testResults.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-400 mb-1">Errors:</p>
                        <ul className="text-sm text-red-300 space-y-0.5">
                          {testResults.errors.map((error: string, idx: number) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'publish':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                {[
                  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you can use this agent' },
                  { value: 'team', label: 'Team', icon: Users, desc: 'Share with your team members' },
                  { value: 'public', label: 'Public', icon: Globe, desc: 'Available to all users' }
                ].map(option => (
                  <label key={option.value} className="flex items-start gap-3 p-3 bg-[#0A0A0A] border border-[#262626] rounded-lg cursor-pointer hover:border-[#3B82F6]/50 transition-colors">
                    <input
                      type="radio"
                      value={option.value}
                      checked={agentData.visibility === option.value}
                      onChange={(e) => setAgentData({ ...agentData, visibility: e.target.value as any })}
                      className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#262626] focus:ring-[#3B82F6] mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4 text-gray-400" />
                        <span className="text-white">{option.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                License
              </label>
              <select
                value={agentData.license}
                onChange={(e) => setAgentData({ ...agentData, license: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
              >
                <option value="MIT">MIT</option>
                <option value="Apache-2.0">Apache 2.0</option>
                <option value="GPL-3.0">GPL 3.0</option>
                <option value="Proprietary">Proprietary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Documentation (Markdown)
              </label>
              <textarea
                value={agentData.documentation}
                onChange={(e) => setAgentData({ ...agentData, documentation: e.target.value })}
                className="w-full px-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 h-32 resize-none"
                placeholder="# Agent Documentation&#10;&#10;## Usage&#10;..."
              />
            </div>

            <div className="p-4 bg-green-900/20 border border-green-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-sm text-green-400 font-medium">Ready to Publish!</p>
                  <p className="text-xs text-green-300 mt-1">
                    Your agent has been configured and tested successfully. Click "Publish Agent" to save and make it available.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-black border border-[#262626] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-[#262626] p-6">
          <h2 className="text-2xl font-bold text-white">Create Custom Agent</h2>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-between mt-6">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        index === currentStep
                          ? 'bg-[#3B82F6] text-white'
                          : index < currentStep
                          ? 'bg-green-600 text-white'
                          : 'bg-[#141414] text-gray-500'
                      }`}
                    >
                      {index < currentStep ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className={`ml-2 text-sm hidden lg:block ${
                      index === currentStep ? 'text-white' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] mx-2 transition-colors ${
                      index < currentStep ? 'bg-green-600' : 'bg-[#262626]'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="px-6 pt-4">
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Please fix the following errors:</p>
                  <ul className="mt-1 text-xs text-red-300 space-y-0.5">
                    {validationErrors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-[#262626] p-6 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 border border-[#262626] rounded-lg text-white hover:border-[#404040] transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
            
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handlePublish}
                className="px-6 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Publish Agent
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}