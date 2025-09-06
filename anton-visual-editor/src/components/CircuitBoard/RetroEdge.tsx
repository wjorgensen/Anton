import React from 'react';
import { EdgeProps, getBezierPath } from '@xyflow/react';

export default function RetroEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isActive = data?.isActive || false;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={isActive ? '#0080FF' : '#FFFFFF'}
        strokeWidth={isActive ? 3 : 2}
        fill="none"
        strokeDasharray={isActive ? '5,5' : '0'}
      />
      {isActive && (
        <circle r="4" fill="#0080FF">
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
    </>
  );
}