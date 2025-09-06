'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className = '', animate = true }: SkeletonProps) {
  return (
    <div
      className={`bg-border rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-bg-secondary border border-border rounded-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="w-6 h-6" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Skeleton className="w-12 h-5 rounded-full" />
          <Skeleton className="w-16 h-5 rounded-full" />
        </div>
        <Skeleton className="w-20 h-6 rounded" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="flex-1 h-9 rounded" />
        <Skeleton className="w-24 h-9 rounded" />
      </div>
    </div>
  );
}

export function ProjectListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-bg-secondary border border-border rounded p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-12 h-5 rounded-full" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <Skeleton className="w-20 h-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentLibrarySkeleton() {
  return (
    <div className="w-80 bg-bg-secondary border-r border-border p-4 space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full rounded" />
      </div>

      {Array.from({ length: 3 }).map((_, categoryIdx) => (
        <div key={categoryIdx} className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="w-6 h-4 rounded-full ml-auto" />
          </div>
          
          <div className="pl-6 space-y-2">
            {Array.from({ length: 4 }).map((_, agentIdx) => (
              <div key={agentIdx} className="flex items-center gap-3 p-2">
                <Skeleton className="w-8 h-8 rounded" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NodeSkeleton() {
  return (
    <div className="w-48 p-4 bg-bg-secondary border border-border rounded-xl space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="w-6 h-6 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      <div className="flex justify-between items-center">
        <Skeleton className="w-12 h-5 rounded-full" />
        <Skeleton className="w-6 h-6 rounded" />
      </div>
    </div>
  );
}

export function FlowEditorSkeleton() {
  return (
    <div className="h-screen flex">
      <AgentLibrarySkeleton />
      
      <div className="flex-1 relative">
        {/* Canvas area with skeleton nodes */}
        <div className="absolute inset-0 p-8">
          <div className="grid grid-cols-4 gap-8 h-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <NodeSkeleton />
              </div>
            ))}
          </div>
        </div>

        {/* Floating toolbar skeleton */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
          <div className="flex gap-2 p-2 bg-bg-secondary border border-border rounded-lg">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="w-8 h-8 rounded" />
            ))}
          </div>
        </div>

        {/* Controls skeleton */}
        <div className="absolute bottom-4 right-4">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-8 h-8 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="w-32 h-10 rounded" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-bg-secondary border border-border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Projects grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}