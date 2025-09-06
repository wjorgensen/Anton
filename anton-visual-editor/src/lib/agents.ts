import { AgentConfig, AgentCategory } from '@/types/agent'

// Cache for loaded agents
let cachedAgents: AgentConfig[] | null = null

/**
 * Load agents from API or return cached version
 */
export async function loadAgents(): Promise<AgentConfig[]> {
  if (cachedAgents) return cachedAgents
  
  try {
    const response = await fetch('/api/agents')
    if (!response.ok) throw new Error('Failed to fetch agents')
    cachedAgents = await response.json()
    return cachedAgents
  } catch (error) {
    console.error('Error loading agents, using fallback:', error)
    return getDefaultAgents()
  }
}

/**
 * Get cached agents (synchronous)
 */
export function getCachedAgents(): AgentConfig[] {
  return cachedAgents || getDefaultAgents()
}

/**
 * Default agents for fallback
 */
function getDefaultAgents(): AgentConfig[] {
  return [
    // Setup Agents
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
    },
    {
      id: 'react-developer',
      name: 'React Developer',
      category: 'execution',
      type: 'react-developer',
      version: '1.0.0',
      description: 'Develops React components and features',
      icon: '⚛️',
      color: '#3B82F6',
      instructions: {
        base: 'Develop React components with modern best practices',
        contextual: 'Build {{feature}} using React hooks and TypeScript'
      },
      claudeMD: '# React Development\n\nExpert React developer for building components.',
      inputs: [
        {
          name: 'feature',
          type: 'string',
          required: true,
          description: 'Feature to develop'
        }
      ],
      outputs: [
        {
          name: 'components',
          type: 'array',
          description: 'List of created components'
        }
      ],
      hooks: {
        onStop: 'hooks/stop.sh'
      },
      resources: {
        estimatedTime: 30,
        estimatedTokens: 20000,
        requiresGPU: false,
        maxRetries: 3
      },
      dependencies: [],
      tags: ['frontend', 'react', 'development']
    },
    {
      id: 'jest-tester',
      name: 'Jest Unit Tester',
      category: 'testing',
      type: 'jest-tester',
      version: '1.0.0',
      description: 'Writes and runs Jest unit tests',
      icon: '🧪',
      color: '#F59E0B',
      instructions: {
        base: 'Write comprehensive Jest unit tests',
        contextual: 'Test {{components}} with Jest'
      },
      claudeMD: '# Jest Testing\n\nExpert in writing Jest tests.',
      inputs: [
        {
          name: 'components',
          type: 'array',
          required: true,
          description: 'Components to test'
        }
      ],
      outputs: [
        {
          name: 'testResults',
          type: 'object',
          description: 'Test results with coverage'
        }
      ],
      hooks: {
        onStop: 'hooks/stop.sh'
      },
      resources: {
        estimatedTime: 15,
        estimatedTokens: 10000,
        requiresGPU: false,
        maxRetries: 3
      },
      dependencies: [],
      tags: ['testing', 'jest', 'unit-testing']
    }
  ]
}

// Backward compatibility - this will be used initially
export const agentLibrary: AgentConfig[] = getCachedAgents()

/**
 * Get agents by category (with async loading support)
 */
export const getAgentsByCategory = async (category: AgentCategory): Promise<AgentConfig[]> => {
  const agents = await loadAgents()
  return agents.filter(agent => agent.category === category)
}

/**
 * Get agents by category (synchronous version using cache)
 */
export const getAgentsByCategorySync = (category: AgentCategory): AgentConfig[] => {
  const agents = getCachedAgents()
  return agents.filter(agent => agent.category === category)
}

/**
 * Get agent by ID (with async loading support)
 */
export const getAgentById = async (id: string): Promise<AgentConfig | undefined> => {
  const agents = await loadAgents()
  return agents.find(agent => agent.id === id)
}

/**
 * Get agent by ID (synchronous version using cache)
 */
export const getAgentByIdSync = (id: string): AgentConfig | undefined => {
  const agents = getCachedAgents()
  return agents.find(agent => agent.id === id)
}