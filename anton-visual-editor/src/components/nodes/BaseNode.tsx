'use client'

import { useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { AgentConfig, NodeStatus } from '@/types/agent'
import { Play, CheckCircle, XCircle, Loader2, Eye, Edit, Copy, Trash2, Settings } from 'lucide-react'
import { useFlowStore } from '@/store/flowStore'

interface BaseNodeData {
  agent: AgentConfig
  label: string
  instructions: string
  claudeMD: string
  status: NodeStatus
  inputs: Record<string, any>
  outputs: Record<string, any>
  config: {
    retryOnFailure: boolean
    maxRetries: number
    timeout: number
    requiresReview: boolean
  }
}

interface BaseNodeProps extends NodeProps<BaseNodeData> {
  categoryColor: string
}

const statusIcons: Record<NodeStatus, React.ReactNode> = {
  pending: <Play className="w-4 h-4" />,
  running: <Loader2 className="w-4 h-4 animate-spin" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  reviewing: <Eye className="w-4 h-4" />,
}

const statusColors: Record<NodeStatus, string> = {
  pending: 'text-text-secondary',
  running: 'text-accent-primary',
  completed: 'text-success',
  failed: 'text-error',
  reviewing: 'text-warning',
}

export default function BaseNode({ data, selected, categoryColor, id }: BaseNodeProps) {
  const { agent, label, status } = data
  const [isHovered, setIsHovered] = useState(false)
  const { selectNode, openEditModal, deleteNode, duplicateNode } = useFlowStore()
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    openEditModal({ id, data, type: agent.category, position: { x: 0, y: 0 } })
  }
  
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation()
    duplicateNode(id)
  }
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteNode(id)
  }
  
  // Create gradient colors based on category
  const getGradient = (color: string) => {
    // Convert hex to RGB for gradient manipulation
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
    
    const rgb = hexToRgb(color)
    if (!rgb) return color
    
    // Create a slightly darker version for gradient
    const darkerRgb = {
      r: Math.max(0, rgb.r - 40),
      g: Math.max(0, rgb.g - 40),
      b: Math.max(0, rgb.b - 40)
    }
    
    return `linear-gradient(135deg, ${color}, rgb(${darkerRgb.r}, ${darkerRgb.g}, ${darkerRgb.b}))`
  }
  
  return (
    <div
      className={`
        relative min-w-[200px] p-4 rounded-xl transition-all duration-300 shadow-lg group cursor-pointer
        ${selected ? 'ring-2 ring-offset-2 ring-offset-bg-primary transform scale-105 z-10' : ''}
        ${isHovered ? 'transform scale-102 z-20' : ''}
        ${status === 'running' ? 'animate-pulse' : ''}
        overflow-hidden backdrop-blur-sm
      `}
      style={{
        background: selected 
          ? getGradient(categoryColor)
          : isHovered 
            ? `linear-gradient(135deg, ${categoryColor}25, ${categoryColor}10)`
            : `linear-gradient(135deg, ${categoryColor}15, ${categoryColor}05)`,
        borderColor: selected ? categoryColor : isHovered ? `${categoryColor}50` : `${categoryColor}30`,
        ringColor: selected ? categoryColor : undefined,
        boxShadow: selected 
          ? `0 20px 40px ${categoryColor}40, 0 0 0 1px ${categoryColor}60`
          : isHovered
            ? `0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px ${categoryColor}50`
            : `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px ${categoryColor}30`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => selectNode(id)}
    >
      {/* Animated Background Pattern */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            ${categoryColor} 10px,
            ${categoryColor} 11px
          )`
        }}
      />
      
      {/* Status Glow Effect */}
      {status === 'running' && (
        <div 
          className="absolute inset-0 rounded-xl opacity-30 animate-pulse pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${categoryColor}60, transparent 70%)`,
          }}
        />
      )}
      
      {/* Quick Action Buttons */}
      <div className={`absolute -top-2 -right-2 flex gap-1 transition-all duration-200 ${
        isHovered || selected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}>
        <button
          onClick={handleEdit}
          className="w-8 h-8 bg-bg-secondary border border-border-primary rounded-full flex items-center justify-center hover:bg-bg-tertiary transition-colors shadow-lg backdrop-blur"
          title="Edit Node"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={handleDuplicate}
          className="w-8 h-8 bg-bg-secondary border border-border-primary rounded-full flex items-center justify-center hover:bg-bg-tertiary transition-colors shadow-lg backdrop-blur"
          title="Duplicate Node"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={handleDelete}
          className="w-8 h-8 bg-error/90 border border-error rounded-full flex items-center justify-center hover:bg-error transition-colors shadow-lg backdrop-blur text-white"
          title="Delete Node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      {/* Enhanced Handles */}
      {agent.inputs.length > 0 && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-5 h-5 transition-all duration-200 hover:scale-125 hover:shadow-glow"
          style={{ 
            background: selected ? '#ffffff' : categoryColor,
            border: `3px solid ${categoryColor}`,
            boxShadow: `0 0 15px ${categoryColor}60`,
            left: -10,
          }}
        />
      )}
      {agent.outputs.length > 0 && (
        <Handle
          type="source"
          position={Position.Right}
          className="w-5 h-5 transition-all duration-200 hover:scale-125 hover:shadow-glow"
          style={{ 
            background: selected ? '#ffffff' : categoryColor,
            border: `3px solid ${categoryColor}`,
            boxShadow: `0 0 15px ${categoryColor}60`,
            right: -10,
          }}
        />
      )}
      
      {/* Header */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg"
                 style={{ background: `${categoryColor}20` }}>
              <span className="text-xl">{agent.icon}</span>
            </div>
            <span className={`font-bold text-sm ${selected ? 'text-white' : 'text-text-primary'}`}>
              {label}
            </span>
          </div>
          <div className={`${statusColors[status]} transition-all duration-200`}>
            <div className="flex items-center justify-center w-6 h-6 rounded-full"
                 style={{ backgroundColor: status === 'running' ? `${categoryColor}20` : 'transparent' }}>
              {statusIcons[status]}
            </div>
          </div>
        </div>
        
        {/* Category Badge */}
        <div
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold mb-3 backdrop-blur"
          style={{
            backgroundColor: selected ? 'rgba(255,255,255,0.2)' : `${categoryColor}25`,
            color: selected ? 'white' : categoryColor,
            border: `1px solid ${categoryColor}40`,
          }}
        >
          {agent.category.toUpperCase()}
        </div>
        
        {/* Description */}
        <p className={`text-xs leading-relaxed mb-3 ${selected ? 'text-white/90' : 'text-text-secondary'}`}>
          {agent.description}
        </p>
        
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          {/* Review Badge */}
          {data.config.requiresReview && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              selected ? 'text-white/80 bg-white/20' : 'text-warning bg-warning/10'
            }`}>
              <Eye className="w-3 h-3" />
              <span>Review Required</span>
            </div>
          )}
          
          {/* Connection Ports Info */}
          {(agent.inputs.length > 0 || agent.outputs.length > 0) && (
            <div className={`flex items-center gap-2 text-xs ${selected ? 'text-white/70' : 'text-text-muted'}`}>
              {agent.inputs.length > 0 && (
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }}></div>
                  {agent.inputs.length} in
                </span>
              )}
              {agent.outputs.length > 0 && (
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }}></div>
                  {agent.outputs.length} out
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}