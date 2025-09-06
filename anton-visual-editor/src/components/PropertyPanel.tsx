'use client'

import React, { useState, useEffect } from 'react'
import { 
  X, 
  ChevronDown, 
  ChevronRight, 
  Settings, 
  Info, 
  Code, 
  Play,
  Clock,
  Zap,
  Users,
  Tag,
  FileText
} from 'lucide-react'
import { Node } from '@xyflow/react'
import { AgentConfig } from '@/types/agent'

interface PropertyPanelProps {
  selectedNode: Node | null
  isOpen: boolean
  onClose: () => void
  onUpdateNode: (nodeId: string, updates: any) => void
}

interface AccordionSectionProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function AccordionSection({ title, icon, isExpanded, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="border border-border-primary rounded-lg mb-3 overflow-hidden bg-bg-secondary/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-bg-tertiary/50 transition-all duration-200"
      >
        <div className="text-accent-primary">{icon}</div>
        <span className="font-medium text-text-primary flex-1">{title}</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-secondary" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-border-primary/50 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

export default function PropertyPanel({ selectedNode, isOpen, onClose, onUpdateNode }: PropertyPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['basic', 'configuration'])
  )
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (selectedNode?.data) {
      setFormData({
        label: selectedNode.data.label || '',
        instructions: selectedNode.data.instructions || '',
        timeout: selectedNode.data.config?.timeout || 300,
        maxRetries: selectedNode.data.config?.maxRetries || 3,
        requiresReview: selectedNode.data.config?.requiresReview || false,
      })
    }
  }, [selectedNode])

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value }
    setFormData(newFormData)
    
    if (selectedNode) {
      onUpdateNode(selectedNode.id, {
        ...selectedNode.data,
        [field]: value,
        config: {
          ...selectedNode.data.config,
          [field]: value
        }
      })
    }
  }

  if (!isOpen) return null

  const agent = selectedNode?.data?.agent as AgentConfig

  return (
    <div className={`fixed right-0 top-0 h-full w-80 bg-bg-primary border-l border-border-primary z-30 transform transition-all duration-300 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-border-primary bg-gradient-to-r from-bg-secondary to-bg-tertiary">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Properties</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-quaternary rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
        {selectedNode && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl">{agent?.icon}</span>
            <div>
              <div className="font-medium text-text-primary">{selectedNode.data?.label}</div>
              <div className="text-xs text-text-secondary uppercase tracking-wider">
                {agent?.category}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedNode ? (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Basic Information */}
          <AccordionSection
            title="Basic Information"
            icon={<Info className="w-4 h-4" />}
            isExpanded={expandedSections.has('basic')}
            onToggle={() => toggleSection('basic')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Label
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => handleFormChange('label', e.target.value)}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Description
                </label>
                <p className="text-sm text-text-secondary bg-bg-tertiary p-3 rounded-lg">
                  {agent?.description}
                </p>
              </div>
            </div>
          </AccordionSection>

          {/* Configuration */}
          <AccordionSection
            title="Configuration"
            icon={<Settings className="w-4 h-4" />}
            isExpanded={expandedSections.has('configuration')}
            onToggle={() => toggleSection('configuration')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Timeout (seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  max="3600"
                  value={formData.timeout}
                  onChange={(e) => handleFormChange('timeout', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Max Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.maxRetries}
                  onChange={(e) => handleFormChange('maxRetries', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.requiresReview}
                  onChange={(e) => handleFormChange('requiresReview', e.target.checked)}
                  className="w-4 h-4 text-accent-primary bg-bg-tertiary border-border-primary rounded focus:ring-accent-primary/50"
                />
                <label className="text-sm font-medium text-text-secondary">
                  Requires Review
                </label>
              </div>
            </div>
          </AccordionSection>

          {/* Instructions */}
          <AccordionSection
            title="Custom Instructions"
            icon={<Code className="w-4 h-4" />}
            isExpanded={expandedSections.has('instructions')}
            onToggle={() => toggleSection('instructions')}
          >
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Additional Instructions
              </label>
              <textarea
                value={formData.instructions}
                onChange={(e) => handleFormChange('instructions', e.target.value)}
                placeholder="Add custom instructions for this agent..."
                rows={4}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none"
              />
            </div>
          </AccordionSection>

          {/* Agent Details */}
          <AccordionSection
            title="Agent Details"
            icon={<FileText className="w-4 h-4" />}
            isExpanded={expandedSections.has('details')}
            onToggle={() => toggleSection('details')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-tertiary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Estimated Time
                    </span>
                  </div>
                  <div className="text-sm text-text-primary font-medium">
                    {agent?.resources?.estimatedTime || 0} min
                  </div>
                </div>
                <div className="bg-bg-tertiary p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-text-secondary" />
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Tokens
                    </span>
                  </div>
                  <div className="text-sm text-text-primary font-medium">
                    {Math.round((agent?.resources?.estimatedTokens || 0) / 1000)}K
                  </div>
                </div>
              </div>

              {agent?.inputs && agent.inputs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="w-4 h-4 text-text-secondary rotate-180" />
                    <span className="text-sm font-medium text-text-secondary">Inputs</span>
                  </div>
                  <div className="space-y-2">
                    {agent.inputs.map((input, index) => (
                      <div key={index} className="bg-bg-tertiary p-2 rounded text-xs">
                        <span className="font-medium text-accent-primary">{input.name}</span>
                        <span className="text-text-secondary ml-2">({input.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agent?.outputs && agent.outputs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Play className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium text-text-secondary">Outputs</span>
                  </div>
                  <div className="space-y-2">
                    {agent.outputs.map((output, index) => (
                      <div key={index} className="bg-bg-tertiary p-2 rounded text-xs">
                        <span className="font-medium text-success">{output.name}</span>
                        <span className="text-text-secondary ml-2">({output.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {agent?.tags && agent.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium text-text-secondary">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {agent.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-bg-quaternary text-text-secondary rounded border border-border-secondary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">No node selected</p>
            <p className="text-sm text-text-muted mt-1">
              Click on a node to view its properties
            </p>
          </div>
        </div>
      )}
    </div>
  )
}