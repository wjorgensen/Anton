#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const TEST_REPORTS_DIR = path.join(__dirname, '../../test-reports');

// Test suites to run
const TEST_SUITES = [
  {
    name: 'API-to-Database',
    file: 'test-api-database.js',
    timeout: 60000
  },
  {
    name: 'Planning Service',
    file: 'test-planning-service.js',
    timeout: 90000
  },
  {
    name: 'WebSocket Real-time',
    file: 'test-websocket-realtime.js',
    timeout: 60000
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper to run a test suite
function runTestSuite(suite) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log(`${colors.cyan}▶ Running ${suite.name} tests...${colors.reset}`);

    const testPath = path.join(__dirname, suite.file);
    const args = [
      '--testPathPattern', testPath,
      '--json',
      '--outputFile', path.join(TEST_REPORTS_DIR, `${suite.file}.json`),
      '--testTimeout', suite.timeout.toString(),
      '--forceExit'
    ];

    const jestProcess = spawn('npx', ['jest', ...args], {
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: 'true'
      }
    });

    let output = '';
    let errorOutput = '';

    jestProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });

    jestProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });

    jestProcess.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        suite: suite.name,
        file: suite.file,
        exitCode: code,
        duration,
        startTime,
        endTime,
        success: code === 0,
        output: output.slice(-1000), // Last 1000 chars
        errorOutput: errorOutput.slice(-1000)
      };

      if (code === 0) {
        console.log(`${colors.green}✓ ${suite.name} tests passed${colors.reset} (${duration}ms)\n`);
      } else {
        console.log(`${colors.red}✗ ${suite.name} tests failed${colors.reset} (${duration}ms)\n`);
      }

      resolve(result);
    });

    jestProcess.on('error', (error) => {
      console.error(`${colors.red}Error running ${suite.name} tests:${colors.reset}`, error);
      resolve({
        suite: suite.name,
        file: suite.file,
        exitCode: -1,
        duration: Date.now() - startTime,
        startTime,
        endTime: Date.now(),
        success: false,
        error: error.message
      });
    });
  });
}

// Helper to ensure services are running
async function checkServices() {
  const services = [
    { name: 'Orchestrator', url: 'http://localhost:3002/health', required: true },
    { name: 'Planning Service', url: 'http://localhost:3003/health', required: true },
    { name: 'PostgreSQL', host: 'localhost', port: 5432, required: true },
    { name: 'Redis', host: 'localhost', port: 6379, required: true }
  ];

  console.log(`${colors.blue}Checking service availability...${colors.reset}\n`);

  const axios = require('axios');
  const net = require('net');

  const serviceStatus = [];

  for (const service of services) {
    let available = false;
    let message = '';

    try {
      if (service.url) {
        // Check HTTP service
        const response = await axios.get(service.url, { timeout: 5000 });
        available = response.status === 200;
        message = `HTTP ${response.status}`;
      } else if (service.port) {
        // Check TCP port
        available = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(5000);
          
          socket.on('connect', () => {
            socket.end();
            resolve(true);
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
          
          socket.on('error', () => {
            resolve(false);
          });
          
          socket.connect(service.port, service.host || 'localhost');
        });
        message = available ? 'Port open' : 'Port closed';
      }
    } catch (error) {
      available = false;
      message = error.message.substring(0, 50);
    }

    serviceStatus.push({
      name: service.name,
      available,
      required: service.required,
      message
    });

    const icon = available ? `${colors.green}✓` : `${colors.red}✗`;
    const status = available ? 'Available' : 'Unavailable';
    console.log(`${icon} ${service.name}: ${status}${colors.reset} ${message ? `(${message})` : ''}`);
  }

  const requiredUnavailable = serviceStatus.filter(s => s.required && !s.available);
  
  if (requiredUnavailable.length > 0) {
    console.log(`\n${colors.red}Required services are not available:${colors.reset}`);
    requiredUnavailable.forEach(s => {
      console.log(`  - ${s.name}`);
    });
    console.log(`\n${colors.yellow}Please start all services with: npm run dev${colors.reset}\n`);
    return false;
  }

  console.log(`\n${colors.green}All required services are available!${colors.reset}\n`);
  return true;
}

// Helper to generate summary report
async function generateReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    suites: results.length,
    passed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      suite: r.suite,
      file: r.file,
      success: r.success,
      duration: r.duration,
      exitCode: r.exitCode
    })),
    environment: {
      node: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    }
  };

  // Calculate success rate
  report.successRate = (report.passed / report.suites * 100).toFixed(2) + '%';

  // Write JSON report
  const reportPath = path.join(TEST_REPORTS_DIR, 'phase1-integration.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log(`\n${colors.bright}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}       Integration Test Summary${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════${colors.reset}\n`);

  console.log(`Total Suites: ${report.suites}`);
  console.log(`${colors.green}Passed: ${report.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${report.failed}${colors.reset}`);
  console.log(`Success Rate: ${report.successRate}`);
  console.log(`Total Duration: ${report.totalDuration}ms\n`);

  console.log(`${colors.bright}Suite Results:${colors.reset}`);
  report.results.forEach(r => {
    const icon = r.success ? `${colors.green}✓` : `${colors.red}✗`;
    const status = r.success ? 'PASS' : 'FAIL';
    console.log(`${icon} ${r.suite.padEnd(20)} ${status.padEnd(6)} ${r.duration}ms${colors.reset}`);
  });

  console.log(`\n${colors.cyan}Report saved to: ${reportPath}${colors.reset}`);

  return report;
}

// Main execution
async function main() {
  console.log(`${colors.bright}${colors.blue}╔════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║     Anton Integration Test Runner      ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚════════════════════════════════════════╝${colors.reset}\n`);

  // Ensure test reports directory exists
  await fs.mkdir(TEST_REPORTS_DIR, { recursive: true });

  // Check if services are running
  const servicesAvailable = await checkServices();
  if (!servicesAvailable) {
    process.exit(1);
  }

  // Run test suites sequentially to avoid conflicts
  const results = [];
  for (const suite of TEST_SUITES) {
    const result = await runTestSuite(suite);
    results.push(result);

    // Add delay between suites to allow cleanup
    if (TEST_SUITES.indexOf(suite) < TEST_SUITES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate and display report
  const report = await generateReport(results);

  // Exit with appropriate code
  const exitCode = report.failed > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    console.log(`\n${colors.green}${colors.bright}All integration tests passed! 🎉${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}${colors.bright}Some tests failed. Please review the results.${colors.reset}\n`);
  }

  process.exit(exitCode);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});

// Run tests
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});