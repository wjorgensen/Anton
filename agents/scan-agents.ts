#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';

interface Agent {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface AgentsByCategory {
  setup: Agent[];
  execution: Agent[];
  testing: Agent[];
  integration: Agent[];
  review: Agent[];
  utility: Agent[];
}

async function scanAgents(): Promise<AgentsByCategory> {
  const libraryPath = path.join(__dirname, 'library');
  const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
  
  const agentsByCategory: AgentsByCategory = {
    setup: [],
    execution: [],
    testing: [],
    integration: [],
    review: [],
    utility: []
  };

  for (const category of categories) {
    const categoryPath = path.join(libraryPath, category);
    
    try {
      const files = await fs.readdir(categoryPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(categoryPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const agent = JSON.parse(content);
        
        // Extract agent ID from filename (remove .json extension)
        const agentId = file.replace('.json', '');
        
        agentsByCategory[category as keyof AgentsByCategory].push({
          id: agentId,
          name: agent.name || agentId,
          category: category,
          description: agent.description || ''
        });
      }
    } catch (error) {
      console.error(`Error scanning ${category}:`, error);
    }
  }
  
  return agentsByCategory;
}

export function formatAgentsForPrompt(agents: AgentsByCategory): string {
  let formatted = '## Available Agents\n\n';
  
  const categoryNames = {
    setup: 'Setup Agents',
    execution: 'Execution Agents', 
    testing: 'Testing Agents',
    integration: 'Integration Agents',
    review: 'Review Agents',
    utility: 'Utility Agents'
  };
  
  for (const [category, categoryAgents] of Object.entries(agents)) {
    if (categoryAgents.length > 0) {
      formatted += `### ${categoryNames[category as keyof typeof categoryNames]}\n`;
      for (const agent of categoryAgents) {
        formatted += `- \`${agent.id}\` - ${agent.description}\n`;
      }
      formatted += '\n';
    }
  }
  
  return formatted;
}

export async function getAgentList(): Promise<string> {
  const agents = await scanAgents();
  return formatAgentsForPrompt(agents);
}

// If run directly, output the agent list
if (require.main === module) {
  getAgentList().then(list => {
    console.log(list);
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}