#!/usr/bin/env node

const chalk = require('chalk');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PerformanceTestRunner {
  constructor() {
    this.results = {
      canvas: null,
      execution: null,
      preview: null,
      api: null,
      timestamp: new Date().toISOString(),
      summary: null
    };
    
    this.tests = [
      {
        name: 'Canvas Performance',
        file: 'test-performance-canvas.js',
        key: 'canvas',
        requiresUI: true
      },
      {
        name: 'Execution Scale',
        file: 'test-performance-execution.js',
        key: 'execution',
        requiresUI: false
      },
      {
        name: 'Preview Streaming',
        file: 'test-performance-preview.js',
        key: 'preview',
        requiresUI: false
      },
      {
        name: 'API Load Test',
        file: 'test-performance-api.js',
        key: 'api',
        requiresUI: false,
        useK6: true
      }
    ];
  }

  async checkPrerequisites() {
    console.log(chalk.blue('🔍 Checking prerequisites...'));
    
    // Check if services are running
    const checks = [
      { url: 'http://localhost:3000', name: 'Frontend' },
      { url: 'http://localhost:4000/health', name: 'Orchestration' },
      { url: 'http://localhost:4001/health', name: 'Planning Service' }
    ];
    
    for (const check of checks) {
      try {
        const axios = require('axios');
        await axios.get(check.url, { timeout: 5000 });
        console.log(chalk.green(`  ✓ ${check.name} is running`));
      } catch (error) {
        console.log(chalk.red(`  ✗ ${check.name} is not available at ${check.url}`));
        console.log(chalk.yellow(`    Please start the service with: npm run dev`));
        return false;
      }
    }
    
    // Check for K6
    try {
      await this.execCommand('k6', ['version']);
      console.log(chalk.green('  ✓ K6 is installed'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠️ K6 is not installed'));
      console.log(chalk.white('    Install with: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation'));
      console.log(chalk.white('    API load test will be skipped'));
    }
    
    // Check for required npm packages
    const requiredPackages = ['puppeteer', 'ws', 'chalk', 'axios'];
    const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, '../../package.json'), 'utf8'));
    const installedPackages = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    const missingPackages = requiredPackages.filter(pkg => !installedPackages[pkg]);
    
    if (missingPackages.length > 0) {
      console.log(chalk.yellow(`  ⚠️ Missing packages: ${missingPackages.join(', ')}`));
      console.log(chalk.white(`    Install with: npm install ${missingPackages.join(' ')}`));
      return false;
    }
    
    console.log(chalk.green('  ✓ All npm packages installed'));
    
    return true;
  }

  execCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });
    });
  }

  async runTest(test) {
    console.log(chalk.blue(`\n🚀 Running ${test.name}...`));
    console.log(chalk.gray('─'.repeat(50)));
    
    const startTime = Date.now();
    
    try {
      if (test.useK6) {
        // Run K6 test
        const proc = spawn('k6', ['run', path.join(__dirname, test.file)], {
          stdio: 'inherit',
          env: { ...process.env, API_URL: 'http://localhost:4000' }
        });
        
        await new Promise((resolve, reject) => {
          proc.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`K6 test failed with exit code ${code}`));
            }
          });
        });
        
        this.results[test.key] = {
          passed: true,
          duration: Date.now() - startTime,
          message: 'K6 test completed - check output above for details'
        };
      } else {
        // Run Node.js test
        const TestClass = require(`./${test.file}`);
        const testInstance = new TestClass();
        const result = await testInstance.run();
        
        this.results[test.key] = {
          passed: result.passed,
          duration: Date.now() - startTime,
          metrics: result
        };
      }
      
      console.log(chalk.green(`✓ ${test.name} completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`));
    } catch (error) {
      console.log(chalk.red(`✗ ${test.name} failed: ${error.message}`));
      
      this.results[test.key] = {
        passed: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async runSequential() {
    console.log(chalk.yellow('\n📋 Running tests sequentially...'));
    
    for (const test of this.tests) {
      await this.runTest(test);
      
      // Add delay between tests to let system stabilize
      if (this.tests.indexOf(test) < this.tests.length - 1) {
        console.log(chalk.gray('\n⏸️  Waiting 5 seconds before next test...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async runParallel() {
    console.log(chalk.yellow('\n📋 Running non-UI tests in parallel...'));
    
    const parallelTests = this.tests.filter(t => !t.requiresUI && !t.useK6);
    const uiTests = this.tests.filter(t => t.requiresUI);
    const k6Tests = this.tests.filter(t => t.useK6);
    
    // Run non-UI tests in parallel
    if (parallelTests.length > 0) {
      await Promise.all(parallelTests.map(test => this.runTest(test)));
    }
    
    // Run UI tests sequentially
    for (const test of uiTests) {
      await this.runTest(test);
    }
    
    // Run K6 tests last
    for (const test of k6Tests) {
      await this.runTest(test);
    }
  }

  generateSummary() {
    console.log(chalk.blue('\n📈 PERFORMANCE TEST SUMMARY'));
    console.log(chalk.blue('═'.repeat(60)));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const test of this.tests) {
      const result = this.results[test.key];
      
      if (result) {
        const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
        const duration = (result.duration / 1000).toFixed(2);
        
        console.log(`${status} ${chalk.white(test.name.padEnd(20))} ${chalk.gray(`(${duration}s)`)}`);
        
        if (result.metrics) {
          // Display key metrics
          if (test.key === 'canvas' && result.metrics.fps) {
            console.log(chalk.gray(`     FPS: ${result.metrics.fps.toFixed(2)}`));
          } else if (test.key === 'execution' && result.metrics.spawnTime) {
            console.log(chalk.gray(`     Spawn Time: ${result.metrics.spawnTime.toFixed(2)}ms`));
          } else if (test.key === 'preview' && result.metrics.latency) {
            console.log(chalk.gray(`     P99 Latency: ${result.metrics.latency.p99}ms`));
          }
        }
        
        if (result.error) {
          console.log(chalk.gray(`     Error: ${result.error}`));
        }
        
        if (result.passed) {
          totalPassed++;
        } else {
          totalFailed++;
        }
      } else {
        console.log(chalk.gray(`⊘ SKIP ${test.name.padEnd(20)} (not run)`));
      }
    }
    
    console.log(chalk.blue('─'.repeat(60)));
    console.log(chalk.white(`Total: ${totalPassed} passed, ${totalFailed} failed`));
    
    const allPassed = totalFailed === 0 && totalPassed === this.tests.length;
    
    console.log(chalk.yellow('\n🏁 Final Result:'));
    console.log(chalk[allPassed ? 'green' : 'red'].bold(
      allPassed ? '✅ ALL PERFORMANCE TESTS PASSED' : '❌ SOME PERFORMANCE TESTS FAILED'
    ));
    
    this.results.summary = {
      passed: totalPassed,
      failed: totalFailed,
      total: this.tests.length,
      allPassed
    };
    
    return allPassed;
  }

  async saveReport() {
    const reportPath = path.join(__dirname, '../../test-results/performance-report.json');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
      console.log(chalk.gray(`\n📄 Report saved to: ${reportPath}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Could not save report: ${error.message}`));
    }
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 ANTON PERFORMANCE TEST SUITE'));
    console.log(chalk.gray('Version 2.0.0'));
    console.log(chalk.gray(new Date().toLocaleString()));
    console.log(chalk.blue('═'.repeat(60)));
    
    // Check prerequisites
    const ready = await this.checkPrerequisites();
    if (!ready) {
      console.log(chalk.red('\n❌ Prerequisites check failed. Please fix the issues above.'));
      process.exit(1);
    }
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const parallel = args.includes('--parallel');
    const skipCanvas = args.includes('--skip-canvas');
    const skipK6 = args.includes('--skip-k6');
    
    if (skipCanvas) {
      this.tests = this.tests.filter(t => t.key !== 'canvas');
      console.log(chalk.yellow('⚠️ Skipping canvas test (--skip-canvas)'));
    }
    
    if (skipK6) {
      this.tests = this.tests.filter(t => !t.useK6);
      console.log(chalk.yellow('⚠️ Skipping K6 test (--skip-k6)'));
    }
    
    // Run tests
    const startTime = Date.now();
    
    if (parallel) {
      await this.runParallel();
    } else {
      await this.runSequential();
    }
    
    // Generate summary
    const allPassed = this.generateSummary();
    
    // Save report
    await this.saveReport();
    
    // Final timing
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.gray(`\n⏱️  Total execution time: ${totalTime.toFixed(2)}s`));
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Unhandled error:'), error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  const runner = new PerformanceTestRunner();
  runner.run().catch(error => {
    console.error(chalk.red('❌ Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = PerformanceTestRunner;