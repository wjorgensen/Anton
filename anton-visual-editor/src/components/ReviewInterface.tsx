'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Code2, 
  FileText, 
  Eye,
  GitCompareArrows,
  AlertTriangle,
  Send,
  Clock,
  User
} from 'lucide-react'

interface ReviewInterfaceProps {
  nodeId: string
  flowId: string
  reviewRequest: {
    scope: 'full' | 'changes' | 'specific'
    files?: string[]
    criteria?: string[]
    requiresApproval: boolean
    timeout?: number
    metadata?: any
  }
  onSubmitFeedback: (feedback: ReviewFeedback) => void
  onClose: () => void
}

interface ReviewFeedback {
  nodeId: string
  decision: 'approve' | 'reject' | 'request-changes'
  comments: string
  actionItems?: string[]
  severity?: 'info' | 'warning' | 'error'
}

interface FileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions: number
  deletions: number
  content?: string
}

export default function ReviewInterface({ 
  nodeId, 
  flowId, 
  reviewRequest,
  onSubmitFeedback,
  onClose 
}: ReviewInterfaceProps) {
  const [decision, setDecision] = useState<ReviewFeedback['decision']>('approve')
  const [comments, setComments] = useState('')
  const [actionItems, setActionItems] = useState<string[]>([])
  const [currentActionItem, setCurrentActionItem] = useState('')
  const [severity, setSeverity] = useState<ReviewFeedback['severity']>('info')
  const [activeTab, setActiveTab] = useState<'diff' | 'preview' | 'logs'>('diff')
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  // Mock data for demonstration - in real implementation, fetch from server
  useEffect(() => {
    // Simulate loading file diffs
    const mockDiffs: FileDiff[] = reviewRequest.files?.map(file => ({
      path: file,
      status: 'modified' as const,
      additions: Math.floor(Math.random() * 50),
      deletions: Math.floor(Math.random() * 20),
      content: `// Sample diff content for ${file}\n+ Added line\n- Removed line`
    })) || []
    setFileDiffs(mockDiffs)
    if (mockDiffs.length > 0) {
      setSelectedFile(mockDiffs[0].path)
    }

    // Setup timeout countdown if specified
    if (reviewRequest.timeout) {
      setTimeLeft(reviewRequest.timeout * 60)
    }
  }, [reviewRequest])

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft])

  const handleAddActionItem = () => {
    if (currentActionItem.trim()) {
      setActionItems([...actionItems, currentActionItem.trim()])
      setCurrentActionItem('')
    }
  }

  const handleRemoveActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    const feedback: ReviewFeedback = {
      nodeId,
      decision,
      comments,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      severity: decision === 'reject' ? 'error' : decision === 'request-changes' ? 'warning' : 'info'
    }
    onSubmitFeedback(feedback)
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-6xl h-[90vh] bg-bg-secondary border border-border-primary rounded-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Eye className="w-5 h-5 text-accent-primary" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Manual Review Checkpoint</h2>
              <p className="text-sm text-text-secondary">
                Node: {reviewRequest.metadata?.nodeLabel || nodeId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft !== null && (
              <div className="flex items-center gap-2 text-warning">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{formatTime(timeLeft)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Files and Diffs */}
          <div className="flex-1 flex flex-col border-r border-border-primary">
            {/* Tab Navigation */}
            <div className="px-4 py-2 border-b border-border-primary flex gap-4">
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'diff' 
                    ? 'bg-accent-primary text-white' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="w-4 h-4" />
                  Code Changes
                </div>
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'preview' 
                    ? 'bg-accent-primary text-white' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </div>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'logs' 
                    ? 'bg-accent-primary text-white' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Execution Logs
                </div>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {activeTab === 'diff' && (
                <>
                  {/* File List */}
                  <div className="w-64 border-r border-border-primary overflow-y-auto">
                    <div className="p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-text-primary mb-3">
                        Modified Files ({fileDiffs.length})
                      </h3>
                      {fileDiffs.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => setSelectedFile(file.path)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedFile === file.path
                              ? 'bg-accent-primary/20 text-accent-primary'
                              : 'hover:bg-bg-tertiary text-text-secondary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate">{file.path.split('/').pop()}</span>
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-success">+{file.additions}</span>
                              <span className="text-error">-{file.deletions}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Diff Viewer */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                      {selectedFile && (
                        <div className="bg-bg-primary rounded-lg p-4 font-mono text-sm">
                          <div className="mb-4 text-text-secondary">
                            {selectedFile}
                          </div>
                          <pre className="whitespace-pre-wrap">
                            {fileDiffs.find(f => f.path === selectedFile)?.content || 'No changes'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'preview' && (
                <div className="flex-1 p-4">
                  <div className="bg-bg-primary rounded-lg h-full flex items-center justify-center text-text-secondary">
                    <div className="text-center">
                      <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Live preview will be displayed here</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="flex-1 p-4">
                  <div className="bg-bg-primary rounded-lg p-4 font-mono text-sm text-text-secondary h-full overflow-y-auto">
                    <div>Agent execution logs will appear here...</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Review Form */}
          <div className="w-96 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Review Criteria */}
              {reviewRequest.criteria && reviewRequest.criteria.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Review Criteria</h3>
                  <div className="space-y-2">
                    {reviewRequest.criteria.map((criterion, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <span>{criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Decision</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border-primary cursor-pointer hover:bg-bg-tertiary transition-colors">
                    <input
                      type="radio"
                      name="decision"
                      value="approve"
                      checked={decision === 'approve'}
                      onChange={(e) => setDecision(e.target.value as ReviewFeedback['decision'])}
                      className="text-accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium">Approve</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border-primary cursor-pointer hover:bg-bg-tertiary transition-colors">
                    <input
                      type="radio"
                      name="decision"
                      value="request-changes"
                      checked={decision === 'request-changes'}
                      onChange={(e) => setDecision(e.target.value as ReviewFeedback['decision'])}
                      className="text-accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-warning" />
                      <span className="text-sm font-medium">Request Changes</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-border-primary cursor-pointer hover:bg-bg-tertiary transition-colors">
                    <input
                      type="radio"
                      name="decision"
                      value="reject"
                      checked={decision === 'reject'}
                      onChange={(e) => setDecision(e.target.value as ReviewFeedback['decision'])}
                      className="text-accent-primary"
                    />
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-error" />
                      <span className="text-sm font-medium">Reject</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">Comments</h3>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Provide feedback or explanation for your decision..."
                  className="w-full h-32 px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary resize-none"
                />
              </div>

              {/* Action Items (for request-changes) */}
              {decision === 'request-changes' && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Action Items</h3>
                  <div className="space-y-2">
                    {actionItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-bg-primary rounded-md">
                        <span className="flex-1 text-sm text-text-secondary">{item}</span>
                        <button
                          onClick={() => handleRemoveActionItem(index)}
                          className="text-error hover:text-error/80 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={currentActionItem}
                        onChange={(e) => setCurrentActionItem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddActionItem()}
                        placeholder="Add action item..."
                        className="flex-1 px-3 py-2 bg-bg-primary border border-border-primary rounded-md text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-primary"
                      />
                      <button
                        onClick={handleAddActionItem}
                        className="px-3 py-2 bg-accent-primary text-white rounded-md hover:bg-accent-hover transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="p-6 border-t border-border-primary">
              <button
                onClick={handleSubmit}
                className="w-full py-2.5 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}