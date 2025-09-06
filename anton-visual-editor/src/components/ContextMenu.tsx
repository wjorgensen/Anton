'use client'

import React, { useEffect, useRef } from 'react'
import { 
  Edit, 
  Copy, 
  Trash2, 
  Settings, 
  Play, 
  Square, 
  Link,
  Unlink,
  Eye,
  EyeOff,
  MoreHorizontal 
} from 'lucide-react'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  items: ContextMenuItem[]
}

interface ContextMenuItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  divider?: boolean
}

export default function ContextMenu({ x, y, onClose, items }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscKey)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [onClose])

  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - items.length * 40 - 20)

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Menu */}
      <div
        ref={menuRef}
        className="fixed z-50 min-w-48 bg-bg-secondary backdrop-blur-xl border border-glass-border rounded-xl shadow-glass py-2 animate-scale-in"
        style={{
          left: adjustedX,
          top: adjustedY,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {item.divider && (
              <div className="h-px bg-border-secondary my-2 mx-3" />
            )}
            <button
              onClick={() => {
                item.onClick()
                onClose()
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all duration-150 ${
                item.disabled
                  ? 'text-text-muted cursor-not-allowed'
                  : item.destructive
                  ? 'text-error hover:text-white hover:bg-error/20'
                  : 'text-text-primary hover:text-white hover:bg-accent-primary/20'
              }`}
            >
              <div className={`w-4 h-4 flex-shrink-0 ${
                item.disabled 
                  ? 'opacity-50' 
                  : item.destructive 
                  ? 'text-error' 
                  : 'text-text-secondary'
              }`}>
                {item.icon}
              </div>
              <span className="flex-1">{item.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </>
  )
}

// Common context menu configurations
export const createNodeContextMenu = (
  nodeId: string,
  onEdit: () => void,
  onDuplicate: () => void,
  onDelete: () => void,
  onRun?: () => void,
  onStop?: () => void,
  isRunning?: boolean,
): ContextMenuItem[] => [
  {
    id: 'edit',
    label: 'Edit Node',
    icon: <Edit className="w-4 h-4" />,
    onClick: onEdit,
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: <Copy className="w-4 h-4" />,
    onClick: onDuplicate,
  },
  {
    id: 'divider1',
    label: '',
    icon: null,
    onClick: () => {},
    divider: true,
  },
  ...(onRun && onStop ? [{
    id: isRunning ? 'stop' : 'run',
    label: isRunning ? 'Stop Execution' : 'Run from Here',
    icon: isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />,
    onClick: isRunning ? onStop : onRun,
  }] : []),
  {
    id: 'properties',
    label: 'Properties',
    icon: <Settings className="w-4 h-4" />,
    onClick: onEdit,
  },
  {
    id: 'divider2',
    label: '',
    icon: null,
    onClick: () => {},
    divider: true,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-4 h-4" />,
    onClick: onDelete,
    destructive: true,
  },
]

export const createCanvasContextMenu = (
  onPaste?: () => void,
  onSelectAll?: () => void,
  onClear?: () => void,
  hasPaste?: boolean,
  hasNodes?: boolean,
): ContextMenuItem[] => [
  {
    id: 'paste',
    label: 'Paste',
    icon: <Copy className="w-4 h-4" />,
    onClick: onPaste || (() => {}),
    disabled: !hasPaste || !onPaste,
  },
  {
    id: 'select-all',
    label: 'Select All',
    icon: <MoreHorizontal className="w-4 h-4" />,
    onClick: onSelectAll || (() => {}),
    disabled: !hasNodes || !onSelectAll,
  },
  {
    id: 'divider1',
    label: '',
    icon: null,
    onClick: () => {},
    divider: true,
  },
  {
    id: 'clear',
    label: 'Clear Canvas',
    icon: <Trash2 className="w-4 h-4" />,
    onClick: onClear || (() => {}),
    disabled: !hasNodes || !onClear,
    destructive: true,
  },
]

export const createEdgeContextMenu = (
  edgeId: string,
  onDelete: () => void,
  onToggleAnimation?: () => void,
  isAnimated?: boolean,
): ContextMenuItem[] => [
  ...(onToggleAnimation ? [{
    id: 'toggle-animation',
    label: isAnimated ? 'Disable Animation' : 'Enable Animation',
    icon: isAnimated ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
    onClick: onToggleAnimation,
  }] : []),
  {
    id: 'disconnect',
    label: 'Disconnect',
    icon: <Unlink className="w-4 h-4" />,
    onClick: onDelete,
    destructive: true,
  },
]