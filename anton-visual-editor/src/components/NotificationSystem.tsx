'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  persistent?: boolean
}

interface NotificationSystemProps {
  notifications: Notification[]
  onRemove: (id: string) => void
}

interface NotificationItemProps {
  notification: Notification
  onRemove: (id: string) => void
}

const notificationConfig = {
  success: {
    icon: CheckCircle,
    className: 'bg-success/10 border-success/30 text-success',
    iconColor: 'text-success',
    glowClass: 'shadow-glow-green',
  },
  error: {
    icon: XCircle,
    className: 'bg-error/10 border-error/30 text-error',
    iconColor: 'text-error',
    glowClass: 'shadow-glow-red',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-warning/10 border-warning/30 text-warning',
    iconColor: 'text-warning',
    glowClass: 'shadow-glow-yellow',
  },
  info: {
    icon: Info,
    className: 'bg-info/10 border-info/30 text-info',
    iconColor: 'text-info',
    glowClass: 'shadow-glow-blue',
  },
}

function NotificationItem({ notification, onRemove }: NotificationItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  
  const config = notificationConfig[notification.type]
  const Icon = config.icon

  useEffect(() => {
    // Trigger enter animation
    setTimeout(() => setIsVisible(true), 10)
    
    // Auto-remove after duration (if not persistent)
    if (!notification.persistent && notification.duration !== 0) {
      const duration = notification.duration || 5000
      const timer = setTimeout(() => handleRemove(), duration)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleRemove = useCallback(() => {
    setIsRemoving(true)
    setTimeout(() => onRemove(notification.id), 300)
  }, [notification.id, onRemove])

  return (
    <div
      className={`
        transform transition-all duration-300 ease-out mb-3
        ${isVisible && !isRemoving ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-full opacity-0 scale-95'}
      `}
    >
      <div
        className={`
          relative p-4 rounded-xl border backdrop-blur-sm ${config.className} ${config.glowClass}
          min-w-80 max-w-md animate-slide-in-right
        `}
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 rounded-xl opacity-5 pointer-events-none">
          <div className="w-full h-full bg-gradient-to-r from-current via-transparent to-current"></div>
        </div>
        
        <div className="relative flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${config.iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
            {notification.message && (
              <p className="text-xs opacity-80 leading-relaxed">
                {notification.message}
              </p>
            )}
          </div>
          
          {/* Close Button */}
          <button
            onClick={handleRemove}
            className="flex-shrink-0 p-1 hover:bg-current hover:bg-opacity-10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Progress Bar for timed notifications */}
        {!notification.persistent && notification.duration !== 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-current bg-opacity-20 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-current opacity-50 animate-shrink-width"
              style={{
                animationDuration: `${notification.duration || 5000}ms`,
                animationTimingFunction: 'linear',
              }}
            ></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NotificationSystem({ notifications, onRemove }: NotificationSystemProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-6 right-6 z-50 max-w-md space-y-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

// Notification Manager Hook
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2)}`
    const newNotification = { id, ...notification }
    
    setNotifications(prev => [...prev, newNotification])
    
    return id
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'success', title, message, ...options })
  }, [addNotification])

  const error = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'error', title, message, persistent: true, ...options })
  }, [addNotification])

  const warning = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'warning', title, message, ...options })
  }, [addNotification])

  const info = useCallback((title: string, message?: string, options?: Partial<Notification>) => {
    return addNotification({ type: 'info', title, message, ...options })
  }, [addNotification])

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
  }
}