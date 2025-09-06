'use client'

import React from 'react'

interface LoadingSkeletonProps {
  variant?: 'node' | 'toolbar' | 'panel' | 'library'
  count?: number
  className?: string
}

const shimmerAnimation = `
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.02) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
`

const baseSkeletonClass = "bg-bg-tertiary rounded animate-shimmer"

export function NodeSkeleton() {
  return (
    <div className="min-w-[200px] p-4 bg-bg-secondary border border-border-primary rounded-xl shadow-lg animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-bg-tertiary rounded-lg"></div>
        <div className="h-4 bg-bg-tertiary rounded flex-1"></div>
        <div className="w-6 h-6 bg-bg-tertiary rounded-full"></div>
      </div>
      
      {/* Category Badge */}
      <div className="w-16 h-5 bg-bg-tertiary rounded-full mb-3"></div>
      
      {/* Description */}
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-bg-tertiary rounded w-full"></div>
        <div className="h-3 bg-bg-tertiary rounded w-3/4"></div>
      </div>
      
      {/* Status Bar */}
      <div className="flex justify-between">
        <div className="w-20 h-4 bg-bg-tertiary rounded"></div>
        <div className="w-16 h-4 bg-bg-tertiary rounded"></div>
      </div>
    </div>
  )
}

export function ToolbarSkeleton() {
  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl shadow-glass p-3 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          {/* Execution Controls */}
          <div className="flex gap-1">
            <div className="w-16 h-8 bg-bg-quaternary rounded-lg"></div>
          </div>
          <div className="w-px h-8 bg-border-secondary/50"></div>
          {/* File Operations */}
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 bg-bg-quaternary rounded-lg"></div>
            ))}
          </div>
          <div className="w-px h-8 bg-border-secondary/50"></div>
          {/* View Controls */}
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-8 h-8 bg-bg-quaternary rounded-lg"></div>
            ))}
          </div>
        </div>
        {/* Status Bar */}
        <div className="flex justify-between">
          <div className="w-24 h-4 bg-bg-quaternary rounded"></div>
          <div className="w-20 h-4 bg-bg-quaternary rounded"></div>
        </div>
      </div>
    </div>
  )
}

export function PropertyPanelSkeleton() {
  return (
    <div className="w-80 h-full bg-bg-primary border-l border-border-primary animate-pulse">
      {/* Header */}
      <div className="p-4 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center justify-between mb-3">
          <div className="w-24 h-6 bg-bg-tertiary rounded"></div>
          <div className="w-8 h-8 bg-bg-tertiary rounded-lg"></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bg-tertiary rounded"></div>
          <div>
            <div className="w-32 h-4 bg-bg-tertiary rounded mb-1"></div>
            <div className="w-16 h-3 bg-bg-tertiary rounded"></div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="border border-border-primary rounded-lg overflow-hidden">
            <div className="p-4 bg-bg-secondary/50">
              <div className="w-32 h-4 bg-bg-tertiary rounded"></div>
            </div>
            <div className="p-4 space-y-3">
              <div className="w-full h-3 bg-bg-tertiary rounded"></div>
              <div className="w-3/4 h-3 bg-bg-tertiary rounded"></div>
              <div className="w-1/2 h-8 bg-bg-tertiary rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LibrarySkeleton() {
  return (
    <div className="w-80 h-full bg-bg-secondary border-r border-border-primary animate-pulse">
      {/* Header */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex items-center justify-between mb-3">
          <div className="w-32 h-6 bg-bg-tertiary rounded"></div>
          <div className="w-16 h-5 bg-bg-tertiary rounded"></div>
        </div>
        <div className="w-full h-8 bg-bg-tertiary rounded-lg"></div>
      </div>
      
      {/* Categories */}
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i}>
            {/* Category Header */}
            <div className="flex items-center gap-3 p-3 rounded-lg mb-3">
              <div className="w-4 h-4 bg-bg-tertiary rounded"></div>
              <div className="w-3 h-3 bg-bg-tertiary rounded-full"></div>
              <div className="w-24 h-4 bg-bg-tertiary rounded"></div>
              <div className="w-6 h-4 bg-bg-tertiary rounded-full ml-auto"></div>
            </div>
            
            {/* Agent Cards */}
            <div className="space-y-2 ml-6">
              {[1, 2, 3].map(j => (
                <div key={j} className="p-4 bg-bg-tertiary rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-bg-quaternary rounded"></div>
                    <div className="flex-1">
                      <div className="w-32 h-4 bg-bg-quaternary rounded mb-2"></div>
                      <div className="space-y-1">
                        <div className="w-full h-3 bg-bg-quaternary rounded"></div>
                        <div className="w-3/4 h-3 bg-bg-quaternary rounded"></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <div className="w-12 h-5 bg-bg-quaternary rounded"></div>
                        <div className="w-16 h-5 bg-bg-quaternary rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LoadingSkeleton({ variant = 'node', count = 1, className }: LoadingSkeletonProps) {
  const components = {
    node: NodeSkeleton,
    toolbar: ToolbarSkeleton, 
    panel: PropertyPanelSkeleton,
    library: LibrarySkeleton,
  }
  
  const Component = components[variant]
  
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </div>
  )
}