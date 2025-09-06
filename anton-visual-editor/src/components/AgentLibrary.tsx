'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, ChevronRight, GripVertical, Menu, X, Loader2 } from 'lucide-react'
import { AgentCategory, AgentConfig } from '@/types/agent'
import { useAgents } from '@/hooks/useAgents'
import { AgentLibrarySkeleton } from '@/components/LoadingSkeletons'
import '@/styles/agent-library.css'

interface AgentLibraryProps {
  onDragStart: (event: React.DragEvent, agent: AgentConfig) => void
}

const categoryLabels: Record<AgentCategory, string> = {
  setup: 'Setup Agents',
  execution: 'Execution Agents',
  testing: 'Testing Agents',
  integration: 'Integration Agents',
  review: 'Review Agents',
  summary: 'Summary Agents',
}

const categoryColors: Record<AgentCategory, string> = {
  setup: '#10B981',
  execution: '#3B82F6',
  testing: '#F59E0B',
  integration: '#8B5CF6',
  review: '#EF4444',
  summary: '#6B7280',
}

const categoryGradients: Record<AgentCategory, { from: string; to: string }> = {
  setup: { from: '#10B981', to: '#059669' },
  execution: { from: '#3B82F6', to: '#2563EB' },
  testing: { from: '#F59E0B', to: '#D97706' },
  integration: { from: '#8B5CF6', to: '#7C3AED' },
  review: { from: '#EF4444', to: '#DC2626' },
  summary: { from: '#6B7280', to: '#4B5563' },
}

export default function AgentLibrary({ onDragStart }: AgentLibraryProps) {
  const { agents, loading, error } = useAgents()
  
  // Show loading skeleton while loading
  if (loading && agents.length === 0) {
    return <AgentLibrarySkeleton />
  }
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<AgentCategory>>(
    new Set(['setup', 'execution'] as AgentCategory[])
  )
  const [draggingAgent, setDraggingAgent] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  const toggleCategory = (category: AgentCategory) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }
  
  const filteredAgents = searchTerm
    ? agents.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          agent.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : agents
  
  const agentsByCategory = (Object.keys(categoryLabels) as AgentCategory[]).reduce(
    (acc, category) => {
      acc[category] = filteredAgents.filter((agent) => agent.category === category)
      return acc
    },
    {} as Record<AgentCategory, AgentConfig[]>
  )

  // Mobile overlay when open
  const mobileOverlay = (
    <div 
      className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${
        isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={() => setIsMobileOpen(false)}
    />
  )

  // Collapsed state for desktop
  if (isCollapsed && !isMobileOpen) {
    return (
      <>
        {mobileOverlay}
        <div className="w-12 h-full bg-gray-900 border-r border-gray-700 flex flex-col hidden md:flex">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-3 hover:bg-gray-800 transition-colors border-b border-gray-700"
            title="Expand Agent Library"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
          
          <div className="flex-1 flex flex-col items-center gap-3 pt-4">
            {(Object.keys(categoryLabels) as AgentCategory[]).map((category) => {
              const count = agentsByCategory[category]?.length || 0
              if (count === 0) return null
              
              const gradient = categoryGradients[category]
              
              return (
                <div
                  key={category}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white relative group cursor-pointer"
                  style={{
                    background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
                  }}
                  title={`${categoryLabels[category]} (${count})`}
                >
                  {count}
                  <div className="absolute left-12 top-0 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {categoryLabels[category]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  }
  
  return (
    <>
      {mobileOverlay}
      
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 border border-gray-700 rounded-lg"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="w-5 h-5 text-gray-400" />
      </button>

      <div className={`
        w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col relative agent-library-scroll
        md:relative md:translate-x-0 
        ${isMobileOpen ? 'fixed top-0 left-0 z-50 agent-library-enter' : 'hidden md:flex'}
      `}>
        {/* Header */}
        <div className="p-4 border-b border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white">Agent Library</h2>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                {agents.length} agents
              </div>
              <button
                onClick={() => {
                  setIsCollapsed(true)
                  setIsMobileOpen(false)
                }}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors hidden md:block"
                title="Collapse Library"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors md:hidden"
                title="Close Library"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-400">Loading agents...</p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">Failed to load agents</p>
            <p className="text-gray-500 text-xs">{error}</p>
          </div>
        </div>
      )}
      
        {/* Agent Categories */}
        {!loading && !error && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 agent-library-scroll">
            {(Object.keys(categoryLabels) as AgentCategory[]).map((category) => {
              const categoryAgents = agentsByCategory[category]
              if (categoryAgents.length === 0 && searchTerm) return null
              
              const gradient = categoryGradients[category]
              const isExpanded = expandedCategories.has(category)
              
              return (
                <div key={category} className="group">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-3 w-full mb-3 p-3 rounded-lg hover:bg-gray-800 transition-all duration-200 group category-header-mobile sm:p-3"
                    style={{
                      background: isExpanded 
                        ? `linear-gradient(90deg, ${gradient.from}15, ${gradient.to}15)`
                        : 'transparent'
                    }}
                  >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  )}
                  
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{
                      background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
                    }}
                  />
                  
                  <span
                    className="text-sm font-semibold"
                    style={{ color: categoryColors[category] }}
                  >
                    {categoryLabels[category]}
                  </span>
                  
                  <span className="text-xs text-gray-400 ml-auto bg-gray-800 px-2 py-0.5 rounded-full">
                    {categoryAgents.length}
                  </span>
                </button>
                
                  {/* Agent Items */}
                  {isExpanded && (
                    <div className="space-y-2 ml-6 sm:ml-4">
                      {categoryAgents.map((agent) => {
                        const isDragging = draggingAgent === agent.id
                        
                        return (
                          <div
                            key={agent.id}
                            draggable
                            onDragStart={(event) => {
                              setDraggingAgent(agent.id)
                              onDragStart(event, agent)
                              
                              // Create custom drag image
                              const dragImage = document.createElement('div')
                              dragImage.className = 'absolute pointer-events-none'
                              dragImage.style.width = '220px'
                              dragImage.style.padding = '16px'
                              dragImage.style.background = `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`
                              dragImage.style.borderRadius = '12px'
                              dragImage.style.color = 'white'
                              dragImage.style.boxShadow = '0 20px 50px rgba(0, 0, 0, 0.6)'
                              dragImage.style.border = '1px solid rgba(255, 255, 255, 0.2)'
                              dragImage.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 12px;">
                                  <span style="font-size: 24px;">${agent.icon}</span>
                                  <div>
                                    <div style="font-weight: 600; font-size: 14px;">${agent.name}</div>
                                    <div style="font-size: 12px; opacity: 0.8;">${agent.category}</div>
                                  </div>
                                </div>
                              `
                              document.body.appendChild(dragImage)
                              event.dataTransfer.setDragImage(dragImage, 110, 30)
                              setTimeout(() => document.body.removeChild(dragImage), 0)
                            }}
                            onDragEnd={() => setDraggingAgent(null)}
                            className={`
                              relative p-4 bg-gray-800 border border-gray-700 rounded-lg 
                              cursor-move transition-all duration-200 group hover:shadow-xl agent-card-mobile
                              ${isDragging ? 
                                'opacity-50 scale-95 shadow-inner' : 
                                'hover:border-gray-600 hover:bg-gray-750 hover:transform hover:-translate-y-0.5 agent-card-hover'
                              }
                            `}
                            style={{
                              background: isDragging 
                                ? `linear-gradient(135deg, ${gradient.from}20, ${gradient.to}20)`
                                : undefined
                            }}
                          >
                          {/* Drag Handle */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ 
                              background: `linear-gradient(180deg, ${gradient.from}, ${gradient.to})` 
                            }} 
                          />
                          
                          {/* Glow Effect */}
                          <div 
                            className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none"
                            style={{ 
                              background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
                              filter: 'blur(10px)',
                              transform: 'scale(1.1)'
                            }}
                          />
                          
                            <div className="relative z-10 flex items-start gap-3">
                              <GripVertical className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-70 transition-opacity mt-0.5 flex-shrink-0 hidden sm:block" />
                              <span className="text-2xl flex-shrink-0">{agent.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors">
                                  {agent.name}
                                </div>
                                <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                  {agent.description}
                                </div>
                                
                                {/* Resource indicators */}
                                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                  <span>⏱ {agent.resources.estimatedTime}min</span>
                                  <span>•</span>
                                  <span>🎯 {Math.round(agent.resources.estimatedTokens / 1000)}K</span>
                                </div>
                                
                                {/* Tags */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {agent.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full border border-gray-600"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {agent.tags.length > 3 && (
                                    <span className="px-2 py-0.5 text-xs text-gray-500">
                                      +{agent.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="text-xs text-gray-400 text-center">
            <span className="hidden sm:inline">Drag agents to canvas to add them to your flow</span>
            <span className="sm:hidden">Tap agents to add them to your flow</span>
          </div>
          <div className="flex justify-center mt-2">
            <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-60"></div>
          </div>
        </div>
      </div>
    </>
  )
}