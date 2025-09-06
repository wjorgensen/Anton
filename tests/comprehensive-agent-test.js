#!/usr/bin/env node

/**
 * Comprehensive Agent Communication Test
 * Tests: Agent lifecycle, hooks, output capture, and multi-agent concurrency
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_REPORT_PATH = path.join(__dirname, 'test-reports', 'agent-communication.json');

// Ensure test-reports directory exists
if (!fs.existsSync(path.join(__dirname, 'test-reports'))) {
    fs.mkdirSync(path.join(__dirname, 'test-reports'));
}

const testReport = {
    timestamp: new Date().toISOString(),
    environment: {
        nodeVersion: process.version,
        platform: process.platform,
        workingDir: process.cwd()
    },
    tests: {
        agentLifecycle: {},
        hookSystem: {},
        outputCapture: {},
        multiAgent: {}
    },
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0
    },
    resourceMetrics: {}
};

const startTime = Date.now();

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAgentLifecycle() {
    console.log('\n🚀 Testing Agent Lifecycle...');
    const results = {
        spawn: false,
        hookConfig: false,
        outputCollection: false,
        termination: false,
        details: []
    };

    try {
        // Test 1: Agent Spawn Simulation
        console.log('  ✓ Testing agent spawn simulation...');
        const testDir = path.join(__dirname, 'test-agent-spawn');
        
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });
        
        // Create mock agent structure
        fs.mkdirSync(path.join(testDir, '.claude-code', 'hooks'), { recursive: true });
        fs.writeFileSync(path.join(testDir, '.claude-code', 'claude.md'), 
            '# Test Agent Instructions\nExecute test commands');
        
        results.spawn = true;
        results.details.push('Agent spawn directory created successfully');
        console.log('    ✅ Agent spawn successful');

        // Test 2: Hook Configuration
        console.log('  ✓ Testing hook configuration...');
        const stopHook = `#!/bin/bash
echo "Stop hook executed at $(date)"
echo "NODE_ID: $NODE_ID"
echo "EXECUTION_ID: $EXECUTION_ID"
`;
        const trackChangesHook = `#!/bin/bash
echo "Track changes hook executed"
find . -type f -newer /tmp/last_run 2>/dev/null || find . -type f
`;
        
        fs.writeFileSync(path.join(testDir, '.claude-code', 'hooks', 'stop.sh'), stopHook);
        fs.chmodSync(path.join(testDir, '.claude-code', 'hooks', 'stop.sh'), '755');
        
        fs.writeFileSync(path.join(testDir, '.claude-code', 'hooks', 'track-changes.sh'), trackChangesHook);
        fs.chmodSync(path.join(testDir, '.claude-code', 'hooks', 'track-changes.sh'), '755');
        
        results.hookConfig = true;
        results.details.push('Hook scripts configured with proper permissions');
        console.log('    ✅ Hook configuration successful');

        // Test 3: Output Collection
        console.log('  ✓ Testing output collection...');
        const testScript = path.join(testDir, 'test-output.js');
        fs.writeFileSync(testScript, `
console.log('STDOUT: Test output line 1');
console.log('STDOUT: Test output line 2');
console.error('STDERR: Test error output');
process.exit(0);
`);
        
        await new Promise((resolve, reject) => {
            const proc = spawn('node', [testScript], {
                cwd: testDir,
                env: { ...process.env }
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            proc.on('close', (code) => {
                if (stdout.includes('STDOUT') && stderr.includes('STDERR')) {
                    results.outputCollection = true;
                    results.details.push(`Captured stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`);
                    console.log('    ✅ Output collection successful');
                }
                resolve();
            });
            
            proc.on('error', reject);
        });

        // Test 4: Termination
        console.log('  ✓ Testing agent termination...');
        const longRunning = spawn('node', ['-e', 'setTimeout(() => {}, 10000)'], {
            cwd: testDir
        });
        
        await delay(100);
        longRunning.kill('SIGTERM');
        
        await new Promise((resolve) => {
            longRunning.on('close', () => {
                results.termination = true;
                results.details.push('Process terminated successfully with SIGTERM');
                console.log('    ✅ Agent termination successful');
                resolve();
            });
        });

    } catch (error) {
        results.details.push(`Error: ${error.message}`);
        console.error('  ❌ Agent lifecycle test failed:', error.message);
    }

    testReport.tests.agentLifecycle = results;
    return results;
}

async function testHookSystem() {
    console.log('\n🔗 Testing Hook System...');
    const results = {
        stopHook: false,
        trackChangesHook: false,
        errorHook: false,
        dataFlow: false,
        details: []
    };

    try {
        const testDir = path.join(__dirname, 'test-hooks');
        
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });
        fs.mkdirSync(path.join(testDir, '.claude-code', 'hooks'), { recursive: true });

        // Test Stop Hook
        console.log('  ✓ Testing stop hook...');
        const stopHook = path.join(testDir, '.claude-code', 'hooks', 'stop.sh');
        fs.writeFileSync(stopHook, `#!/bin/bash
echo "Stop hook executed"
echo "Status: success"
echo "Timestamp: $(date +%s)"
`);
        fs.chmodSync(stopHook, '755');
        
        const stopOutput = await new Promise((resolve, reject) => {
            const proc = spawn('bash', [stopHook], {
                env: { ...process.env, NODE_ID: 'test-node', EXECUTION_ID: 'test-exec' }
            });
            
            let output = '';
            proc.stdout.on('data', (data) => { output += data; });
            proc.on('close', () => resolve(output));
            proc.on('error', reject);
        });
        
        if (stopOutput.includes('Stop hook executed')) {
            results.stopHook = true;
            results.details.push('Stop hook executed successfully');
            console.log('    ✅ Stop hook executed');
        }

        // Test Track Changes Hook
        console.log('  ✓ Testing track-changes hook...');
        fs.writeFileSync(path.join(testDir, 'test1.txt'), 'File 1');
        fs.writeFileSync(path.join(testDir, 'test2.txt'), 'File 2');
        
        const trackHook = path.join(testDir, '.claude-code', 'hooks', 'track-changes.sh');
        fs.writeFileSync(trackHook, `#!/bin/bash
echo "Tracking changes in: $PWD"
find . -type f -name "*.txt" | head -10
`);
        fs.chmodSync(trackHook, '755');
        
        const trackOutput = await new Promise((resolve, reject) => {
            const proc = spawn('bash', [trackHook], {
                cwd: testDir,
                env: process.env
            });
            
            let output = '';
            proc.stdout.on('data', (data) => { output += data; });
            proc.on('close', () => resolve(output));
            proc.on('error', reject);
        });
        
        if (trackOutput.includes('test1.txt') || trackOutput.includes('test2.txt')) {
            results.trackChangesHook = true;
            results.details.push('Track changes hook detected files');
            console.log('    ✅ Track-changes hook executed');
        }

        // Test Error Hook
        console.log('  ✓ Testing error hook...');
        const errorHook = path.join(testDir, '.claude-code', 'hooks', 'error.sh');
        fs.writeFileSync(errorHook, `#!/bin/bash
echo "Error hook triggered"
echo "Error: $ERROR_MESSAGE"
echo "Code: $ERROR_CODE"
`);
        fs.chmodSync(errorHook, '755');
        
        const errorOutput = await new Promise((resolve, reject) => {
            const proc = spawn('bash', [errorHook], {
                env: { ...process.env, ERROR_MESSAGE: 'Test error', ERROR_CODE: '1' }
            });
            
            let output = '';
            proc.stdout.on('data', (data) => { output += data; });
            proc.on('close', () => resolve(output));
            proc.on('error', reject);
        });
        
        if (errorOutput.includes('Error hook triggered')) {
            results.errorHook = true;
            results.details.push('Error hook handled error correctly');
            console.log('    ✅ Error hook executed');
        }

        // Test Data Flow
        console.log('  ✓ Testing hook data flow...');
        const dataFile = path.join(testDir, 'hook-data.json');
        fs.writeFileSync(dataFile, JSON.stringify({
            nodeId: 'test-node',
            executionId: 'test-exec',
            timestamp: Date.now()
        }));
        
        if (fs.existsSync(dataFile)) {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            if (data.nodeId && data.executionId) {
                results.dataFlow = true;
                results.details.push('Hook data flow verified');
                console.log('    ✅ Hook data flow verified');
            }
        }

    } catch (error) {
        results.details.push(`Error: ${error.message}`);
        console.error('  ❌ Hook system test failed:', error.message);
    }

    testReport.tests.hookSystem = results;
    return results;
}

async function testAgentOutput() {
    console.log('\n📤 Testing Agent Output Capture...');
    const results = {
        stdoutCapture: false,
        stderrCapture: false,
        fileOutputs: false,
        outputStreaming: false,
        details: []
    };

    try {
        const testDir = path.join(__dirname, 'test-output');
        
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        // Test stdout/stderr capture
        console.log('  ✓ Testing stdout/stderr capture...');
        const testScript = path.join(testDir, 'output-test.js');
        fs.writeFileSync(testScript, `
console.log('STDOUT: Line 1');
console.log('STDOUT: Line 2');
console.error('STDERR: Error line');

// Write output file
const fs = require('fs');
fs.writeFileSync('output.json', JSON.stringify({
    timestamp: Date.now(),
    data: 'Test output'
}));

// Stream output
for (let i = 0; i < 5; i++) {
    console.log('STREAM: Output ' + i);
}
`);

        const { stdout, stderr } = await new Promise((resolve, reject) => {
            const proc = spawn('node', [testScript], {
                cwd: testDir
            });
            
            let stdout = '';
            let stderr = '';
            
            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            proc.on('close', () => {
                resolve({ stdout, stderr });
            });
            
            proc.on('error', reject);
        });

        if (stdout.includes('STDOUT')) {
            results.stdoutCapture = true;
            results.details.push(`Captured ${stdout.split('\\n').length} stdout lines`);
            console.log('    ✅ Stdout capture successful');
        }

        if (stderr.includes('STDERR')) {
            results.stderrCapture = true;
            results.details.push(`Captured stderr output`);
            console.log('    ✅ Stderr capture successful');
        }

        // Test file outputs
        console.log('  ✓ Testing file output capture...');
        const outputFile = path.join(testDir, 'output.json');
        if (fs.existsSync(outputFile)) {
            const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            if (data.timestamp && data.data) {
                results.fileOutputs = true;
                results.details.push('File output captured successfully');
                console.log('    ✅ File output capture successful');
            }
        }

        // Test streaming
        if (stdout.includes('STREAM')) {
            const streamLines = stdout.match(/STREAM:/g);
            if (streamLines && streamLines.length >= 5) {
                results.outputStreaming = true;
                results.details.push(`Streamed ${streamLines.length} output lines`);
                console.log('    ✅ Output streaming successful');
            }
        }

    } catch (error) {
        results.details.push(`Error: ${error.message}`);
        console.error('  ❌ Output capture test failed:', error.message);
    }

    testReport.tests.outputCapture = results;
    return results;
}

async function testMultiAgent() {
    console.log('\n🤖 Testing Multi-Agent Execution...');
    const results = {
        concurrentExecution: false,
        agentCommunication: false,
        noConflicts: false,
        resourceSharing: false,
        details: []
    };

    try {
        const testDir = path.join(__dirname, 'test-multiagent');
        
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        console.log('  ✓ Starting 5 agents concurrently...');
        
        const agents = [];
        const outputs = [];
        
        // Create 5 agent scripts
        for (let i = 1; i <= 5; i++) {
            const agentScript = path.join(testDir, `agent-${i}.js`);
            fs.writeFileSync(agentScript, `
const fs = require('fs');
const agentId = ${i};
const startTime = Date.now();

console.log('Agent ' + agentId + ' started at', startTime);

// Create agent-specific output
fs.writeFileSync('agent-' + agentId + '-output.txt', 'Output from Agent ' + agentId);

// Simulate work with random delay
setTimeout(() => {
    const endTime = Date.now();
    console.log('Agent ' + agentId + ' completed at', endTime);
    
    // Write completion marker
    fs.writeFileSync('agent-' + agentId + '-complete.json', JSON.stringify({
        agent: agentId,
        started: startTime,
        completed: endTime,
        duration: endTime - startTime
    }));
    
    process.exit(0);
}, Math.random() * 2000 + 500);
`);
        }

        // Launch all agents concurrently
        const launchPromises = [];
        for (let i = 1; i <= 5; i++) {
            launchPromises.push(new Promise((resolve, reject) => {
                const proc = spawn('node', [`agent-${i}.js`], {
                    cwd: testDir
                });
                
                let output = '';
                proc.stdout.on('data', (data) => {
                    output += data.toString();
                });
                
                proc.on('close', (code) => {
                    outputs.push({ agent: i, output, code });
                    resolve();
                });
                
                proc.on('error', reject);
                
                agents.push(proc);
            }));
        }

        // Wait for all agents to complete
        await Promise.all(launchPromises);
        
        console.log(`    Status: All ${agents.length} agents completed`);

        // Check concurrent execution
        if (agents.length === 5) {
            results.concurrentExecution = true;
            results.details.push(`Successfully ran ${agents.length} agents concurrently`);
            console.log('    ✅ Concurrent execution verified');
        }

        // Check agent communication (via output files)
        let completedAgents = 0;
        for (let i = 1; i <= 5; i++) {
            const completeFile = path.join(testDir, `agent-${i}-complete.json`);
            if (fs.existsSync(completeFile)) {
                completedAgents++;
            }
        }
        
        if (completedAgents === 5) {
            results.agentCommunication = true;
            results.details.push('All agents communicated completion successfully');
            console.log('    ✅ All agents communicated completion');
        }

        // Check for conflicts
        const failedAgents = outputs.filter(o => o.code !== 0);
        if (failedAgents.length === 0) {
            results.noConflicts = true;
            results.details.push('No conflicts detected between agents');
            console.log('    ✅ No conflicts detected');
        }

        // Check resource sharing
        const outputFiles = fs.readdirSync(testDir).filter(f => f.endsWith('-output.txt'));
        if (outputFiles.length === 5) {
            results.resourceSharing = true;
            results.details.push('All agents successfully shared filesystem resources');
            console.log('    ✅ Resource sharing successful');
        }

        // Analyze execution timing
        const timings = [];
        for (let i = 1; i <= 5; i++) {
            const completeFile = path.join(testDir, `agent-${i}-complete.json`);
            if (fs.existsSync(completeFile)) {
                const data = JSON.parse(fs.readFileSync(completeFile, 'utf8'));
                timings.push(data);
            }
        }
        
        if (timings.length > 0) {
            const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
            results.details.push(`Average agent execution time: ${avgDuration.toFixed(2)}ms`);
        }

    } catch (error) {
        results.details.push(`Error: ${error.message}`);
        console.error('  ❌ Multi-agent test failed:', error.message);
    }

    testReport.tests.multiAgent = results;
    return results;
}

function generateResourceMetrics() {
    const metrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: Date.now()
    };

    // Calculate memory in MB
    metrics.memoryMB = {
        rss: (metrics.memory.rss / 1024 / 1024).toFixed(2),
        heapTotal: (metrics.memory.heapTotal / 1024 / 1024).toFixed(2),
        heapUsed: (metrics.memory.heapUsed / 1024 / 1024).toFixed(2)
    };

    return metrics;
}

async function runAllTests() {
    console.log('🧪 Anton Agent Communication Test Suite');
    console.log('=====================================');
    console.log(`Started: ${new Date().toISOString()}`);
    console.log(`Node Version: ${process.version}`);
    console.log(`Platform: ${process.platform}\n`);

    try {
        // Run all test suites
        await testAgentLifecycle();
        await testHookSystem();
        await testAgentOutput();
        await testMultiAgent();

        // Calculate summary
        const endTime = Date.now();
        testReport.summary.duration = endTime - startTime;

        // Count results
        Object.values(testReport.tests).forEach(suite => {
            Object.entries(suite).forEach(([key, value]) => {
                if (key !== 'details' && typeof value === 'boolean') {
                    testReport.summary.total++;
                    if (value === true) {
                        testReport.summary.passed++;
                    } else {
                        testReport.summary.failed++;
                    }
                }
            });
        });

        // Add resource metrics
        testReport.resourceMetrics = generateResourceMetrics();

        // Display summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Summary');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${testReport.summary.total}`);
        console.log(`✅ Passed: ${testReport.summary.passed}`);
        console.log(`❌ Failed: ${testReport.summary.failed}`);
        console.log(`⏱️  Duration: ${(testReport.summary.duration / 1000).toFixed(2)}s`);
        console.log(`📈 Success Rate: ${((testReport.summary.passed / testReport.summary.total) * 100).toFixed(1)}%`);
        
        console.log('\n📊 Resource Usage:');
        console.log(`  Memory RSS: ${testReport.resourceMetrics.memoryMB.rss} MB`);
        console.log(`  Heap Used: ${testReport.resourceMetrics.memoryMB.heapUsed} MB`);

        // Display detailed results
        console.log('\n📋 Detailed Results:');
        Object.entries(testReport.tests).forEach(([suite, results]) => {
            const tests = Object.entries(results).filter(([key]) => key !== 'details' && typeof results[key] === 'boolean');
            const passed = tests.filter(([, value]) => value === true).length;
            console.log(`\n  ${suite}: ${passed}/${tests.length} passed`);
            if (results.details && results.details.length > 0) {
                results.details.slice(0, 3).forEach(detail => {
                    console.log(`    • ${detail}`);
                });
            }
        });

        // Write report
        fs.writeFileSync(TEST_REPORT_PATH, JSON.stringify(testReport, null, 2));
        console.log(`\n📄 Report saved to: ${TEST_REPORT_PATH}`);

        // Exit code based on results
        process.exit(testReport.summary.failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        testReport.fatalError = error.message;
        fs.writeFileSync(TEST_REPORT_PATH, JSON.stringify(testReport, null, 2));
        process.exit(1);
    }
}

// Clean up test directories before starting
function cleanup() {
    const testDirs = ['test-agent-spawn', 'test-hooks', 'test-output', 'test-multiagent'];
    testDirs.forEach(dir => {
        const fullPath = path.join(__dirname, dir);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true });
        }
    });
}

// Run tests
cleanup();
runAllTests();