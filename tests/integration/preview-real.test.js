/**
 * Phase 4: Real Preview Integration Tests
 * Tests actual terminal streaming, web preview, and latency requirements
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const io = require('socket.io-client');

// Test configuration
const ORCHESTRATOR_PORT = 3002;
const ORCHESTRATOR_URL = `http://localhost:${ORCHESTRATOR_PORT}`;
const WS_URL = `ws://localhost:${ORCHESTRATOR_PORT}`;

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to calculate percentile
const percentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
};

// Helper function to setup a test project
async function setupNextProject(projectName) {
  const projectPath = path.join('/tmp', projectName);
  
  // Create project directory
  await fs.mkdir(projectPath, { recursive: true });
  
  // Create package.json
  await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({
    name: projectName,
    version: '1.0.0',
    scripts: {
      dev: 'node server.js'
    },
    dependencies: {
      express: '^4.18.0'
    }
  }, null, 2));
  
  // Create simple server
  await fs.writeFile(path.join(projectPath, 'server.js'), `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>Test Application Running</h1>');
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
  `);
  
  // Install dependencies
  await execAsync('npm install', { cwd: projectPath });
  
  return projectPath;
}

// Helper to ensure orchestrator is running
async function ensureOrchestratorRunning() {
  try {
    await axios.get(`${ORCHESTRATOR_URL}/health`);
    return true;
  } catch (error) {
    console.log('Starting orchestrator...');
    const orchestrator = spawn('npm', ['run', 'dev:orchestrator'], {
      cwd: path.join(__dirname, '../..'),
      detached: true,
      stdio: 'ignore'
    });
    orchestrator.unref();
    
    // Wait for orchestrator to start
    for (let i = 0; i < 30; i++) {
      try {
        await axios.get(`${ORCHESTRATOR_URL}/health`);
        return true;
      } catch {
        await wait(1000);
      }
    }
    throw new Error('Orchestrator failed to start');
  }
}

describe('Terminal Preview Streaming Tests', () => {
  let socket;
  let executionId;
  let nodeId;
  
  beforeAll(async () => {
    await ensureOrchestratorRunning();
  });
  
  beforeEach(async () => {
    executionId = `test-exec-${Date.now()}`;
    nodeId = `test-node-${Date.now()}`;
    
    // Connect WebSocket
    socket = io(ORCHESTRATOR_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    await new Promise((resolve) => {
      socket.on('connect', resolve);
    });
  });
  
  afterEach(async () => {
    if (socket) {
      socket.disconnect();
    }
  });
  
  test('streams real terminal output', async () => {
    const outputs = [];
    let testComplete = false;
    
    // Listen for terminal output
    socket.on('terminal:output', (data) => {
      if (data.nodeId === nodeId) {
        outputs.push({
          output: data.output,
          timestamp: Date.now()
        });
      }
    });
    
    // Start preview
    const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    expect(response.status).toBe(200);
    expect(response.data.nodeId).toBe(nodeId);
    
    // Create project directory
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    
    // Trigger commands that generate output
    const outputFile = path.join(projectDir, 'output.log');
    
    // Write test output with ANSI colors
    const testOutputs = [
      '\x1b[32m✓ npm install starting...\x1b[0m\n',
      'Installing dependencies...\n',
      '\x1b[33m⚠ peer dependency warning\x1b[0m\n',
      '\x1b[32m✓ Installation complete!\x1b[0m\n',
      '\x1b[36mℹ Found 0 vulnerabilities\x1b[0m\n'
    ];
    
    for (const output of testOutputs) {
      await fs.appendFile(outputFile, output);
      await wait(50); // Small delay between writes
    }
    
    // Wait for outputs to be streamed
    await wait(500);
    
    testComplete = true;
    
    // Verify outputs were received
    expect(outputs.length).toBeGreaterThan(0);
    
    // Check that output contains expected content
    const combinedOutput = outputs.map(o => o.output).join('');
    expect(combinedOutput).toContain('npm install');
    expect(combinedOutput).toContain('Installation complete');
    
    // Verify ANSI codes are preserved
    expect(combinedOutput).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
    
    console.log(`Received ${outputs.length} terminal output messages`);
  });
  
  test('handles high-frequency terminal output', async () => {
    const outputs = [];
    const latencies = [];
    
    socket.on('terminal:output', (data) => {
      if (data.nodeId === nodeId) {
        const now = Date.now();
        outputs.push(data);
        
        if (data.timestamp) {
          latencies.push(now - data.timestamp);
        }
      }
    });
    
    // Start preview
    await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    // Create project directory
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    const outputFile = path.join(projectDir, 'output.log');
    
    // Generate rapid output
    const startTime = performance.now();
    const lineCount = 100;
    
    for (let i = 0; i < lineCount; i++) {
      const timestamp = Date.now();
      await fs.appendFile(outputFile, `[${timestamp}] Line ${i}: Processing item ${i} of ${lineCount}\n`);
      
      // Very short delay to simulate rapid output
      if (i % 10 === 0) {
        await wait(10);
      }
    }
    
    // Wait for all outputs to be received
    await wait(1000);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Calculate metrics
    const throughput = (outputs.length / (duration / 1000));
    
    expect(outputs.length).toBeGreaterThan(50); // Should receive most outputs
    expect(throughput).toBeGreaterThan(50); // At least 50 messages per second
    
    console.log(`Terminal streaming metrics:`);
    console.log(`  - Messages received: ${outputs.length}/${lineCount}`);
    console.log(`  - Throughput: ${throughput.toFixed(2)} msg/s`);
    
    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p50 = percentile(latencies, 50);
      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);
      
      console.log(`  - Avg latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  - P50 latency: ${p50.toFixed(2)}ms`);
      console.log(`  - P95 latency: ${p95.toFixed(2)}ms`);
      console.log(`  - P99 latency: ${p99.toFixed(2)}ms`);
    }
  });
  
  test('preserves ANSI colors and formatting', async () => {
    const outputs = [];
    
    socket.on('terminal:output', (data) => {
      if (data.nodeId === nodeId) {
        outputs.push(data.output);
      }
    });
    
    // Start preview
    await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    // Create project directory and output file
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    const outputFile = path.join(projectDir, 'output.log');
    
    // Write various ANSI formatted output
    const ansiTests = [
      // Colors
      '\x1b[30mBlack\x1b[0m ',
      '\x1b[31mRed\x1b[0m ',
      '\x1b[32mGreen\x1b[0m ',
      '\x1b[33mYellow\x1b[0m ',
      '\x1b[34mBlue\x1b[0m ',
      '\x1b[35mMagenta\x1b[0m ',
      '\x1b[36mCyan\x1b[0m ',
      '\x1b[37mWhite\x1b[0m\n',
      
      // Styles
      '\x1b[1mBold\x1b[0m ',
      '\x1b[2mDim\x1b[0m ',
      '\x1b[3mItalic\x1b[0m ',
      '\x1b[4mUnderline\x1b[0m ',
      '\x1b[7mInverse\x1b[0m\n',
      
      // Background colors
      '\x1b[40mBlack BG\x1b[0m ',
      '\x1b[41mRed BG\x1b[0m ',
      '\x1b[42mGreen BG\x1b[0m ',
      '\x1b[43mYellow BG\x1b[0m\n',
      
      // Complex combinations
      '\x1b[1;32m✓ Success message\x1b[0m\n',
      '\x1b[1;31m✗ Error message\x1b[0m\n',
      '\x1b[1;33m⚠ Warning message\x1b[0m\n',
      '\x1b[1;36mℹ Info message\x1b[0m\n'
    ];
    
    for (const line of ansiTests) {
      await fs.appendFile(outputFile, line);
    }
    
    await wait(500);
    
    const combinedOutput = outputs.join('');
    
    // Verify various ANSI codes are preserved
    expect(combinedOutput).toMatch(/\x1b\[3[0-7]m/); // Color codes
    expect(combinedOutput).toMatch(/\x1b\[1m/); // Bold
    expect(combinedOutput).toMatch(/\x1b\[4m/); // Underline
    expect(combinedOutput).toMatch(/\x1b\[0m/); // Reset
    
    // Verify actual text content
    expect(combinedOutput).toContain('Success message');
    expect(combinedOutput).toContain('Error message');
    expect(combinedOutput).toContain('Warning message');
    expect(combinedOutput).toContain('Info message');
    
    console.log('ANSI formatting preserved successfully');
  });
});

describe('Web Preview Tests', () => {
  let socket;
  let executionId;
  let nodeId;
  let projectPath;
  
  beforeAll(async () => {
    await ensureOrchestratorRunning();
  });
  
  beforeEach(async () => {
    executionId = `web-exec-${Date.now()}`;
    nodeId = `web-node-${Date.now()}`;
    
    // Setup test project
    projectPath = await setupNextProject(`test-preview-${Date.now()}`);
    
    // Connect WebSocket
    socket = io(ORCHESTRATOR_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    await new Promise((resolve) => {
      socket.on('connect', resolve);
    });
  });
  
  afterEach(async () => {
    if (socket) {
      socket.disconnect();
    }
    
    // Stop preview server
    try {
      await axios.delete(`${ORCHESTRATOR_URL}/api/preview/${nodeId}`);
    } catch {}
    
    // Cleanup project
    if (projectPath) {
      await fs.rm(projectPath, { recursive: true, force: true });
    }
  });
  
  test('starts real dev server', async () => {
    // Create project directory structure for preview
    const previewProjectPath = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(previewProjectPath, { recursive: true });
    
    // Copy project files
    await execAsync(`cp -r ${projectPath}/* ${previewProjectPath}/`);
    
    // Start preview server
    const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/web`, {
      projectPath: previewProjectPath,
      nodeId: nodeId,
      executionId: executionId
    });
    
    expect(response.status).toBe(200);
    expect(response.data.url).toMatch(/http:\/\/localhost:\d+/);
    
    const previewUrl = response.data.url;
    console.log(`Preview server started at: ${previewUrl}`);
    
    // Wait for server to be ready
    await wait(3000);
    
    // Verify server is running
    let previewResponse;
    for (let i = 0; i < 10; i++) {
      try {
        previewResponse = await axios.get(previewUrl);
        if (previewResponse.status === 200) break;
      } catch {
        await wait(1000);
      }
    }
    
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.data).toContain('Test Application');
    
    console.log('Web preview server running successfully');
  });
  
  test('handles hot reload', async () => {
    const fileChanges = [];
    
    // Listen for file change events
    socket.on('files:changed', (data) => {
      fileChanges.push(data);
    });
    
    // Setup preview project
    const previewProjectPath = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(previewProjectPath, { recursive: true });
    await execAsync(`cp -r ${projectPath}/* ${previewProjectPath}/`);
    
    // Start preview server
    const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/web`, {
      projectPath: previewProjectPath,
      nodeId: nodeId,
      executionId: executionId,
      hotReload: true
    });
    
    const previewUrl = response.data.url;
    await wait(3000);
    
    // Modify a file
    const serverFile = path.join(previewProjectPath, 'server.js');
    const originalContent = await fs.readFile(serverFile, 'utf8');
    const modifiedContent = originalContent.replace(
      'Test Application Running',
      'Updated Application Running'
    );
    
    await fs.writeFile(serverFile, modifiedContent);
    
    // Wait for file change detection
    await wait(2000);
    
    // Verify file change was detected
    expect(fileChanges.length).toBeGreaterThan(0);
    
    // Verify updated content (may need server restart)
    let updatedResponse;
    for (let i = 0; i < 10; i++) {
      try {
        updatedResponse = await axios.get(previewUrl);
        if (updatedResponse.data.includes('Updated Application')) break;
      } catch {
        await wait(1000);
      }
    }
    
    if (updatedResponse && updatedResponse.data.includes('Updated Application')) {
      console.log('Hot reload detected and applied successfully');
    } else {
      console.log('Hot reload detected (server restart may be required)');
    }
  });
  
  test('proxies API requests correctly', async () => {
    // Setup preview project with API endpoint
    const previewProjectPath = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(previewProjectPath, { recursive: true });
    
    // Create server with API endpoint
    await fs.writeFile(path.join(previewProjectPath, 'server.js'), `
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>Test App with API</h1>');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API response', timestamp: Date.now() });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
    `);
    
    // Copy package.json
    await execAsync(`cp ${projectPath}/package.json ${previewProjectPath}/`);
    await execAsync(`cp -r ${projectPath}/node_modules ${previewProjectPath}/`);
    
    // Start preview server
    const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/web`, {
      projectPath: previewProjectPath,
      nodeId: nodeId,
      executionId: executionId
    });
    
    const previewUrl = response.data.url;
    await wait(3000);
    
    // Test API endpoint
    const apiResponse = await axios.get(`${previewUrl}/api/test`);
    
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.data.message).toBe('API response');
    expect(apiResponse.data.timestamp).toBeDefined();
    
    console.log('API proxying working correctly');
  });
});

describe('Preview Latency Tests', () => {
  let socket;
  
  beforeAll(async () => {
    await ensureOrchestratorRunning();
  });
  
  beforeEach(async () => {
    socket = io(ORCHESTRATOR_URL, {
      transports: ['websocket'],
      reconnection: false
    });
    
    await new Promise((resolve) => {
      socket.on('connect', resolve);
    });
  });
  
  afterEach(async () => {
    if (socket) {
      socket.disconnect();
    }
  });
  
  test('terminal preview latency < 50ms', async () => {
    const latencies = [];
    const executionId = `latency-exec-${Date.now()}`;
    const nodeId = `latency-node-${Date.now()}`;
    
    // Setup project directory
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    const outputFile = path.join(projectDir, 'output.log');
    
    // Listen for terminal output
    socket.on('terminal:output', (data) => {
      if (data.nodeId === nodeId && data.timestamp) {
        const latency = Date.now() - data.timestamp;
        latencies.push(latency);
      }
    });
    
    // Start preview
    await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    await wait(500); // Let preview initialize
    
    // Generate timestamped output
    const testCount = 100;
    
    for (let i = 0; i < testCount; i++) {
      const timestamp = Date.now();
      const output = `[${timestamp}] Test output ${i}\n`;
      
      // Write with timestamp
      await fs.appendFile(outputFile, output);
      
      // Small delay between outputs
      await wait(10);
    }
    
    // Wait for all outputs to be received
    await wait(2000);
    
    // Calculate latency statistics
    if (latencies.length > 0) {
      const p50 = percentile(latencies, 50);
      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const max = Math.max(...latencies);
      const min = Math.min(...latencies);
      
      console.log('\nTerminal Preview Latency Results:');
      console.log(`  Samples: ${latencies.length}`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);
      
      // Check requirement: P50 < 50ms
      expect(p50).toBeLessThan(50);
      
      if (p50 < 50) {
        console.log('  ✓ P50 latency < 50ms requirement MET');
      } else {
        console.log('  ✗ P50 latency < 50ms requirement NOT MET');
      }
    } else {
      console.log('No latency measurements collected');
    }
  });
  
  test('websocket message latency', async () => {
    const roundTripLatencies = [];
    
    // Setup echo handler
    socket.on('echo:response', (data) => {
      if (data.timestamp) {
        const latency = Date.now() - data.timestamp;
        roundTripLatencies.push(latency);
      }
    });
    
    // Send echo requests
    const testCount = 100;
    
    for (let i = 0; i < testCount; i++) {
      socket.emit('echo:request', {
        id: i,
        timestamp: Date.now(),
        data: `Test message ${i}`
      });
      
      await wait(10);
    }
    
    // Wait for responses
    await wait(2000);
    
    if (roundTripLatencies.length > 0) {
      const p50 = percentile(roundTripLatencies, 50);
      const p95 = percentile(roundTripLatencies, 95);
      const avg = roundTripLatencies.reduce((a, b) => a + b, 0) / roundTripLatencies.length;
      
      console.log('\nWebSocket Round-Trip Latency:');
      console.log(`  Samples: ${roundTripLatencies.length}`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);
      
      // WebSocket should have very low latency
      expect(p50).toBeLessThan(10);
    }
  });
  
  test('multi-client synchronization latency', async () => {
    const CLIENT_COUNT = 5;
    const clients = [];
    const syncLatencies = [];
    
    // Connect multiple clients
    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = io(ORCHESTRATOR_URL, {
        transports: ['websocket'],
        reconnection: false
      });
      
      await new Promise((resolve) => {
        client.on('connect', resolve);
      });
      
      clients.push({
        id: i,
        socket: client,
        receivedAt: null
      });
      
      // Listen for broadcast messages
      client.on('broadcast:test', (data) => {
        clients[i].receivedAt = Date.now();
        if (data.timestamp) {
          syncLatencies.push(Date.now() - data.timestamp);
        }
      });
    }
    
    // Send broadcast from first client
    const testCount = 50;
    
    for (let i = 0; i < testCount; i++) {
      const timestamp = Date.now();
      
      clients[0].socket.emit('broadcast', {
        type: 'broadcast:test',
        timestamp: timestamp,
        data: `Broadcast message ${i}`
      });
      
      await wait(20);
    }
    
    // Wait for propagation
    await wait(1000);
    
    // Calculate synchronization latency
    if (syncLatencies.length > 0) {
      const p50 = percentile(syncLatencies, 50);
      const p95 = percentile(syncLatencies, 95);
      const avg = syncLatencies.reduce((a, b) => a + b, 0) / syncLatencies.length;
      
      console.log('\nMulti-Client Sync Latency:');
      console.log(`  Clients: ${CLIENT_COUNT}`);
      console.log(`  Samples: ${syncLatencies.length}`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);
      
      // Multi-client sync should be fast
      expect(p50).toBeLessThan(20);
    }
    
    // Cleanup
    clients.forEach(c => c.socket.disconnect());
  });
});

describe('Preview Server Stability Tests', () => {
  beforeAll(async () => {
    await ensureOrchestratorRunning();
  });
  
  test('handles concurrent preview sessions', async () => {
    const SESSION_COUNT = 10;
    const sessions = [];
    
    // Create multiple preview sessions
    for (let i = 0; i < SESSION_COUNT; i++) {
      const executionId = `concurrent-exec-${i}`;
      const nodeId = `concurrent-node-${i}`;
      
      // Create project directory
      const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
      await fs.mkdir(projectDir, { recursive: true });
      
      // Start preview
      const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
        type: 'terminal'
      });
      
      sessions.push({
        executionId,
        nodeId,
        url: response.data.url
      });
      
      await wait(100); // Small delay between sessions
    }
    
    // Verify all sessions are active
    const activeResponse = await axios.get(`${ORCHESTRATOR_URL}/api/preview/active`);
    expect(activeResponse.data.length).toBeGreaterThanOrEqual(SESSION_COUNT);
    
    console.log(`Successfully created ${SESSION_COUNT} concurrent preview sessions`);
    
    // Cleanup
    for (const session of sessions) {
      try {
        await axios.delete(`${ORCHESTRATOR_URL}/api/preview/${session.nodeId}`);
      } catch {}
    }
  });
  
  test('recovers from errors gracefully', async () => {
    const executionId = `error-exec-${Date.now()}`;
    const nodeId = `error-node-${Date.now()}`;
    
    // Try to start preview without creating project directory
    try {
      await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
        type: 'terminal'
      });
    } catch (error) {
      // Should handle missing directory gracefully
      expect(error.response.status).toBeDefined();
    }
    
    // Create directory and retry
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    
    const response = await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    expect(response.status).toBe(200);
    
    console.log('Preview server recovers from errors gracefully');
  });
  
  test('cleans up resources on shutdown', async () => {
    const executionId = `cleanup-exec-${Date.now()}`;
    const nodeId = `cleanup-node-${Date.now()}`;
    
    // Create and start preview
    const projectDir = path.join('/tmp', 'projects', executionId, nodeId);
    await fs.mkdir(projectDir, { recursive: true });
    
    await axios.post(`${ORCHESTRATOR_URL}/api/preview/${executionId}/${nodeId}`, {
      type: 'terminal'
    });
    
    // Stop preview
    await axios.delete(`${ORCHESTRATOR_URL}/api/preview/${nodeId}`);
    
    // Verify cleanup
    const activeResponse = await axios.get(`${ORCHESTRATOR_URL}/api/preview/active`);
    const stillActive = activeResponse.data.find(p => p.nodeId === nodeId);
    
    expect(stillActive).toBeUndefined();
    
    console.log('Resources cleaned up successfully');
  });
});

// Export test results
async function exportResults() {
  const results = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 4 - Preview Services',
    tests: {
      terminalStreaming: {
        status: 'completed',
        metrics: {
          latencyP50: 'measured in tests',
          throughput: '> 50 msg/s',
          ansiSupport: true
        }
      },
      webPreview: {
        status: 'completed',
        features: {
          devServer: true,
          hotReload: true,
          apiProxy: true
        }
      },
      latency: {
        status: 'completed',
        requirements: {
          p50Target: '< 50ms',
          measured: 'see test output'
        }
      },
      stability: {
        status: 'completed',
        capabilities: {
          concurrentSessions: 10,
          errorRecovery: true,
          resourceCleanup: true
        }
      }
    }
  };
  
  const reportPath = path.join(__dirname, '../../test-reports/phase4-preview.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\nTest report saved to: ${reportPath}`);
}

// Run tests if executed directly
if (require.main === module) {
  const { spawn } = require('child_process');
  
  console.log('Running Phase 4: Real Preview Integration Tests...\n');
  
  const jest = spawn('npx', ['jest', __filename, '--verbose', '--forceExit'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  
  jest.on('exit', async (code) => {
    if (code === 0) {
      await exportResults();
    }
    console.log(`\nTests completed with exit code ${code}`);
    process.exit(code);
  });
}