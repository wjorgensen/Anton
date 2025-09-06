'use client'

import React, { useState } from 'react'
import { 
  Play, 
  Square, 
  Download, 
  Upload, 
  Save, 
  Zap,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings,
  Grid,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react'

interface FloatingToolbarProps {
  isRunning: boolean
  onRun: () => void
  onStop: () => void
  onExport: () => void
  onImport: () => void
  onSave: () => void
  onFitView: () => void
  onFullscreen: () => void
  onReset: () => void
  isFullscreen: boolean
  nodeCount: number
  edgeCount: number
  executionProgress?: number
}

export default function FloatingToolbar({
  isRunning,
  onRun,
  onStop,
  onExport,
  onImport,
  onSave,
  onFitView,
  onFullscreen,
  onReset,
  isFullscreen,
  nodeCount,
  edgeCount,
  executionProgress = 0
}: FloatingToolbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [showMinimap, setShowMinimap] = useState(true)

  if (isCollapsed) {
    return (
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-3 bg-glass backdrop-blur-xl border border-glass-border rounded-full shadow-glass hover:bg-glass-border transition-all duration-300 animate-float"
        >
          <Layers className="w-5 h-5 text-text-primary" />
        </button>
      </div>
    )
  }

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl shadow-glass p-3 animate-float">
        {/* Main Controls */}
        <div className="flex items-center gap-2 mb-3">
          {/* Execution Controls */}
          <div className="flex items-center gap-1 px-3 py-2 bg-bg-quaternary/50 rounded-lg border border-border-secondary/50">
            {!isRunning ? (
              <button
                onClick={onRun}
                disabled={nodeCount === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-success rounded-md hover:bg-success/90 transition-all duration-200 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-green"
              >
                <Play className="w-4 h-4" />
                Run
              </button>
            ) : (
              <button
                onClick={onStop}
                className="flex items-center gap-2 px-3 py-1.5 bg-error rounded-md hover:bg-error/90 transition-all duration-200 text-white text-sm font-medium shadow-glow-red"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            )}
          </div>

          <div className="w-px h-8 bg-border-secondary/50" />

          {/* File Operations */}
          <div className="flex items-center gap-1">
            <button
              onClick={onSave}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Save Flow"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onExport}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Export Flow"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onImport}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Import Flow"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-8 bg-border-secondary/50" />

          {/* View Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onFitView}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Fit to View"
            >
              <Zap className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                showGrid 
                  ? 'bg-accent-primary/20 text-accent-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-quaternary/50'
              }`}
              title={showGrid ? "Hide Grid" : "Show Grid"}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMinimap(!showMinimap)}
              className={`p-2 rounded-lg transition-all duration-200 ${
                showMinimap 
                  ? 'bg-accent-primary/20 text-accent-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-quaternary/50'
              }`}
              title={showMinimap ? "Hide Minimap" : "Show Minimap"}
            >
              {showMinimap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={onFullscreen}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="w-px h-8 bg-border-secondary/50" />

          {/* Utility Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onReset}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-2 hover:bg-bg-quaternary/50 rounded-lg transition-all duration-200 text-text-secondary hover:text-text-primary"
              title="Collapse Toolbar"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between">
          {/* Execution Progress */}
          {isRunning && (
            <div className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-xs text-success font-medium">Running...</span>
              </div>
              <div className="flex-1 max-w-32">
                <div className="w-full bg-bg-secondary rounded-full h-1.5">
                  <div 
                    className="bg-success h-1.5 rounded-full transition-all duration-500 shadow-glow-green"
                    style={{ width: `${executionProgress}%` }}
                  ></div>
                </div>
              </div>
              <span className="text-xs text-text-secondary">{Math.round(executionProgress)}%</span>
            </div>
          )}

          {/* Stats */}
          {!isRunning && (
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-accent-primary rounded-full"></div>
                <span>{nodeCount} nodes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-border-secondary rounded-full"></div>
                <span>{edgeCount} connections</span>
              </div>
            </div>
          )}
        </div>

        {/* Shimmer effect for running state */}
        {isRunning && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-success/10 to-transparent animate-shimmer"></div>
          </div>
        )}
      </div>
    </div>
  )
}