'use client'

import { useEffect, useState } from 'react'
import { X, Code, FileText, Settings, Save, AlertCircle, CheckCircle, Monitor, Play, Eye, Loader2 } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'

export default function NodeEditModal() {
  const { isEditModalOpen, editingNode, closeEditModal, updateEditingNode, saveEditingNode } = useFlowStore()
  const [activeTab, setActiveTab] = useState<'instructions' | 'claudemd' | 'config' | 'preview'>('instructions')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isValidating, setIsValidating] = useState(false)
  
  if (!isEditModalOpen || !editingNode) return null
  
  const handleSave = async () => {
    setIsValidating(true)
    const errors = await validateNode()
    setValidationErrors(errors)
    
    if (Object.keys(errors).length === 0) {
      saveEditingNode()
    }
    setIsValidating(false)
  }
  
  const validateNode = async (): Promise<Record<string, string>> => {
    const errors: Record<string, string> = {}
    
    if (!editingNode?.data.label?.trim()) {
      errors.label = 'Node label is required'
    }
    
    if (!editingNode?.data.instructions?.trim()) {
      errors.instructions = 'Instructions are required'
    }
    
    if (editingNode?.data.config.maxRetries < 0 || editingNode?.data.config.maxRetries > 10) {
      errors.maxRetries = 'Max retries must be between 0 and 10'
    }
    
    if (editingNode?.data.config.timeout < 30 || editingNode?.data.config.timeout > 3600) {
      errors.timeout = 'Timeout must be between 30 and 3600 seconds'
    }
    
    return errors
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={closeEditModal}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl h-[80vh] bg-bg-secondary border border-border-primary rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            <span className="text-lg">{editingNode.data.agent.icon}</span>
            <div>
              <h2 className="text-lg font-semibold">{editingNode.data.label}</h2>
              <p className="text-xs text-text-secondary">
                {editingNode.data.agent.type} • {editingNode.data.agent.version}
              </p>
            </div>
          </div>
          <button
            onClick={closeEditModal}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-border-primary">
          <button
            onClick={() => setActiveTab('instructions')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors relative ${
              activeTab === 'instructions'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Code className="w-4 h-4" />
            Instructions
            {validationErrors.instructions && (
              <AlertCircle className="w-4 h-4 text-error" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('claudemd')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'claudemd'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            Claude.md
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors relative ${
              activeTab === 'config'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configuration
            {(validationErrors.label || validationErrors.maxRetries || validationErrors.timeout) && (
              <AlertCircle className="w-4 h-4 text-error" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-accent-primary text-accent-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Preview
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'instructions' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Agent Instructions
                </label>
                <div className="text-xs text-text-muted">
                  {editingNode.data.instructions.length} characters
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={editingNode.data.instructions}
                  onChange={(e) => {
                    updateEditingNode({ instructions: e.target.value })
                    if (validationErrors.instructions) {
                      setValidationErrors(prev => ({ ...prev, instructions: '' }))
                    }
                  }}
                  className={`w-full h-[400px] px-3 py-2 bg-bg-primary border rounded-lg font-mono text-sm focus:outline-none transition-colors resize-none ${
                    validationErrors.instructions 
                      ? 'border-error focus:border-error' 
                      : 'border-border-primary focus:border-accent-primary'
                  }`}
                  placeholder="Enter specific instructions for this agent...\n\nExample:\n- Analyze the project requirements\n- Set up the basic file structure\n- Initialize configuration files\n- Create documentation templates"
                />
                {validationErrors.instructions && (
                  <div className="absolute top-2 right-2 bg-error text-white px-2 py-1 rounded text-xs">
                    {validationErrors.instructions}
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-accent-primary" />
                </div>
                <p className="text-xs text-text-muted">
                  These instructions will be provided to the Claude agent when it runs. Be specific about the tasks, expected outputs, and any constraints or requirements.
                </p>
              </div>
            </div>
          )}
          
          {activeTab === 'claudemd' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Claude.md Content
              </label>
              <textarea
                value={editingNode.data.claudeMD}
                onChange={(e) => updateEditingNode({ claudeMD: e.target.value })}
                className="w-full h-[400px] px-3 py-2 bg-bg-primary border border-border-primary rounded-lg font-mono text-sm focus:outline-none focus:border-accent-primary transition-colors resize-none"
                placeholder="# Claude.md content..."
              />
              <p className="mt-2 text-xs text-text-muted">
                This markdown content will be written to the claude.md file for the agent.
              </p>
            </div>
          )}
          
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Node Label *
                </label>
                <input
                  type="text"
                  value={editingNode.data.label}
                  onChange={(e) => {
                    updateEditingNode({ label: e.target.value })
                    if (validationErrors.label) {
                      setValidationErrors(prev => ({ ...prev, label: '' }))
                    }
                  }}
                  className={`w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm focus:outline-none transition-colors ${
                    validationErrors.label 
                      ? 'border-error focus:border-error' 
                      : 'border-border-primary focus:border-accent-primary'
                  }`}
                  placeholder="Enter a descriptive name for this node"
                />
                {validationErrors.label && (
                  <p className="mt-1 text-xs text-error">{validationErrors.label}</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    value={editingNode.data.config.maxRetries}
                    onChange={(e) => {
                      updateEditingNode({
                        config: {
                          ...editingNode.data.config,
                          maxRetries: parseInt(e.target.value) || 0,
                        },
                      })
                      if (validationErrors.maxRetries) {
                        setValidationErrors(prev => ({ ...prev, maxRetries: '' }))
                      }
                    }}
                    className={`w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm focus:outline-none transition-colors ${
                      validationErrors.maxRetries 
                        ? 'border-error focus:border-error' 
                        : 'border-border-primary focus:border-accent-primary'
                    }`}
                    min="0"
                    max="10"
                  />
                  {validationErrors.maxRetries && (
                    <p className="mt-1 text-xs text-error">{validationErrors.maxRetries}</p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">Number of times to retry if the agent fails (0-10)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={editingNode.data.config.timeout}
                    onChange={(e) => {
                      updateEditingNode({
                        config: {
                          ...editingNode.data.config,
                          timeout: parseInt(e.target.value) || 30,
                        },
                      })
                      if (validationErrors.timeout) {
                        setValidationErrors(prev => ({ ...prev, timeout: '' }))
                      }
                    }}
                    className={`w-full px-3 py-2 bg-bg-primary border rounded-lg text-sm focus:outline-none transition-colors ${
                      validationErrors.timeout 
                        ? 'border-error focus:border-error' 
                        : 'border-border-primary focus:border-accent-primary'
                    }`}
                    min="30"
                    max="3600"
                  />
                  {validationErrors.timeout && (
                    <p className="mt-1 text-xs text-error">{validationErrors.timeout}</p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">Maximum execution time (30-3600 seconds)</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium border-b border-border-primary pb-2">Execution Options</h3>
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border-primary hover:bg-bg-tertiary transition-colors">
                  <input
                    type="checkbox"
                    checked={editingNode.data.config.retryOnFailure}
                    onChange={(e) =>
                      updateEditingNode({
                        config: {
                          ...editingNode.data.config,
                          retryOnFailure: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 mt-0.5 bg-bg-primary border border-border-primary rounded text-accent-primary focus:ring-accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">Retry on failure</span>
                    <p className="text-xs text-text-muted mt-1">Automatically retry the agent if it fails, up to the max retry limit</p>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border-primary hover:bg-bg-tertiary transition-colors">
                  <input
                    type="checkbox"
                    checked={editingNode.data.config.requiresReview}
                    onChange={(e) =>
                      updateEditingNode({
                        config: {
                          ...editingNode.data.config,
                          requiresReview: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 mt-0.5 bg-bg-primary border border-border-primary rounded text-accent-primary focus:ring-accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium">Requires manual review</span>
                    <p className="text-xs text-text-muted mt-1">Pause execution after this agent completes and wait for manual approval</p>
                  </div>
                </label>
              </div>
              
              {/* Agent Info */}
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <span className="text-lg">{editingNode.data.agent.icon}</span>
                  Agent Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-text-muted">Category:</span>
                    <span className="ml-2 font-medium capitalize">{editingNode.data.agent.category}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Version:</span>
                    <span className="ml-2 font-medium">{editingNode.data.agent.version}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Inputs:</span>
                    <span className="ml-2 font-medium">{editingNode.data.agent.inputs.length}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Outputs:</span>
                    <span className="ml-2 font-medium">{editingNode.data.agent.outputs.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Node Preview */}
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Node Preview
                </h3>
                <div className="bg-bg-primary rounded-lg p-4 border border-border-primary">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-primary/20">
                        <span className="text-lg">{editingNode.data.agent.icon}</span>
                      </div>
                      <span className="font-bold text-sm">{editingNode.data.label}</span>
                    </div>
                    <div className="flex items-center justify-center w-6 h-6 rounded-full">
                      <Play className="w-4 h-4 text-text-secondary" />
                    </div>
                  </div>
                  
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold mb-3 bg-accent-primary/25 text-accent-primary border border-accent-primary/40">
                    {editingNode.data.agent.category.toUpperCase()}
                  </div>
                  
                  <p className="text-xs leading-relaxed text-text-secondary mb-3">
                    {editingNode.data.agent.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    {editingNode.data.config.requiresReview && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs text-warning bg-warning/10">
                        <Eye className="w-3 h-3" />
                        <span>Review Required</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      {editingNode.data.agent.inputs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
                          {editingNode.data.agent.inputs.length} in
                        </span>
                      )}
                      {editingNode.data.agent.outputs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-accent-primary"></div>
                          {editingNode.data.agent.outputs.length} out
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Configuration Summary */}
              <div className="bg-bg-tertiary rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuration Summary
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Max Retries:</span>
                      <span className="font-medium">{editingNode.data.config.maxRetries}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Timeout:</span>
                      <span className="font-medium">{editingNode.data.config.timeout}s</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Retry on Failure:</span>
                      <span className={`font-medium ${
                        editingNode.data.config.retryOnFailure ? 'text-success' : 'text-text-muted'
                      }`}>
                        {editingNode.data.config.retryOnFailure ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Requires Review:</span>
                      <span className={`font-medium ${
                        editingNode.data.config.requiresReview ? 'text-warning' : 'text-text-muted'
                      }`}>
                        {editingNode.data.config.requiresReview ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Instructions Preview */}
              {editingNode.data.instructions && (
                <div className="bg-bg-tertiary rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    Instructions Preview
                  </h3>
                  <div className="bg-bg-primary rounded-lg p-3 border border-border-primary">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-text-secondary leading-relaxed">
                      {editingNode.data.instructions.length > 300 
                        ? `${editingNode.data.instructions.substring(0, 300)}...` 
                        : editingNode.data.instructions
                      }
                    </pre>
                    {editingNode.data.instructions.length > 300 && (
                      <button 
                        onClick={() => setActiveTab('instructions')}
                        className="mt-2 text-xs text-accent-primary hover:underline"
                      >
                        View full instructions →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border-primary">
          <button
            onClick={closeEditModal}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating}
            className={`btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              Object.keys(validationErrors).length > 0 ? 'bg-error hover:bg-error/90' : ''
            }`}
          >
            {isValidating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : Object.keys(validationErrors).length > 0 ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isValidating ? 'Validating...' : Object.keys(validationErrors).length > 0 ? 'Fix Errors' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}