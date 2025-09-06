/**
 * Integration Test: Claude Code Hook System
 * Tests communication between Claude instances and the orchestrator
 */

const axios = require('axios');
const WebSocket = require('ws');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const API_URL = 'http://localhost:3002';
const WS_URL = 'ws://localhost:3002';

class HookIntegrationTest {
  constructor() {
    this.ws = null;
    this.receivedMessages = [];
  }

  // Connect to WebSocket for real-time updates
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.receivedMessages.push(message);
        console.log('📨 Received WebSocket message:', message.type);
      });
      
      this.ws.on('error', reject);
    });
  }

  // Test: Stop Hook
  async testStopHook() {
    console.log('\n🧪 Testing Stop Hook...');
    
    const nodeId = 'test-node-stop-' + Date.now();
    const executionId = 'exec-' + Date.now();
    
    // Simulate stop hook call
    const stopHookData = {
      nodeId,
      executionId,
      status: 'success',
      output: {
        files: ['src/index.js', 'src/utils.js'],
        metrics: {
          duration: 2500,
          tokensUsed: 3500,
          filesModified: 2
        },
        logs: ['Setup completed', 'Dependencies installed']
      },
      timestamp: Date.now()
    };

    try {
      const response = await axios.post(`${API_URL}/api/agent-complete`, stopHookData);
      
      console.log('✅ Stop hook sent successfully');
      console.log('   Response:', response.data);
      
      // Verify state was updated
      await this.verifyStateUpdate(nodeId, 'completed');
      
      return { success: true, nodeId };
    } catch (error) {
      console.error('❌ Stop hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Track Changes Hook
  async testTrackChangesHook() {
    console.log('\n🧪 Testing Track Changes Hook...');
    
    const nodeId = 'test-node-track-' + Date.now();
    
    const trackData = {
      nodeId,
      tool: 'Write',
      file: 'src/app.js',
      action: 'created',
      content: 'console.log("Hello World");',
      timestamp: Date.now()
    };

    try {
      const response = await axios.post(`${API_URL}/api/track-changes`, trackData);
      
      console.log('✅ Track changes hook sent successfully');
      
      // Verify file tracking
      const tracked = await axios.get(`${API_URL}/api/nodes/${nodeId}/files`);
      console.log('   Tracked files:', tracked.data.files);
      
      return { success: true, files: tracked.data.files };
    } catch (error) {
      console.error('❌ Track changes hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Subagent Complete Hook
  async testSubagentCompleteHook() {
    console.log('\n🧪 Testing Subagent Complete Hook...');
    
    const parentNodeId = 'parent-node-' + Date.now();
    const subagentId = 'subagent-' + Date.now();
    
    const subagentData = {
      parentNodeId,
      subagentId,
      status: 'success',
      output: {
        result: 'Subagent task completed',
        data: { processed: 10, failed: 0 }
      },
      timestamp: Date.now()
    };

    try {
      const response = await axios.post(`${API_URL}/api/subagent-complete`, subagentData);
      
      console.log('✅ Subagent complete hook sent successfully');
      console.log('   Parent notified:', response.data.parentNotified);
      
      return { success: true, parentNodeId };
    } catch (error) {
      console.error('❌ Subagent complete hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Review Feedback Hook
  async testReviewFeedbackHook() {
    console.log('\n🧪 Testing Review Feedback Hook...');
    
    const nodeId = 'review-node-' + Date.now();
    
    const feedbackData = {
      nodeId,
      action: 'request_changes',
      feedback: {
        comments: ['Add error handling', 'Improve variable naming'],
        files: {
          'src/app.js': {
            line: 42,
            comment: 'This needs try-catch'
          }
        }
      },
      reviewer: 'test-user',
      timestamp: Date.now()
    };

    try {
      const response = await axios.post(`${API_URL}/api/review-feedback`, feedbackData);
      
      console.log('✅ Review feedback hook sent successfully');
      console.log('   Feedback processed:', response.data.processed);
      
      return { success: true, nodeId };
    } catch (error) {
      console.error('❌ Review feedback hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Error Hook
  async testErrorHook() {
    console.log('\n🧪 Testing Error Hook...');
    
    const nodeId = 'error-node-' + Date.now();
    
    const errorData = {
      nodeId,
      status: 'error',
      error: {
        message: 'Test execution failed',
        stack: 'Error: Test execution failed\n    at testFunction (test.js:10:5)',
        type: 'TestError',
        code: 'TEST_FAILED'
      },
      timestamp: Date.now()
    };

    try {
      const response = await axios.post(`${API_URL}/api/agent-complete`, errorData);
      
      console.log('✅ Error hook sent successfully');
      
      // Verify error state
      await this.verifyStateUpdate(nodeId, 'failed');
      
      // Check if retry is scheduled
      const retryStatus = await axios.get(`${API_URL}/api/nodes/${nodeId}/retry-status`);
      console.log('   Retry scheduled:', retryStatus.data.scheduled);
      
      return { success: true, nodeId };
    } catch (error) {
      console.error('❌ Error hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Progress Hook (for long-running operations)
  async testProgressHook() {
    console.log('\n🧪 Testing Progress Hook...');
    
    const nodeId = 'progress-node-' + Date.now();
    
    // Simulate progress updates
    const progressUpdates = [
      { progress: 0, message: 'Starting installation...' },
      { progress: 25, message: 'Installing dependencies...' },
      { progress: 50, message: 'Building application...' },
      { progress: 75, message: 'Running tests...' },
      { progress: 100, message: 'Complete!' }
    ];

    try {
      for (const update of progressUpdates) {
        const progressData = {
          nodeId,
          progress: update.progress,
          message: update.message,
          timestamp: Date.now()
        };
        
        await axios.post(`${API_URL}/api/progress-update`, progressData);
        console.log(`   Progress: ${update.progress}% - ${update.message}`);
        
        // Small delay to simulate real progress
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('✅ Progress hooks sent successfully');
      
      return { success: true, nodeId };
    } catch (error) {
      console.error('❌ Progress hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Parallel Hook Processing
  async testParallelHooks() {
    console.log('\n🧪 Testing Parallel Hook Processing...');
    
    const nodeIds = Array.from({ length: 5 }, (_, i) => `parallel-node-${i}-${Date.now()}`);
    
    try {
      // Send multiple hooks simultaneously
      const promises = nodeIds.map((nodeId, index) => 
        axios.post(`${API_URL}/api/agent-complete`, {
          nodeId,
          status: 'success',
          output: { result: `Task ${index} completed` },
          timestamp: Date.now()
        })
      );
      
      const results = await Promise.all(promises);
      
      console.log(`✅ Processed ${results.length} hooks in parallel`);
      
      // Verify all nodes updated
      for (const nodeId of nodeIds) {
        await this.verifyStateUpdate(nodeId, 'completed');
      }
      
      return { success: true, processedCount: results.length };
    } catch (error) {
      console.error('❌ Parallel hooks failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test: Hook with Large Payload
  async testLargePayloadHook() {
    console.log('\n🧪 Testing Large Payload Hook...');
    
    const nodeId = 'large-payload-node-' + Date.now();
    
    // Create a large output (simulating many files/logs)
    const largeOutput = {
      files: Array.from({ length: 100 }, (_, i) => `file${i}.js`),
      logs: Array.from({ length: 1000 }, (_, i) => `Log line ${i}: Processing...`),
      metrics: {
        duration: 45000,
        tokensUsed: 150000,
        filesModified: 100,
        testsRun: 500,
        testsPassed: 495
      }
    };
    
    const hookData = {
      nodeId,
      status: 'success',
      output: largeOutput,
      timestamp: Date.now()
    };

    try {
      const startTime = Date.now();
      const response = await axios.post(`${API_URL}/api/agent-complete`, hookData);
      const duration = Date.now() - startTime;
      
      console.log('✅ Large payload hook sent successfully');
      console.log(`   Processing time: ${duration}ms`);
      console.log(`   Payload size: ${JSON.stringify(hookData).length} bytes`);
      
      return { success: true, duration, size: JSON.stringify(hookData).length };
    } catch (error) {
      console.error('❌ Large payload hook failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Helper: Verify state update
  async verifyStateUpdate(nodeId, expectedStatus) {
    try {
      const response = await axios.get(`${API_URL}/api/nodes/${nodeId}/status`);
      if (response.data.status === expectedStatus) {
        console.log(`   ✓ Node ${nodeId} status: ${expectedStatus}`);
        return true;
      } else {
        console.log(`   ✗ Node ${nodeId} status: ${response.data.status} (expected: ${expectedStatus})`);
        return false;
      }
    } catch (error) {
      console.log(`   ✗ Failed to verify node ${nodeId}: ${error.message}`);
      return false;
    }
  }

  // Run all tests
  async runAll() {
    console.log('🚀 Starting Hook Integration Tests');
    console.log('=' .repeat(50));
    
    const results = [];
    
    // Connect WebSocket
    try {
      await this.connectWebSocket();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error.message);
    }
    
    // Run each test
    const tests = [
      { name: 'Stop Hook', fn: () => this.testStopHook() },
      { name: 'Track Changes Hook', fn: () => this.testTrackChangesHook() },
      { name: 'Subagent Complete Hook', fn: () => this.testSubagentCompleteHook() },
      { name: 'Review Feedback Hook', fn: () => this.testReviewFeedbackHook() },
      { name: 'Error Hook', fn: () => this.testErrorHook() },
      { name: 'Progress Hook', fn: () => this.testProgressHook() },
      { name: 'Parallel Hooks', fn: () => this.testParallelHooks() },
      { name: 'Large Payload Hook', fn: () => this.testLargePayloadHook() }
    ];
    
    for (const test of tests) {
      const result = await test.fn();
      results.push({
        name: test.name,
        ...result
      });
    }
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
    }
    
    // Print summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary:');
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📨 WebSocket messages received: ${this.receivedMessages.length}`);
    console.log('=' .repeat(50));
    
    return {
      passed,
      failed,
      total: results.length,
      results
    };
  }
}

// Run tests if executed directly
if (require.main === module) {
  const test = new HookIntegrationTest();
  test.runAll().then(summary => {
    process.exit(summary.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = HookIntegrationTest;