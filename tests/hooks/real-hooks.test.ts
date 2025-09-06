import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import { Server } from 'http';

const TEST_DIR = path.join(__dirname, 'test-project');
const SETUP_SCRIPT = path.join(__dirname, 'setup-real-project.sh');
const PORT = 3502; // Test orchestrator port

describe('Real Hook System Tests', () => {
  let app: express.Application;
  let server: Server;
  let receivedCallbacks: any[] = [];
  
  beforeAll(async () => {
    // Setup test project
    console.log('Setting up test project...');
    execSync(`bash ${SETUP_SCRIPT}`, { stdio: 'inherit' });
    
    // Create mock orchestrator server
    app = express();
    app.use(express.json());
    
    // Mock orchestrator endpoints
    app.post('/api/agent-complete', (req, res) => {
      console.log('Received agent-complete:', req.body);
      receivedCallbacks.push({ type: 'complete', ...req.body });
      res.json({ success: true });
    });
    
    app.post('/api/execution/:executionId/status', (req, res) => {
      console.log('Received status update:', req.body);
      receivedCallbacks.push({ type: 'status', ...req.body });
      res.json({ success: true });
    });
    
    app.post('/api/file-changes', (req, res) => {
      console.log('Received file changes:', req.body);
      receivedCallbacks.push({ type: 'file-changes', ...req.body });
      res.json({ success: true });
    });
    
    // Start server
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => {
        console.log(`Test orchestrator listening on port ${PORT}`);
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    // Cleanup
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    
    // Clean test directory
    if (fs.existsSync(TEST_DIR)) {
      execSync(`rm -rf ${TEST_DIR}`, { stdio: 'ignore' });
    }
  });
  
  beforeEach(() => {
    receivedCallbacks = [];
  });
  
  describe('Stop Hook Tests', () => {
    test('stop hook sends success callback to orchestrator', async () => {
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: path.join(TEST_DIR, 'node-1'),
        NODE_ID: 'node-1',
        EXECUTION_ID: 'exec-test-001',
        ORCHESTRATOR_URL: `http://localhost:${PORT}`,
        STATUS: 'success'
      };
      
      // Execute stop hook
      const stopHookPath = path.join(TEST_DIR, 'node-1/.claude-code/hooks/stop.sh');
      
      try {
        execSync(`bash ${stopHookPath}`, { env, stdio: 'pipe' });
      } catch (error) {
        console.error('Stop hook execution error:', error);
      }
      
      // Wait for callback
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify callback received
      const completeCallback = receivedCallbacks.find(cb => cb.type === 'complete');
      expect(completeCallback).toBeDefined();
      expect(completeCallback?.nodeId).toBe('node-1');
      expect(completeCallback?.status).toBe('success');
      expect(completeCallback?.executionId).toBe('exec-test-001');
    });
    
    test('stop hook sends failure callback with error message', async () => {
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: path.join(TEST_DIR, 'node-2'),
        NODE_ID: 'node-2',
        EXECUTION_ID: 'exec-test-002',
        ORCHESTRATOR_URL: `http://localhost:${PORT}`,
        STATUS: 'error',
        ERROR_MESSAGE: 'Test failed with exit code 1'
      };
      
      const stopHookPath = path.join(TEST_DIR, 'node-2/.claude-code/hooks/stop.sh');
      
      try {
        execSync(`bash ${stopHookPath}`, { env, stdio: 'pipe' });
      } catch (error) {
        console.error('Stop hook execution error:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const completeCallback = receivedCallbacks.find(cb => cb.type === 'complete');
      expect(completeCallback).toBeDefined();
      expect(completeCallback?.nodeId).toBe('node-2');
      expect(completeCallback?.status).toBe('error');
      expect(completeCallback?.error).toBe('Test failed with exit code 1');
    });
    
    test('stop hook handles missing environment variables gracefully', async () => {
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: path.join(TEST_DIR, 'node-1'),
        // Missing NODE_ID and EXECUTION_ID
        ORCHESTRATOR_URL: `http://localhost:${PORT}`,
        STATUS: 'success'
      };
      
      const stopHookPath = path.join(TEST_DIR, 'node-1/.claude-code/hooks/stop.sh');
      
      const result = execSync(`bash ${stopHookPath} 2>&1 || true`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      // Should log error about missing variables
      expect(result).toContain('NODE_ID');
    });
  });
  
  describe('File Change Tracking Tests', () => {
    test('track-changes hook detects new files', async () => {
      const projectDir = path.join(TEST_DIR, 'node-1');
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NODE_ID: 'node-1',
        EXECUTION_ID: 'exec-test-003',
        ORCHESTRATOR_URL: `http://localhost:${PORT}`
      };
      
      // Create new files
      fs.writeFileSync(path.join(projectDir, 'new-file.js'), 'console.log("new");');
      fs.writeFileSync(path.join(projectDir, 'src/component.tsx'), 'export default () => {}');
      
      // Execute track-changes hook
      const trackHookPath = path.join(projectDir, '.claude-code/hooks/track-changes.sh');
      const output = execSync(`bash ${trackHookPath}`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      // Parse output
      const data = JSON.parse(output);
      
      expect(data.nodeId).toBe('node-1');
      expect(data.files).toContain('new-file.js');
      expect(data.files).toContain('src/component.tsx');
      expect(data.timestamp).toBeDefined();
    });
    
    test('track-changes hook detects modified files', async () => {
      const projectDir = path.join(TEST_DIR, 'node-2');
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NODE_ID: 'node-2',
        EXECUTION_ID: 'exec-test-004',
        ORCHESTRATOR_URL: `http://localhost:${PORT}`
      };
      
      // Modify existing file
      const filePath = path.join(projectDir, 'app.js');
      const originalContent = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, originalContent + '\n// Modified');
      
      // Create tracking state file
      const stateFile = path.join(projectDir, '.claude-code/.file-state.json');
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify({
        'app.js': { 
          mtime: new Date(Date.now() - 10000).toISOString(),
          size: originalContent.length 
        }
      }));
      
      // Execute track-changes hook
      const trackHookPath = path.join(projectDir, '.claude-code/hooks/track-changes.sh');
      const output = execSync(`bash ${trackHookPath}`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      const data = JSON.parse(output);
      
      expect(data.nodeId).toBe('node-2');
      expect(data.modified).toContain('app.js');
    });
    
    test('track-changes hook excludes ignored patterns', async () => {
      const projectDir = path.join(TEST_DIR, 'node-1');
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NODE_ID: 'node-1',
        IGNORE_PATTERNS: 'node_modules/,*.log,.git/'
      };
      
      // Create files that should be ignored
      fs.mkdirSync(path.join(projectDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'node_modules/package.js'), 'module');
      fs.writeFileSync(path.join(projectDir, 'debug.log'), 'log data');
      fs.writeFileSync(path.join(projectDir, 'important.js'), 'not ignored');
      
      const trackHookPath = path.join(projectDir, '.claude-code/hooks/track-changes.sh');
      const output = execSync(`bash ${trackHookPath}`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      const data = JSON.parse(output);
      
      expect(data.files).not.toContain('node_modules/package.js');
      expect(data.files).not.toContain('debug.log');
      expect(data.files).toContain('important.js');
    });
  });
  
  describe('Hook Execution Performance', () => {
    test('stop hook completes within acceptable time', async () => {
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: path.join(TEST_DIR, 'node-1'),
        NODE_ID: 'node-perf',
        EXECUTION_ID: 'exec-perf-001',
        ORCHESTRATOR_URL: `http://localhost:${PORT}`,
        STATUS: 'success'
      };
      
      const stopHookPath = path.join(TEST_DIR, 'node-1/.claude-code/hooks/stop.sh');
      
      const startTime = Date.now();
      execSync(`bash ${stopHookPath}`, { env, stdio: 'pipe' });
      const duration = Date.now() - startTime;
      
      // Hook should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
    
    test('track-changes hook handles large projects efficiently', async () => {
      const projectDir = path.join(TEST_DIR, 'large-project');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, '.claude-code/hooks'), { recursive: true });
      
      // Copy track-changes hook
      const sourceHook = path.join(TEST_DIR, 'node-1/.claude-code/hooks/track-changes.sh');
      const targetHook = path.join(projectDir, '.claude-code/hooks/track-changes.sh');
      fs.copyFileSync(sourceHook, targetHook);
      
      // Create many files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(
          path.join(projectDir, `file-${i}.js`),
          `// File ${i}\nconsole.log(${i});`
        );
      }
      
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NODE_ID: 'node-large'
      };
      
      const startTime = Date.now();
      const output = execSync(`bash ${targetHook}`, { 
        env, 
        encoding: 'utf-8' 
      });
      const duration = Date.now() - startTime;
      
      const data = JSON.parse(output);
      
      expect(data.files.length).toBe(100);
      expect(duration).toBeLessThan(2000); // Should handle 100 files in < 2 seconds
      
      // Cleanup
      execSync(`rm -rf ${projectDir}`);
    });
  });
  
  describe('Hook Error Handling', () => {
    test('stop hook handles network errors gracefully', async () => {
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: path.join(TEST_DIR, 'node-1'),
        NODE_ID: 'node-network',
        EXECUTION_ID: 'exec-network-001',
        ORCHESTRATOR_URL: 'http://localhost:99999', // Invalid port
        STATUS: 'success'
      };
      
      const stopHookPath = path.join(TEST_DIR, 'node-1/.claude-code/hooks/stop.sh');
      
      // Should not throw, but log error
      const result = execSync(`bash ${stopHookPath} 2>&1 || true`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      expect(result).toContain('connect');
    });
    
    test('track-changes hook handles permission errors', async () => {
      const projectDir = path.join(TEST_DIR, 'node-restricted');
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(path.join(projectDir, '.claude-code/hooks'), { recursive: true });
      
      // Copy hook
      const sourceHook = path.join(TEST_DIR, 'node-1/.claude-code/hooks/track-changes.sh');
      const targetHook = path.join(projectDir, '.claude-code/hooks/track-changes.sh');
      fs.copyFileSync(sourceHook, targetHook);
      
      // Create restricted file
      const restrictedFile = path.join(projectDir, 'restricted.txt');
      fs.writeFileSync(restrictedFile, 'test');
      fs.chmodSync(restrictedFile, 0o000); // No permissions
      
      const env = {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        NODE_ID: 'node-restricted'
      };
      
      // Should handle permission error gracefully
      const output = execSync(`bash ${targetHook} 2>/dev/null || true`, { 
        env, 
        encoding: 'utf-8' 
      });
      
      // Cleanup
      fs.chmodSync(restrictedFile, 0o644);
      execSync(`rm -rf ${projectDir}`);
      
      // Should still return valid JSON
      if (output) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });
});