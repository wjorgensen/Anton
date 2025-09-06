'use client';

import React from 'react';
import {
  Plus,
  Search,
  Filter,
  GitBranch,
  Zap,
  Layers,
  Sparkles,
  ArrowRight,
  BookOpen,
  Play,
  RefreshCw
} from 'lucide-react';

interface EmptyStateProps {
  type: 'no-projects' | 'no-results' | 'error';
  title?: string;
  description?: string;
  searchQuery?: string;
  hasFilters?: boolean;
  onCreateProject?: () => void;
  onClearFilters?: () => void;
  onRetry?: () => void;
}

// SVG illustrations
const NoProjectsIllustration = () => (
  <div className="relative">
    <svg width="200" height="150" viewBox="0 0 200 150" className="mx-auto">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#262626" strokeWidth="1" opacity="0.3"/>
        </pattern>
        
        {/* Gradient for glow effects */}
        <radialGradient id="blueGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0"/>
        </radialGradient>
      </defs>
      
      <rect width="200" height="150" fill="url(#grid)" />
      
      {/* Central node */}
      <circle cx="100" cy="75" r="15" fill="#3B82F6" opacity="0.8"/>
      <circle cx="100" cy="75" r="25" fill="url(#blueGlow)"/>
      
      {/* Connecting dots */}
      <circle cx="60" cy="45" r="8" fill="#6B7280" opacity="0.6"/>
      <circle cx="140" cy="45" r="8" fill="#6B7280" opacity="0.6"/>
      <circle cx="60" cy="105" r="8" fill="#6B7280" opacity="0.6"/>
      <circle cx="140" cy="105" r="8" fill="#6B7280" opacity="0.6"/>
      
      {/* Dashed connecting lines */}
      <line x1="75" y1="60" x2="60" y2="45" stroke="#404040" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
      <line x1="125" y1="60" x2="140" y2="45" stroke="#404040" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
      <line x1="75" y1="90" x2="60" y2="105" stroke="#404040" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
      <line x1="125" y1="90" x2="140" y2="105" stroke="#404040" strokeWidth="2" strokeDasharray="4,4" opacity="0.5"/>
      
      {/* Floating particles */}
      <circle cx="30" cy="30" r="2" fill="#3B82F6" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="170" cy="40" r="3" fill="#60A5FA" opacity="0.3">
        <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="40" cy="120" r="2" fill="#93C5FD" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="4s" repeatCount="indefinite"/>
      </circle>
    </svg>
    
    {/* Floating plus icon */}
    <div className="absolute top-4 right-8 animate-bounce">
      <div className="w-6 h-6 bg-[#3B82F6] rounded-full flex items-center justify-center">
        <Plus className="w-3 h-3 text-white" />
      </div>
    </div>
  </div>
);

const NoResultsIllustration = () => (
  <div className="relative">
    <svg width="180" height="120" viewBox="0 0 180 120" className="mx-auto">
      {/* Search glass */}
      <circle cx="60" cy="50" r="25" fill="none" stroke="#404040" strokeWidth="3"/>
      <circle cx="60" cy="50" r="15" fill="none" stroke="#3B82F6" strokeWidth="2" opacity="0.6"/>
      <line x1="80" y1="70" x2="95" y2="85" stroke="#404040" strokeWidth="3" strokeLinecap="round"/>
      
      {/* Question marks */}
      <text x="120" y="40" fill="#6B7280" fontSize="24" opacity="0.4">?</text>
      <text x="140" y="70" fill="#6B7280" fontSize="16" opacity="0.3">?</text>
      <text x="110" y="85" fill="#6B7280" fontSize="20" opacity="0.35">?</text>
      
      {/* Empty results indicator */}
      <rect x="20" y="95" width="60" height="3" fill="#262626" rx="1"/>
      <rect x="90" y="95" width="40" height="3" fill="#262626" rx="1"/>
      <rect x="140" y="95" width="20" height="3" fill="#262626" rx="1"/>
    </svg>
    
    <div className="absolute top-2 left-4 animate-pulse">
      <Search className="w-4 h-4 text-[#3B82F6] opacity-60" />
    </div>
  </div>
);

const ErrorIllustration = () => (
  <div className="relative">
    <svg width="160" height="120" viewBox="0 0 160 120" className="mx-auto">
      {/* Warning triangle */}
      <path d="M80 20 L140 100 L20 100 Z" fill="none" stroke="#EF4444" strokeWidth="2" opacity="0.6"/>
      <circle cx="80" cy="85" r="2" fill="#EF4444"/>
      <line x1="80" y1="50" x2="80" y2="70" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Broken connection lines */}
      <line x1="30" y1="30" x2="45" y2="35" stroke="#6B7280" strokeWidth="2" strokeDasharray="3,3" opacity="0.4"/>
      <line x1="115" y1="35" x2="130" y2="30" stroke="#6B7280" strokeWidth="2" strokeDasharray="3,3" opacity="0.4"/>
      <line x1="25" y1="80" x2="40" y2="85" stroke="#6B7280" strokeWidth="2" strokeDasharray="3,3" opacity="0.4"/>
      <line x1="120" y1="85" x2="135" y2="80" stroke="#6B7280" strokeWidth="2" strokeDasharray="3,3" opacity="0.4"/>
    </svg>
    
    <div className="absolute top-4 right-4 animate-pulse">
      <RefreshCw className="w-4 h-4 text-yellow-400" />
    </div>
  </div>
);

export default function EmptyState({
  type,
  title,
  description,
  searchQuery,
  hasFilters,
  onCreateProject,
  onClearFilters,
  onRetry
}: EmptyStateProps) {
  const getConfig = () => {
    switch (type) {
      case 'no-projects':
        return {
          illustration: <NoProjectsIllustration />,
          title: title || 'No projects yet',
          description: description || 'Create your first AI orchestration project to get started with automated workflows.',
          primaryAction: {
            label: 'Create Your First Project',
            icon: <Plus className="w-4 h-4" />,
            onClick: onCreateProject,
            variant: 'primary' as const
          },
          secondaryActions: [
            {
              label: 'View Templates',
              icon: <BookOpen className="w-4 h-4" />,
              onClick: () => console.log('View templates')
            },
            {
              label: 'Watch Demo',
              icon: <Play className="w-4 h-4" />,
              onClick: () => console.log('Watch demo')
            }
          ],
          tips: [
            'Start with pre-built templates',
            'Connect multiple AI agents',
            'Automate complex workflows',
            'Monitor execution in real-time'
          ]
        };
      
      case 'no-results':
        return {
          illustration: <NoResultsIllustration />,
          title: title || 'No projects found',
          description: description || `${searchQuery ? `No projects match "${searchQuery}"` : 'No projects match your current filters'}.`,
          primaryAction: hasFilters ? {
            label: 'Clear Filters',
            icon: <RefreshCw className="w-4 h-4" />,
            onClick: onClearFilters,
            variant: 'secondary' as const
          } : {
            label: 'Create New Project',
            icon: <Plus className="w-4 h-4" />,
            onClick: onCreateProject,
            variant: 'primary' as const
          },
          secondaryActions: searchQuery ? [
            {
              label: 'Search All Projects',
              icon: <Search className="w-4 h-4" />,
              onClick: () => onClearFilters?.()
            }
          ] : [],
          suggestions: [
            'Try different search terms',
            'Remove some filters',
            'Check project status filters',
            'Expand date range'
          ]
        };
      
      case 'error':
        return {
          illustration: <ErrorIllustration />,
          title: title || 'Something went wrong',
          description: description || 'Unable to load projects. Please check your connection and try again.',
          primaryAction: {
            label: 'Try Again',
            icon: <RefreshCw className="w-4 h-4" />,
            onClick: onRetry,
            variant: 'primary' as const
          },
          secondaryActions: [
            {
              label: 'Check Status',
              icon: <Zap className="w-4 h-4" />,
              onClick: () => console.log('Check status')
            }
          ],
          troubleshooting: [
            'Check your internet connection',
            'Refresh the page',
            'Clear browser cache',
            'Contact support if issue persists'
          ]
        };
      
      default:
        return {
          illustration: <NoProjectsIllustration />,
          title: 'Empty State',
          description: 'No content available.',
          primaryAction: null,
          secondaryActions: []
        };
    }
  };

  const config = getConfig();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      {/* Illustration */}
      <div className="mb-8">
        {config.illustration}
      </div>

      {/* Content */}
      <div className="max-w-md space-y-4">
        <h3 className="text-xl font-semibold text-white">
          {config.title}
        </h3>
        
        <p className="text-gray-400 leading-relaxed">
          {config.description}
        </p>

        {/* Primary Action */}
        {config.primaryAction && (
          <div className="pt-2">
            <button
              onClick={config.primaryAction.onClick}
              className={`
                inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${config.primaryAction.variant === 'primary'
                  ? 'bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white hover:from-[#60A5FA] hover:to-[#3B82F6] shadow-lg hover:shadow-blue-500/25'
                  : 'bg-[#1a1a1a] border border-[#404040] text-gray-300 hover:text-white hover:border-[#606060]'
                }
                hover:scale-105 transform
              `}
            >
              {config.primaryAction.icon}
              {config.primaryAction.label}
            </button>
          </div>
        )}

        {/* Secondary Actions */}
        {config.secondaryActions && config.secondaryActions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {config.secondaryActions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 
                           hover:text-white border border-[#404040] hover:border-[#606060] 
                           rounded-lg transition-all hover:bg-[#1a1a1a]"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Tips/Suggestions/Troubleshooting */}
        {(config.tips || config.suggestions || config.troubleshooting) && (
          <div className="pt-6 border-t border-[#262626]">
            <div className="text-left max-w-sm mx-auto">
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#3B82F6]" />
                {type === 'error' ? 'Troubleshooting' : type === 'no-results' ? 'Suggestions' : 'Quick Tips'}
              </h4>
              <ul className="space-y-2">
                {(config.tips || config.suggestions || config.troubleshooting)?.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-400">
                    <ArrowRight className="w-3 h-3 text-[#3B82F6] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Template Suggestions for No Projects */}
        {type === 'no-projects' && (
          <div className="pt-6 border-t border-[#262626]">
            <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center justify-center gap-2">
              <Layers className="w-4 h-4 text-[#3B82F6]" />
              Popular Templates
            </h4>
            <div className="grid grid-cols-1 gap-2 max-w-xs mx-auto">
              {[
                { name: 'Full Stack Web App', icon: '🌐' },
                { name: 'REST API Service', icon: '🔌' },
                { name: 'React Dashboard', icon: '⚛️' },
                { name: 'Mobile App', icon: '📱' }
              ].map((template, index) => (
                <button
                  key={index}
                  onClick={() => console.log(`Create from template: ${template.name}`)}
                  className="flex items-center gap-3 p-3 text-left text-sm text-gray-400 
                             hover:text-white bg-[#0F0F0F] hover:bg-[#1a1a1a] border 
                             border-[#262626] hover:border-[#404040] rounded-lg transition-all"
                >
                  <span className="text-lg">{template.icon}</span>
                  {template.name}
                  <ArrowRight className="w-3 h-3 ml-auto opacity-50" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#3B82F6]/5 to-transparent pointer-events-none opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#3B82F6]/5 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}