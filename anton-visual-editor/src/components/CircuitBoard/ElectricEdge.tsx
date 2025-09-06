'use client';

import React from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';

export default function ElectricEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
        </linearGradient>
        
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: `url(#gradient-${id})`,
          strokeWidth: 2,
          filter: `url(#glow-${id})`,
        }}
      />
      
      {data?.animated !== false && (
        <>
          <circle r="4" fill="#3B82F6" filter={`url(#glow-${id})`}>
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2" fill="#60A5FA">
            <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
          </circle>
        </>
      )}
      
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="px-2 py-1 bg-black/80 border border-[#3B82F6]/50 rounded text-[#3B82F6] text-xs font-medium backdrop-blur-sm"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}