'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TerminalPreview } from './TerminalPreview';
import { WebPreview } from './WebPreview';

export type PreviewType = 'terminal' | 'web';

export interface PreviewTab {
  id: string;
  nodeId: string;
  executionId: string;
  type: PreviewType;
  title: string;
  status: 'loading' | 'active' | 'error' | 'closed';
  lastActivity?: Date;
  url?: string;
}

interface PreviewManagerProps {
  className?: string;
  maxTabs?: number;
  onTabClose?: (tabId: string) => void;
  onTabAdd?: (tab: PreviewTab) => void;
}

export function PreviewManager({ 
  className = '', 
  maxTabs = 8,
  onTabClose,
  onTabAdd 
}: PreviewManagerProps) {
  const [tabs, setTabs] = useState<PreviewTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  const [pipSize, setPipSize] = useState({ width: 400, height: 300 });
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);

  // Add a new preview tab
  const addTab = useCallback((tab: PreviewTab) => {
    setTabs(currentTabs => {
      // Check if tab already exists
      if (currentTabs.some(t => t.nodeId === tab.nodeId && t.type === tab.type)) {
        // Switch to existing tab
        const existingTab = currentTabs.find(t => t.nodeId === tab.nodeId && t.type === tab.type);
        if (existingTab) {
          setActiveTabId(existingTab.id);
        }
        return currentTabs;
      }

      // Limit number of tabs
      let newTabs = [...currentTabs];
      if (newTabs.length >= maxTabs) {
        // Remove oldest inactive tab
        const oldestInactive = newTabs
          .filter(t => t.id !== activeTabId)
          .sort((a, b) => (a.lastActivity?.getTime() || 0) - (b.lastActivity?.getTime() || 0))[0];
        
        if (oldestInactive) {
          newTabs = newTabs.filter(t => t.id !== oldestInactive.id);
          onTabClose?.(oldestInactive.id);
        }
      }

      newTabs.push({
        ...tab,
        status: 'loading',
        lastActivity: new Date()
      });

      setActiveTabId(tab.id);
      onTabAdd?.(tab);
      
      return newTabs;
    });
  }, [maxTabs, activeTabId, onTabClose, onTabAdd]);

  // Remove a tab
  const removeTab = useCallback((tabId: string) => {
    setTabs(currentTabs => {
      const newTabs = currentTabs.filter(t => t.id !== tabId);
      
      // If we removed the active tab, switch to the next one
      if (activeTabId === tabId && newTabs.length > 0) {
        const currentIndex = currentTabs.findIndex(t => t.id === tabId);
        const nextTab = newTabs[Math.min(currentIndex, newTabs.length - 1)];
        setActiveTabId(nextTab.id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      onTabClose?.(tabId);
      return newTabs;
    });
  }, [activeTabId, onTabClose]);

  // Update tab status
  const updateTabStatus = useCallback((tabId: string, status: PreviewTab['status'], url?: string) => {
    setTabs(currentTabs => 
      currentTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, status, url, lastActivity: new Date() }
          : tab
      )
    );
  }, []);

  // Switch to a tab
  const switchToTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    updateTabStatus(tabId, 'active');
  }, [updateTabStatus]);

  // Handle tab dragging for reordering
  const handleTabDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData('text/plain', tabId);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const draggedTabId = e.dataTransfer.getData('text/plain');
    
    if (draggedTabId && draggedTabId !== targetTabId) {
      setTabs(currentTabs => {
        const newTabs = [...currentTabs];
        const draggedIndex = newTabs.findIndex(t => t.id === draggedTabId);
        const targetIndex = newTabs.findIndex(t => t.id === targetTabId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [draggedTab] = newTabs.splice(draggedIndex, 1);
          newTabs.splice(targetIndex, 0, draggedTab);
        }
        
        return newTabs;
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'w':
            if (activeTabId) {
              e.preventDefault();
              removeTab(activeTabId);
            }
            break;
          case 't':
            e.preventDefault();
            // Could trigger "add new tab" functionality
            break;
          case '[':
          case ']':
            e.preventDefault();
            if (tabs.length > 1) {
              const currentIndex = tabs.findIndex(t => t.id === activeTabId);
              const nextIndex = e.key === ']' 
                ? (currentIndex + 1) % tabs.length
                : (currentIndex - 1 + tabs.length) % tabs.length;
              switchToTab(tabs[nextIndex].id);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, removeTab, switchToTab]);

  // Expose API for parent components
  useEffect(() => {
    (window as any).previewManager = {
      addTerminalPreview: (nodeId: string, executionId: string, title?: string) => {
        addTab({
          id: `terminal-${nodeId}-${Date.now()}`,
          nodeId,
          executionId,
          type: 'terminal',
          title: title || `Terminal: ${nodeId.slice(-8)}`,
          status: 'loading'
        });
      },
      addWebPreview: (nodeId: string, executionId: string, title?: string) => {
        addTab({
          id: `web-${nodeId}-${Date.now()}`,
          nodeId,
          executionId,
          type: 'web',
          title: title || `Web: ${nodeId.slice(-8)}`,
          status: 'loading'
        });
      },
      closeTab: removeTab,
      switchToTab
    };

    return () => {
      delete (window as any).previewManager;
    };
  }, [addTab, removeTab, switchToTab]);

  // Picture-in-Picture drag functionality
  const handlePipDragStart = useCallback((e: React.MouseEvent) => {
    if (!isPictureInPicture) return;
    
    const startX = e.clientX - pipPosition.x;
    const startY = e.clientY - pipPosition.y;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      setPipPosition({
        x: Math.max(0, Math.min(window.innerWidth - pipSize.width, moveEvent.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - pipSize.height, moveEvent.clientY - startY))
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }, [isPictureInPicture, pipPosition, pipSize]);

  // Toggle functions
  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMaximized) setIsMaximized(false);
    if (isPictureInPicture) setIsPictureInPicture(false);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (isMinimized) setIsMinimized(false);
    if (isPictureInPicture) setIsPictureInPicture(false);
  };

  const togglePictureInPicture = () => {
    setIsPictureInPicture(!isPictureInPicture);
    if (isMinimized) setIsMinimized(false);
    if (isMaximized) setIsMaximized(false);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  const getTabIcon = (type: PreviewType, status: PreviewTab['status']) => {
    if (status === 'loading') {
      return <div className="w-3 h-3 border border-zinc-500 border-t-blue-500 rounded-full animate-spin" />;
    }
    if (status === 'error') {
      return <div className="w-3 h-3 bg-red-500 rounded-full" />;
    }
    if (type === 'terminal') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
      </svg>
    );
  };

  if (tabs.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-zinc-950 border border-zinc-800 rounded-lg ${className}`}>
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-zinc-400 mb-2">No Preview Windows</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Open terminal or web previews to see them here
          </p>
          <div className="flex flex-col gap-2 text-xs text-zinc-600">
            <div>• Right-click nodes to open previews</div>
            <div>• Use keyboard shortcuts: Cmd/Ctrl+W to close, Cmd/Ctrl+[ ] to navigate</div>
          </div>
        </div>
      </div>
    );
  }

  // Picture-in-Picture component
  const PictureInPictureWindow = () => (
    <div
      ref={pipRef}
      className="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: `${pipPosition.x}px`,
        top: `${pipPosition.y}px`,
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
      }}
    >
      {/* PiP Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700 cursor-move"
        onMouseDown={handlePipDragStart}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300 font-medium">
            {activeTab?.title || 'Preview'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={togglePictureInPicture}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
            title="Exit Picture-in-Picture"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* PiP Content */}
      <div className="h-full pb-8">
        {activeTab && (
          activeTab.type === 'terminal' ? (
            <TerminalPreview
              nodeId={activeTab.nodeId}
              executionId={activeTab.executionId}
              className="h-full"
            />
          ) : (
            <WebPreview
              nodeId={activeTab.nodeId}
              executionId={activeTab.executionId}
              className="h-full"
            />
          )
        )}
      </div>
    </div>
  );

  if (isPictureInPicture && activeTab) {
    return <PictureInPictureWindow />;
  }

  return (
    <>
      <div 
        className={`flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden transition-all duration-300 ${
          isMaximized 
            ? 'fixed inset-4 z-40 h-auto' 
            : isMinimized 
              ? 'h-12' 
              : 'h-full'
        } ${className}`}
      >
        {/* Tab Bar */}
        <div className="flex items-center bg-zinc-900 border-b border-zinc-800">
          {/* Window Controls */}
          <div className="flex items-center">
            <button
              onClick={toggleMinimize}
              className={`p-2 transition-colors ${
                isMinimized 
                  ? 'text-yellow-400 bg-yellow-400/10' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={isMinimized ? 'Restore' : 'Minimize'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M20 12H4" />
              </svg>
            </button>
            
            <button
              onClick={toggleMaximize}
              className={`p-2 transition-colors ${
                isMaximized 
                  ? 'text-green-400 bg-green-400/10' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 8V4a2 2 0 012-2h12a2 2 0 012 2v4M4 16v4a2 2 0 002 2h12a2 2 0 002-2v-4" />
              </svg>
            </button>

            <button
              onClick={togglePictureInPicture}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Picture-in-Picture"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M7 4V2a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1h-2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h1z" />
              </svg>
            </button>
          </div>

          {/* Collapse/Expand Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 9l-7 7-7-7" />
            </svg>
          </button>

        {/* Tabs Container */}
        <div 
          ref={tabsContainerRef}
          className="flex-1 flex overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleTabDragStart(e, tab.id)}
              onDragOver={handleTabDragOver}
              onDrop={(e) => handleTabDrop(e, tab.id)}
              className={`
                flex items-center gap-2 px-3 py-2 min-w-0 max-w-48 cursor-pointer border-r border-zinc-800 transition-colors
                ${tab.id === activeTabId 
                  ? 'bg-zinc-800 text-white' 
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'
                }
              `}
              onClick={() => switchToTab(tab.id)}
            >
              {getTabIcon(tab.type, tab.status)}
              <span className="truncate text-sm font-medium">{tab.title}</span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className="ml-auto p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Tab Actions */}
        <div className="flex items-center border-l border-zinc-800">
          <div className="px-2 text-xs text-zinc-500">
            {tabs.length}/{maxTabs}
          </div>
        </div>
      </div>

        {/* Content Area */}
        {!isCollapsed && !isMinimized && activeTab && (
          <div className="flex-1 overflow-hidden">
            {activeTab.type === 'terminal' ? (
              <TerminalPreview
                nodeId={activeTab.nodeId}
                executionId={activeTab.executionId}
                className="h-full"
              />
            ) : (
              <WebPreview
                nodeId={activeTab.nodeId}
                executionId={activeTab.executionId}
                className="h-full"
              />
            )}
          </div>
        )}

        {/* Collapsed State */}
        {(isCollapsed || isMinimized) && (
          <div className="p-4 text-center text-sm text-zinc-500">
            {isMinimized ? 'Minimized' : 'Collapsed'} • {tabs.length} tab{tabs.length !== 1 ? 's' : ''} open
          </div>
        )}
      </div>
    </>
  );
}