'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 500,
  disabled = false,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (disabled) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let newPosition = position;

      // Check if tooltip would go outside viewport and adjust position
      switch (position) {
        case 'top':
          if (triggerRect.top - tooltipRect.height < 10) {
            newPosition = 'bottom';
          }
          break;
        case 'bottom':
          if (triggerRect.bottom + tooltipRect.height > viewport.height - 10) {
            newPosition = 'top';
          }
          break;
        case 'left':
          if (triggerRect.left - tooltipRect.width < 10) {
            newPosition = 'right';
          }
          break;
        case 'right':
          if (triggerRect.right + tooltipRect.width > viewport.width - 10) {
            newPosition = 'left';
          }
          break;
      }

      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  const getTooltipClasses = () => {
    const baseClasses = `
      absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 border border-gray-700 rounded shadow-lg
      whitespace-nowrap pointer-events-none transition-opacity duration-200
      ${isVisible ? 'opacity-100' : 'opacity-0'}
    `;

    const positionClasses = {
      top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
      bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1', 
      left: 'right-full top-1/2 transform -translate-y-1/2 mr-1',
      right: 'left-full top-1/2 transform -translate-y-1/2 ml-1',
    };

    return `${baseClasses} ${positionClasses[actualPosition]} ${className}`;
  };

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-gray-900 border border-gray-700 transform rotate-45';
    
    const arrowPositions = {
      top: 'top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-t-0 border-l-0',
      bottom: 'bottom-full left-1/2 transform -translate-x-1/2 translate-y-1/2 border-b-0 border-r-0',
      left: 'left-full top-1/2 transform -translate-x-1/2 -translate-y-1/2 border-t-0 border-r-0',
      right: 'right-full top-1/2 transform translate-x-1/2 -translate-y-1/2 border-b-0 border-l-0',
    };

    return `${baseClasses} ${arrowPositions[actualPosition]}`;
  };

  if (disabled || !content) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={getTooltipClasses()}
          role="tooltip"
        >
          <div className={getArrowClasses()} />
          {content}
        </div>
      )}
    </div>
  );
}