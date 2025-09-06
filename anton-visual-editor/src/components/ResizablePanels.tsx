'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  children: React.ReactNode[];
  defaultSizes?: number[];
  minSizes?: number[];
  direction?: 'horizontal' | 'vertical';
  className?: string;
  onResize?: (sizes: number[]) => void;
}

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className = '' }: PanelProps) {
  return <div className={className}>{children}</div>;
}

export function ResizablePanels({ 
  children, 
  defaultSizes = [],
  minSizes = [],
  direction = 'horizontal',
  className = '',
  onResize 
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>(() => {
    if (defaultSizes.length === children.length) {
      return defaultSizes;
    }
    return Array(children.length).fill(100 / children.length);
  });
  const [isResizing, setIsResizing] = useState<number | null>(null);

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(index);
    
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSizes = [...sizes];
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const containerSize = direction === 'horizontal' ? rect.width : rect.height;
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const deltaPercent = (delta / containerSize) * 100;
      
      const newSizes = [...startSizes];
      const currentMinSize = minSizes[index] || 10;
      const nextMinSize = minSizes[index + 1] || 10;
      
      // Calculate new sizes
      const newCurrentSize = Math.max(currentMinSize, newSizes[index] + deltaPercent);
      const newNextSize = Math.max(nextMinSize, newSizes[index + 1] - deltaPercent);
      
      // Only update if both panels respect minimum sizes
      if (newCurrentSize >= currentMinSize && newNextSize >= nextMinSize) {
        newSizes[index] = newCurrentSize;
        newSizes[index + 1] = newNextSize;
        setSizes(newSizes);
        onResize?.(newSizes);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sizes, direction, minSizes, onResize]);

  // Keyboard support for accessibility
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    
    e.preventDefault();
    const step = e.shiftKey ? 5 : 1;
    const isIncrement = direction === 'horizontal' 
      ? ['ArrowRight'].includes(e.key)
      : ['ArrowDown'].includes(e.key);
    const isDecrement = direction === 'horizontal'
      ? ['ArrowLeft'].includes(e.key)
      : ['ArrowUp'].includes(e.key);
    
    if (!isIncrement && !isDecrement) return;
    
    const newSizes = [...sizes];
    const currentMinSize = minSizes[index] || 10;
    const nextMinSize = minSizes[index + 1] || 10;
    const delta = isIncrement ? step : -step;
    
    const newCurrentSize = Math.max(currentMinSize, newSizes[index] + delta);
    const newNextSize = Math.max(nextMinSize, newSizes[index + 1] - delta);
    
    if (newCurrentSize >= currentMinSize && newNextSize >= nextMinSize) {
      newSizes[index] = newCurrentSize;
      newSizes[index + 1] = newNextSize;
      setSizes(newSizes);
      onResize?.(newSizes);
    }
  }, [sizes, direction, minSizes, onResize]);

  return (
    <div 
      ref={containerRef}
      className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} h-full w-full ${className}`}
    >
      {children.map((child, index) => (
        <React.Fragment key={index}>
          <div 
            className="relative overflow-hidden transition-all duration-200"
            style={{
              [direction === 'horizontal' ? 'width' : 'height']: `${sizes[index]}%`,
              minWidth: direction === 'horizontal' ? `${minSizes[index] || 10}%` : undefined,
              minHeight: direction === 'vertical' ? `${minSizes[index] || 10}%` : undefined,
            }}
          >
            {child}
          </div>
          
          {/* Resize Handle */}
          {index < children.length - 1 && (
            <div
              className={`relative flex-shrink-0 ${
                direction === 'horizontal' 
                  ? 'w-1 cursor-col-resize hover:bg-blue-500/30' 
                  : 'h-1 cursor-row-resize hover:bg-blue-500/30'
              } ${
                isResizing === index 
                  ? 'bg-blue-500/50' 
                  : 'bg-zinc-700 hover:bg-zinc-600'
              } transition-colors group`}
              onMouseDown={(e) => handleMouseDown(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              tabIndex={0}
              role="separator"
              aria-label={`Resize panel ${index + 1}`}
            >
              {/* Visual indicator */}
              <div 
                className={`absolute ${
                  direction === 'horizontal'
                    ? 'inset-y-0 left-0 w-1'
                    : 'inset-x-0 top-0 h-1'
                } bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity`}
              />
              
              {/* Resize dots */}
              <div 
                className={`absolute ${
                  direction === 'horizontal'
                    ? 'top-1/2 left-0 -translate-y-1/2 w-1 h-8'
                    : 'left-1/2 top-0 -translate-x-1/2 h-1 w-8'
                } flex ${
                  direction === 'horizontal' ? 'flex-col' : 'flex-row'
                } items-center justify-center gap-0.5`}
              >
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 h-0.5 bg-zinc-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                ))}
              </div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}