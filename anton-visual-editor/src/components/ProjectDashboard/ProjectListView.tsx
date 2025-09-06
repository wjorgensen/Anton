'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Star,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit3,
  Check,
  X,
  Calendar,
  Clock,
  Activity,
  TrendingUp,
  Copy,
  Trash2,
  Archive
} from 'lucide-react';
import { Project } from '@/store/dashboardStore';

interface ProjectListViewProps {
  projects: Project[];
  selectedProjects: Set<string>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  onSelectAll: () => void;
  onToggleSelection: (projectId: string) => void;
  onToggleFavorite: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onArchive: (projectId: string) => void;
  onEditProject: (projectId: string, field: string, value: string) => void;
}

interface EditingCell {
  projectId: string;
  field: string;
  value: string;
}

const SortableHeader = ({
  label,
  field,
  sortBy,
  sortOrder,
  onSort,
  className = ''
}: {
  label: string;
  field: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}) => {
  const isActive = sortBy === field;

  return (
    <th className={`px-6 py-4 text-left ${className}`}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-400 
                   uppercase tracking-wider hover:text-white transition-colors group"
      >
        {label}
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 -mb-1 transition-colors ${
              isActive && sortOrder === 'asc'
                ? 'text-[#3B82F6]'
                : 'text-gray-600 group-hover:text-gray-400'
            }`}
          />
          <ChevronDown
            className={`w-3 h-3 transition-colors ${
              isActive && sortOrder === 'desc'
                ? 'text-[#3B82F6]'
                : 'text-gray-600 group-hover:text-gray-400'
            }`}
          />
        </div>
      </button>
    </th>
  );
};

const EditableCell = ({
  value,
  projectId,
  field,
  editingCell,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  type = 'text',
  options = []
}: {
  value: string;
  projectId: string;
  field: string;
  editingCell: EditingCell | null;
  onStartEdit: (projectId: string, field: string, value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  type?: 'text' | 'select';
  options?: Array<{ value: string; label: string }>;
}) => {
  const isEditing = editingCell?.projectId === projectId && editingCell?.field === field;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        {type === 'select' ? (
          <select
            value={editingCell.value}
            onChange={(e) => onStartEdit(projectId, field, e.target.value)}
            className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#404040] rounded 
                       text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            autoFocus
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={editingCell.value}
            onChange={(e) => onStartEdit(projectId, field, e.target.value)}
            className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#404040] rounded 
                       text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            autoFocus
            onKeyPress={(e) => e.key === 'Enter' && onSaveEdit()}
            onKeyDown={(e) => e.key === 'Escape' && onCancelEdit()}
          />
        )}
        <button
          onClick={onSaveEdit}
          className="p-1 text-green-400 hover:text-green-300 transition-colors"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={onCancelEdit}
          className="p-1 text-red-400 hover:text-red-300 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <span className="flex-1">{value}</span>
      <button
        onClick={() => onStartEdit(projectId, field, value)}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 
                   hover:text-white transition-all"
      >
        <Edit3 className="w-3 h-3" />
      </button>
    </div>
  );
};

export default function ProjectListView({
  projects,
  selectedProjects,
  sortBy,
  sortOrder,
  onSort,
  onSelectAll,
  onToggleSelection,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onArchive,
  onEditProject
}: ProjectListViewProps) {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [showActionsFor, setShowActionsFor] = useState<string | null>(null);

  const getStatusIcon = (status: Project['status']) => {
    switch (status) {
      case 'running':
        return <Play className="w-4 h-4 text-blue-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'running':
        return 'text-blue-400 bg-blue-400/10';
      case 'completed':
        return 'text-green-400 bg-green-400/10';
      case 'failed':
        return 'text-red-400 bg-red-400/10';
      case 'paused':
        return 'text-yellow-400 bg-yellow-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.8) return 'text-green-400';
    if (rate >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const handleStartEdit = (projectId: string, field: string, value: string) => {
    setEditingCell({ projectId, field, value });
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      onEditProject(editingCell.projectId, editingCell.field, editingCell.value);
      setEditingCell(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const statusOptions = [
    { value: 'idle', label: 'Idle' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'paused', label: 'Paused' }
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#262626]">
            <th className="px-6 py-4 w-12">
              <input
                type="checkbox"
                checked={projects.length > 0 && selectedProjects.size === projects.length}
                onChange={onSelectAll}
                className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#404040] rounded 
                           focus:ring-[#3B82F6] focus:ring-offset-0"
              />
            </th>
            <SortableHeader
              label="Project"
              field="name"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="min-w-[300px]"
            />
            <SortableHeader
              label="Status"
              field="status"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-32"
            />
            <SortableHeader
              label="Progress"
              field="progress"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-32"
            />
            <SortableHeader
              label="Success Rate"
              field="successRate"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-32"
            />
            <SortableHeader
              label="Technology"
              field="technology"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-48"
            />
            <SortableHeader
              label="Agents"
              field="agentCount"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-24"
            />
            <SortableHeader
              label="Duration"
              field="estimatedTime"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-24"
            />
            <SortableHeader
              label="Updated"
              field="date"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              className="w-32"
            />
            <th className="px-6 py-4 w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#262626]/50">
          {projects.map((project, index) => (
            <tr
              key={project.id}
              className={`
                hover:bg-[#0F0F0F] transition-colors group
                ${index % 2 === 0 ? 'bg-[#0A0A0A]' : 'bg-black'}
                ${selectedProjects.has(project.id) ? 'bg-[#3B82F6]/5 border-l-2 border-[#3B82F6]' : ''}
              `}
            >
              {/* Selection */}
              <td className="px-6 py-4">
                <input
                  type="checkbox"
                  checked={selectedProjects.has(project.id)}
                  onChange={() => onToggleSelection(project.id)}
                  className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#404040] rounded 
                             focus:ring-[#3B82F6] focus:ring-offset-0"
                />
              </td>

              {/* Project Name & Description */}
              <td className="px-6 py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <EditableCell
                      value={project.name}
                      projectId={project.id}
                      field="name"
                      editingCell={editingCell}
                      onStartEdit={handleStartEdit}
                      onSaveEdit={handleSaveEdit}
                      onCancelEdit={handleCancelEdit}
                    />
                    {project.isFavorite && (
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {project.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-[#1a1a1a] text-xs text-gray-400 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.tags.length > 2 && (
                      <span className="px-1.5 py-0.5 bg-[#1a1a1a] text-xs text-gray-400 rounded">
                        +{project.tags.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </td>

              {/* Status */}
              <td className="px-6 py-4">
                <EditableCell
                  value={project.status}
                  projectId={project.id}
                  field="status"
                  editingCell={editingCell}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  type="select"
                  options={statusOptions}
                />
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mt-1 ${getStatusColor(project.status)}`}>
                  {getStatusIcon(project.status)}
                  <span className="capitalize">{project.status}</span>
                </div>
              </td>

              {/* Progress */}
              <td className="px-6 py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-[#1a1a1a] rounded-full h-1.5">
                    <div
                      className="bg-[#3B82F6] h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </td>

              {/* Success Rate */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-gray-400" />
                  <span className={`text-sm font-medium ${getSuccessRateColor(project.metrics.successRate)}`}>
                    {(project.metrics.successRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {project.metrics.totalExecutions} runs
                </div>
              </td>

              {/* Technology */}
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {project.technology.frontend && (
                    <span className="px-2 py-1 bg-[#1a1a1a] border border-[#404040] rounded text-xs text-gray-300">
                      {project.technology.frontend}
                    </span>
                  )}
                  {project.technology.backend && (
                    <span className="px-2 py-1 bg-[#1a1a1a] border border-[#404040] rounded text-xs text-gray-300">
                      {project.technology.backend}
                    </span>
                  )}
                  {project.technology.database && (
                    <span className="px-2 py-1 bg-[#1a1a1a] border border-[#404040] rounded text-xs text-gray-300">
                      {project.technology.database}
                    </span>
                  )}
                </div>
              </td>

              {/* Agents */}
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <span className="text-sm text-white font-medium">
                    {project.agentCount}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {project.metrics.activeAgents} active
                </div>
              </td>

              {/* Duration */}
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-sm text-white">
                    {formatDuration(project.estimatedTime)}
                  </span>
                </div>
                {project.actualTime && (
                  <div className="text-xs text-gray-500">
                    actual: {formatDuration(project.actualTime)}
                  </div>
                )}
              </td>

              {/* Updated */}
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  <span className="text-sm text-gray-300">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {Math.floor((Date.now() - project.updatedAt.getTime()) / 86400000)}d ago
                </div>
              </td>

              {/* Actions */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onToggleFavorite(project.id)}
                    className={`p-1.5 rounded hover:bg-[#1a1a1a] transition-colors ${
                      project.isFavorite ? 'text-yellow-400' : 'text-gray-400'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${project.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowActionsFor(showActionsFor === project.id ? null : project.id)}
                      className="p-1.5 rounded hover:bg-[#1a1a1a] transition-colors text-gray-400 hover:text-white"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </button>
                    
                    {showActionsFor === project.id && (
                      <div className="absolute right-0 top-8 z-50 w-36 bg-[#1a1a1a] border border-[#404040] 
                                      rounded-lg shadow-xl p-1 space-y-1">
                        <button
                          onClick={() => {
                            onDuplicate(project.id);
                            setShowActionsFor(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 
                                     hover:text-white hover:bg-[#262626] rounded transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          Duplicate
                        </button>
                        <button
                          onClick={() => {
                            onArchive(project.id);
                            setShowActionsFor(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 
                                     hover:text-white hover:bg-[#262626] rounded transition-colors"
                        >
                          <Archive className="w-3 h-3" />
                          Archive
                        </button>
                        <button
                          onClick={() => {
                            onDelete(project.id);
                            setShowActionsFor(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 
                                     hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Click outside to close actions menu */}
      {showActionsFor && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowActionsFor(null)}
        />
      )}
    </div>
  );
}