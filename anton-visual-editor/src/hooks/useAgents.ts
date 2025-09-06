import { useState, useEffect } from 'react'
import { AgentConfig, AgentCategory } from '@/types/agent'
import { loadAgents, getCachedAgents } from '@/lib/agents'

export function useAgents() {
  const [agents, setAgents] = useState<AgentConfig[]>(getCachedAgents())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadAgentsAsync = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const loadedAgents = await loadAgents()
        if (mounted) {
          setAgents(loadedAgents)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load agents')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadAgentsAsync()

    return () => {
      mounted = false
    }
  }, [])

  const getAgentsByCategory = (category: AgentCategory): AgentConfig[] => {
    return agents.filter(agent => agent.category === category)
  }

  const getAgentById = (id: string): AgentConfig | undefined => {
    return agents.find(agent => agent.id === id)
  }

  return {
    agents,
    loading,
    error,
    getAgentsByCategory,
    getAgentById,
  }
}