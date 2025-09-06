#!/usr/bin/env node

/**
 * E2E Test: Manual Review Checkpoint Functionality
 * Comprehensive test suite for review nodes in the orchestration flow
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class ReviewCheckpointE2ETest {
  constructor(config = {}) {
    this.config = {
      baseURL: config.baseURL || 'http://localhost:3000',
      apiURL: config.apiURL || 'http://localhost:3002',
      headless: config.headless ?? false,
      slowMo: config.slowMo || 100,
      timeout: config.timeout || 30000,
      screenshotDir: path.join(__dirname, 'screenshots', 'review')
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = [];
    
    // Ensure screenshot directory exists
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  async setup() {
    console.log('🚀 Setting up test environment...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: path.join(this.config.screenshotDir, 'videos'),
        size: { width: 1920, height: 1080 }
      }
    });
    
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.config.timeout);
    
    // Set up request interception for API monitoring
    this.page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📡 API Request: ${request.method()} ${request.url()}`);
      }
    });
    
    this.page.on('response', response => {
      if (response.url().includes('/api/') && response.status() !== 200) {
        console.log(`⚠️ API Response: ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('✅ Test environment ready');
  }

  async teardown() {
    console.log('🧹 Cleaning up test environment...');
    
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    
    console.log('✅ Cleanup complete');
  }

  async takeScreenshot(name) {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  async waitForReview(timeout = 30000) {
    console.log('⏳ Waiting for review checkpoint...');
    
    try {
      await this.page.waitForSelector('.review-checkpoint-notification', {
        timeout,
        state: 'visible'
      });
      console.log('✅ Review checkpoint reached');
      return true;
    } catch (error) {
      console.error('❌ Review checkpoint not reached within timeout');
      return false;
    }
  }

  /**
   * Test 1: Setup Review Flow
   */
  async test1_SetupReviewFlow() {
    console.log('\n📝 Test 1: Setup Review Flow');
    console.log('=' + '='.repeat(49));
    
    try {
      // Navigate to application
      await this.page.goto(this.config.baseURL);
      await this.takeScreenshot('01-homepage');
      
      // Create new project with review checkpoint
      await this.page.click('[data-testid="new-project"]');
      await this.page.waitForSelector('.project-modal', { state: 'visible' });
      
      // Fill project details
      await this.page.fill('[data-testid="project-name"]', 'Review Test Project');
      await this.page.fill('[data-testid="project-description"]', 
        'Build a REST API with authentication and manual review checkpoint');
      
      // Add review configuration
      await this.page.click('[data-testid="add-review-checkpoint"]');
      await this.page.check('[data-testid="review-after-development"]');
      await this.page.check('[data-testid="review-before-deployment"]');
      
      await this.takeScreenshot('02-project-config');
      
      // Generate flow
      await this.page.click('[data-testid="generate-flow"]');
      await this.page.waitForSelector('.flow-canvas', { timeout: 10000 });
      
      // Verify review node exists
      const reviewNode = await this.page.locator('.flow-node[data-type="review"]').count();
      if (reviewNode === 0) {
        throw new Error('Review node not created in flow');
      }
      
      await this.takeScreenshot('03-flow-with-review');
      
      // Start execution
      await this.page.click('[data-testid="execute-flow"]');
      await this.page.waitForSelector('.execution-status.running', { timeout: 5000 });
      
      console.log('✅ Review flow setup successful');
      
      this.testResults.push({
        name: 'Setup Review Flow',
        status: 'passed',
        duration: Date.now() - startTime
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('01-error');
      
      this.testResults.push({
        name: 'Setup Review Flow',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 2: Review Interface
   */
  async test2_ReviewInterface() {
    console.log('\n📝 Test 2: Review Interface');
    console.log('=' + '='.repeat(49));
    
    try {
      // Wait for review checkpoint
      const reviewReached = await this.waitForReview();
      if (!reviewReached) {
        throw new Error('Review checkpoint not reached');
      }
      
      await this.takeScreenshot('04-review-notification');
      
      // Open review interface
      await this.page.click('[data-testid="open-review"]');
      await this.page.waitForSelector('.review-interface', { state: 'visible' });
      
      // Verify interface elements
      const elements = [
        { selector: '.code-diff-viewer', name: 'Code diff viewer' },
        { selector: '.file-browser', name: 'File browser' },
        { selector: '.preview-pane', name: 'Live preview' },
        { selector: '.comment-section', name: 'Comment section' },
        { selector: '.review-actions', name: 'Review actions' }
      ];
      
      for (const element of elements) {
        const isVisible = await this.page.isVisible(element.selector);
        if (!isVisible) {
          throw new Error(`${element.name} not visible`);
        }
        console.log(`  ✓ ${element.name} present`);
      }
      
      // Test file browser
      await this.page.click('.file-browser .file-item:first-child');
      await this.page.waitForSelector('.code-diff-viewer .diff-content', { state: 'visible' });
      
      // Test inline comments
      const diffLine = await this.page.locator('.diff-line').first();
      await diffLine.hover();
      await this.page.click('.add-comment-icon');
      await this.page.fill('.inline-comment-input', 'Consider adding error handling here');
      await this.page.click('[data-testid="save-comment"]');
      
      await this.takeScreenshot('05-review-interface');
      
      // Verify comment saved
      const comment = await this.page.locator('.inline-comment:has-text("error handling")').count();
      if (comment === 0) {
        throw new Error('Inline comment not saved');
      }
      
      console.log('✅ Review interface test passed');
      
      this.testResults.push({
        name: 'Review Interface',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('02-error');
      
      this.testResults.push({
        name: 'Review Interface',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 3a: Approval Flow
   */
  async test3a_ApprovalFlow() {
    console.log('\n📝 Test 3a: Approval Flow');
    console.log('=' + '='.repeat(49));
    
    try {
      // Add approval comment
      await this.page.fill('[data-testid="review-comment"]', 
        'Looks good! Code is clean and follows best practices.');
      
      // Select approval criteria
      await this.page.check('[data-testid="criteria-code-quality"]');
      await this.page.check('[data-testid="criteria-security"]');
      await this.page.check('[data-testid="criteria-performance"]');
      
      await this.takeScreenshot('06-approval-ready');
      
      // Click approve
      await this.page.click('[data-testid="approve-review"]');
      
      // Confirm approval
      await this.page.waitForSelector('.approval-confirmation', { state: 'visible' });
      await this.page.click('[data-testid="confirm-approval"]');
      
      // Verify execution continues
      await this.page.waitForSelector('.review-status.approved', { timeout: 5000 });
      await this.page.waitForSelector('.next-node.status-running', { timeout: 10000 });
      
      await this.takeScreenshot('07-approval-complete');
      
      // Check approval in history
      await this.page.click('[data-testid="review-history"]');
      const approvalEntry = await this.page.locator('.history-entry:has-text("Approved")').count();
      if (approvalEntry === 0) {
        throw new Error('Approval not recorded in history');
      }
      
      console.log('✅ Approval flow test passed');
      
      this.testResults.push({
        name: 'Approval Flow',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('03a-error');
      
      this.testResults.push({
        name: 'Approval Flow',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 3b: Request Changes Flow
   */
  async test3b_RequestChangesFlow() {
    console.log('\n📝 Test 3b: Request Changes Flow');
    console.log('=' + '='.repeat(49));
    
    try {
      // Reset to new review scenario
      await this.page.click('[data-testid="new-test-scenario"]');
      await this.waitForReview();
      await this.page.click('[data-testid="open-review"]');
      
      // Add feedback for changes
      const feedback = [
        'Add input validation for user data',
        'Implement rate limiting on API endpoints',
        'Add comprehensive error handling',
        'Include unit tests for new functions'
      ];
      
      for (const item of feedback) {
        await this.page.click('[data-testid="add-feedback-item"]');
        await this.page.fill('.feedback-input:last-child', item);
      }
      
      // Add general comment
      await this.page.fill('[data-testid="review-comment"]', 
        'Good progress, but needs improvements in security and testing.');
      
      await this.takeScreenshot('08-request-changes');
      
      // Request changes
      await this.page.click('[data-testid="request-changes"]');
      await this.page.waitForSelector('.changes-confirmation', { state: 'visible' });
      await this.page.click('[data-testid="confirm-changes"]');
      
      // Verify node enters revision state
      await this.page.waitForSelector('.review-node.status-revising', { timeout: 5000 });
      
      // Monitor agent addressing feedback
      await this.page.waitForSelector('.revision-progress', { state: 'visible' });
      
      // Wait for revision completion
      await this.page.waitForSelector('.revision-complete', { timeout: 30000 });
      
      await this.takeScreenshot('09-revisions-complete');
      
      // Verify changes applied
      await this.page.click('[data-testid="view-changes"]');
      const changesApplied = await this.page.locator('.change-item.applied').count();
      if (changesApplied < feedback.length) {
        throw new Error('Not all requested changes were applied');
      }
      
      // Re-review and approve
      await this.page.click('[data-testid="approve-review"]');
      await this.page.click('[data-testid="confirm-approval"]');
      
      console.log('✅ Request changes flow test passed');
      
      this.testResults.push({
        name: 'Request Changes Flow',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('03b-error');
      
      this.testResults.push({
        name: 'Request Changes Flow',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 3c: Rejection Flow
   */
  async test3c_RejectionFlow() {
    console.log('\n📝 Test 3c: Rejection Flow');
    console.log('=' + '='.repeat(49));
    
    try {
      // Reset to new review scenario
      await this.page.click('[data-testid="new-test-scenario"]');
      await this.waitForReview();
      await this.page.click('[data-testid="open-review"]');
      
      // Add rejection reasons
      await this.page.fill('[data-testid="review-comment"]', 
        'Critical security vulnerabilities found. Complete redesign needed.');
      
      // Select rejection criteria
      await this.page.check('[data-testid="reject-security-issues"]');
      await this.page.check('[data-testid="reject-architecture-flaws"]');
      
      await this.takeScreenshot('10-rejection-ready');
      
      // Click reject
      await this.page.click('[data-testid="reject-review"]');
      
      // Confirm rejection
      await this.page.waitForSelector('.rejection-confirmation', { state: 'visible' });
      await this.page.fill('[data-testid="rejection-reason"]', 
        'The implementation has fundamental flaws that require a complete rewrite.');
      await this.page.click('[data-testid="confirm-rejection"]');
      
      // Verify flow stops
      await this.page.waitForSelector('.review-status.rejected', { timeout: 5000 });
      await this.page.waitForSelector('.flow-status.stopped', { timeout: 5000 });
      
      await this.takeScreenshot('11-rejection-complete');
      
      // Verify error state
      const errorState = await this.page.locator('.flow-error:has-text("rejected")').count();
      if (errorState === 0) {
        throw new Error('Flow did not enter error state after rejection');
      }
      
      // Check rejection in history
      await this.page.click('[data-testid="review-history"]');
      const rejectionEntry = await this.page.locator('.history-entry.rejection').count();
      if (rejectionEntry === 0) {
        throw new Error('Rejection not recorded in history');
      }
      
      console.log('✅ Rejection flow test passed');
      
      this.testResults.push({
        name: 'Rejection Flow',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('03c-error');
      
      this.testResults.push({
        name: 'Rejection Flow',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 4: Multiple Review Iterations
   */
  async test4_MultipleIterations() {
    console.log('\n📝 Test 4: Multiple Review Iterations');
    console.log('=' + '='.repeat(49));
    
    try {
      // Setup flow with iteration limit
      await this.page.goto(this.config.baseURL);
      await this.page.click('[data-testid="new-project"]');
      await this.page.fill('[data-testid="project-name"]', 'Iteration Test');
      await this.page.fill('[data-testid="max-iterations"]', '3');
      await this.page.click('[data-testid="generate-flow"]');
      await this.page.click('[data-testid="execute-flow"]');
      
      let iteration = 1;
      const maxIterations = 3;
      
      while (iteration <= maxIterations) {
        console.log(`  📍 Iteration ${iteration}/${maxIterations}`);
        
        // Wait for review
        await this.waitForReview();
        await this.page.click('[data-testid="open-review"]');
        
        if (iteration < maxIterations) {
          // Request changes
          await this.page.fill('[data-testid="review-comment"]', 
            `Iteration ${iteration}: Minor improvements needed`);
          await this.page.click('[data-testid="request-changes"]');
          await this.page.click('[data-testid="confirm-changes"]');
          
          // Wait for revision
          await this.page.waitForSelector('.revision-complete', { timeout: 30000 });
          
          // Verify iteration count
          const iterationCount = await this.page.locator('.iteration-counter').textContent();
          if (!iterationCount.includes(`${iteration}/${maxIterations}`)) {
            throw new Error('Iteration counter not updating correctly');
          }
        } else {
          // Final approval
          await this.page.fill('[data-testid="review-comment"]', 'All issues resolved');
          await this.page.click('[data-testid="approve-review"]');
          await this.page.click('[data-testid="confirm-approval"]');
        }
        
        iteration++;
      }
      
      await this.takeScreenshot('12-iterations-complete');
      
      // Verify max iterations enforcement
      if (iteration > maxIterations) {
        const limitReached = await this.page.locator('.max-iterations-reached').count();
        if (limitReached === 0) {
          throw new Error('Max iterations not enforced');
        }
      }
      
      console.log('✅ Multiple iterations test passed');
      
      this.testResults.push({
        name: 'Multiple Iterations',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('04-error');
      
      this.testResults.push({
        name: 'Multiple Iterations',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Test 5: Concurrent Reviews
   */
  async test5_ConcurrentReviews() {
    console.log('\n📝 Test 5: Concurrent Reviews');
    console.log('=' + '='.repeat(49));
    
    try {
      // Create flow with parallel branches requiring review
      await this.page.goto(this.config.baseURL);
      await this.page.click('[data-testid="new-project"]');
      await this.page.fill('[data-testid="project-name"]', 'Concurrent Review Test');
      await this.page.click('[data-testid="parallel-flow"]');
      await this.page.click('[data-testid="add-review-all-branches"]');
      await this.page.click('[data-testid="generate-flow"]');
      await this.page.click('[data-testid="execute-flow"]');
      
      // Wait for multiple review notifications
      await this.page.waitForSelector('.review-notification.branch-1', { timeout: 30000 });
      await this.page.waitForSelector('.review-notification.branch-2', { timeout: 30000 });
      
      await this.takeScreenshot('13-concurrent-reviews');
      
      // Open review dashboard
      await this.page.click('[data-testid="review-dashboard"]');
      
      // Verify multiple reviews pending
      const pendingReviews = await this.page.locator('.pending-review').count();
      if (pendingReviews < 2) {
        throw new Error('Expected at least 2 concurrent reviews');
      }
      
      // Review first branch
      await this.page.click('.pending-review:first-child [data-testid="review-now"]');
      await this.page.fill('[data-testid="review-comment"]', 'Branch 1 approved');
      await this.page.click('[data-testid="approve-review"]');
      await this.page.click('[data-testid="confirm-approval"]');
      
      // Review second branch
      await this.page.click('[data-testid="review-dashboard"]');
      await this.page.click('.pending-review:first-child [data-testid="review-now"]');
      await this.page.fill('[data-testid="review-comment"]', 'Branch 2 needs changes');
      await this.page.click('[data-testid="request-changes"]');
      await this.page.click('[data-testid="confirm-changes"]');
      
      // Verify independent handling
      const branch1Status = await this.page.locator('.branch-1.approved').count();
      const branch2Status = await this.page.locator('.branch-2.revising').count();
      
      if (branch1Status === 0 || branch2Status === 0) {
        throw new Error('Branches not handled independently');
      }
      
      await this.takeScreenshot('14-concurrent-handled');
      
      console.log('✅ Concurrent reviews test passed');
      
      this.testResults.push({
        name: 'Concurrent Reviews',
        status: 'passed'
      });
      
      return true;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.takeScreenshot('05-error');
      
      this.testResults.push({
        name: 'Concurrent Reviews',
        status: 'failed',
        error: error.message
      });
      
      return false;
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST REPORT');
    console.log('='.repeat(50));
    
    const total = this.testResults.length;
    const passed = this.testResults.filter(t => t.status === 'passed').length;
    const failed = this.testResults.filter(t => t.status === 'failed').length;
    
    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    console.log('\nTest Details:');
    this.testResults.forEach((test, index) => {
      const icon = test.status === 'passed' ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${test.name}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });
    
    // Save report to file
    const reportPath = path.join(this.config.screenshotDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.testResults,
      summary: { total, passed, failed }
    }, null, 2));
    
    console.log(`\n📁 Report saved to: ${reportPath}`);
    console.log(`📸 Screenshots saved to: ${this.config.screenshotDir}`);
    
    return { total, passed, failed };
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('\n🔍 Manual Review Checkpoint E2E Test Suite');
    console.log('=' + '='.repeat(49));
    console.log(`Base URL: ${this.config.baseURL}`);
    console.log(`API URL: ${this.config.apiURL}`);
    console.log(`Headless: ${this.config.headless}`);
    console.log('=' + '='.repeat(49));
    
    try {
      await this.setup();
      
      // Run tests in sequence
      await this.test1_SetupReviewFlow();
      await this.test2_ReviewInterface();
      await this.test3a_ApprovalFlow();
      await this.test3b_RequestChangesFlow();
      await this.test3c_RejectionFlow();
      await this.test4_MultipleIterations();
      await this.test5_ConcurrentReviews();
      
    } catch (error) {
      console.error('\n💥 Critical error:', error);
    } finally {
      await this.teardown();
    }
    
    const report = this.generateReport();
    
    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);
  }
}

// Run if executed directly
if (require.main === module) {
  const test = new ReviewCheckpointE2ETest({
    headless: process.env.HEADLESS === 'true',
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    apiURL: process.env.API_URL || 'http://localhost:3002'
  });
  
  test.runAll().catch(console.error);
}

module.exports = ReviewCheckpointE2ETest;