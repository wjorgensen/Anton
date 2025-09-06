'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  nodeId?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration || 5000,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove non-persistent toasts
    if (!newToast.persistent) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-800 border-green-600 text-green-100';
      case 'warning':
        return 'bg-yellow-800 border-yellow-600 text-yellow-100';
      case 'error':
        return 'bg-red-800 border-red-600 text-red-100';
      default:
        return 'bg-blue-800 border-blue-600 text-blue-100';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  return (
    <div
      className={`
        border rounded-lg p-3 shadow-lg transition-all duration-300 transform
        ${getToastStyles()}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{toast.title}</div>
          {toast.message && (
            <div className="text-xs opacity-90 mt-1 break-words">{toast.message}</div>
          )}
          {toast.nodeId && (
            <div className="text-xs opacity-70 mt-1 font-mono">Node: {toast.nodeId}</div>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="text-current opacity-70 hover:opacity-100 text-sm leading-none"
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// Utility hooks for common toast patterns
export function useNodeToasts() {
  const { addToast } = useToast();

  const notifyNodeStarted = useCallback((nodeId: string) => {
    addToast({
      type: 'info',
      title: 'Node Started',
      message: `Node ${nodeId} is now running`,
      nodeId,
      duration: 3000,
    });
  }, [addToast]);

  const notifyNodeCompleted = useCallback((nodeId: string, output?: any) => {
    addToast({
      type: 'success',
      title: 'Node Completed',
      message: output ? `Node ${nodeId} completed successfully` : `Node ${nodeId} finished`,
      nodeId,
      duration: 4000,
    });
  }, [addToast]);

  const notifyNodeFailed = useCallback((nodeId: string, error?: string) => {
    addToast({
      type: 'error',
      title: 'Node Failed',
      message: error || `Node ${nodeId} encountered an error`,
      nodeId,
      persistent: true, // Keep error toasts visible
    });
  }, [addToast]);

  const notifyNodeReview = useCallback((nodeId: string) => {
    addToast({
      type: 'warning',
      title: 'Review Required',
      message: `Node ${nodeId} needs manual review`,
      nodeId,
      persistent: true,
    });
  }, [addToast]);

  return {
    notifyNodeStarted,
    notifyNodeCompleted,
    notifyNodeFailed,
    notifyNodeReview,
  };
}

export function useConnectionToasts() {
  const { addToast } = useToast();

  const notifyConnected = useCallback(() => {
    addToast({
      type: 'success',
      title: 'WebSocket Connected',
      message: 'Real-time updates are now active',
      duration: 3000,
    });
  }, [addToast]);

  const notifyDisconnected = useCallback(() => {
    addToast({
      type: 'warning',
      title: 'Connection Lost',
      message: 'Attempting to reconnect...',
      duration: 4000,
    });
  }, [addToast]);

  const notifyReconnected = useCallback(() => {
    addToast({
      type: 'success',
      title: 'Reconnected',
      message: 'WebSocket connection restored',
      duration: 3000,
    });
  }, [addToast]);

  const notifyConnectionFailed = useCallback((error: string) => {
    addToast({
      type: 'error',
      title: 'Connection Failed',
      message: error,
      persistent: true,
    });
  }, [addToast]);

  return {
    notifyConnected,
    notifyDisconnected,
    notifyReconnected,
    notifyConnectionFailed,
  };
}