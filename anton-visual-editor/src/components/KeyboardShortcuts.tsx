'use client'

import { useEffect } from 'react'
import { useFlowStore } from '@/store/flowStore'

interface KeyboardShortcutsProps {
  onRun: () => void
  onStop: () => void
  onSave: () => void
  onExport: () => void
  onImport: () => void
  onFitView: () => void
  onReset: () => void
  onFullscreen: () => void
  isRunning: boolean
}

export default function KeyboardShortcuts({
  onRun,
  onStop,
  onSave,
  onExport,
  onImport,
  onFitView,
  onReset,
  onFullscreen,
  isRunning,
}: KeyboardShortcutsProps) {
  const {
    nodes,
    selectedNodes,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
    selectMultipleNodes,
    clearSelection,
    snapNodesToGrid,
    centerAllNodes,
    applyAutoLayout,
    applyForceLayout,
    alignNodes,
    distributeNodes,
  } = useFlowStore()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey
      const isShift = event.shiftKey
      const isAlt = event.altKey

      // Ctrl/Cmd combinations
      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 's':
            event.preventDefault()
            onSave()
            break

          case 'r':
            event.preventDefault()
            if (!isRunning) {
              onRun()
            }
            break

          case 'e':
            if (isShift) {
              event.preventDefault()
              onExport()
            }
            break

          case 'i':
            if (isShift) {
              event.preventDefault()
              onImport()
            }
            break

          case 'f':
            event.preventDefault()
            onFitView()
            break

          case 'r':
            if (isShift) {
              event.preventDefault()
              onReset()
            }
            break

          case 'enter':
            if (isShift) {
              event.preventDefault()
              onFullscreen()
            }
            break

          case 'c':
            event.preventDefault()
            if (selectedNodes.length > 0) {
              copyNodes(selectedNodes)
            }
            break

          case 'v':
            event.preventDefault()
            pasteNodes()
            break

          case 'a':
            event.preventDefault()
            selectMultipleNodes(nodes.map(node => node.id))
            break

          case 'd':
            event.preventDefault()
            if (selectedNodes.length > 0) {
              // Duplicate selected nodes
              const nodesToCopy = nodes.filter(node => selectedNodes.includes(node.id))
              copyNodes(selectedNodes)
              pasteNodes({ x: 50, y: 50 }) // Offset duplicates
            }
            break

          case 'g':
            event.preventDefault()
            if (selectedNodes.length > 0) {
              snapNodesToGrid()
            }
            break

          case 'l':
            event.preventDefault()
            if (isShift) {
              // Auto layout
              applyAutoLayout({ direction: 'LR', nodeSpacing: 150, rankSpacing: 200, alignment: 'center' })
            } else if (isAlt) {
              // Force directed layout
              applyForceLayout(50)
            }
            break

          case '0':
            event.preventDefault()
            centerAllNodes()
            break
        }
      }
      // Alt combinations for alignment
      else if (isAlt && selectedNodes.length >= 2) {
        switch (event.key.toLowerCase()) {
          case 'arrowleft':
          case 'h':
            event.preventDefault()
            alignNodes(selectedNodes, 'left')
            break

          case 'arrowright':
          case 'l':
            event.preventDefault()
            alignNodes(selectedNodes, 'right')
            break

          case 'arrowup':
          case 'k':
            event.preventDefault()
            alignNodes(selectedNodes, 'top')
            break

          case 'arrowdown':
          case 'j':
            event.preventDefault()
            alignNodes(selectedNodes, 'bottom')
            break

          case 'c':
            event.preventDefault()
            alignNodes(selectedNodes, 'center')
            break

          case 'm':
            event.preventDefault()
            alignNodes(selectedNodes, 'middle')
            break
        }
      }
      // Alt + Shift combinations for distribution
      else if (isAlt && isShift && selectedNodes.length >= 3) {
        switch (event.key.toLowerCase()) {
          case 'arrowleft':
          case 'h':
          case 'arrowright':
          case 'l':
            event.preventDefault()
            distributeNodes(selectedNodes, 'horizontal')
            break

          case 'arrowup':
          case 'k':
          case 'arrowdown':
          case 'j':
            event.preventDefault()
            distributeNodes(selectedNodes, 'vertical')
            break
        }
      }
      // Single key shortcuts
      else {
        switch (event.key) {
          case 'Delete':
          case 'Backspace':
            event.preventDefault()
            if (selectedNodes.length > 0) {
              deleteSelectedNodes()
            }
            break

          case 'Escape':
            event.preventDefault()
            clearSelection()
            break

          case ' ':
            event.preventDefault()
            if (isRunning) {
              onStop()
            } else {
              onRun()
            }
            break

          case 'Tab':
            event.preventDefault()
            // Cycle through nodes
            if (nodes.length > 0) {
              const currentIndex = selectedNodes.length === 1 
                ? nodes.findIndex(node => node.id === selectedNodes[0])
                : -1
              const nextIndex = (currentIndex + 1) % nodes.length
              selectMultipleNodes([nodes[nextIndex].id])
            }
            break
        }
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    // Dependencies
    nodes,
    selectedNodes,
    isRunning,
    onRun,
    onStop,
    onSave,
    onExport,
    onImport,
    onFitView,
    onReset,
    onFullscreen,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
    selectMultipleNodes,
    clearSelection,
    snapNodesToGrid,
    centerAllNodes,
    applyAutoLayout,
    applyForceLayout,
    alignNodes,
    distributeNodes,
  ])

  return null // This component doesn't render anything
}

// Export a helper component that shows keyboard shortcuts
export function KeyboardShortcutsHelp() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Keyboard Shortcuts</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Flow Control */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">Flow Control</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+R</kbd>
              <span>Run Flow</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Space</kbd>
              <span>Run/Stop Toggle</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+S</kbd>
              <span>Save Flow</span>
            </div>
          </div>
        </div>

        {/* Selection */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">Selection</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+A</kbd>
              <span>Select All</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Escape</kbd>
              <span>Clear Selection</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Tab</kbd>
              <span>Cycle Nodes</span>
            </div>
          </div>
        </div>

        {/* Edit Operations */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">Edit Operations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+C</kbd>
              <span>Copy Nodes</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+V</kbd>
              <span>Paste Nodes</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+D</kbd>
              <span>Duplicate Nodes</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Delete</kbd>
              <span>Delete Selected</span>
            </div>
          </div>
        </div>

        {/* View Controls */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">View Controls</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+F</kbd>
              <span>Fit to View</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+0</kbd>
              <span>Center Nodes</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+Shift+R</kbd>
              <span>Reset View</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+Shift+Enter</kbd>
              <span>Fullscreen</span>
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">Layout</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+G</kbd>
              <span>Snap to Grid</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+Shift+L</kbd>
              <span>Auto Layout</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Ctrl+Alt+L</kbd>
              <span>Force Layout</span>
            </div>
          </div>
        </div>

        {/* Alignment */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-accent-primary">Alignment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+←</kbd>
              <span>Align Left</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+→</kbd>
              <span>Align Right</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+↑</kbd>
              <span>Align Top</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+↓</kbd>
              <span>Align Bottom</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+C</kbd>
              <span>Align Center</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-2 py-1 bg-bg-secondary rounded">Alt+M</kbd>
              <span>Align Middle</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-bg-secondary rounded-lg">
        <p className="text-sm text-text-muted">
          <strong>Tip:</strong> Most shortcuts require 2+ selected nodes for alignment and 3+ for distribution.
          Use <kbd className="px-1 bg-bg-tertiary rounded">Ctrl+Click</kbd> or drag to select multiple nodes.
        </p>
      </div>
    </div>
  )
}