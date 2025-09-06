'use client';

import React from 'react';
import { Clock, Zap, GitBranch, PlayCircle } from 'lucide-react';

interface ExecutionPhase {
  phase: number;
  name: string;
  nodes: string[];
  parallel: boolean;
  description: string;
}

interface ExecutionPlan {
  projectName?: string;
  description?: string;
  estimatedDuration?: string;
  parallelizationStrategy?: string;
}

interface ExecutionPhasePanelProps {
  plan?: ExecutionPlan;
  phases?: ExecutionPhase[];
  metadata?: {
    totalNodes?: number;
    parallelGroups?: number;
    estimatedSavings?: string;
    generatedBy?: string;
  };
  currentPhase?: number;
  onPhaseClick?: (phase: number) => void;
}

export default function ExecutionPhasePanel({
  plan,
  phases = [],
  metadata,
  currentPhase = 0,
  onPhaseClick
}: ExecutionPhasePanelProps) {
  if (!plan && phases.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900 border border-green-500/30 rounded-lg p-4 space-y-4">
      {/* Plan Overview */}
      {plan && (
        <div className="space-y-2">
          <h3 className="text-green-400 font-mono text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Execution Plan
          </h3>
          
          {plan.projectName && (
            <div className="text-gray-300 text-xs font-mono">
              Project: {plan.projectName}
            </div>
          )}
          
          {plan.estimatedDuration && (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Clock className="w-3 h-3" />
              <span>Est. Duration: {plan.estimatedDuration}</span>
            </div>
          )}
          
          {plan.parallelizationStrategy && (
            <div className="bg-gray-800 border border-green-500/20 rounded p-2 mt-2">
              <div className="text-green-400 text-xs font-mono mb-1">Strategy:</div>
              <div className="text-gray-300 text-xs">{plan.parallelizationStrategy}</div>
            </div>
          )}
        </div>
      )}

      {/* Execution Phases */}
      {phases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-green-400 font-mono text-xs font-bold flex items-center gap-2">
            <GitBranch className="w-3 h-3" />
            Execution Phases
          </h4>
          
          <div className="space-y-1">
            {phases.map((phase) => (
              <button
                key={phase.phase}
                onClick={() => onPhaseClick?.(phase.phase)}
                className={`w-full text-left p-2 rounded border transition-all ${
                  currentPhase === phase.phase
                    ? 'bg-green-500/20 border-green-500'
                    : 'bg-gray-800 border-gray-700 hover:border-green-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
                      currentPhase === phase.phase ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {phase.phase}
                    </div>
                    <span className="text-gray-300 text-xs font-mono">{phase.name}</span>
                  </div>
                  {phase.parallel && (
                    <span className="text-yellow-400 text-xs bg-yellow-400/10 px-1 rounded">
                      PARALLEL
                    </span>
                  )}
                </div>
                
                <div className="mt-1 text-gray-400 text-xs pl-8">
                  {phase.description}
                </div>
                
                <div className="mt-1 text-gray-500 text-xs pl-8">
                  {phase.nodes.length} node{phase.nodes.length !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {metadata && (
        <div className="pt-2 border-t border-gray-700 space-y-1">
          {metadata.totalNodes && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total Nodes:</span>
              <span className="text-gray-300 font-mono">{metadata.totalNodes}</span>
            </div>
          )}
          
          {metadata.parallelGroups !== undefined && metadata.parallelGroups > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Parallel Groups:</span>
              <span className="text-yellow-400 font-mono">{metadata.parallelGroups}</span>
            </div>
          )}
          
          {metadata.estimatedSavings && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Time Savings:</span>
              <span className="text-green-400 font-mono">{metadata.estimatedSavings}</span>
            </div>
          )}
          
          {metadata.generatedBy && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Generated By:</span>
              <span className="text-gray-500 font-mono">{metadata.generatedBy}</span>
            </div>
          )}
        </div>
      )}

      {/* Run Button */}
      <button className="w-full bg-green-500 text-black font-mono text-xs py-2 px-3 rounded hover:bg-green-400 transition-colors flex items-center justify-center gap-2">
        <PlayCircle className="w-4 h-4" />
        EXECUTE PLAN
      </button>
    </div>
  );
}