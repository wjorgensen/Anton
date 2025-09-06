/**
 * Integration tests for live preview streaming and synchronization
 * Tests terminal preview, web preview, and multi-client synchronization
 */

const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

const TEST_PORT = 3456;
const WS_PORT = 3457;
const PREVIEW_PORT = 3458;

/**
 * Terminal Preview Test Suite
 * Tests real-time ANSI terminal streaming with WebSocket
 */
describe('Terminal Preview Integration Tests', () => {
  let server;
  let terminalService;
  let wsClient;
  
  beforeEach(async () => {
    // Start orchestration server with terminal preview
    const { TerminalPreviewService } = require('../../orchestration/dist/services/TerminalPreviewService');
    const { WebSocketService } = require('../../orchestration/dist/services/WebSocketService');
    
    // Create WebSocket service
    const wsService = new WebSocketService();
    await wsService.initialize(WS_PORT);
    
    // Create terminal preview service
    terminalService = new TerminalPreviewService(wsService, '/tmp/test-preview');
    
    // Connect test WebSocket client
    wsClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise((resolve) => wsClient.on('open', resolve));
  });
  
  afterEach(async () => {
    if (wsClient) wsClient.close();
    if (terminalService) terminalService.destroy();
    if (server) server.close();
  });
  
  test('should stream ANSI colored output in real-time', async () => {
    const nodeId = 'test-node-1';
    const executionId = 'exec-123';
    const messages = [];
    
    // Listen for terminal data
    wsClient.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'preview' && msg.data.type === 'terminal') {
        messages.push(msg);
      }
    });
    
    // Create terminal
    const terminal = terminalService.createTerminal(nodeId, executionId);
    
    // Write ANSI colored output
    const testData = [
      '\x1b[32mGREEN TEXT\x1b[0m\n',
      '\x1b[31mRED ERROR\x1b[0m\n',
      '\x1b[33mYELLOW WARNING\x1b[0m\n',
      '\x1b[36mCYAN INFO\x1b[0m\n'
    ];
    
    const startTime = performance.now();
    
    for (const data of testData) {
      terminalService.writeToTerminal(nodeId, data);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Verify real-time streaming
    expect(messages.length).toBeGreaterThan(0);
    expect(latency).toBeLessThan(50); // < 50ms latency requirement
    
    // Verify ANSI preservation
    const content = messages.map(m => m.data.content).join('');
    expect(content).toContain('\x1b[32m');
    expect(content).toContain('\x1b[31m');
    expect(content).toContain('\x1b[33m');
    expect(content).toContain('\x1b[36m');
    
    console.log(`Terminal streaming latency: ${latency.toFixed(2)}ms`);
  });
  
  test('should handle buffer management correctly', async () => {
    const nodeId = 'test-node-2';
    const executionId = 'exec-124';
    
    // Create terminal with small buffer
    const terminal = terminalService.createTerminal(nodeId, executionId);
    
    // Generate large amount of data
    const largeData = 'X'.repeat(1024); // 1KB chunks
    const chunks = 100;
    
    const startTime = performance.now();
    
    for (let i = 0; i < chunks; i++) {
      terminalService.writeToTerminal(nodeId, `Chunk ${i}: ${largeData}\n`);
    }
    
    // Force buffer flush
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const stats = terminalService.getStats();
    
    // Verify buffer management
    expect(stats.activeTerminals).toBe(1);
    expect(stats.totalBufferedBytes).toBeLessThan(1024 * 1024); // Less than 1MB buffered
    
    const endTime = performance.now();
    const throughput = (chunks * 1024) / ((endTime - startTime) / 1000);
    
    console.log(`Buffer throughput: ${(throughput / 1024 / 1024).toFixed(2)} MB/s`);
    expect(throughput).toBeGreaterThan(10 * 1024 * 1024); // > 10MB/s requirement
  });
  
  test('should handle terminal resize correctly', async () => {
    const nodeId = 'test-node-3';
    const executionId = 'exec-125';
    const resizeEvents = [];
    
    wsClient.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.data?.action === 'resize') {
        resizeEvents.push(msg);
      }
    });
    
    const terminal = terminalService.createTerminal(nodeId, executionId);
    
    // Test different terminal sizes
    const sizes = [
      { cols: 80, rows: 24 },
      { cols: 120, rows: 40 },
      { cols: 160, rows: 50 }
    ];
    
    for (const size of sizes) {
      terminalService.resizeTerminal(nodeId, size.cols, size.rows);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify resize events
    expect(resizeEvents.length).toBe(sizes.length);
    resizeEvents.forEach((event, i) => {
      expect(event.data.cols).toBe(sizes[i].cols);
      expect(event.data.rows).toBe(sizes[i].rows);
    });
  });
});

/**
 * Web Preview Test Suite
 * Tests iframe-based web preview with hot reload
 */
describe('Web Preview Integration Tests', () => {
  let previewServer;
  let targetServer;
  let wsClient;
  
  beforeEach(async () => {
    // Start target dev server
    targetServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <head><title>Test App</title></head>
          <body>
            <h1>Test Application</h1>
            <script>
              console.log('App loaded');
              console.error('Test error');
              
              // Simulate hot reload
              if (window.HMR_WEBSOCKET_URL) {
                const ws = new WebSocket(window.HMR_WEBSOCKET_URL);
                ws.onmessage = (e) => {
                  if (e.data === 'reload') {
                    window.location.reload();
                  }
                };
              }
            </script>
          </body>
        </html>
      `);
    });
    
    await new Promise(resolve => targetServer.listen(PREVIEW_PORT, resolve));
    
    // Start preview proxy server
    const { WebPreviewService } = require('../../orchestration/dist/services/web-preview');
    previewServer = new WebPreviewService();
    await previewServer.start(TEST_PORT);
    
    // Connect WebSocket for console forwarding
    wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/console`);
    await new Promise(resolve => wsClient.on('open', resolve));
  });
  
  afterEach(async () => {
    if (wsClient) wsClient.close();
    if (previewServer) await previewServer.stop();
    if (targetServer) targetServer.close();
  });
  
  test('should proxy web content correctly', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/preview?url=http://localhost:${PREVIEW_PORT}`);
    const html = await response.text();
    
    // Verify proxied content
    expect(response.status).toBe(200);
    expect(html).toContain('Test Application');
    expect(html).toContain('console.log');
  });
  
  test('should forward console messages', async () => {
    const messages = [];
    
    wsClient.on('message', (data) => {
      messages.push(JSON.parse(data));
    });
    
    // Load page that generates console messages
    await fetch(`http://localhost:${TEST_PORT}/preview?url=http://localhost:${PREVIEW_PORT}`);
    
    // Wait for console forwarding
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify console messages
    const logMessages = messages.filter(m => m.type === 'console' && m.level === 'log');
    const errorMessages = messages.filter(m => m.type === 'console' && m.level === 'error');
    
    expect(logMessages.length).toBeGreaterThan(0);
    expect(errorMessages.length).toBeGreaterThan(0);
    expect(logMessages[0].message).toContain('App loaded');
    expect(errorMessages[0].message).toContain('Test error');
  });
  
  test('should handle hot reload', async () => {
    let reloadCount = 0;
    
    wsClient.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'reload') {
        reloadCount++;
      }
    });
    
    // Trigger hot reload
    wsClient.send(JSON.stringify({ type: 'hmr', action: 'reload' }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify reload triggered
    expect(reloadCount).toBeGreaterThan(0);
  });
  
  test('should handle iframe security correctly', async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/preview?url=http://localhost:${PREVIEW_PORT}`);
    
    // Check security headers
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });
});

/**
 * Multi-Client Synchronization Test Suite
 * Tests multiple preview clients with synchronized updates
 */
describe('Multi-Client Synchronization Tests', () => {
  let wsServer;
  let clients = [];
  const CLIENT_COUNT = 5;
  
  beforeEach(async () => {
    // Start WebSocket server
    wsServer = new WebSocket.Server({ port: WS_PORT });
    
    // Track connected clients
    const connectedClients = new Set();
    
    wsServer.on('connection', (ws) => {
      connectedClients.add(ws);
      
      // Broadcast to all clients
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'broadcast') {
          for (const client of connectedClients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                ...message,
                timestamp: Date.now()
              }));
            }
          }
        }
      });
      
      ws.on('close', () => {
        connectedClients.delete(ws);
      });
    });
    
    // Connect multiple clients
    for (let i = 0; i < CLIENT_COUNT; i++) {
      const client = new WebSocket(`ws://localhost:${WS_PORT}`);
      await new Promise(resolve => client.on('open', resolve));
      clients.push({
        id: i,
        ws: client,
        messages: []
      });
      
      // Track received messages
      client.on('message', (data) => {
        clients[i].messages.push(JSON.parse(data));
      });
    }
  });
  
  afterEach(async () => {
    clients.forEach(c => c.ws.close());
    if (wsServer) wsServer.close();
  });
  
  test('should synchronize updates to all clients', async () => {
    const testMessage = {
      type: 'broadcast',
      action: 'update',
      data: 'Test synchronization data'
    };
    
    // Send from first client
    clients[0].ws.send(JSON.stringify(testMessage));
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify all clients received the message
    for (let i = 0; i < CLIENT_COUNT; i++) {
      expect(clients[i].messages.length).toBe(1);
      expect(clients[i].messages[0].action).toBe('update');
      expect(clients[i].messages[0].data).toBe(testMessage.data);
    }
    
    // Verify timestamps are close (< 10ms difference)
    const timestamps = clients.map(c => c.messages[0].timestamp);
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    expect(maxDiff).toBeLessThan(10);
  });
  
  test('should handle connection recovery', async () => {
    const clientIndex = 2;
    const originalClient = clients[clientIndex];
    
    // Disconnect a client
    originalClient.ws.close();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Send update while client is disconnected
    clients[0].ws.send(JSON.stringify({
      type: 'broadcast',
      action: 'update-while-disconnected',
      data: 'Update 1'
    }));
    
    // Reconnect the client
    const newClient = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise(resolve => newClient.on('open', resolve));
    
    const reconnectedMessages = [];
    newClient.on('message', (data) => {
      reconnectedMessages.push(JSON.parse(data));
    });
    
    // Send update after reconnection
    clients[0].ws.send(JSON.stringify({
      type: 'broadcast',
      action: 'update-after-reconnect',
      data: 'Update 2'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify reconnected client receives new updates
    expect(reconnectedMessages.length).toBe(1);
    expect(reconnectedMessages[0].action).toBe('update-after-reconnect');
    
    newClient.close();
  });
  
  test('should handle high throughput', async () => {
    const messageCount = 1000;
    const startTime = performance.now();
    
    // Send many messages rapidly
    for (let i = 0; i < messageCount; i++) {
      clients[0].ws.send(JSON.stringify({
        type: 'broadcast',
        action: 'throughput-test',
        sequence: i,
        data: `Message ${i}`
      }));
    }
    
    // Wait for all messages to propagate
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const allReceived = clients.every(c => c.messages.length >= messageCount);
        if (allReceived) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
    
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;
    const messagesPerSecond = (messageCount * CLIENT_COUNT) / duration;
    
    // Verify all clients received all messages
    for (const client of clients) {
      expect(client.messages.length).toBe(messageCount);
      
      // Verify message order
      for (let i = 0; i < messageCount; i++) {
        expect(client.messages[i].sequence).toBe(i);
      }
    }
    
    console.log(`Throughput: ${messagesPerSecond.toFixed(0)} messages/second across ${CLIENT_COUNT} clients`);
    expect(messagesPerSecond).toBeGreaterThan(1000); // > 1000 msg/s requirement
  });
  
  test('should maintain low memory usage', async () => {
    const initialMemory = process.memoryUsage();
    
    // Send large messages
    const largeData = 'X'.repeat(10000); // 10KB per message
    const messageCount = 100;
    
    for (let i = 0; i < messageCount; i++) {
      clients[0].ws.send(JSON.stringify({
        type: 'broadcast',
        action: 'memory-test',
        data: largeData
      }));
      
      // Small delay to allow garbage collection
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    
    console.log(`Memory increase: ${memoryIncrease.toFixed(2)} MB`);
    
    // Memory should not increase excessively (< 50MB for this test)
    expect(memoryIncrease).toBeLessThan(50);
  });
});

/**
 * Performance Benchmarks
 */
describe('Performance Requirements', () => {
  test('should meet latency requirements', async () => {
    const measurements = [];
    
    // Create simple echo WebSocket server
    const server = new WebSocket.Server({ port: WS_PORT });
    server.on('connection', (ws) => {
      ws.on('message', (data) => {
        ws.send(data);
      });
    });
    
    const client = new WebSocket(`ws://localhost:${WS_PORT}`);
    await new Promise(resolve => client.on('open', resolve));
    
    // Measure round-trip latency
    for (let i = 0; i < 100; i++) {
      const startTime = performance.now();
      
      const promise = new Promise(resolve => {
        client.once('message', () => {
          const endTime = performance.now();
          measurements.push(endTime - startTime);
          resolve();
        });
      });
      
      client.send('ping');
      await promise;
    }
    
    client.close();
    server.close();
    
    // Calculate statistics
    const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const maxLatency = Math.max(...measurements);
    const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];
    
    console.log(`Latency - Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency.toFixed(2)}ms, P95: ${p95Latency.toFixed(2)}ms`);
    
    // Verify latency requirements
    expect(avgLatency).toBeLessThan(50);
    expect(p95Latency).toBeLessThan(50);
  });
  
  test('should handle 50+ concurrent clients', async () => {
    const CONCURRENT_CLIENTS = 50;
    const server = new WebSocket.Server({ port: WS_PORT });
    const connectedClients = new Set();
    
    server.on('connection', (ws) => {
      connectedClients.add(ws);
      ws.on('close', () => connectedClients.delete(ws));
    });
    
    const clients = [];
    
    // Connect many clients
    for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
      const client = new WebSocket(`ws://localhost:${WS_PORT}`);
      await new Promise(resolve => client.on('open', resolve));
      clients.push(client);
    }
    
    // Verify all connected
    expect(connectedClients.size).toBe(CONCURRENT_CLIENTS);
    
    // Send messages from all clients
    const promises = clients.map((client, i) => {
      return new Promise(resolve => {
        client.send(`Message from client ${i}`);
        setTimeout(resolve, 10);
      });
    });
    
    await Promise.all(promises);
    
    // Clean up
    clients.forEach(c => c.close());
    server.close();
    
    console.log(`Successfully handled ${CONCURRENT_CLIENTS} concurrent clients`);
  });
});

// Run tests if executed directly
if (require.main === module) {
  const { spawn } = require('child_process');
  
  console.log('Running Preview Integration Tests...\n');
  
  const jest = spawn('npx', ['jest', __filename, '--verbose', '--detectOpenHandles'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });
  
  jest.on('exit', (code) => {
    console.log(`\nTests completed with exit code ${code}`);
    process.exit(code);
  });
}