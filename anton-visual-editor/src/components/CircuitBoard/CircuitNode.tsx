'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { 
  Cpu, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  GitBranch,
  Code2,
  Database,
  Globe,
  Shield
} from 'lucide-react';

interface CircuitNodeData {
  label: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  agent?: string;
  description?: string;
  type?: string;
}

const getNodeIcon = (agent?: string, type?: string) => {
  if (type === 'parallel') return GitBranch;
  if (type === 'condition') return Shield;
  
  const agentLower = agent?.toLowerCase() || '';
  if (agentLower.includes('frontend')) return Globe;
  if (agentLower.includes('backend')) return Database;
  if (agentLower.includes('test')) return Shield;
  if (agentLower.includes('deploy')) return Zap;
  return Code2;
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Cpu className="w-4 h-4 text-gray-400" />;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'running':
      return {
        border: 'border-blue-500',
        bg: 'bg-blue-500/10',
        shadow: 'shadow-blue-500/50',
        pulse: true
      };
    case 'completed':
      return {
        border: 'border-green-500',
        bg: 'bg-green-500/10',
        shadow: 'shadow-green-500/50',
        pulse: false
      };
    case 'failed':
      return {
        border: 'border-red-500',
        bg: 'bg-red-500/10',
        shadow: 'shadow-red-500/50',
        pulse: false
      };
    default:
      return {
        border: 'border-[#404040]',
        bg: 'bg-[#1a1a1a]',
        shadow: 'shadow-[#404040]/20',
        pulse: false
      };
  }
};

function CircuitNode({ data, isConnectable }: NodeProps<CircuitNodeData>) {
  const Icon = getNodeIcon(data.agent, data.type);
  const statusStyle = getStatusColor(data.status);
  const progress = data.progress || 0;

  return (
    <div 
      className={`
        relative rounded-lg border-2 ${statusStyle.border} ${statusStyle.bg}
        shadow-lg ${statusStyle.shadow} transition-all duration-300
        ${statusStyle.pulse ? 'animate-pulse' : ''}
        min-w-[180px] backdrop-blur-sm
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-[#3B82F6] !border-2 !border-black"
        style={{ left: -7 }}
      />
      
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${statusStyle.bg} border ${statusStyle.border}`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-medium text-white text-sm">{data.label}</div>
              {data.agent && (
                <div className="text-xs text-gray-400">{data.agent}</div>
              )}
            </div>
          </div>
          {getStatusIcon(data.status)}
        </div>

        {data.description && (
          <div className="text-xs text-gray-500 mb-2">{data.description}</div>
        )}

        {data.status === 'running' && (
          <div className="mt-2">
            <div className="h-1 bg-[#262626] rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1 text-center">{progress}%</div>
          </div>
        )}

        <div className="absolute -top-1 -right-1 flex gap-1">
          <div className={`w-2 h-2 rounded-full ${statusStyle.border} ${statusStyle.bg}`} />
          <div className={`w-2 h-2 rounded-full ${statusStyle.border} ${statusStyle.bg} animate-ping`} />
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!w-3 !h-3 !bg-[#3B82F6] !border-2 !border-black"
        style={{ right: -7 }}
      />
    </div>
  );
}

export default memo(CircuitNode);