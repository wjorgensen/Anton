'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useWebSocket } from '../hooks/useWebSocket';
import { LoadingState } from './LoadingState';

interface TerminalPreviewProps {
  nodeId: string;
  executionId: string;
  className?: string;
  onResize?: (cols: number, rows: number) => void;
}

export function TerminalPreview({ 
  nodeId, 
  executionId, 
  className = '' 
}: TerminalPreviewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const { socket } = useWebSocket(executionId);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!terminalRef.current || terminalInstance.current) return;

    // Create terminal with black background theme
    const terminal = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#FFFFFF',
        cursor: '#3B82F6',
        cursorAccent: '#000000',
        selection: 'rgba(59, 130, 246, 0.3)',
        black: '#000000',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#A78BFA',
        cyan: '#06B6D4',
        white: '#FFFFFF',
        brightBlack: '#666666',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FCD34D',
        brightBlue: '#60A5FA',
        brightMagenta: '#C4B5FD',
        brightCyan: '#67E8F9',
        brightWhite: '#FFFFFF'
      },
      fontFamily: 'JetBrains Mono, SF Mono, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 5000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: false,
      tabStopWidth: 4,
      convertEol: true,
      rendererType: 'canvas'
    });

    // Create and load fit addon
    const fit = new FitAddon();
    fitAddon.current = fit;
    terminal.loadAddon(fit);

    // Open terminal in the DOM
    terminal.open(terminalRef.current);

    // Initial fit
    try {
      fit.fit();
    } catch (error) {
      console.error('Error fitting terminal:', error);
    }

    terminalInstance.current = terminal;

    // Write initial message
    terminal.writeln('\x1b[1;36m🚀 Terminal Preview Connected\x1b[0m');
    terminal.writeln(`\x1b[90mNode: ${nodeId}\x1b[0m`);
    terminal.writeln(`\x1b[90mExecution: ${executionId}\x1b[0m`);
    terminal.writeln('');
    
    setIsInitializing(false);

    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
        terminalInstance.current = null;
      }
      if (fitAddon.current) {
        fitAddon.current = null;
      }
    };
  }, [nodeId, executionId]);

  // Handle WebSocket connection and messages
  useEffect(() => {
    if (!socket || !terminalInstance.current) return;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('subscribe:node', nodeId);
      if (terminalInstance.current) {
        terminalInstance.current.writeln('\x1b[1;32m✓ Connected to live output stream\x1b[0m');
        terminalInstance.current.writeln('');
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      if (terminalInstance.current) {
        terminalInstance.current.writeln('\x1b[1;31m✗ Disconnected from output stream\x1b[0m');
      }
    };

    const handlePreviewData = (data: any) => {
      if (!terminalInstance.current) return;
      
      // Only process data for this specific node
      if (data.nodeId !== nodeId) return;
      
      if (data.type === 'terminal') {
        if (data.action === 'clear') {
          terminalInstance.current.clear();
        } else if (data.action === 'resize' && data.cols && data.rows) {
          terminalInstance.current.resize(data.cols, data.rows);
        } else if (data.content) {
          // Write content preserving ANSI codes
          if (data.ansi) {
            terminalInstance.current.write(data.content);
          } else {
            // Plain text - add newline if needed
            const lines = data.content.split('\n');
            lines.forEach((line, index) => {
              if (index < lines.length - 1) {
                terminalInstance.current!.writeln(line);
              } else if (line) {
                terminalInstance.current!.write(line);
              }
            });
          }
        }
      }
    };

    const handleTerminalOutput = (data: any) => {
      if (!terminalInstance.current || data.nodeId !== nodeId) return;
      
      const { output, stream } = data;
      
      // Apply color based on stream type
      if (stream === 'stderr') {
        terminalInstance.current.write(`\x1b[31m${output}\x1b[0m`);
      } else {
        terminalInstance.current.write(output);
      }
    };

    const handleNodeUpdate = (data: any) => {
      if (!terminalInstance.current || data.nodeId !== nodeId) return;
      
      const { status } = data;
      
      // Show status updates in terminal
      if (status === 'running') {
        terminalInstance.current.writeln('\x1b[1;33m⚡ Agent started\x1b[0m');
      } else if (status === 'completed') {
        terminalInstance.current.writeln('\x1b[1;32m✅ Agent completed successfully\x1b[0m');
      } else if (status === 'failed') {
        terminalInstance.current.writeln('\x1b[1;31m❌ Agent failed\x1b[0m');
      } else if (status === 'reviewing') {
        terminalInstance.current.writeln('\x1b[1;36m👀 Awaiting review\x1b[0m');
      }
    };

    // Connect event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('preview:data', handlePreviewData);
    socket.on('terminal:output', handleTerminalOutput);
    socket.on('node:update', handleNodeUpdate);

    // Initial subscription
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('preview:data', handlePreviewData);
      socket.off('terminal:output', handleTerminalOutput);
      socket.off('node:update', handleNodeUpdate);
      
      if (socket.connected) {
        socket.emit('unsubscribe:node', nodeId);
      }
    };
  }, [socket, nodeId]);

  // Handle resize
  useEffect(() => {
    if (!fitAddon.current || !terminalInstance.current) return;

    const handleResize = () => {
      try {
        fitAddon.current?.fit();
      } catch (error) {
        console.error('Error resizing terminal:', error);
      }
    };

    window.addEventListener('resize', handleResize);

    // Observe the terminal container for size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  const handleClearTerminal = () => {
    if (terminalInstance.current) {
      terminalInstance.current.clear();
    }
  };

  const handleExportLogs = () => {
    if (!terminalInstance.current) return;
    
    // Get the terminal buffer content
    const buffer = terminalInstance.current.buffer.active;
    let content = '';
    
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        content += line.translateToString(true) + '\n';
      }
    }
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-log-${nodeId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`flex flex-col h-full w-full bg-black border border-zinc-800 rounded-lg overflow-hidden ${className}`}>
      {/* Terminal Header with Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className="text-xs text-zinc-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            Node: {nodeId.slice(-8)}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearTerminal}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="Clear terminal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={handleExportLogs}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
            title="Export logs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full bg-black"
        style={{ padding: '8px' }}
      />
    </div>
  );
}