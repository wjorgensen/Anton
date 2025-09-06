const fs = require('fs');
const path = require('path');
const { ReviewTestHelper, ReviewMetricsCollector } = require('./test-utils');

async function runComprehensiveReviewTests() {
  console.log('🔍 Starting comprehensive review system tests...\n');
  
  const collector = new ReviewMetricsCollector();
  const testResults = {
    checkpointPause: [],
    feedbackProcessing: [],
    retryMechanisms: [],
    concurrentReviews: [],
    timeoutHandling: [],
    overallMetrics: {}
  };

  console.log('📊 Running checkpoint pause tests...');
  
  const checkpointTests = [
    {
      name: 'Basic Review Pause',
      test: async () => {
        const helper = new ReviewTestHelper();
        await helper.initialize();
        
        const startTime = Date.now();
        const project = await helper.createProject({
          name: 'Basic Review Pause Test',
          requiresApproval: true
        });

        let reviewReached = false;
        helper.socket.on('node:review', () => {
          reviewReached = true;
          collector.recordCheckpoint(true);
        });

        await helper.startExecution(project);
        await helper.waitFor(() => reviewReached, 10000);
        
        const deployStatus = await helper.getNodeStatus('deploy');
        const pauseAccurate = deployStatus === 'pending';
        
        const duration = Date.now() - startTime;
        collector.recordReviewDuration(duration);
        
        const metrics = helper.cleanup();
        
        return {
          success: pauseAccurate,
          duration,
          metrics
        };
      }
    },
    {
      name: 'Multiple Sequential Reviews',
      test: async () => {
        const helper = new ReviewTestHelper();
        await helper.initialize();
        
        const flow = {
          nodes: [
            { id: 'dev1', agentId: 'react-developer' },
            { id: 'review1', agentId: 'manual-review', type: 'review', requiresReview: true },
            { id: 'dev2', agentId: 'react-developer' },
            { id: 'review2', agentId: 'manual-review', type: 'review', requiresReview: true },
            { id: 'deploy', agentId: 'deployment' }
          ],
          edges: [
            { source: 'dev1', target: 'review1' },
            { source: 'review1', target: 'dev2' },
            { source: 'dev2', target: 'review2' },
            { source: 'review2', target: 'deploy' }
          ]
        };

        const project = await helper.createProject({
          name: 'Sequential Reviews Test',
          customFlow: flow
        });

        const reviewsReached = [];
        helper.socket.on('node:review', (data) => {
          reviewsReached.push(data.nodeId);
        });

        helper.socket.on('node:review', async (data) => {
          await helper.submitFeedback(data.nodeId, {
            approved: true,
            feedback: `Approved ${data.nodeId}`
          });
        });

        await helper.startExecution(project);
        await helper.waitFor(() => reviewsReached.length >= 2, 15000);
        
        const metrics = helper.cleanup();
        
        return {
          success: reviewsReached.length === 2,
          reviewsCount: reviewsReached.length,
          metrics
        };
      }
    }
  ];

  for (const test of checkpointTests) {
    try {
      console.log(`  ▶ ${test.name}`);
      const result = await test.test();
      testResults.checkpointPause.push({
        name: test.name,
        ...result
      });
      console.log(`    ✅ ${test.name}: ${result.success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.log(`    ❌ ${test.name}: ERROR - ${error.message}`);
      testResults.checkpointPause.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n📝 Running feedback processing tests...');
  
  const feedbackTests = [
    {
      name: 'Retry with Feedback',
      test: async () => {
        const helper = new ReviewTestHelper();
        await helper.initialize();
        
        const project = await helper.createProject({
          name: 'Retry Feedback Test',
          maxRetries: 3
        });

        let retryCount = 0;
        let feedbackProcessed = false;
        
        helper.socket.on('node:retry', () => {
          retryCount++;
          collector.recordRetrySuccess(true);
        });

        helper.socket.on('node:review', async (data) => {
          const startTime = Date.now();
          
          await helper.submitFeedback(data.nodeId, {
            approved: retryCount >= 2,
            feedback: retryCount < 2 ? 'Please add error handling' : 'Looks good now',
            actionItems: retryCount < 2 ? ['Add try-catch blocks'] : []
          });
          
          const processingTime = Date.now() - startTime;
          collector.recordFeedbackProcessing(processingTime);
          feedbackProcessed = true;
        });

        await helper.startExecution(project);
        await helper.waitFor(() => retryCount >= 2 || feedbackProcessed, 20000);
        
        const metrics = helper.cleanup();
        
        return {
          success: retryCount >= 2,
          retryCount,
          metrics
        };
      }
    },
    {
      name: 'Approval Flow',
      test: async () => {
        const helper = new ReviewTestHelper();
        await helper.initialize();
        
        const project = await helper.createProject({
          name: 'Approval Flow Test'
        });

        let deployStarted = false;
        
        helper.socket.on('node:review', async (data) => {
          await helper.submitFeedback(data.nodeId, {
            approved: true,
            feedback: 'Approved for deployment'
          });
          collector.recordApproval(true);
        });

        helper.socket.on('node:start', (data) => {
          if (data.nodeId === 'deploy') {
            deployStarted = true;
          }
        });

        await helper.startExecution(project);
        await helper.waitFor(() => deployStarted, 15000);
        
        const metrics = helper.cleanup();
        
        return {
          success: deployStarted,
          metrics
        };
      }
    },
    {
      name: 'Rejection Flow',
      test: async () => {
        const helper = new ReviewTestHelper();
        await helper.initialize();
        
        const project = await helper.createProject({
          name: 'Rejection Flow Test'
        });

        let flowAborted = false;
        
        helper.socket.on('node:review', async (data) => {
          await helper.submitFeedback(data.nodeId, {
            approved: false,
            decision: 'reject',
            feedback: 'Critical issues found',
            severity: 'error'
          });
          collector.recordApproval(false);
        });

        helper.socket.on('flow:aborted', () => {
          flowAborted = true;
        });

        helper.socket.on('flow:error', () => {
          flowAborted = true;
        });

        await helper.startExecution(project);
        await helper.waitFor(() => flowAborted, 10000);
        
        const metrics = helper.cleanup();
        
        return {
          success: flowAborted,
          metrics
        };
      }
    }
  ];

  for (const test of feedbackTests) {
    try {
      console.log(`  ▶ ${test.name}`);
      const result = await test.test();
      testResults.feedbackProcessing.push({
        name: test.name,
        ...result
      });
      console.log(`    ✅ ${test.name}: ${result.success ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
      console.log(`    ❌ ${test.name}: ERROR - ${error.message}`);
      testResults.feedbackProcessing.push({
        name: test.name,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n⏱️ Running timeout handling tests...');
  
  const timeoutTest = async () => {
    const helper = new ReviewTestHelper();
    await helper.initialize();
    
    const project = await helper.createProject({
      name: 'Timeout Test',
      reviewTimeout: 3000,
      requiresApproval: false
    });

    let timedOut = false;
    
    helper.socket.on('review:timeout', () => {
      timedOut = true;
      collector.recordTimeout(true);
    });

    helper.socket.on('review:cancelled', (data) => {
      if (data.reason === 'timeout') {
        timedOut = true;
        collector.recordTimeout(true);
      }
    });

    await helper.startExecution(project);
    await helper.waitFor(() => timedOut, 5000);
    
    const metrics = helper.cleanup();
    
    return {
      success: timedOut,
      metrics
    };
  };

  try {
    console.log('  ▶ Review Timeout Handling');
    const result = await timeoutTest();
    testResults.timeoutHandling.push({
      name: 'Review Timeout',
      ...result
    });
    console.log(`    ✅ Timeout Handling: ${result.success ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.log(`    ❌ Timeout Handling: ERROR - ${error.message}`);
    testResults.timeoutHandling.push({
      name: 'Review Timeout',
      success: false,
      error: error.message
    });
  }

  console.log('\n🔀 Running concurrent review tests...');
  
  const concurrentTest = async () => {
    const helper = new ReviewTestHelper();
    await helper.initialize();
    
    const flow = {
      nodes: [
        { id: 'start', agentId: 'start' },
        { id: 'branch1', agentId: 'react-developer' },
        { id: 'branch2', agentId: 'vue-developer' },
        { id: 'review1', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'review2', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'merge', agentId: 'merge' }
      ],
      edges: [
        { source: 'start', target: 'branch1' },
        { source: 'start', target: 'branch2' },
        { source: 'branch1', target: 'review1' },
        { source: 'branch2', target: 'review2' },
        { source: 'review1', target: 'merge' },
        { source: 'review2', target: 'merge' }
      ]
    };

    const project = await helper.createProject({
      name: 'Concurrent Reviews Test',
      customFlow: flow
    });

    const activeReviews = new Set();
    
    helper.socket.on('node:review', (data) => {
      activeReviews.add(data.nodeId);
    });

    helper.socket.on('node:review', async (data) => {
      await helper.submitFeedback(data.nodeId, {
        approved: true,
        feedback: `Approved ${data.nodeId}`
      });
    });

    await helper.startExecution(project);
    await helper.waitFor(() => activeReviews.size >= 2, 15000);
    
    const metrics = helper.cleanup();
    
    return {
      success: activeReviews.size === 2,
      concurrentCount: activeReviews.size,
      metrics
    };
  };

  try {
    console.log('  ▶ Concurrent Reviews');
    const result = await concurrentTest();
    testResults.concurrentReviews.push({
      name: 'Parallel Branch Reviews',
      ...result
    });
    console.log(`    ✅ Concurrent Reviews: ${result.success ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.log(`    ❌ Concurrent Reviews: ERROR - ${error.message}`);
    testResults.concurrentReviews.push({
      name: 'Parallel Branch Reviews',
      success: false,
      error: error.message
    });
  }

  const overallStats = collector.calculateStatistics();
  testResults.overallMetrics = {
    ...overallStats,
    summary: collector.generateReport().summary
  };

  console.log('\n📈 Overall Metrics:');
  console.log(`  • Checkpoint Accuracy: ${overallStats.checkpointAccuracy.rate * 100}%`);
  console.log(`  • Avg Feedback Processing: ${overallStats.feedbackProcessing.avg}ms`);
  console.log(`  • Retry Success Rate: ${overallStats.retrySuccess.rate * 100}%`);
  console.log(`  • Avg Review Duration: ${overallStats.reviewDuration.avg}ms`);
  console.log(`  • Timeout Rate: ${overallStats.timeoutRate.rate * 100}%`);
  console.log(`  • Approval Rate: ${overallStats.approvalRate.rate * 100}%`);

  return testResults;
}

async function generateReport() {
  try {
    const results = await runComprehensiveReviewTests();
    
    const totalTests = 
      results.checkpointPause.length +
      results.feedbackProcessing.length +
      results.timeoutHandling.length +
      results.concurrentReviews.length;
    
    const passedTests = [
      ...results.checkpointPause,
      ...results.feedbackProcessing,
      ...results.timeoutHandling,
      ...results.concurrentReviews
    ].filter(t => t.success).length;

    const report = {
      phase: 'Phase 5 - Review System',
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: `${(passedTests / totalTests * 100).toFixed(1)}%`
      },
      categories: {
        checkpointPause: {
          total: results.checkpointPause.length,
          passed: results.checkpointPause.filter(t => t.success).length,
          tests: results.checkpointPause
        },
        feedbackProcessing: {
          total: results.feedbackProcessing.length,
          passed: results.feedbackProcessing.filter(t => t.success).length,
          tests: results.feedbackProcessing
        },
        timeoutHandling: {
          total: results.timeoutHandling.length,
          passed: results.timeoutHandling.filter(t => t.success).length,
          tests: results.timeoutHandling
        },
        concurrentReviews: {
          total: results.concurrentReviews.length,
          passed: results.concurrentReviews.filter(t => t.success).length,
          tests: results.concurrentReviews
        }
      },
      metrics: results.overallMetrics,
      performance: {
        checkpointAccuracy: results.overallMetrics.summary.checkpointAccuracy,
        feedbackProcessingTime: results.overallMetrics.summary.avgFeedbackTime,
        retrySuccessRate: results.overallMetrics.summary.retrySuccessRate,
        avgReviewDuration: results.overallMetrics.summary.avgReviewDuration,
        timeoutRate: results.overallMetrics.summary.timeoutRate,
        approvalRate: results.overallMetrics.summary.approvalRate
      }
    };

    const reportDir = path.join(__dirname, '../../test-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'phase5-review.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Report generated: ${reportPath}`);
    console.log('\n📋 Test Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${totalTests - passedTests}`);
    console.log(`  Success Rate: ${(passedTests / totalTests * 100).toFixed(1)}%`);

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  generateReport();
}

module.exports = { generateReport };