#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Import test classes
const CanvasPerformanceTestReal = require('./test-performance-canvas-real');
const ConcurrentExecutionLoadTest = require('./test-performance-execution-real');
const WebSocketConnectionTest = require('./test-performance-websocket-real');

class PerformanceTestRunner {
  constructor() {
    this.results = {
      canvas: null,
      execution: null,
      websocket: null,
      summary: {
        totalTests: 3,
        passed: 0,
        failed: 0,
        timestamp: new Date().toISOString()
      }
    };
  }

  async ensureServicesRunning() {
    console.log('🔍 Checking if services are running...\n');
    
    // Check if services are accessible
    const axios = require('axios');
    const services = [
      { name: 'Frontend', url: 'http://localhost:3000', required: true },
      { name: 'Orchestration', url: 'http://localhost:4000/health', required: true }
    ];
    
    let allRunning = true;
    
    for (const service of services) {
      try {
        await axios.get(service.url, { timeout: 5000 });
        console.log(`✅ ${service.name} is running at ${service.url}`);
      } catch (error) {
        console.log(`❌ ${service.name} is not accessible at ${service.url}`);
        if (service.required) {
          allRunning = false;
        }
      }
    }
    
    if (!allRunning) {
      console.log('\n⚠️  Required services are not running!');
      console.log('Please start the services with: npm run dev');
      console.log('Then run this test again.\n');
      process.exit(1);
    }
    
    console.log('\n✅ All required services are running\n');
  }

  async runCanvasPerformanceTest() {
    console.log('=' .repeat(60));
    console.log('🎨 CANVAS PERFORMANCE TEST - 500 NODES');
    console.log('=' .repeat(60));
    
    try {
      const test = new CanvasPerformanceTestReal();
      const result = await test.run();
      this.results.canvas = result;
      
      if (result.passed) {
        this.results.summary.passed++;
        console.log('✅ Canvas performance test PASSED\n');
      } else {
        this.results.summary.failed++;
        console.log('❌ Canvas performance test FAILED\n');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Canvas test error:', error.message);
      this.results.canvas = { passed: false, error: error.message };
      this.results.summary.failed++;
      return null;
    }
  }

  async runExecutionLoadTest() {
    console.log('=' .repeat(60));
    console.log('🚀 CONCURRENT EXECUTION LOAD TEST - 100 EXECUTIONS');
    console.log('=' .repeat(60));
    
    try {
      const test = new ConcurrentExecutionLoadTest();
      const result = await test.run();
      this.results.execution = result;
      
      if (result.passed) {
        this.results.summary.passed++;
        console.log('✅ Execution load test PASSED\n');
      } else {
        this.results.summary.failed++;
        console.log('❌ Execution load test FAILED\n');
      }
      
      return result;
    } catch (error) {
      console.error('❌ Execution test error:', error.message);
      this.results.execution = { passed: false, error: error.message };
      this.results.summary.failed++;
      return null;
    }
  }

  async runWebSocketTest() {
    console.log('=' .repeat(60));
    console.log('🔌 WEBSOCKET CONNECTION TEST - 50 CLIENTS');
    console.log('=' .repeat(60));
    
    try {
      const test = new WebSocketConnectionTest();
      const result = await test.run();
      this.results.websocket = result;
      
      if (result.passed) {
        this.results.summary.passed++;
        console.log('✅ WebSocket connection test PASSED\n');
      } else {
        this.results.summary.failed++;
        console.log('❌ WebSocket connection test FAILED\n');
      }
      
      return result;
    } catch (error) {
      console.error('❌ WebSocket test error:', error.message);
      this.results.websocket = { passed: false, error: error.message };
      this.results.summary.failed++;
      return null;
    }
  }

  async generateFinalReport() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL PERFORMANCE TEST REPORT');
    console.log('=' .repeat(60));
    
    // Prepare comprehensive report
    const report = {
      timestamp: this.results.summary.timestamp,
      testSuite: 'Phase 6 Performance Tests',
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: {
        totalTests: this.results.summary.totalTests,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        successRate: ((this.results.summary.passed / this.results.summary.totalTests) * 100).toFixed(2) + '%'
      },
      tests: {
        canvas: this.results.canvas ? {
          passed: this.results.canvas.passed,
          fps: this.results.canvas.results?.fps || null,
          nodeCount: this.results.canvas.nodeCount || 500,
          error: this.results.canvas.error
        } : null,
        execution: this.results.execution ? {
          passed: this.results.execution.passed,
          successRate: this.results.execution.results?.successRate || null,
          concurrentExecutions: this.results.execution.configuration?.concurrentExecutions || 100,
          error: this.results.execution.error
        } : null,
        websocket: this.results.websocket ? {
          passed: this.results.websocket.passed,
          connectionRate: this.results.websocket.results?.connections?.connectionRate || null,
          concurrentClients: this.results.websocket.configuration?.concurrentClients || 50,
          error: this.results.websocket.error
        } : null
      },
      performanceMetrics: {
        canvasFPS: this.results.canvas?.results?.fps?.average || 0,
        executionSuccessRate: this.results.execution?.results?.successRate || 0,
        websocketCapacity: this.results.websocket?.results?.connections?.successful || 0,
        resourceUtilization: {
          memoryUsageMB: this.results.canvas?.results?.memory?.heapUsedMB || 0
        }
      }
    };
    
    // Display summary
    console.log('\n📈 Test Results Summary:');
    console.log(`  Total Tests: ${report.summary.totalTests}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Success Rate: ${report.summary.successRate}`);
    
    console.log('\n🎯 Key Performance Metrics:');
    
    if (this.results.canvas?.results?.fps) {
      const fpsPassed = this.results.canvas.results.fps.average > 55;
      console.log(`  Canvas FPS: ${fpsPassed ? '✅' : '❌'} ${this.results.canvas.results.fps.average.toFixed(2)} FPS (target: > 55)`);
    }
    
    if (this.results.execution?.results) {
      const execPassed = this.results.execution.results.successRate >= 95;
      console.log(`  Execution Success: ${execPassed ? '✅' : '❌'} ${this.results.execution.results.successRate.toFixed(2)}% (target: >= 95%)`);
    }
    
    if (this.results.websocket?.results?.connections) {
      const wsPassed = this.results.websocket.results.connections.successful === 50;
      console.log(`  WebSocket Clients: ${wsPassed ? '✅' : '❌'} ${this.results.websocket.results.connections.successful}/50 connected`);
    }
    
    // Save final report
    const reportPath = path.join(process.cwd(), 'test-reports', 'phase6-performance.json');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📁 Final report saved to: ${reportPath}`);
    
    // Overall result
    const allPassed = this.results.summary.failed === 0;
    console.log('\n' + '=' .repeat(60));
    if (allPassed) {
      console.log('✅ ALL PERFORMANCE TESTS PASSED!');
    } else {
      console.log('❌ SOME PERFORMANCE TESTS FAILED');
      console.log(`   ${this.results.summary.failed} out of ${this.results.summary.totalTests} tests failed`);
    }
    console.log('=' .repeat(60) + '\n');
    
    return report;
  }

  async run() {
    console.log('\n🚀 ANTON PERFORMANCE TEST SUITE');
    console.log('Phase 6 - Real Performance Testing');
    console.log('=' .repeat(60) + '\n');
    
    try {
      // Check services
      await this.ensureServicesRunning();
      
      // Run tests sequentially to avoid interference
      await this.runCanvasPerformanceTest();
      await this.runExecutionLoadTest();
      await this.runWebSocketTest();
      
      // Generate final report
      const report = await this.generateFinalReport();
      
      // Exit with appropriate code
      process.exit(this.results.summary.failed === 0 ? 0 : 1);
    } catch (error) {
      console.error('❌ Test suite error:', error);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run();
}

module.exports = PerformanceTestRunner;