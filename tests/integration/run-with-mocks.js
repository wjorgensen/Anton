#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { createOrchestratorMock, createPlanningMock } = require('./mock-services');

let orchestratorServer;
let planningServer;

async function startMockServices() {
  console.log('Starting mock services...');
  orchestratorServer = await createOrchestratorMock(3002);
  planningServer = await createPlanningMock(3003);
  console.log('Mock services started');
  
  // Give services time to fully initialize
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function stopMockServices() {
  console.log('Stopping mock services...');
  if (orchestratorServer) orchestratorServer.close();
  if (planningServer) planningServer.close();
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function runTests() {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', ['tests/integration/run-integration-tests.js'], {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: 'true'
      },
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      resolve(code);
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    await startMockServices();
    const exitCode = await runTests();
    await stopMockServices();
    process.exit(exitCode);
  } catch (error) {
    console.error('Error:', error);
    await stopMockServices();
    process.exit(1);
  }
}

// Handle interrupts
process.on('SIGINT', async () => {
  console.log('\nInterrupted, cleaning up...');
  await stopMockServices();
  process.exit(130);
});

main();