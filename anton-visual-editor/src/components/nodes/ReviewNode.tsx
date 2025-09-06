'use client'

import { memo, useState } from 'react'
import { NodeProps, Handle, Position } from '@xyflow/react'
import { Eye, CheckCircle2, XCircle, MessageSquare, Clock, AlertCircle } from 'lucide-react'

interface ReviewNodeData {
  label: string
  agentConfig: {
    name: string
    description?: string
  }
  reviewScope?: 'full' | 'changes' | 'specific'
  status?: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'changes-requested'
  requiresApproval?: boolean
  timeout?: number
  feedback?: Array<{
    id: string
    message: string
    severity: 'info' | 'warning' | 'error'
    timestamp: string
  }>
  approvers?: string[]
  currentReviewer?: string
}

const statusConfig = {
  pending: {
    color: '#666666',
    icon: Clock,
    label: 'Pending Review',
  },
  reviewing: {
    color: '#3B82F6',
    icon: Eye,
    label: 'Under Review',
  },
  approved: {
    color: '#10B981',
    icon: CheckCircle2,
    label: 'Approved',
  },
  rejected: {
    color: '#EF4444',
    icon: XCircle,
    label: 'Rejected',
  },
  'changes-requested': {
    color: '#F59E0B',
    icon: MessageSquare,
    label: 'Changes Requested',
  },
}

function ReviewNode({ data, selected }: NodeProps<ReviewNodeData>) {
  const [showDetails, setShowDetails] = useState(false)
  const status = data.status || 'pending'
  const StatusIcon = statusConfig[status].icon
  const statusColor = statusConfig[status].color

  return (
    <div
      className={`
        relative min-w-[250px] rounded-lg border-2 transition-all duration-200
        ${selected ? 'border-accent-primary shadow-lg shadow-accent-glow' : 'border-border-primary'}
        bg-bg-secondary hover:bg-bg-tertiary
      `}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-accent-primary !w-3 !h-3 !border-2 !border-bg-primary"
      />
      
      {/* Header */}
      <div
        className="px-3 py-2 border-b border-border-primary rounded-t-md"
        style={{ backgroundColor: `${statusColor}20` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
            <span className="text-xs font-medium text-text-secondary">
              {statusConfig[status].label}
            </span>
          </div>
          {data.requiresApproval && (
            <AlertCircle className="w-4 h-4 text-warning" title="Requires manual approval" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <h3 className="text-sm font-semibold text-text-primary mb-1">
          {data.label || data.agentConfig?.name || 'Manual Review'}
        </h3>
        
        {data.reviewScope && (
          <div className="text-xs text-text-secondary mb-2">
            Scope: <span className="text-accent-primary capitalize">{data.reviewScope}</span>
          </div>
        )}

        {/* Review Stats */}
        {(data.approvers || data.feedback) && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-primary">
            {data.approvers && data.approvers.length > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-success" />
                <span className="text-xs text-text-secondary">
                  {data.approvers.length} approved
                </span>
              </div>
            )}
            {data.feedback && data.feedback.length > 0 && (
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3 text-info" />
                <span className="text-xs text-text-secondary">
                  {data.feedback.length} comments
                </span>
              </div>
            )}
          </div>
        )}

        {/* Current Reviewer */}
        {data.currentReviewer && status === 'reviewing' && (
          <div className="mt-2 pt-2 border-t border-border-primary">
            <div className="text-xs text-text-secondary">
              Reviewer: <span className="text-accent-primary">{data.currentReviewer}</span>
            </div>
          </div>
        )}
      </div>

      {/* Timeout Indicator */}
      {data.timeout && status === 'reviewing' && (
        <div className="absolute -top-2 -right-2 bg-bg-tertiary border border-border-primary rounded-full px-2 py-0.5">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-warning" />
            <span className="text-xs text-text-secondary">{data.timeout}m</span>
          </div>
        </div>
      )}

      {/* Feedback Preview (on hover) */}
      {showDetails && data.feedback && data.feedback.length > 0 && (
        <div className="absolute z-10 top-full left-0 mt-2 w-64 bg-bg-secondary border border-border-primary rounded-lg shadow-xl p-3">
          <h4 className="text-xs font-semibold text-text-primary mb-2">Recent Feedback</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {data.feedback.slice(0, 3).map((item) => (
              <div key={item.id} className="text-xs">
                <div className={`
                  flex items-start gap-2 p-2 rounded border
                  ${item.severity === 'error' ? 'border-error bg-error/10' : ''}
                  ${item.severity === 'warning' ? 'border-warning bg-warning/10' : ''}
                  ${item.severity === 'info' ? 'border-info bg-info/10' : ''}
                `}>
                  <span className="text-text-secondary line-clamp-2">{item.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-accent-primary !w-3 !h-3 !border-2 !border-bg-primary"
      />
    </div>
  )
}

export default memo(ReviewNode)