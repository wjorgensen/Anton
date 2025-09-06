#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

interface TestResult {
  testName: string;
  success: boolean;
  duration?: number;
  error?: string;
  metrics?: any;
}

interface TestReport {
  tests: Record<string, TestResult>;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    totalDuration: number;
    timestamp: string;
  };
}

class IntegrationTestRunner {
  private tests = [
    '1-complete-flow.test.ts',
    '2-review-system.test.ts',
    '3-multi-agent.test.ts',
    '4-failure-recovery.test.ts',
    '5-performance.test.ts'
  ];
  
  private reportPath = path.join(process.cwd(), 'test-reports', 'integration-v3.json');
  private report: TestReport = {
    tests: {},
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      totalDuration: 0,
      timestamp: new Date().toISOString()
    }
  };

  async run() {
    console.log(chalk.cyan.bold('\n🚀 Anton v2 Integration Test Suite v3.0\n'));
    console.log(chalk.gray('=' .repeat(60)));
    
    // Ensure test-reports directory exists
    await fs.mkdir('test-reports', { recursive: true });
    
    // Check if services are running
    console.log(chalk.yellow('\n📡 Checking services...'));
    const servicesReady = await this.checkServices();
    if (!servicesReady) {
      console.log(chalk.red('❌ Services are not running. Please start them with: npm run dev'));
      process.exit(1);
    }
    console.log(chalk.green('✓ All services are running'));
    
    // Run tests sequentially
    console.log(chalk.cyan('\n📋 Running integration tests...\n'));
    
    for (const testFile of this.tests) {
      await this.runTest(testFile);
    }
    
    // Generate final report
    await this.generateReport();
    
    // Display summary
    this.displaySummary();
    
    // Exit with appropriate code
    process.exit(this.report.summary.failed > 0 ? 1 : 0);
  }

  private async checkServices(): Promise<boolean> {
    try {
      const checks = [
        { url: 'http://localhost:3000', name: 'Frontend' },
        { url: 'http://localhost:3002/health', name: 'Orchestration' },
        { url: 'http://localhost:3003/health', name: 'Planning Service' }
      ];
      
      for (const check of checks) {
        try {
          const response = await fetch(check.url);
          if (response.ok) {
            console.log(chalk.gray(`  ✓ ${check.name} is running`));
          } else {
            console.log(chalk.red(`  ✗ ${check.name} returned status ${response.status}`));
            return false;
          }
        } catch (error) {
          console.log(chalk.red(`  ✗ ${check.name} is not reachable`));
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private async runTest(testFile: string): Promise<void> {
    const testName = testFile.replace('.test.ts', '').replace(/^\d+-/, '');
    const displayName = testName.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
    
    console.log(chalk.cyan(`\n▶ Running: ${displayName}`));
    console.log(chalk.gray('-'.repeat(40)));
    
    const startTime = Date.now();
    
    try {
      // Run test with Playwright
      const { stdout, stderr } = await execAsync(
        `npx playwright test tests/integration/v3/${testFile} --reporter=json`,
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            CI: 'true',
            FORCE_COLOR: '0'
          }
        }
      );
      
      // Parse test output if available
      try {
        const jsonOutput = JSON.parse(stdout);
        const passed = jsonOutput.suites?.[0]?.specs?.[0]?.tests?.[0]?.status === 'passed';
        
        if (passed) {
          console.log(chalk.green(`  ✓ Test passed`));
        } else {
          console.log(chalk.red(`  ✗ Test failed`));
        }
      } catch (e) {
        // Fallback if JSON parsing fails
        console.log(chalk.green(`  ✓ Test completed`));
      }
      
      const duration = Date.now() - startTime;
      console.log(chalk.gray(`  Duration: ${(duration / 1000).toFixed(2)}s`));
      
      // Read test results from file
      await this.readTestResults();
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.log(chalk.red(`  ✗ Test failed`));
      console.log(chalk.gray(`  Duration: ${(duration / 1000).toFixed(2)}s`));
      
      if (error.stderr) {
        console.log(chalk.red(`  Error: ${error.stderr}`));
      } else if (error.message) {
        console.log(chalk.red(`  Error: ${error.message}`));
      }
      
      // Record failure
      this.report.tests[testName] = {
        testName,
        success: false,
        duration,
        error: error.message || 'Test execution failed'
      };
      this.report.summary.failed++;
    }
  }

  private async readTestResults(): Promise<void> {
    try {
      const content = await fs.readFile(this.reportPath, 'utf-8');
      const data = JSON.parse(content);
      
      // Merge with current report
      if (data.tests) {
        this.report.tests = { ...this.report.tests, ...data.tests };
      }
      
      // Update summary
      const tests = Object.values(this.report.tests);
      this.report.summary = {
        totalTests: tests.length,
        passed: tests.filter(t => t.success).length,
        failed: tests.filter(t => !t.success).length,
        totalDuration: tests.reduce((sum, t) => sum + (t.duration || 0), 0),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      // File doesn't exist or is invalid, continue
    }
  }

  private async generateReport(): Promise<void> {
    console.log(chalk.cyan('\n📊 Generating report...'));
    
    // Add detailed metrics
    const detailedReport = {
      ...this.report,
      environment: {
        node: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      },
      testDetails: Object.entries(this.report.tests).map(([name, result]) => ({
        name,
        ...result,
        durationFormatted: result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'N/A'
      }))
    };
    
    // Save detailed report
    await fs.writeFile(
      this.reportPath,
      JSON.stringify(detailedReport, null, 2)
    );
    
    // Generate HTML report
    await this.generateHTMLReport(detailedReport);
    
    console.log(chalk.green(`✓ Report saved to ${this.reportPath}`));
  }

  private async generateHTMLReport(report: any): Promise<void> {
    const htmlPath = path.join('test-reports', 'integration-v3.html');
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anton v2 Integration Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .stat-label {
      color: #666;
      text-transform: uppercase;
      font-size: 0.8em;
    }
    .passed { color: #10b981; }
    .failed { color: #ef4444; }
    .test-list {
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .test-item {
      padding: 20px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .test-item:last-child {
      border-bottom: none;
    }
    .test-name {
      font-weight: 600;
    }
    .test-status {
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 0.9em;
      font-weight: 500;
    }
    .status-passed {
      background: #d1fae5;
      color: #065f46;
    }
    .status-failed {
      background: #fee2e2;
      color: #991b1b;
    }
    .metrics {
      margin-top: 10px;
      font-size: 0.9em;
      color: #666;
    }
    .metric-item {
      display: inline-block;
      margin-right: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 Anton v2 Integration Test Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <div class="stat-card">
      <div class="stat-value">${report.summary.totalTests}</div>
      <div class="stat-label">Total Tests</div>
    </div>
    <div class="stat-card">
      <div class="stat-value passed">${report.summary.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value failed">${report.summary.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%</div>
      <div class="stat-label">Success Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${(report.summary.totalDuration / 1000 / 60).toFixed(1)}m</div>
      <div class="stat-label">Total Duration</div>
    </div>
  </div>
  
  <div class="test-list">
    ${report.testDetails.map((test: any) => `
      <div class="test-item">
        <div>
          <div class="test-name">${test.name.split('-').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' ')}</div>
          ${test.metrics ? `
            <div class="metrics">
              ${Object.entries(test.metrics).slice(0, 4).map(([key, value]) => `
                <span class="metric-item">${key}: ${value}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div>
          <span class="test-status ${test.success ? 'status-passed' : 'status-failed'}">
            ${test.success ? 'PASSED' : 'FAILED'}
          </span>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;
    
    await fs.writeFile(htmlPath, html);
    console.log(chalk.green(`✓ HTML report saved to ${htmlPath}`));
  }

  private displaySummary(): void {
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan.bold('📈 TEST SUMMARY'));
    console.log(chalk.cyan('='.repeat(60)));
    
    const { summary } = this.report;
    const successRate = summary.totalTests > 0 
      ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
      : '0';
    
    console.log(chalk.white(`
  Total Tests:    ${summary.totalTests}
  Passed:         ${chalk.green(summary.passed.toString())}
  Failed:         ${summary.failed > 0 ? chalk.red(summary.failed.toString()) : '0'}
  Success Rate:   ${summary.passed === summary.totalTests ? chalk.green(successRate + '%') : chalk.yellow(successRate + '%')}
  Total Duration: ${(summary.totalDuration / 1000 / 60).toFixed(1)} minutes
    `));
    
    if (summary.failed > 0) {
      console.log(chalk.red('\n❌ Some tests failed. Check the report for details.'));
    } else {
      console.log(chalk.green('\n✅ All tests passed successfully!'));
    }
    
    console.log(chalk.gray('\nDetailed results available at:'));
    console.log(chalk.blue(`  - JSON: ${this.reportPath}`));
    console.log(chalk.blue(`  - HTML: test-reports/integration-v3.html`));
  }
}

// Run the tests
const runner = new IntegrationTestRunner();
runner.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});