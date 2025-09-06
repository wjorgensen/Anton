'use client';

import React from 'react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'pulse' | 'dots';
  className?: string;
}

export function LoadingState({ 
  message = 'Loading...', 
  size = 'md', 
  variant = 'spinner',
  className = '' 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderSpinner = () => (
    <div className={`${sizeClasses[size]} border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin`} />
  );

  const renderPulse = () => (
    <div className={`${sizeClasses[size]} bg-blue-500 rounded-full animate-pulse`} />
  );

  const renderDots = () => (
    <div className="flex items-center gap-1">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={`${size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'} bg-blue-500 rounded-full animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {renderLoader()}
      {message && (
        <span className={`${textSizeClasses[size]} text-zinc-400 animate-pulse`}>
          {message}
        </span>
      )}
    </div>
  );
}

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function Skeleton({ 
  width = '100%', 
  height = '1rem', 
  className = '',
  variant = 'rectangular'
}: SkeletonProps) {
  const baseClasses = 'bg-zinc-800 animate-pulse';
  
  const variantClasses = {
    rectangular: 'rounded',
    circular: 'rounded-full',
    text: 'rounded'
  };

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (variant === 'text') {
    return (
      <div className="space-y-2">
        <div className={`${baseClasses} ${variantClasses[variant]} h-4 ${className}`} style={{ width: '75%' }} />
        <div className={`${baseClasses} ${variantClasses[variant]} h-4 ${className}`} style={{ width: '50%' }} />
        <div className={`${baseClasses} ${variantClasses[variant]} h-4 ${className}`} style={{ width: '60%' }} />
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

interface ProgressBarProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ 
  progress, 
  size = 'md', 
  variant = 'default',
  showLabel = false,
  className = '' 
}: ProgressBarProps) {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const colorClasses = {
    default: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500'
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full ${sizeClasses[size]} bg-zinc-800 rounded-full overflow-hidden`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[variant]} transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-zinc-400">
          <span>{clampedProgress.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}