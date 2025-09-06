#!/usr/bin/env node

/**
 * E2E Test Runner using Playwright MCP
 * This script coordinates with the Playwright MCP to run browser-based tests
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseURL: 'http://localhost:3000',
  apiURL: 'http://localhost:3002',
  timeout: 30000,
  headless: false,
  slowMo: 100
};

// Test scenarios
const testScenarios = [
  {
    name: 'Project Creation Flow',
    description: 'Complete user journey from project creation to execution',
    steps: [
      { instruction: 'Navigate to http://localhost:3000' },
      { instruction: 'Click on "New Project" button' },
      { instruction: 'Fill in project description: "Build a REST API with authentication"' },
      { instruction: 'Click "Generate Flow" button' },
      { instruction: 'Wait for flow canvas to appear' },
      { instruction: 'Verify at least 3 nodes are created' },
      { instruction: 'Click "Execute" button' },
      { instruction: 'Verify execution starts (node status becomes active)' },
      { instruction: 'Check that terminal preview is visible' },
      { instruction: 'Take screenshot of running execution' }
    ]
  },
  {
    name: 'Claude Hook Communication',
    description: 'Test the hook system communication between Claude instances and orchestrator',
    steps: [
      { instruction: 'Open developer tools network tab' },
      { instruction: 'Navigate to http://localhost:3000/test-hooks' },
      { instruction: 'Trigger test hook by clicking "Send Test Hook"' },
      { instruction: 'Verify POST request to /api/agent-complete' },
      { instruction: 'Check response status is 200' },
      { instruction: 'Verify state update in UI' },
      { instruction: 'Test error hook by clicking "Send Error Hook"' },
      { instruction: 'Verify error is displayed in UI' }
    ]
  },
  {
    name: 'Agent Execution Monitoring',
    description: 'Monitor agent execution in real-time',
    steps: [
      { instruction: 'Navigate to existing project' },
      { instruction: 'Open execution panel' },
      { instruction: 'Start flow execution' },
      { instruction: 'Monitor setup agent status changes' },
      { instruction: 'Verify terminal output is streaming' },
      { instruction: 'Check that multiple agents run in parallel' },
      { instruction: 'Verify progress bars are updating' },
      { instruction: 'Check execution metrics display' },
      { instruction: 'Take screenshot of parallel execution' }
    ]
  },
  {
    name: 'Review System',
    description: 'Test manual review checkpoints',
    steps: [
      { instruction: 'Navigate to project with review nodes' },
      { instruction: 'Execute flow until review checkpoint' },
      { instruction: 'Wait for review interface to appear' },
      { instruction: 'Verify code diff is displayed' },
      { instruction: 'Add a review comment' },
      { instruction: 'Click "Request Changes"' },
      { instruction: 'Verify feedback is sent' },
      { instruction: 'Make requested changes' },
      { instruction: 'Click "Approve"' },
      { instruction: 'Verify flow continues after approval' }
    ]
  },
  {
    name: 'Visual Flow Editor',
    description: 'Test flow creation and editing',
    steps: [
      { instruction: 'Navigate to flow editor' },
      { instruction: 'Drag "Next.js Setup" agent from library to canvas' },
      { instruction: 'Drag "React Developer" agent to canvas' },
      { instruction: 'Connect the two nodes' },
      { instruction: 'Double-click on React Developer node' },
      { instruction: 'Edit instructions in the modal' },
      { instruction: 'Save changes' },
      { instruction: 'Verify flow is saved' },
      { instruction: 'Take screenshot of completed flow' }
    ]
  },
  {
    name: 'Live Preview System',
    description: 'Test terminal and web preview functionality',
    steps: [
      { instruction: 'Start a project execution' },
      { instruction: 'Open terminal preview' },
      { instruction: 'Verify terminal output is streaming' },
      { instruction: 'Test terminal scrolling' },
      { instruction: 'Open web preview' },
      { instruction: 'Verify hot reload is working' },
      { instruction: 'Check that both previews update in real-time' },
      { instruction: 'Take screenshot of split preview' }
    ]
  }
];

// Instructions for running with Playwright MCP
const generateInstructions = () => {
  console.log('\n' + '='.repeat(80));
  console.log('ANTON E2E TEST SUITE - Playwright MCP Instructions');
  console.log('='.repeat(80) + '\n');
  
  console.log('Prerequisites:');
  console.log('1. Ensure Anton is running (npm run dev)');
  console.log('2. Ensure Playwright MCP is connected');
  console.log('3. Browser should be ready for automation\n');
  
  console.log('Test Execution Instructions:');
  console.log('Use the Playwright MCP to execute these test scenarios:\n');
  
  testScenarios.forEach((scenario, index) => {
    console.log(`\n${index + 1}. ${scenario.name}`);
    console.log(`   Description: ${scenario.description}`);
    console.log('   Steps:');
    scenario.steps.forEach((step, stepIndex) => {
      console.log(`      ${stepIndex + 1}. ${step.instruction}`);
    });
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('Expected Results:');
  console.log('- All navigation should complete without errors');
  console.log('- UI elements should be responsive and visible');
  console.log('- Agent execution should show real-time updates');
  console.log('- Hook communication should update state correctly');
  console.log('- Review system should pause and resume execution');
  console.log('- Performance should maintain 60+ FPS with 100+ nodes');
  console.log('='.repeat(80) + '\n');
};

// Generate test report template
const generateReportTemplate = () => {
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      baseURL: config.baseURL,
      apiURL: config.apiURL,
      browser: 'Chromium (via Playwright MCP)'
    },
    scenarios: testScenarios.map(scenario => ({
      name: scenario.name,
      description: scenario.description,
      steps: scenario.steps.map(step => ({
        instruction: step.instruction,
        status: 'pending',
        notes: ''
      })),
      result: 'pending',
      screenshots: [],
      duration: null
    })),
    summary: {
      total: testScenarios.length,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };
  
  const reportPath = path.join(__dirname, 'test-report-template.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Test report template saved to: ${reportPath}`);
  
  return report;
};

// Main execution
const main = () => {
  console.log('Anton E2E Test Suite Coordinator');
  console.log('=================================\n');
  
  // Generate instructions
  generateInstructions();
  
  // Generate report template
  const report = generateReportTemplate();
  
  console.log('\nNext Steps:');
  console.log('1. Use Playwright MCP to navigate to http://localhost:3000');
  console.log('2. Execute each test scenario step by step');
  console.log('3. Take screenshots at key points');
  console.log('4. Update the test report with results');
  console.log('5. Review the final test report\n');
  
  console.log('To start testing with Playwright MCP:');
  console.log('- Use browser_navigate to go to the application');
  console.log('- Use browser_click to interact with buttons');
  console.log('- Use browser_type to fill in forms');
  console.log('- Use browser_snapshot to verify state');
  console.log('- Use browser_take_screenshot to capture results\n');
};

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testScenarios,
  config,
  generateInstructions,
  generateReportTemplate
};