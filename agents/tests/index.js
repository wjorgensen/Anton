#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('========================================');
console.log('AGENT LIBRARY COMPREHENSIVE TEST SUITE');
console.log('========================================');
console.log('');

const tests = [
    {
        name: 'Schema Validation Tests',
        script: 'test-agent-schema.js',
        description: 'Validates all agent JSON files against the schema'
    },
    {
        name: 'Agent Loading Tests', 
        script: 'test-agent-loader.js',
        description: 'Tests agent loading, category retrieval, and directory integrity'
    },
    {
        name: 'Hook Configuration Tests',
        script: 'test-agent-hooks.js',
        description: 'Validates hook configurations and security restrictions'
    }
];

let totalPassed = 0;
let totalFailed = 0;
const failedTests = [];

// Run each test suite
for (const test of tests) {
    console.log(`Running: ${test.name}`);
    console.log(`Description: ${test.description}`);
    console.log('----------------------------------------');
    
    try {
        const output = execSync(`node ${path.join(__dirname, test.script)}`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        console.log(output);
        totalPassed++;
        console.log(`✓ ${test.name} completed successfully\n`);
        
    } catch (error) {
        totalFailed++;
        failedTests.push(test.name);
        
        // Print error output
        if (error.stdout) {
            console.log(error.stdout);
        }
        if (error.stderr) {
            console.error(error.stderr);
        }
        
        console.log(`✗ ${test.name} failed with exit code ${error.status}\n`);
    }
}

// Final summary
console.log('========================================');
console.log('FINAL TEST SUMMARY');
console.log('========================================');
console.log(`Test Suites Passed: ${totalPassed}/${tests.length}`);
console.log(`Test Suites Failed: ${totalFailed}/${tests.length}`);

if (failedTests.length > 0) {
    console.log('\n❌ Failed Test Suites:');
    failedTests.forEach(test => {
        console.log(`  - ${test}`);
    });
}

console.log('\n========================================');

// Exit with appropriate code
process.exit(totalFailed > 0 ? 1 : 0);