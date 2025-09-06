#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const tests = [
  {
    name: 'HookHandler Export Test',
    file: 'test-hookhandler-export.js',
    description: 'Tests HookHandler class export, instantiation, and core functionality'
  },
  {
    name: 'ClaudeCodeManager Real Agent Test',
    file: 'test-claude-manager-real.js',
    description: 'Tests ClaudeCodeManager with real agent spawning and management'
  },
  {
    name: 'Database Connection Test',
    file: 'test-database-connection.js', 
    description: 'Tests Prisma database connections and operations'
  }
];

// Test results collector
const results = {
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd()
  },
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  }
};

async function runTest(test) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${test.name}`);
  console.log(`File: ${test.file}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  const testResult = {
    name: test.name,
    file: test.file,
    description: test.description,
    startTime: new Date().toISOString(),
    output: '',
    error: '',
    passed: false,
    duration: 0,
    exitCode: null
  };

  return new Promise((resolve) => {
    // Run test using npx jest with the specific test file
    const testProcess = spawn('npx', ['jest', test.file, '--no-coverage', '--verbose'], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    testProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    testProcess.on('close', (code) => {
      const endTime = Date.now();
      testResult.output = stdout;
      testResult.error = stderr;
      testResult.exitCode = code;
      testResult.passed = code === 0;
      testResult.duration = endTime - startTime;
      testResult.endTime = new Date().toISOString();

      // Parse test results from output
      const passMatch = stdout.match(/Tests:\s+(\d+)\s+passed/);
      const failMatch = stdout.match(/Tests:\s+(\d+)\s+failed/);
      const totalMatch = stdout.match(/Tests:.*,\s+(\d+)\s+total/);

      if (passMatch || failMatch || totalMatch) {
        testResult.stats = {
          passed: passMatch ? parseInt(passMatch[1]) : 0,
          failed: failMatch ? parseInt(failMatch[1]) : 0,
          total: totalMatch ? parseInt(totalMatch[1]) : 0
        };
      }

      resolve(testResult);
    });

    testProcess.on('error', (err) => {
      testResult.error = err.message;
      testResult.passed = false;
      resolve(testResult);
    });
  });
}

async function runAllTests() {
  console.log('Starting Phase 1 Infrastructure Tests');
  console.log('=====================================\n');

  const startTime = Date.now();

  // Run tests sequentially to avoid resource conflicts
  for (const test of tests) {
    try {
      const result = await runTest(test);
      results.tests.push(result);
      results.summary.total++;
      if (result.passed) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }
    } catch (error) {
      console.error(`Error running test ${test.name}:`, error);
      results.tests.push({
        ...test,
        error: error.message,
        passed: false
      });
      results.summary.failed++;
    }
  }

  results.summary.duration = Date.now() - startTime;

  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} ✅`);
  console.log(`Failed: ${results.summary.failed} ❌`);
  console.log(`Duration: ${(results.summary.duration / 1000).toFixed(2)}s`);
  console.log('='.repeat(60));

  // Individual test results
  console.log('\nIndividual Test Results:');
  console.log('-'.repeat(40));
  results.tests.forEach(test => {
    const status = test.passed ? '✅ PASS' : '❌ FAIL';
    const duration = test.duration ? `${(test.duration / 1000).toFixed(2)}s` : 'N/A';
    console.log(`${status} - ${test.name} (${duration})`);
    if (test.stats) {
      console.log(`      ${test.stats.passed}/${test.stats.total} tests passed`);
    }
    if (!test.passed && test.error) {
      console.log(`      Error: ${test.error.split('\n')[0]}`);
    }
  });

  // Save results to JSON file
  const reportPath = path.join(__dirname, 'test-results.json');
  try {
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📊 Full test report saved to: ${reportPath}`);
  } catch (error) {
    console.error('Failed to save test report:', error);
  }

  // Exit with appropriate code
  process.exit(results.summary.failed > 0 ? 1 : 0);
}

// Check if Jest is available
async function checkDependencies() {
  try {
    const jestCheck = spawn('npx', ['jest', '--version']);
    return new Promise((resolve) => {
      jestCheck.on('close', (code) => {
        if (code !== 0) {
          console.error('Jest is not available. Installing test dependencies...');
          const install = spawn('npm', ['install', '--save-dev', 'jest'], {
            cwd: path.join(__dirname, '..', '..'),
            stdio: 'inherit'
          });
          install.on('close', () => resolve());
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Error checking dependencies:', error);
  }
}

// Main execution
(async () => {
  try {
    await checkDependencies();
    await runAllTests();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();