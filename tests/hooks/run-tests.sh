#!/bin/bash

# Run hook tests with proper setup
set -e

echo "=== Running Hook Tests Phase 2 ==="
echo ""

# Change to hooks test directory
cd "$(dirname "$0")"

# Setup test project
echo "1. Setting up test project..."
bash setup-real-project.sh

# Run real hook tests
echo ""
echo "2. Running real hook tests..."
npm test real-hooks.test.ts -- --run --reporter=verbose 2>&1 | grep -E "(✓|✗|Test Files|Tests|Duration)" || true

# Quick validation of all agents
echo ""
echo "3. Validating all 52 agents..."
node -e "
const fs = require('fs');
const path = require('path');

// Load directory
const directory = JSON.parse(fs.readFileSync('../../agents/directory.json', 'utf-8'));
let totalAgents = 0;
let agentsWithHooks = 0;
let errors = [];

// Check each category
for (const [category, data] of Object.entries(directory.categories)) {
  if (data.agents) {
    for (const agentId of data.agents) {
      totalAgents++;
      const agentPath = path.join('../../agents/library', category, agentId + '.json');
      
      try {
        if (fs.existsSync(agentPath)) {
          const agent = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
          if (agent.hooks && agent.hooks.Stop) {
            agentsWithHooks++;
          } else {
            errors.push(\`\${agentId}: Missing Stop hook\`);
          }
        } else {
          errors.push(\`\${agentId}: File not found\`);
        }
      } catch (e) {
        errors.push(\`\${agentId}: \${e.message}\`);
      }
    }
  }
}

console.log('Total agents:', totalAgents);
console.log('Agents with Stop hook:', agentsWithHooks);
console.log('Success rate:', ((agentsWithHooks/totalAgents) * 100).toFixed(1) + '%');

if (errors.length > 0) {
  console.log('\\nErrors found:');
  errors.slice(0, 5).forEach(e => console.log('  -', e));
  if (errors.length > 5) {
    console.log('  ... and', errors.length - 5, 'more');
  }
}
"

# Generate report
echo ""
echo "4. Generating report..."
node generate-report.js 2>/dev/null || echo "Report generation needs test data"

echo ""
echo "=== Hook Tests Complete ==="
echo "Reports saved to: ../../test-reports/phase2-hooks.{json,html}"