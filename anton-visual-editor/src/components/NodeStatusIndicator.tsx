'use client';

import { useEffect, useState } from 'react';

interface NodeStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'reviewing';
  progress?: number;
  output?: string;
  error?: string;
  timestamp: number;
}

interface NodeStatusIndicatorProps {
  nodeId: string;
  status: NodeStatus;
  showDetails?: boolean;
}

export function NodeStatusIndicator({ nodeId, status, showDetails = false }: NodeStatusIndicatorProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (status.status === 'running') {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [status.status]);

  const getStatusColor = () => {
    switch (status.status) {
      case 'pending': return 'bg-gray-500';
      case 'running': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'reviewing': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'pending': return 'Pending';
      case 'running': return 'Running';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'reviewing': return 'Reviewing';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'pending': return '⏸️';
      case 'running': return '⚡';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'reviewing': return '👀';
      default: return '?';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${getStatusColor()} ${
            isAnimating ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-sm font-medium">{getStatusIcon()} {getStatusText()}</span>
      </div>

      {/* Node ID */}
      <div className="text-xs text-gray-400 font-mono">
        {nodeId}
      </div>

      {/* Progress Bar for Running Status */}
      {status.status === 'running' && typeof status.progress === 'number' && (
        <div className="flex-1 max-w-xs">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, status.progress))}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {Math.round(status.progress)}%
          </div>
        </div>
      )}

      {/* Pulsing Animation for Active States */}
      {status.status === 'running' && (
        <div className="relative">
          <div className="absolute inset-0 w-4 h-4 bg-blue-500/20 rounded-full animate-ping" />
          <div className="relative w-4 h-4 bg-blue-500 rounded-full" />
        </div>
      )}

      {/* Details Section */}
      {showDetails && (
        <div className="flex-1 min-w-0">
          {status.output && (
            <div className="text-xs text-green-300 truncate">
              Output: {JSON.stringify(status.output).substring(0, 50)}...
            </div>
          )}
          {status.error && (
            <div className="text-xs text-red-300 truncate">
              Error: {status.error.substring(0, 50)}...
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1">
            Last update: {new Date(status.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

// Specialized component for node cards in flow editor
export function NodeCard({ nodeId, status, className = '' }: {
  nodeId: string;
  status: NodeStatus;
  className?: string;
}) {
  const getStatusBorderColor = () => {
    switch (status.status) {
      case 'pending': return 'border-gray-500';
      case 'running': return 'border-blue-500 shadow-blue-500/20';
      case 'completed': return 'border-green-500 shadow-green-500/20';
      case 'failed': return 'border-red-500 shadow-red-500/20';
      case 'reviewing': return 'border-yellow-500 shadow-yellow-500/20';
      default: return 'border-gray-500';
    }
  };

  const isPulsing = status.status === 'running' || status.status === 'reviewing';

  return (
    <div 
      className={`
        relative p-4 bg-gray-800 rounded-lg border-2 transition-all duration-300
        ${getStatusBorderColor()}
        ${isPulsing ? 'shadow-lg animate-pulse' : ''}
        ${className}
      `}
    >
      {/* Corner Status Indicator */}
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900">
        <div className={`w-full h-full rounded-full ${
          status.status === 'pending' ? 'bg-gray-500' :
          status.status === 'running' ? 'bg-blue-500 animate-pulse' :
          status.status === 'completed' ? 'bg-green-500' :
          status.status === 'failed' ? 'bg-red-500' :
          status.status === 'reviewing' ? 'bg-yellow-500 animate-pulse' :
          'bg-gray-500'
        }`} />
      </div>

      {/* Content */}
      <div className="font-mono text-sm text-gray-300">
        {nodeId}
      </div>
      
      {/* Running animation overlay */}
      {status.status === 'running' && (
        <div className="absolute inset-0 bg-blue-500/5 rounded-lg animate-pulse" />
      )}
    </div>
  );
}