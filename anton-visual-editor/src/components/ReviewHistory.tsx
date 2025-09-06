'use client'

import { useState, useEffect } from 'react'
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar
} from 'lucide-react'

interface ReviewHistoryItem {
  id: string
  nodeId: string
  nodeName: string
  timestamp: Date
  decision: 'approve' | 'reject' | 'request-changes'
  reviewer: string
  comments: string
  actionItems?: string[]
  duration?: number // in seconds
  retryCount?: number
}

interface ReviewHistoryProps {
  flowId: string
  nodeId?: string // Optional: filter by specific node
  onSelectReview?: (review: ReviewHistoryItem) => void
}

export default function ReviewHistory({ flowId, nodeId, onSelectReview }: ReviewHistoryProps) {
  const [history, setHistory] = useState<ReviewHistoryItem[]>([])
  const [filteredHistory, setFilteredHistory] = useState<ReviewHistoryItem[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [filterDecision, setFilterDecision] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'node' | 'decision'>('date')
  const [isLoading, setIsLoading] = useState(true)

  // Load review history
  useEffect(() => {
    loadHistory()
  }, [flowId, nodeId])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      // In real implementation, fetch from API
      // const response = await fetch(`/api/flows/${flowId}/review-history${nodeId ? `?nodeId=${nodeId}` : ''}`)
      // const data = await response.json()
      
      // Mock data for demonstration
      const mockHistory: ReviewHistoryItem[] = [
        {
          id: 'review-1',
          nodeId: 'node-1',
          nodeName: 'React Component Development',
          timestamp: new Date(Date.now() - 3600000),
          decision: 'approve',
          reviewer: 'john.doe@example.com',
          comments: 'Looks good! The component follows best practices.',
          duration: 240,
          retryCount: 0
        },
        {
          id: 'review-2',
          nodeId: 'node-2',
          nodeName: 'API Integration',
          timestamp: new Date(Date.now() - 7200000),
          decision: 'request-changes',
          reviewer: 'jane.smith@example.com',
          comments: 'Please add error handling for API failures.',
          actionItems: [
            'Add try-catch blocks around API calls',
            'Implement retry logic with exponential backoff',
            'Add user-friendly error messages'
          ],
          duration: 480,
          retryCount: 1
        },
        {
          id: 'review-3',
          nodeId: 'node-3',
          nodeName: 'Unit Tests',
          timestamp: new Date(Date.now() - 10800000),
          decision: 'reject',
          reviewer: 'admin@example.com',
          comments: 'Tests are failing. Please fix before proceeding.',
          actionItems: [
            'Fix failing test cases',
            'Add missing test coverage'
          ],
          duration: 360,
          retryCount: 2
        }
      ]
      
      setHistory(mockHistory)
    } catch (error) {
      console.error('Failed to load review history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...history]
    
    // Apply decision filter
    if (filterDecision !== 'all') {
      filtered = filtered.filter(item => item.decision === filterDecision)
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.timestamp.getTime() - a.timestamp.getTime()
        case 'node':
          return a.nodeName.localeCompare(b.nodeName)
        case 'decision':
          return a.decision.localeCompare(b.decision)
        default:
          return 0
      }
    })
    
    setFilteredHistory(filtered)
  }, [history, filterDecision, sortBy])

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const getDecisionIcon = (decision: ReviewHistoryItem['decision']) => {
    switch (decision) {
      case 'approve':
        return <CheckCircle2 className="w-4 h-4 text-success" />
      case 'reject':
        return <XCircle className="w-4 h-4 text-error" />
      case 'request-changes':
        return <MessageSquare className="w-4 h-4 text-warning" />
    }
  }

  const getDecisionColor = (decision: ReviewHistoryItem['decision']) => {
    switch (decision) {
      case 'approve':
        return 'text-success'
      case 'reject':
        return 'text-error'
      case 'request-changes':
        return 'text-warning'
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatTimestamp = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / 3600000)
    
    if (hours < 1) {
      const mins = Math.floor(diff / 60000)
      return `${mins} minute${mins !== 1 ? 's' : ''} ago`
    } else if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else {
      const days = Math.floor(hours / 24)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-secondary">Loading review history...</div>
      </div>
    )
  }

  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent-primary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Review History {nodeId && `(Node: ${nodeId})`}
            </h3>
          </div>
          <div className="text-xs text-text-secondary">
            {filteredHistory.length} review{filteredHistory.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-border-primary flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-secondary" />
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="text-xs bg-bg-primary border border-border-primary rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent-primary"
          >
            <option value="all">All Decisions</option>
            <option value="approve">Approved</option>
            <option value="reject">Rejected</option>
            <option value="request-changes">Changes Requested</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-bg-primary border border-border-primary rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent-primary"
          >
            <option value="date">Date</option>
            <option value="node">Node</option>
            <option value="decision">Decision</option>
          </select>
        </div>
      </div>

      {/* History Items */}
      <div className="max-h-96 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <div className="px-4 py-8 text-center text-text-secondary text-sm">
            No review history available
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {filteredHistory.map((item) => {
              const isExpanded = expandedItems.has(item.id)
              
              return (
                <div key={item.id} className="hover:bg-bg-tertiary transition-colors">
                  <div
                    className="px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpanded(item.id)}
                  >
                    <div className="flex items-start gap-3">
                      <button className="mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-text-secondary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-secondary" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getDecisionIcon(item.decision)}
                            <span className="text-sm font-medium text-text-primary">
                              {item.nodeName}
                            </span>
                            <span className={`text-xs ${getDecisionColor(item.decision)}`}>
                              {item.decision.replace('-', ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-text-secondary">
                            {formatTimestamp(item.timestamp)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-text-secondary">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{item.reviewer}</span>
                          </div>
                          {item.duration && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(item.duration)}</span>
                            </div>
                          )}
                          {item.retryCount && item.retryCount > 0 && (
                            <span className="text-warning">
                              {item.retryCount} retr{item.retryCount === 1 ? 'y' : 'ies'}
                            </span>
                          )}
                        </div>
                        
                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            <div className="text-sm text-text-secondary">
                              {item.comments}
                            </div>
                            
                            {item.actionItems && item.actionItems.length > 0 && (
                              <div className="bg-bg-primary rounded-md p-2">
                                <div className="text-xs font-medium text-text-primary mb-1">
                                  Action Items:
                                </div>
                                <ul className="space-y-1">
                                  {item.actionItems.map((action, index) => (
                                    <li key={index} className="text-xs text-text-secondary flex items-start gap-1">
                                      <span className="text-accent-primary mt-0.5">•</span>
                                      <span>{action}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {onSelectReview && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectReview(item)
                                }}
                                className="text-xs text-accent-primary hover:text-accent-hover transition-colors"
                              >
                                View Details →
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}