'use client';

import { WebPreview } from '@/components/WebPreview';
import { useState } from 'react';

export default function TestPreviewPage() {
  const [executionId] = useState('test-exec-123');
  const [nodeId] = useState('node-456');

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Web Preview Test</h1>
        
        <div className="mb-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <p className="text-sm text-zinc-400">
            Testing web preview with:
          </p>
          <ul className="mt-2 text-sm text-zinc-300">
            <li>• Execution ID: {executionId}</li>
            <li>• Node ID: {nodeId}</li>
          </ul>
        </div>

        <div className="h-[600px]">
          <WebPreview
            nodeId={nodeId}
            executionId={executionId}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}