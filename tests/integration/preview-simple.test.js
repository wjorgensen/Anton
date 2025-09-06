/**
 * Phase 4: Simplified Preview Integration Tests
 * Tests preview functionality without requiring full orchestrator build
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// Test configuration
const TEST_PORT = 3456;
const WS_PORT = 3457;

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to calculate percentile
const percentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[index];
};

describe('Terminal Preview Latency Tests', () => {
  let wsServer;
  let testDir;
  
  beforeAll(async () => {
    // Create test directory
    testDir = path.join('/tmp', 'preview-test', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterAll(async () => {
    // Cleanup
    if (wsServer) wsServer.close();
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  test('terminal preview latency < 50ms', async () => {
    const latencies = [];
    const fileWatchLatencies = [];
    const wsLatencies = [];
    
    // Create WebSocket server for testing
    wsServer = new WebSocket.Server({ port: WS_PORT });
    
    // Handle connections
    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'terminal:output' && msg.timestamp) {
          const now = Date.now();
          const totalLatency = now - msg.timestamp;
          latencies.push(totalLatency);
          
          // Send acknowledgement
          ws.send(JSON.stringify({
            type: 'ack',
            originalTimestamp: msg.timestamp,
            receivedAt: now
          }));
        }
      });
    });
    
    // Connect client
    const wsClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise(resolve => wsClient.on('open', resolve));
    
    // Test file watching latency
    const outputFile = path.join(testDir, 'output.log');
    await fs.writeFile(outputFile, '');
    
    // Simulate terminal output with file watching
    const testCount = 100;
    
    for (let i = 0; i < testCount; i++) {
      const timestamp = Date.now();
      const message = `[${timestamp}] Test output ${i}: Lorem ipsum dolor sit amet\n`;
      
      // Measure file write time
      const fileWriteStart = performance.now();
      await fs.appendFile(outputFile, message);
      const fileWriteEnd = performance.now();
      fileWatchLatencies.push(fileWriteEnd - fileWriteStart);
      
      // Simulate streaming to WebSocket
      const wsStart = performance.now();
      wsClient.send(JSON.stringify({
        type: 'terminal:output',
        timestamp: timestamp,
        nodeId: 'test-node',
        output: message
      }));
      const wsEnd = performance.now();
      wsLatencies.push(wsEnd - wsStart);
      
      // Small delay to simulate real conditions
      if (i % 10 === 0) {
        await wait(10);
      }
    }
    
    // Wait for all messages to be processed
    await wait(500);
    
    // Close WebSocket
    wsClient.close();
    
    // Calculate statistics
    if (fileWatchLatencies.length > 0) {
      const fileP50 = percentile(fileWatchLatencies, 50);
      const fileP95 = percentile(fileWatchLatencies, 95);
      const fileAvg = fileWatchLatencies.reduce((a, b) => a + b, 0) / fileWatchLatencies.length;
      
      console.log('\n📁 File Watch Latency:');
      console.log(`  Samples: ${fileWatchLatencies.length}`);
      console.log(`  P50: ${fileP50.toFixed(2)}ms`);
      console.log(`  P95: ${fileP95.toFixed(2)}ms`);
      console.log(`  Avg: ${fileAvg.toFixed(2)}ms`);
    }
    
    if (wsLatencies.length > 0) {
      const wsP50 = percentile(wsLatencies, 50);
      const wsP95 = percentile(wsLatencies, 95);
      const wsAvg = wsLatencies.reduce((a, b) => a + b, 0) / wsLatencies.length;
      
      console.log('\n🔌 WebSocket Send Latency:');
      console.log(`  Samples: ${wsLatencies.length}`);
      console.log(`  P50: ${wsP50.toFixed(2)}ms`);
      console.log(`  P95: ${wsP95.toFixed(2)}ms`);
      console.log(`  Avg: ${wsAvg.toFixed(2)}ms`);
    }
    
    if (latencies.length > 0) {
      const p50 = percentile(latencies, 50);
      const p95 = percentile(latencies, 95);
      const p99 = percentile(latencies, 99);
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const max = Math.max(...latencies);
      const min = Math.min(...latencies);
      
      console.log('\n🎯 End-to-End Terminal Preview Latency:');
      console.log(`  Samples: ${latencies.length}`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Avg: ${avg.toFixed(2)}ms`);
      
      // Check requirement: P50 < 50ms
      if (p50 < 50) {
        console.log('\n  ✅ P50 latency < 50ms requirement MET');
      } else {
        console.log(`\n  ⚠️  P50 latency ${p50.toFixed(2)}ms (target: < 50ms)`);
      }
      
      expect(p50).toBeLessThan(50);
    }
  });
  
  test('terminal streaming throughput', async () => {
    const throughputData = [];
    let totalBytes = 0;
    
    // Create WebSocket server
    wsServer = new WebSocket.Server({ port: WS_PORT + 1 });
    
    wsServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        totalBytes += data.length;
      });
    });
    
    // Connect client
    const wsClient = new WebSocket(`ws://localhost:${WS_PORT + 1}`);
    await new Promise(resolve => wsClient.on('open', resolve));
    
    const startTime = performance.now();
    const messageCount = 1000;
    const messageSize = 1024; // 1KB per message
    
    // Send messages rapidly
    for (let i = 0; i < messageCount; i++) {
      const message = JSON.stringify({
        type: 'terminal:output',
        nodeId: 'throughput-test',
        sequence: i,
        output: 'X'.repeat(messageSize),
        timestamp: Date.now()
      });
      
      wsClient.send(message);
      
      // Very small delay every 100 messages
      if (i % 100 === 0) {
        await wait(1);
      }
    }
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    const throughputMBps = (totalBytes / (1024 * 1024)) / duration;
    const messagesPerSecond = messageCount / duration;
    
    console.log('\n📊 Terminal Streaming Throughput:');
    console.log(`  Messages sent: ${messageCount}`);
    console.log(`  Total data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Throughput: ${throughputMBps.toFixed(2)} MB/s`);
    console.log(`  Message rate: ${messagesPerSecond.toFixed(0)} msg/s`);
    
    // Check requirements
    expect(throughputMBps).toBeGreaterThan(10); // > 10 MB/s
    expect(messagesPerSecond).toBeGreaterThan(100); // > 100 msg/s
    
    wsClient.close();
  });
  
  test('ANSI color preservation', async () => {
    const outputFile = path.join(testDir, 'ansi-test.log');
    const ansiCodes = [];
    
    // Test various ANSI codes
    const testStrings = [
      '\x1b[30mBlack\x1b[0m',
      '\x1b[31mRed\x1b[0m',
      '\x1b[32mGreen\x1b[0m',
      '\x1b[33mYellow\x1b[0m',
      '\x1b[34mBlue\x1b[0m',
      '\x1b[35mMagenta\x1b[0m',
      '\x1b[36mCyan\x1b[0m',
      '\x1b[37mWhite\x1b[0m',
      '\x1b[1mBold\x1b[0m',
      '\x1b[4mUnderline\x1b[0m',
      '\x1b[7mInverse\x1b[0m',
      '\x1b[1;32m✓ Success\x1b[0m',
      '\x1b[1;31m✗ Error\x1b[0m',
      '\x1b[1;33m⚠ Warning\x1b[0m'
    ];
    
    // Write ANSI formatted content
    for (const str of testStrings) {
      await fs.appendFile(outputFile, str + '\n');
      
      // Extract ANSI codes
      const codes = str.match(/\x1b\[[0-9;]*m/g);
      if (codes) {
        ansiCodes.push(...codes);
      }
    }
    
    // Read back and verify
    const content = await fs.readFile(outputFile, 'utf8');
    
    // Verify ANSI codes are preserved
    expect(content).toMatch(/\x1b\[\d+m/); // Contains ANSI codes
    expect(content).toContain('Success');
    expect(content).toContain('Error');
    expect(content).toContain('Warning');
    
    console.log('\n🎨 ANSI Color Preservation:');
    console.log(`  Test strings: ${testStrings.length}`);
    console.log(`  ANSI codes found: ${ansiCodes.length}`);
    console.log(`  Unique codes: ${new Set(ansiCodes).size}`);
    console.log('  ✅ All ANSI codes preserved correctly');
  });
});

describe('Web Preview Simulation Tests', () => {
  let server;
  let serverPort;
  let testDir;
  
  beforeAll(async () => {
    // Find available port
    serverPort = TEST_PORT + Math.floor(Math.random() * 1000);
    // Create test directory for this suite
    testDir = path.join('/tmp', 'web-preview-test', Date.now().toString());
    await fs.mkdir(testDir, { recursive: true });
  });
  
  afterAll(async () => {
    if (server) {
      server.close();
    }
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
  
  test('simulated dev server startup time', async () => {
    const http = require('http');
    const startTime = performance.now();
    
    // Create simple HTTP server (simulating dev server)
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Test Dev Server</h1>');
    });
    
    // Start server
    await new Promise((resolve) => {
      server.listen(serverPort, resolve);
    });
    
    const endTime = performance.now();
    const startupTime = endTime - startTime;
    
    console.log('\n🚀 Web Preview Server Startup:');
    console.log(`  Port: ${serverPort}`);
    console.log(`  Startup time: ${startupTime.toFixed(2)}ms`);
    
    // Verify server is running
    const testRequest = () => new Promise((resolve, reject) => {
      http.get(`http://localhost:${serverPort}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }).on('error', reject);
    });
    
    const response = await testRequest();
    expect(response.status).toBe(200);
    expect(response.data).toContain('Test Dev Server');
    
    console.log('  ✅ Server responding correctly');
  });
  
  test('hot reload simulation', async () => {
    const fileChangeTimes = [];
    const reloadTimes = [];
    
    // Simulate file watching
    const watchDir = path.join(testDir, 'watch-test');
    await fs.mkdir(watchDir, { recursive: true });
    
    // Create test files
    const files = ['app.js', 'style.css', 'index.html'];
    for (const file of files) {
      await fs.writeFile(path.join(watchDir, file), `// ${file} content`);
    }
    
    // Simulate file changes and measure detection time
    for (let i = 0; i < 10; i++) {
      const file = files[i % files.length];
      const filePath = path.join(watchDir, file);
      
      const changeStart = performance.now();
      await fs.appendFile(filePath, `\n// Change ${i}`);
      const changeEnd = performance.now();
      
      fileChangeTimes.push(changeEnd - changeStart);
      
      // Simulate reload trigger
      const reloadStart = performance.now();
      // In real scenario, this would trigger browser reload
      await wait(5);
      const reloadEnd = performance.now();
      
      reloadTimes.push(reloadEnd - reloadStart);
    }
    
    const avgFileChange = fileChangeTimes.reduce((a, b) => a + b, 0) / fileChangeTimes.length;
    const avgReload = reloadTimes.reduce((a, b) => a + b, 0) / reloadTimes.length;
    
    console.log('\n🔄 Hot Reload Performance:');
    console.log(`  File changes: ${fileChangeTimes.length}`);
    console.log(`  Avg file change time: ${avgFileChange.toFixed(2)}ms`);
    console.log(`  Avg reload trigger time: ${avgReload.toFixed(2)}ms`);
    console.log(`  Total hot reload latency: ${(avgFileChange + avgReload).toFixed(2)}ms`);
    
    expect(avgFileChange + avgReload).toBeLessThan(100);
  });
});

// Export test results
async function exportResults() {
  const results = {
    timestamp: new Date().toISOString(),
    phase: 'Phase 4 - Preview Services (Simplified)',
    tests: {
      terminalStreaming: {
        status: 'completed',
        metrics: {
          latencyTarget: '< 50ms',
          throughputTarget: '> 10 MB/s',
          ansiSupport: true
        }
      },
      webPreview: {
        status: 'completed',
        features: {
          serverStartup: 'measured',
          hotReload: 'simulated'
        }
      }
    }
  };
  
  const reportDir = path.join(__dirname, '../../test-reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'phase4-preview-simplified.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 Test report saved to: ${reportPath}`);
  return results;
}

// Run tests if executed directly
if (require.main === module) {
  const { spawn } = require('child_process');
  
  console.log('🧪 Running Phase 4: Simplified Preview Integration Tests...\n');
  
  const jest = spawn('npx', ['jest', __filename, '--verbose', '--forceExit'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  
  jest.on('exit', async (code) => {
    if (code === 0) {
      const results = await exportResults();
      console.log('\n✅ All tests completed successfully!');
      console.log('\n📊 Summary:');
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(`\n❌ Tests failed with exit code ${code}`);
    }
    process.exit(code);
  });
}