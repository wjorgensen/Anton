#!/usr/bin/env node

const { createOrchestratorMock, createPlanningMock } = require('./mock-services');
const { spawn } = require('child_process');
const path = require('path');

let orchestratorServer;
let planningServer;

async function startServices() {
  console.log('Starting mock services...');
  orchestratorServer = await createOrchestratorMock(3002);
  planningServer = await createPlanningMock(3003);
  console.log('Mock services ready\n');
  await new Promise(r => setTimeout(r, 500));
}

async function stopServices() {
  if (orchestratorServer) orchestratorServer.close();
  if (planningServer) planningServer.close();
}

async function runTests() {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, 'demo-integration-tests.js')], {
      stdio: 'inherit',
      env: { ...process.env }
    });
    child.on('exit', resolve);
  });
}

async function main() {
  try {
    await startServices();
    const exitCode = await runTests();
    await stopServices();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error);
    await stopServices();
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  await stopServices();
  process.exit(130);
});

main();