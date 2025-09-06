'use client';

import React, { useState } from 'react';
import {
  Star,
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Activity,
  Calendar,
  TrendingUp,
  Users,
  Zap,
  Copy,
  Edit,
  Trash2,
  Archive,
  ExternalLink
} from 'lucide-react';
import { Project } from '@/store/dashboardStore';

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: (projectId: string) => void;
  onToggleSelection: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onArchive: (projectId: string) => void;
}

export default function ProjectCard({
  project,
  isSelected,
  onSelect,
  onToggleSelection,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onArchive
}: ProjectCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getStatusConfig = (status: Project['status']) => {
    switch (status) {
      case 'running':
        return {
          color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
          icon: <Play className="w-4 h-4" />,
          gradient: 'from-blue-600/20 to-cyan-600/20',
          glow: 'shadow-blue-500/10'
        };
      case 'completed':
        return {
          color: 'text-green-400 bg-green-400/10 border-green-400/20',
          icon: <CheckCircle className="w-4 h-4" />,
          gradient: 'from-green-600/20 to-emerald-600/20',
          glow: 'shadow-green-500/10'
        };
      case 'failed':
        return {
          color: 'text-red-400 bg-red-400/10 border-red-400/20',
          icon: <XCircle className="w-4 h-4" />,
          gradient: 'from-red-600/20 to-pink-600/20',
          glow: 'shadow-red-500/10'
        };
      case 'paused':
        return {
          color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
          icon: <Pause className="w-4 h-4" />,
          gradient: 'from-yellow-600/20 to-orange-600/20',
          glow: 'shadow-yellow-500/10'
        };
      default:
        return {
          color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
          icon: <AlertCircle className="w-4 h-4" />,
          gradient: 'from-gray-600/20 to-slate-600/20',
          glow: 'shadow-gray-500/10'
        };
    }
  };

  const statusConfig = getStatusConfig(project.status);

  const getProjectIcon = () => {
    const techStack = `${project.technology.frontend}-${project.technology.backend}`;
    
    if (techStack.includes('React')) return '⚛️';
    if (techStack.includes('Vue')) return '💚';
    if (techStack.includes('Angular')) return '🅰️';
    if (techStack.includes('Node')) return '🟢';
    if (techStack.includes('Python')) return '🐍';
    if (techStack.includes('Express')) return '🚀';
    return '🔧';
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-400';
    if (rate >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`
        relative group cursor-pointer transition-all duration-300 ease-out
        bg-gradient-to-br from-[#0A0A0A] via-[#0F0F0F] to-[#0A0A0A]
        border-2 ${isSelected ? 'border-[#3B82F6]' : 'border-[#1a1a1a]'}
        rounded-xl p-5 overflow-hidden
        hover:border-[#3B82F6]/50 hover:shadow-2xl hover:shadow-blue-500/5
        ${isHovered ? 'transform scale-[1.02] -translate-y-1' : ''}
        ${statusConfig.glow}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect(project.id)}
    >
      {/* Background Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${statusConfig.gradient} opacity-50`} />
      
      {/* Animated Border Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#3B82F6]/10 to-transparent 
                      transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

      {/* Selection Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelection(project.id);
        }}
        className={`
          absolute top-4 left-4 w-4 h-4 rounded border-2 
          text-[#3B82F6] bg-[#0A0A0A]/80 border-[#404040] 
          focus:ring-2 focus:ring-[#3B82F6]/30
          transition-all duration-200
          ${isHovered || isSelected ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Header Actions */}
      <div className={`
        absolute top-4 right-4 flex items-center gap-2
        transition-all duration-200
        ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}
      `}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(project.id);
          }}
          className={`
            p-1.5 rounded-lg transition-all duration-200 backdrop-blur-sm
            hover:bg-[#141414]/80 hover:scale-110
            ${project.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-400'}
          `}
        >
          <Star className={`w-4 h-4 ${project.isFavorite ? 'fill-current' : ''}`} />
        </button>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-1.5 rounded-lg transition-all duration-200 backdrop-blur-sm
                       text-gray-400 hover:text-white hover:bg-[#141414]/80 hover:scale-110"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {/* Actions Dropdown */}
          {showActions && (
            <div className="absolute right-0 top-8 z-50 w-48 bg-[#1a1a1a]/95 backdrop-blur-sm 
                            border border-[#404040] rounded-lg shadow-xl p-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(project.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 
                           hover:text-white hover:bg-[#262626] rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(project.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 
                           hover:text-white hover:bg-[#262626] rounded transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 
                           hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Project Header */}
      <div className="relative mb-4 pt-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-2xl">{getProjectIcon()}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-lg leading-tight truncate">
              {project.name}
            </h3>
          </div>
        </div>
        <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      </div>

      {/* Status Badge with Animation */}
      <div className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border
        ${statusConfig.color} backdrop-blur-sm
        animate-pulse-slow
      `}>
        <span className="relative">
          {statusConfig.icon}
          {project.status === 'running' && (
            <span className="absolute inset-0 animate-ping">
              <Play className="w-4 h-4 opacity-30" />
            </span>
          )}
        </span>
        <span className="capitalize font-semibold">{project.status}</span>
      </div>

      {/* Progress Bar for Running Projects */}
      {project.status === 'running' && (
        <div className="mt-4">
          <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
            <span className="font-medium">Progress</span>
            <span className="font-semibold text-[#3B82F6]">{project.progress}%</span>
          </div>
          <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full 
                         transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${project.progress}%` }}
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                              transform -skew-x-12 animate-shine" />
            </div>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-gray-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className={`font-semibold ${getSuccessRateColor(project.metrics.successRate)}`}>
              {(project.metrics.successRate * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Activity className="w-3.5 h-3.5" />
            <span className="font-medium">{project.agentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-medium">{formatDuration(project.estimatedTime)}</span>
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="mt-4 flex flex-wrap gap-2">
        {project.technology.frontend && (
          <span className="px-2.5 py-1 bg-[#141414]/80 border border-[#262626] rounded-md 
                           text-xs text-gray-300 font-medium backdrop-blur-sm
                           hover:border-[#404040] transition-colors">
            {project.technology.frontend}
          </span>
        )}
        {project.technology.backend && (
          <span className="px-2.5 py-1 bg-[#141414]/80 border border-[#262626] rounded-md 
                           text-xs text-gray-300 font-medium backdrop-blur-sm
                           hover:border-[#404040] transition-colors">
            {project.technology.backend}
          </span>
        )}
        {project.technology.database && (
          <span className="px-2.5 py-1 bg-[#141414]/80 border border-[#262626] rounded-md 
                           text-xs text-gray-300 font-medium backdrop-blur-sm
                           hover:border-[#404040] transition-colors">
            {project.technology.database}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-[#262626]/50 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        </div>
        {project.metrics.lastExecuted && (
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span>
              {Math.floor((Date.now() - project.metrics.lastExecuted.getTime()) / 86400000)}d ago
            </span>
          </div>
        )}
      </div>

      {/* Hover Overlay */}
      <div className={`
        absolute inset-0 bg-gradient-to-t from-[#3B82F6]/5 to-transparent 
        transition-opacity duration-300 pointer-events-none
        ${isHovered ? 'opacity-100' : 'opacity-0'}
      `} />
    </div>
  );
}