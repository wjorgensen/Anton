import { AgentConfig, AgentCategory } from '@/types/agent'
import fs from 'fs'
import path from 'path'

// Icon mapping for different agent types
const iconMap: Record<string, string> = {
  // Setup
  'nextjs': '⚡',
  'vite-react': '⚡',
  'express': '🚀',
  'django': '🐍',
  'rails': '💎',
  'flutter': '🦋',
  'vue': '💚',
  'angular': '🅰️',
  'fastapi': '🚀',
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
  'api-integration': '🔗',
  'database-migration': '📊',
  'docker': '🐳',
  'ci-cd': '♻️',
  'dependency': '📦',
  
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
const categoryColors: Record<AgentCategory, string> = {
  setup: '#10B981',
  execution: '#3B82F6',
  testing: '#F59E0B',
  integration: '#8B5CF6',
  review: '#EF4444',
  summary: '#6B7280',
}

/**
 * Load all agents from the JSON files in /agents/library
 */
export async function loadAllAgents(): Promise<AgentConfig[]> {
  const agentsPath = path.join(process.cwd(), '..', 'agents', 'library')
  const agents: AgentConfig[] = []
  
  try {
    const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility']
    
    for (const category of categories) {
      const categoryPath = path.join(agentsPath, category)
      
      if (!fs.existsSync(categoryPath)) continue
      
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'))
      
      for (const file of files) {
        const filePath = path.join(categoryPath, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const agentData = JSON.parse(content)
        
        // Transform the JSON data to match our AgentConfig type
        const agent: AgentConfig = {
          ...agentData,
          category: category === 'utility' ? 'summary' : category as AgentCategory,
          icon: getIconForAgent(agentData.icon || agentData.type || agentData.id),
          color: agentData.color || categoryColors[category === 'utility' ? 'summary' : category as AgentCategory],
          // Ensure all required fields are present
          tags: agentData.tags || [],
          dependencies: agentData.dependencies || [],
          resources: agentData.resources || {
            estimatedTime: 10,
            estimatedTokens: 10000,
            requiresGPU: false,
            maxRetries: 3
          }
        }
        
        agents.push(agent)
      }
    }
  } catch (error) {
    console.error('Error loading agents:', error)
    // Fallback to some default agents if loading fails
    return getDefaultAgents()
  }
  
  return agents
}

/**
 * Get icon for agent based on type or id
 */
function getIconForAgent(identifier: string): string {
  // Check direct mapping
  if (iconMap[identifier]) {
    return iconMap[identifier]
  }
  
  // Check partial matches
  for (const [key, icon] of Object.entries(iconMap)) {
    if (identifier.includes(key)) {
      return icon
    }
  }
  
  return iconMap.default
}

/**
 * Get default agents as fallback
 */
function getDefaultAgents(): AgentConfig[] {
  return [
    {
      id: 'nextjs-setup',
      name: 'Next.js Setup',
      category: 'setup',
      type: 'nextjs-setup',
      version: '1.0.0',
      description: 'Sets up a Next.js project with TypeScript and Tailwind CSS',
      icon: '⚡',
      color: '#10B981',
      instructions: {
        base: 'Create a Next.js project with TypeScript, App Router, and Tailwind CSS',
        contextual: 'Set up {{projectName}} with Next.js {{version}}'
      },
      claudeMD: '# Next.js Project Setup\n\nThis agent will create a complete Next.js project setup.',
      inputs: [
        {
          name: 'projectName',
          type: 'string',
          required: true,
          description: 'Name of the project',
          default: 'my-app'
        }
      ],
      outputs: [
        {
          name: 'projectPath',
          type: 'string',
          description: 'Path to the created project'
        }
      ],
      hooks: {
        onStop: 'hooks/stop.sh'
      },
      resources: {
        estimatedTime: 5,
        estimatedTokens: 5000,
        requiresGPU: false,
        maxRetries: 3
      },
      dependencies: [],
      tags: ['frontend', 'react', 'nextjs', 'setup']
    }
  ]
}

/**
 * Load agents for client-side use (without file system access)
 * This should be called from an API route
 */
export async function getAgentsForClient(): Promise<AgentConfig[]> {
  try {
    const response = await fetch('/api/agents')
    if (!response.ok) throw new Error('Failed to fetch agents')
    return await response.json()
  } catch (error) {
    console.error('Error fetching agents:', error)
    return getDefaultAgents()
  }
}