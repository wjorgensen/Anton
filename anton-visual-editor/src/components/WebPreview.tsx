'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { LoadingState, Skeleton } from './LoadingState';

interface WebPreviewProps {
  nodeId: string;
  executionId: string;
  className?: string;
}

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  userAgent?: string;
}

const devicePresets: DevicePreset[] = [
  { name: 'Desktop', width: 1280, height: 720 },
  { name: 'Laptop', width: 1024, height: 768 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'iPhone SE', width: 375, height: 667, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
  { name: 'iPhone 12', width: 390, height: 844, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
  { name: 'iPad', width: 820, height: 1180, userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' },
];

export function WebPreview({ nodeId, executionId, className = '' }: WebPreviewProps) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [lastReload, setLastReload] = useState<Date | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DevicePreset>(devicePresets[0]);
  const [isResponsiveMode, setIsResponsiveMode] = useState<boolean>(false);
  const [customWidth, setCustomWidth] = useState<number>(1280);
  const [customHeight, setCustomHeight] = useState<number>(720);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Fetch preview URL from API
    const fetchPreviewUrl = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`/api/preview/${executionId}/${nodeId}`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to start preview: ${response.statusText}`);
        }
        
        const data = await response.json();
        setUrl(data.url);
        
        // Connect to preview server's WebSocket for hot reload notifications
        if (data.url) {
          const previewUrl = new URL(data.url);
          socketRef.current = io(previewUrl.origin, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
          });
          
          socketRef.current.on('connect', () => {
            console.log('Preview WebSocket connected');
            setConnected(true);
          });
          
          socketRef.current.on('disconnect', () => {
            console.log('Preview WebSocket disconnected');
            setConnected(false);
          });
          
          socketRef.current.on('reload', (data: any) => {
            console.log('Received reload event:', data);
            setLastReload(new Date());
            // Force iframe reload
            if (iframeRef.current) {
              iframeRef.current.src = iframeRef.current.src;
            }
          });
        }
      } catch (err) {
        console.error('Error fetching preview URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreviewUrl();
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [nodeId, executionId]);

  // Handle iframe load events
  const handleIframeLoad = () => {
    console.log('Preview iframe loaded');
  };

  const handleIframeError = () => {
    console.error('Preview iframe error');
    setError('Failed to load preview content');
  };

  // Refresh button handler
  const handleRefresh = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
      setLastReload(new Date());
    }
  };

  // Open in new tab handler
  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`flex flex-col h-full w-full bg-black border border-zinc-800 rounded-lg overflow-hidden ${className}`}>
      {/* Preview Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-xs text-zinc-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {lastReload && (
            <span className="text-xs text-zinc-500">
              Last reload: {lastReload.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Device Selector */}
          <select
            value={currentDevice.name}
            onChange={(e) => {
              const device = devicePresets.find(d => d.name === e.target.value);
              if (device) {
                setCurrentDevice(device);
                setCustomWidth(device.width);
                setCustomHeight(device.height);
              }
            }}
            className="bg-zinc-800 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-700 focus:border-blue-500 outline-none"
          >
            {devicePresets.map(device => (
              <option key={device.name} value={device.name}>
                {device.name} ({device.width}x{device.height})
              </option>
            ))}
          </select>

          {/* Responsive Mode Toggle */}
          <button
            onClick={() => setIsResponsiveMode(!isResponsiveMode)}
            className={`p-1.5 rounded transition-colors ${
              isResponsiveMode 
                ? 'bg-blue-600 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Toggle responsive mode"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </button>

          {url && (
            <>
              <button
                onClick={handleRefresh}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Refresh"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                title="Open in new tab"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Device Controls Bar */}
      {isResponsiveMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">Width:</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                className="bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded w-16 border border-zinc-600 focus:border-blue-500 outline-none"
                min="200"
                max="2560"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">Height:</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                className="bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded w-16 border border-zinc-600 focus:border-blue-500 outline-none"
                min="200"
                max="2560"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              {customWidth} × {customHeight}
            </span>
            <button
              onClick={() => {
                const temp = customWidth;
                setCustomWidth(customHeight);
                setCustomHeight(temp);
              }}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
              title="Rotate"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Preview Content */}
      <div className="flex-1 relative bg-zinc-950 flex items-center justify-center">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-zinc-950/80 backdrop-blur-sm">
            <LoadingState 
              message="Starting preview server..." 
              size="md" 
              variant="spinner"
            />
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3 p-6 bg-zinc-900 rounded-lg border border-red-900">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-400">{error}</span>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {url && !loading && !error && (
          <div 
            className={`relative bg-white transition-all duration-300 ${
              isResponsiveMode 
                ? 'border border-zinc-600 rounded-lg shadow-2xl' 
                : 'w-full h-full'
            }`}
            style={isResponsiveMode ? {
              width: `${customWidth}px`,
              height: `${customHeight}px`,
              maxWidth: '100%',
              maxHeight: '100%'
            } : {}}
          >
            {/* Device Frame (for mobile/tablet) */}
            {isResponsiveMode && (currentDevice.name.includes('iPhone') || currentDevice.name.includes('Mobile')) && (
              <div className="absolute -inset-4 bg-zinc-800 rounded-2xl border border-zinc-600">
                <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-zinc-600 rounded-full"></div>
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-8 border-2 border-zinc-600 rounded-full"></div>
              </div>
            )}
            
            {isResponsiveMode && currentDevice.name.includes('iPad') && (
              <div className="absolute -inset-3 bg-zinc-800 rounded-xl border border-zinc-600">
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-8 border-2 border-zinc-600 rounded-full"></div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src={url}
              className={`border-0 ${isResponsiveMode ? 'w-full h-full rounded-md' : 'w-full h-full'}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={`Preview for node ${nodeId}`}
            />
          </div>
        )}
        
        {!url && !loading && !error && (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-zinc-400">No preview available</p>
              <p className="text-xs text-zinc-500 mt-1">Start the execution to see the preview</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Preview Footer with URL */}
      {url && (
        <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <input
              type="text"
              value={url}
              readOnly
              className="flex-1 bg-transparent text-xs text-zinc-400 outline-none"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(url)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Copy URL"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}