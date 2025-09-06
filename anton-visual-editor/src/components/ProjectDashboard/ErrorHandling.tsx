'use client';

import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  XCircle,
  AlertTriangle,
  Bug,
  Zap,
  RefreshCw,
  Eye,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Code,
  FileText,
  ExternalLink,
  Copy,
  Search,
  Filter,
  Download,
  Settings,
  PlayCircle,
  CheckCircle,
  ArrowRight,
  Terminal,
  Layers
} from 'lucide-react';

interface ExecutionError {
  id: string;
  nodeId: string;
  nodeName: string;
  category: string;
  timestamp: Date;
  errorType: 'validation' | 'runtime' | 'timeout' | 'network' | 'permission' | 'resource' | 'logic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stackTrace?: string;
  context?: {
    inputData?: any;
    environment?: string;
    dependencies?: string[];
    resourceUsage?: {
      cpu: number;
      memory: number;
      tokens: number;
    };
  };
  suggestions?: string[];
  relatedErrors?: string[];
  retryCount: number;
  maxRetries: number;
  isResolved: boolean;
  resolution?: {
    method: 'retry' | 'manual' | 'auto';
    timestamp: Date;
    notes?: string;
  };
}

interface ErrorHandlingProps {
  errors: ExecutionError[];
  onRetryNode?: (nodeId: string) => void;
  onViewNodeDetails?: (nodeId: string) => void;
  onResolveError?: (errorId: string, method: string, notes?: string) => void;
  onExportErrors?: () => void;
}

export default function ErrorHandling({
  errors,
  onRetryNode,
  onViewNodeDetails,
  onResolveError,
  onExportErrors
}: ErrorHandlingProps) {
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showResolved, setShowResolved] = useState(false);

  // Filter and sort errors
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      const matchesSearch = !searchTerm || 
        error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        error.nodeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        error.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSeverity = severityFilter === 'all' || error.severity === severityFilter;
      const matchesType = typeFilter === 'all' || error.errorType === typeFilter;
      const matchesResolved = showResolved || !error.isResolved;
      
      return matchesSearch && matchesSeverity && matchesType && matchesResolved;
    }).sort((a, b) => {
      // Sort by severity first, then by timestamp
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [errors, searchTerm, severityFilter, typeFilter, showResolved]);

  // Error statistics
  const errorStats = useMemo(() => {
    const total = filteredErrors.length;
    const critical = filteredErrors.filter(e => e.severity === 'critical').length;
    const high = filteredErrors.filter(e => e.severity === 'high').length;
    const resolved = filteredErrors.filter(e => e.isResolved).length;
    const retryable = filteredErrors.filter(e => e.retryCount < e.maxRetries && !e.isResolved).length;
    
    const errorTypes = filteredErrors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      critical,
      high,
      resolved,
      retryable,
      errorTypes
    };
  }, [filteredErrors]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'low':
        return <Bug className="w-4 h-4 text-blue-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'validation':
        return <CheckCircle className="w-4 h-4" />;
      case 'runtime':
        return <PlayCircle className="w-4 h-4" />;
      case 'timeout':
        return <Clock className="w-4 h-4" />;
      case 'network':
        return <Zap className="w-4 h-4" />;
      case 'permission':
        return <User className="w-4 h-4" />;
      case 'resource':
        return <Layers className="w-4 h-4" />;
      default:
        return <Bug className="w-4 h-4" />;
    }
  };

  const toggleErrorExpansion = (errorId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedErrors(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatStackTrace = (stackTrace: string) => {
    return stackTrace.split('\n').map((line, index) => (
      <div key={index} className="font-mono text-xs text-gray-300 hover:bg-[#1A1A1A] px-2 py-1 rounded">
        {line}
      </div>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header with Statistics */}
      <div className="border-b border-[#262626] p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Error Management</h2>
            <p className="text-sm text-gray-400 mt-1">Track, analyze, and resolve execution errors</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onExportErrors}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Error Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Total Errors</span>
              <AlertCircle className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-white">{errorStats.total}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Critical</span>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{errorStats.critical}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">High Priority</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400">{errorStats.high}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Resolved</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-green-400">{errorStats.resolved}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Retryable</span>
              <RefreshCw className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400">{errorStats.retryable}</div>
          </div>

          <div className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Success Rate</span>
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {errorStats.total > 0 ? ((errorStats.resolved / errorStats.total) * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="border-b border-[#262626] p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search errors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="validation">Validation</option>
            <option value="runtime">Runtime</option>
            <option value="timeout">Timeout</option>
            <option value="network">Network</option>
            <option value="permission">Permission</option>
            <option value="resource">Resource</option>
            <option value="logic">Logic</option>
          </select>

          {/* Show Resolved Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="w-4 h-4 text-blue-500 bg-[#0A0A0A] border-gray-600 rounded focus:ring-blue-500"
            />
            Show Resolved
          </label>
        </div>
      </div>

      {/* Error List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {filteredErrors.map((error) => (
            <div
              key={error.id}
              className={`bg-[#0A0A0A] border rounded-xl transition-all ${
                error.isResolved 
                  ? 'border-green-500/20 bg-green-500/5' 
                  : error.severity === 'critical'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-[#262626] hover:border-[#404040]'
              }`}
            >
              {/* Error Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleErrorExpansion(error.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {expandedErrors.has(error.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Error Info */}
                    <div className="flex items-center gap-3">
                      {getSeverityIcon(error.severity)}
                      <div>
                        <h3 className="text-white font-medium">{error.nodeName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span>{error.timestamp.toLocaleString()}</span>
                          <div className="flex items-center gap-1">
                            {getTypeIcon(error.errorType)}
                            <span className="capitalize">{error.errorType}</span>
                          </div>
                          <span className="capitalize">{error.category}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(error.severity)}`}>
                      {error.severity}
                    </div>

                    {error.isResolved ? (
                      <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400">
                        Resolved
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {error.retryCount < error.maxRetries && (
                          <button
                            onClick={() => onRetryNode?.(error.nodeId)}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 inline" />
                            Retry ({error.retryCount}/{error.maxRetries})
                          </button>
                        )}
                        <button
                          onClick={() => onViewNodeDetails?.(error.nodeId)}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                <div className="mt-3 pl-8">
                  <p className="text-sm text-gray-300">{error.message}</p>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedErrors.has(error.id) && (
                <div className="border-t border-[#262626] p-4 space-y-4">
                  {/* Stack Trace */}
                  {error.stackTrace && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white">Stack Trace</h4>
                        <button
                          onClick={() => copyToClipboard(error.stackTrace!)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="bg-[#141414] rounded-lg p-3 max-h-40 overflow-y-auto">
                        {formatStackTrace(error.stackTrace)}
                      </div>
                    </div>
                  )}

                  {/* Context Information */}
                  {error.context && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {error.context.inputData && (
                        <div>
                          <h4 className="text-sm font-medium text-white mb-2">Input Data</h4>
                          <div className="bg-[#141414] rounded-lg p-3">
                            <pre className="text-xs text-gray-300 overflow-x-auto">
                              {JSON.stringify(error.context.inputData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {error.context.resourceUsage && (
                        <div>
                          <h4 className="text-sm font-medium text-white mb-2">Resource Usage</h4>
                          <div className="bg-[#141414] rounded-lg p-3 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">CPU:</span>
                              <span className="text-white">{error.context.resourceUsage.cpu}%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Memory:</span>
                              <span className="text-white">{error.context.resourceUsage.memory}MB</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">Tokens:</span>
                              <span className="text-white">{error.context.resourceUsage.tokens}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggestions */}
                  {error.suggestions && error.suggestions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-white mb-2">Suggestions</h4>
                      <div className="space-y-2">
                        {error.suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-blue-300">{suggestion}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution Actions */}
                  {!error.isResolved && (
                    <div className="flex items-center gap-2 pt-2 border-t border-[#262626]">
                      <button
                        onClick={() => onResolveError?.(error.id, 'manual', 'Manually resolved')}
                        className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      >
                        Mark as Resolved
                      </button>
                      
                      {error.retryCount < error.maxRetries && (
                        <button
                          onClick={() => onRetryNode?.(error.nodeId)}
                          className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                        >
                          Retry Node
                        </button>
                      )}
                    </div>
                  )}

                  {/* Resolution Info */}
                  {error.isResolved && error.resolution && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium text-green-400">
                          Resolved via {error.resolution.method}
                        </span>
                        <span className="text-xs text-gray-400">
                          {error.resolution.timestamp.toLocaleString()}
                        </span>
                      </div>
                      {error.resolution.notes && (
                        <p className="text-xs text-green-300 mt-1">{error.resolution.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filteredErrors.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No errors found</p>
              <p className="text-gray-500 text-sm mt-1">All systems running smoothly!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}