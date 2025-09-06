import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { AgentConfig, AgentCategory } from '@/types/agent'

// Icon mapping for different agent types  
const iconMap: Record<string, string> = {
  // Setup
  'nextjs': '⚡',
  'vite': '⚡', 
  'express': '🚀',
  'django': '🐍',
  'rails': '💎',
  'flutter': '🦋',
  'vue': '💚',
  'angular': '🅰️',
  'fastapi': '⚡',
  'nestjs': '🦅',
  'spring-boot': '🍃',
  'laravel': '🎼',
  'postgres': '🐘',
  'mongodb': '🍃',
  'redis': '🔴',
  
  // Execution
  'react': '⚛️',
  'nodejs': '🟩',
  'python': '🐍',
  'go': '🐹',
  'rust': '🦀',
  'java': '☕',
  'graphql': '◈',
  'websocket': '🔌',
  'database': '💾',
  'api': '🔗',
  'mobile': '📱',
  'devops': '⚙️',
  
  // Testing
  'jest': '🧪',
  'pytest': '🧪',
  'playwright': '🎭',
  'cypress': '🌲',
  'vitest': '⚡',
  'mocha': '☕',
  'go-test': '🐹',
  'junit': '☕',
  'rspec': '💎',
  'phpunit': '🐘',
  'k6': '📊',
  
  // Integration
  'git': '🔀',
  'docker': '🐳',
  'ci-cd': '♻️',
  'dependency': '📦',
  'db-migrator': '📊',
  
  // Review
  'manual': '👀',
  'code': '🔍',
  'security': '🛡️',
  
  // Utility
  'deployment': '🚀',
  'documentation': '📝',
  'summarizer': '📋',
  
  // Default
  'default': '🤖'
}

// Color scheme for categories
const categoryColors: Record<string, string> = {
  setup: '#10B981',
  execution: '#3B82F6', 
  testing: '#F59E0B',
  integration: '#8B5CF6',
  review: '#EF4444',
  utility: '#6B7280',
  summary: '#6B7280',
}

function getIconForAgent(identifier: string): string {
  // Check direct mapping
  if (iconMap[identifier]) {
    return iconMap[identifier]
  }
  
  // Check partial matches
  for (const [key, icon] of Object.entries(iconMap)) {
    if (identifier.toLowerCase().includes(key)) {
      return icon
    }
  }
  
  return iconMap.default
}

export async function GET() {
  try {
    const agentsPath = path.join(process.cwd(), '..', 'agents', 'library')
    const agents: AgentConfig[] = []
    
    const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility']
    
    for (const category of categories) {
      const categoryPath = path.join(agentsPath, category)
      
      if (!fs.existsSync(categoryPath)) continue
      
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'))
      
      for (const file of files) {
        const filePath = path.join(categoryPath, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const agentData = JSON.parse(content)
        
        // Map utility to summary for UI consistency
        const mappedCategory = category === 'utility' ? 'summary' : category
        
        // Transform the JSON data to match our AgentConfig type
        const agent: AgentConfig = {
          id: agentData.id,
          name: agentData.name || agentData.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: mappedCategory as AgentCategory,
          type: agentData.type || agentData.id,
          version: agentData.version || '1.0.0',
          description: agentData.description || `${agentData.name} agent`,
          icon: getIconForAgent(agentData.icon || agentData.type || agentData.id),
          color: agentData.color || categoryColors[mappedCategory],
          instructions: agentData.instructions || {
            base: `Execute ${agentData.name} tasks`,
            contextual: `Process {{input}} with ${agentData.name}`
          },
          claudeMD: agentData.claudeMD || `# ${agentData.name}\n\n${agentData.description}`,
          inputs: agentData.inputs || [],
          outputs: agentData.outputs || [],
          hooks: agentData.hooks || {},
          resources: {
            estimatedTime: agentData.resources?.estimatedTime || 10,
            estimatedTokens: agentData.resources?.estimatedTokens || 10000,
            requiresGPU: agentData.resources?.requiresGPU || false,
            maxRetries: agentData.resources?.maxRetries || 3,
            ...agentData.resources
          },
          dependencies: agentData.dependencies || [],
          tags: agentData.tags || []
        }
        
        agents.push(agent)
      }
    }
    
    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error loading agents:', error)
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
  }
}