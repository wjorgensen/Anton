'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Save, Trash2, Copy, Settings } from 'lucide-react';

interface NodeEditPanelProps {
  node: Node;
  onClose: () => void;
  onUpdate: (node: Node) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function NodeEditPanel({
  node,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
}: NodeEditPanelProps) {
  const [label, setLabel] = useState(node.data.label || '');
  const [agent, setAgent] = useState(node.data.agent || '');
  const [description, setDescription] = useState(node.data.description || '');

  useEffect(() => {
    setLabel(node.data.label || '');
    setAgent(node.data.agent || '');
    setDescription(node.data.description || '');
  }, [node]);

  const handleSave = () => {
    onUpdate({
      ...node,
      data: {
        ...node.data,
        label,
        agent,
        description,
      },
    });
    onClose();
  };

  return (
    <div className="fixed right-4 top-20 w-80 bg-black border border-[#262626] rounded-lg shadow-2xl z-50">
      <div className="border-b border-[#262626] p-4 bg-gradient-to-r from-[#0A0A0A] to-[#141414]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#3B82F6]" />
            <h3 className="font-medium text-white">Edit Node</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#262626] rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Node Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
            placeholder="Enter node label"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Agent Type
          </label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
          >
            <option value="">Select agent type</option>
            <option value="frontend-developer">Frontend Developer</option>
            <option value="backend-developer">Backend Developer</option>
            <option value="database-developer">Database Developer</option>
            <option value="test-runner">Test Runner</option>
            <option value="deployment">Deployment</option>
            <option value="code-review">Code Review</option>
            <option value="playwright-e2e">Playwright E2E</option>
            <option value="api-integrator">API Integrator</option>
            <option value="docker-builder">Docker Builder</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] resize-none h-20"
            placeholder="Enter node description"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          
          <button
            onClick={onDuplicate}
            className="px-4 py-2 bg-[#262626] text-white rounded-lg hover:bg-[#404040] transition-all"
          >
            <Copy className="w-4 h-4" />
          </button>
          
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}