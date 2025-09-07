#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function scanAgents() {
  const libraryPath = path.join(__dirname, 'library');
  const categories = ['setup', 'execution', 'testing', 'integration', 'review', 'utility'];
  
  const agentsByCategory = {
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
        
        agentsByCategory[category].push({
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
  
  // Sort agents alphabetically within each category
  for (const category of Object.keys(agentsByCategory)) {
    agentsByCategory[category].sort((a, b) => a.id.localeCompare(b.id));
  }
  
  return agentsByCategory;
}

function formatAgentsForPrompt(agents) {
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
      formatted += `### ${categoryNames[category]}\n`;
      for (const agent of categoryAgents) {
        formatted += `- \`${agent.id}\` - ${agent.description}\n`;
      }
      formatted += '\n';
    }
  }
  
  return formatted;
}

async function getAgentList() {
  const agents = await scanAgents();
  return formatAgentsForPrompt(agents);
}

module.exports = {
  scanAgents,
  formatAgentsForPrompt,
  getAgentList
};

// If run directly, output the agent list
if (require.main === module) {
  getAgentList().then(list => {
    console.log(list);
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}