'use client';

import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, Loader2 } from 'lucide-react';

interface SimpleProjectWizardProps {
  onComplete: (project: { name: string; prompt: string }) => void;
  onCancel: () => void;
}

export default function SimpleProjectWizard({ onComplete, onCancel }: SimpleProjectWizardProps) {
  const [projectName, setProjectName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!projectName.trim() || !prompt.trim()) return;

    setIsCreating(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onComplete({
      name: projectName,
      prompt: prompt
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-[#262626] rounded-xl w-full max-w-2xl shadow-2xl">
        <div className="border-b border-[#262626] p-6 bg-gradient-to-r from-[#0A0A0A] to-[#141414]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Create New Project</h2>
                <p className="text-gray-400 text-sm">Describe what you want to build</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-[#262626] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
              placeholder="My Amazing Project"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What do you want to build?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all resize-none h-32"
              placeholder="Describe your project in detail. For example:
              
Build a real-time chat application with user authentication, message history, and file sharing capabilities. Include a React frontend with a modern UI and a Node.js backend with WebSocket support."
            />
            <p className="mt-2 text-xs text-gray-500">
              The more detail you provide, the better the AI can plan your project
            </p>
          </div>

          <div className="bg-gradient-to-r from-[#3B82F6]/10 to-[#8B5CF6]/10 border border-[#3B82F6]/20 rounded-lg p-4">
            <h3 className="text-sm font-medium text-[#3B82F6] mb-2">What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-[#3B82F6] rounded-full mt-1.5 flex-shrink-0" />
                <span>AI analyzes your requirements and creates a circuit board visualization</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-[#3B82F6] rounded-full mt-1.5 flex-shrink-0" />
                <span>Edit nodes and connections to customize the workflow</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1 h-1 bg-[#3B82F6] rounded-full mt-1.5 flex-shrink-0" />
                <span>Click run to execute the plan with visual progress tracking</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#262626] bg-gradient-to-r from-[#0A0A0A] to-[#141414] p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 border border-[#262626] rounded-lg text-gray-400 hover:text-white hover:border-[#404040] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!projectName.trim() || !prompt.trim() || isCreating}
              className="px-8 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white rounded-lg hover:from-[#60A5FA] hover:to-[#A78BFA] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg shadow-[#3B82F6]/25"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create & View Circuit Board
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}