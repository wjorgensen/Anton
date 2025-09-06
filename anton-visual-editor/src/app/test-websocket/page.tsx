'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { NodeStatusIndicator } from '@/components/NodeStatusIndicator';
import { TerminalPreview } from '@/components/TerminalPreview';
import { ToastProvider, useNodeToasts, useConnectionToasts } from '@/components/ToastManager';

function TestWebSocketContent() {
  const [executionId] = useState('test-execution-123');
  const [selectedNode, setSelectedNode] = useState<string>('test-node-1');
  const { 
    connected, 
    connecting, 
    error, 
    lastConnectionTime,
    nodeUpdates, 
    previewData, 
    subscribeToNode, 
    sendTerminalInput,
    reconnect,
    clearError
  } = useWebSocket(executionId);

  const nodeToasts = useNodeToasts();
  const connectionToasts = useConnectionToasts();
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    if (connected) {
      subscribeToNode('test-node-1');
      subscribeToNode('test-node-2');
      
      if (!wasConnected) {
        connectionToasts.notifyConnected();
        setWasConnected(true);
      } else {
        connectionToasts.notifyReconnected();
      }
    } else if (wasConnected) {
      connectionToasts.notifyDisconnected();
    }
  }, [connected, subscribeToNode, wasConnected, connectionToasts]);

  useEffect(() => {
    if (error) {
      connectionToasts.notifyConnectionFailed(error);
    }
  }, [error, connectionToasts]);

  // Monitor node status changes for toasts
  useEffect(() => {
    Object.entries(nodeUpdates).forEach(([nodeId, status]) => {
      if (status.status === 'running') {
        nodeToasts.notifyNodeStarted(nodeId);
      } else if (status.status === 'completed') {
        nodeToasts.notifyNodeCompleted(nodeId, status.output);
      } else if (status.status === 'failed') {
        nodeToasts.notifyNodeFailed(nodeId, status.error);
      } else if (status.status === 'reviewing') {
        nodeToasts.notifyNodeReview(nodeId);
      }
    });
  }, [nodeUpdates, nodeToasts]);

  const sendTestInput = () => {
    sendTerminalInput('test-node-1', 'echo "Hello from terminal"');
  };

  const simulateNodeUpdate = (nodeId: string, status: 'running' | 'completed' | 'failed') => {
    // This would normally come from the WebSocket, but we'll simulate it for testing
    if (status === 'running') {
      nodeToasts.notifyNodeStarted(nodeId);
    } else if (status === 'completed') {
      nodeToasts.notifyNodeCompleted(nodeId);
    } else if (status === 'failed') {
      nodeToasts.notifyNodeFailed(nodeId, 'Simulated error');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-blue-400">WebSocket Test Page</h1>
        
        <div className="mb-8 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500' : connecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`}></div>
              <span>
                {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
              </span>
            </div>
            
            {lastConnectionTime && (
              <div className="text-sm text-gray-400">
                Last connected: {lastConnectionTime.toLocaleTimeString()}
              </div>
            )}
            
            {error && (
              <div className="p-2 bg-red-900/50 border border-red-500/20 rounded text-red-300 text-sm">
                <div className="flex justify-between items-start">
                  <span>{error}</span>
                  <button
                    onClick={clearError}
                    className="text-red-200 hover:text-white ml-2"
                    title="Clear error"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
            
            {!connected && !connecting && (
              <button
                onClick={reconnect}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        <div className="mb-8 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Node Updates</h2>
          {Object.entries(nodeUpdates).length === 0 ? (
            <p className="text-gray-400">No node updates yet...</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(nodeUpdates).map(([nodeId, status]) => (
                <NodeStatusIndicator
                  key={nodeId}
                  nodeId={nodeId}
                  status={status}
                  showDetails={true}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-8 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Preview Data</h2>
          {Object.entries(previewData).length === 0 ? (
            <p className="text-gray-400">No preview data yet...</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(previewData).map(([nodeId, dataArray]) => (
                <div key={nodeId} className="p-2 bg-gray-800 rounded">
                  <div className="font-mono text-sm text-blue-400 mb-2">{nodeId}</div>
                  {dataArray.slice(-5).map((data, idx) => (
                    <div key={idx} className="text-xs text-gray-300 mb-1">
                      <span className="text-gray-500">[{data.type}]</span>{' '}
                      {JSON.stringify(data.data).substring(0, 80)}...
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-8 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Terminal Preview</h2>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Select Node:</label>
            <select 
              value={selectedNode} 
              onChange={(e) => setSelectedNode(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value="test-node-1">test-node-1</option>
              <option value="test-node-2">test-node-2</option>
            </select>
          </div>
          <div className="h-64">
            <TerminalPreview 
              nodeId={selectedNode} 
              executionId={executionId}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={sendTestInput}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
              disabled={!connected}
            >
              Send Terminal Input
            </button>
            <button
              onClick={() => simulateNodeUpdate('test-node-1', 'running')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded transition-colors text-sm"
            >
              Simulate Running
            </button>
            <button
              onClick={() => simulateNodeUpdate('test-node-1', 'completed')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors text-sm"
            >
              Simulate Success
            </button>
            <button
              onClick={() => simulateNodeUpdate('test-node-1', 'failed')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm"
            >
              Simulate Error
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestWebSocketPage() {
  return (
    <ToastProvider>
      <TestWebSocketContent />
    </ToastProvider>
  );
}