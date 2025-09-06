'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  Clock,
  User,
  FileText,
  Download,
  RotateCcw,
  Eye,
  GitCommit,
  GitMerge,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  Plus,
  Minus,
  Edit
} from 'lucide-react';

interface FlowVersion {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  createdAt: Date;
  changes: {
    additions: number;
    deletions: number;
    modifications: number;
    details: ChangeDetail[];
  };
  nodeCount: number;
  edgeCount: number;
  parent?: string;
  branch?: string;
  tags: string[];
}

interface ChangeDetail {
  type: 'add' | 'remove' | 'modify';
  target: 'node' | 'edge' | 'metadata';
  id: string;
  description: string;
  before?: any;
  after?: any;
}

interface VersionHistoryProps {
  versions: FlowVersion[];
  currentVersion: string;
  onRestore: (versionId: string) => void;
  onCompare: (versionA: string, versionB: string) => void;
  onExport: (versionId: string) => void;
  onCreateBranch: (fromVersion: string) => void;
}

export default function VersionHistory({
  versions,
  currentVersion,
  onRestore,
  onCompare,
  onExport,
  onCreateBranch
}: VersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [showDiff, setShowDiff] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('');

  const toggleVersionExpanded = (versionId: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionId)) {
      newExpanded.delete(versionId);
    } else {
      newExpanded.add(versionId);
    }
    setExpandedVersions(newExpanded);
  };

  const toggleVersionSelection = (versionId: string) => {
    const newSelection = new Set(selectedVersions);
    if (newSelection.has(versionId)) {
      newSelection.delete(versionId);
    } else {
      if (compareMode && newSelection.size >= 2) {
        // In compare mode, limit to 2 selections
        const first = Array.from(newSelection)[0];
        newSelection.clear();
        newSelection.add(first);
      }
      newSelection.add(versionId);
    }
    setSelectedVersions(newSelection);
  };

  const handleCompare = () => {
    if (selectedVersions.size === 2) {
      const [versionA, versionB] = Array.from(selectedVersions);
      onCompare(versionA, versionB);
      setShowDiff(true);
    }
  };

  const getChangeIcon = (type: ChangeDetail['type']) => {
    switch (type) {
      case 'add':
        return <Plus className="w-3 h-3 text-green-400" />;
      case 'remove':
        return <Minus className="w-3 h-3 text-red-400" />;
      case 'modify':
        return <Edit className="w-3 h-3 text-yellow-400" />;
    }
  };

  const getChangeColor = (type: ChangeDetail['type']) => {
    switch (type) {
      case 'add':
        return 'text-green-400 bg-green-400/10';
      case 'remove':
        return 'text-red-400 bg-red-400/10';
      case 'modify':
        return 'text-yellow-400 bg-yellow-400/10';
    }
  };

  const filteredVersions = filterTag 
    ? versions.filter(v => v.tags.includes(filterTag))
    : versions;

  // Get all unique tags
  const allTags = Array.from(new Set(versions.flatMap(v => v.tags)));

  const renderVersionTree = () => {
    // Build parent-child relationship map
    const childrenMap = new Map<string | undefined, FlowVersion[]>();
    
    filteredVersions.forEach(version => {
      const parent = version.parent;
      if (!childrenMap.has(parent)) {
        childrenMap.set(parent, []);
      }
      childrenMap.get(parent)!.push(version);
    });

    const renderNode = (version: FlowVersion, level: number = 0): React.ReactNode => {
      const children = childrenMap.get(version.id) || [];
      const isExpanded = expandedVersions.has(version.id);
      const isSelected = selectedVersions.has(version.id);
      const isCurrent = version.id === currentVersion;

      return (
        <div key={version.id}>
          <div
            className={`border border-[#262626] rounded-lg p-4 hover:border-[#3B82F6]/50 transition-all cursor-pointer ${
              isCurrent ? 'bg-[#3B82F6]/10 border-[#3B82F6]' : 'bg-[#0A0A0A]'
            } ${isSelected ? 'ring-2 ring-[#3B82F6]' : ''}`}
            style={{ marginLeft: `${level * 24}px` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {/* Expand/Collapse for branches */}
                {children.length > 0 && (
                  <button
                    onClick={() => toggleVersionExpanded(version.id)}
                    className="p-1 hover:bg-[#141414] rounded mt-1"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                )}

                {/* Selection checkbox in compare mode */}
                {compareMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleVersionSelection(version.id)}
                    className="w-4 h-4 text-[#3B82F6] bg-[#0A0A0A] border-[#262626] rounded focus:ring-[#3B82F6] mt-1"
                  />
                )}

                {/* Version Icon */}
                <div className="p-2 bg-[#141414] rounded-lg">
                  {version.branch ? (
                    <GitBranch className="w-5 h-5 text-[#3B82F6]" />
                  ) : (
                    <GitCommit className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium">v{version.version}</h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-xs rounded-full">
                        Current
                      </span>
                    )}
                    {version.branch && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                        {version.branch}
                      </span>
                    )}
                    {version.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="text-sm text-gray-400 mb-2">{version.description}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {version.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(version.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {version.nodeCount} nodes, {version.edgeCount} edges
                    </span>
                  </div>

                  {/* Change Summary */}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-green-400 text-xs">
                      <Plus className="w-3 h-3" />
                      {version.changes.additions}
                    </span>
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <Minus className="w-3 h-3" />
                      {version.changes.deletions}
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400 text-xs">
                      <Edit className="w-3 h-3" />
                      {version.changes.modifications}
                    </span>
                  </div>

                  {/* Detailed Changes (Expandable) */}
                  {version.changes.details.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                        View detailed changes
                      </summary>
                      <div className="mt-2 space-y-1">
                        {version.changes.details.map((change, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs">
                            {getChangeIcon(change.type)}
                            <span className="text-gray-300">
                              {change.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Preview version
                  }}
                  className="p-2 hover:bg-[#141414] rounded text-gray-400 hover:text-white transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                
                {!isCurrent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(version.id);
                    }}
                    className="p-2 hover:bg-[#141414] rounded text-gray-400 hover:text-white transition-colors"
                    title="Restore"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(version.id);
                  }}
                  className="p-2 hover:bg-[#141414] rounded text-gray-400 hover:text-white transition-colors"
                  title="Export"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateBranch(version.id);
                  }}
                  className="p-2 hover:bg-[#141414] rounded text-gray-400 hover:text-white transition-colors"
                  title="Create Branch"
                >
                  <GitBranch className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Render children */}
          {isExpanded && children.length > 0 && (
            <div className="mt-2">
              {children.map(child => renderNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    // Render root versions
    const rootVersions = filteredVersions.filter(v => !v.parent);
    return rootVersions.map(version => renderNode(version));
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="border-b border-[#262626] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Version History</h2>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedVersions(new Set());
              }}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                compareMode 
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'border-[#262626] text-gray-400 hover:text-white hover:border-[#404040]'
              }`}
            >
              Compare Versions
            </button>

            {compareMode && selectedVersions.size === 2 && (
              <button
                onClick={handleCompare}
                className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors"
              >
                Show Diff
              </button>
            )}
          </div>
        </div>

        {/* Filter by Tag */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Filter by tag:</span>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="px-3 py-1 bg-[#0A0A0A] border border-[#262626] rounded text-sm text-white focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="">All</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        )}

        {/* Compare Mode Info */}
        {compareMode && (
          <div className="mt-3 p-2 bg-[#3B82F6]/10 border border-[#3B82F6]/30 rounded-lg">
            <p className="text-sm text-[#3B82F6]">
              Select two versions to compare. {selectedVersions.size}/2 selected.
            </p>
          </div>
        )}
      </div>

      {/* Version Tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <GitCommit className="w-12 h-12 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Version History</h3>
            <p className="text-sm text-gray-400">
              Version history will appear here as you make changes to your flow.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {renderVersionTree()}
          </div>
        )}
      </div>

      {/* Diff View Modal (simplified placeholder) */}
      {showDiff && selectedVersions.size === 2 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black border border-[#262626] rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="border-b border-[#262626] p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Version Comparison</h3>
              <button
                onClick={() => setShowDiff(false)}
                className="p-1 hover:bg-[#141414] rounded"
              >
                <Check className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <p className="text-gray-400">
                Diff view between selected versions would be displayed here...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}