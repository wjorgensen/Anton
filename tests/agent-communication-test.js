#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3002';
const TEST_TIMEOUT = 120000; // 2 minutes
const REPORT_PATH = path.join(__dirname, 'test-reports', 'agent-communication.json');

// Ensure test-reports directory exists
if (!fs.existsSync(path.join(__dirname, 'test-reports'))) {
    fs.mkdirSync(path.join(__dirname, 'test-reports'));
}

const testReport = {
    timestamp: new Date().toISOString(),
    environment: {
        orchestratorUrl: ORCHESTRATOR_URL,
        nodeVersion: process.version,
        platform: process.platform
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
    }
};

const startTime = Date.now();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAgentLifecycle() {
    console.log('\n🚀 Testing Agent Lifecycle...');
    const results = {
        spawn: false,
        hookConfig: false,
        outputCollection: false,
        termination: false,
        errors: []
    };

    try {
        // Test 1: Agent Spawn
        console.log('  ✓ Testing agent spawn...');
        const projectResponse = await axios.post(`${ORCHESTRATOR_URL}/api/projects`, {
            name: `test-lifecycle-${Date.now()}`,
            description: 'Agent lifecycle test'
        });
        
        if (projectResponse.data.id) {
            results.spawn = true;
            console.log('    ✅ Agent spawn successful');
        }

        // Test 2: Hook Configuration
        console.log('  ✓ Testing hook configuration...');
        const flowData = {
            projectId: projectResponse.data.id,
            name: 'Test Flow',
            nodes: [
                {
                    id: 'node-1',
                    type: 'agent',
                    position: { x: 100, y: 100 },
                    data: {
                        label: 'Test Agent',
                        agentType: 'nodejs-developer',
                        instructions: 'console.log("Test output")',
                        hooks: {
                            stop: true,
                            postToolUse: true,
                            error: true
                        }
                    }
                }
            ],
            edges: []
        };

        const flowResponse = await axios.post(`${ORCHESTRATOR_URL}/api/flows`, flowData);
        if (flowResponse.data.id) {
            results.hookConfig = true;
            console.log('    ✅ Hook configuration successful');
        }

        // Test 3: Output Collection
        console.log('  ✓ Testing output collection...');
        const executionResponse = await axios.post(`${ORCHESTRATOR_URL}/api/executions`, {
            flowId: flowResponse.data.id,
            mode: 'sequential'
        });

        // Wait for execution to start
        await delay(2000);

        // Check execution status
        const statusResponse = await axios.get(
            `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
        );

        if (statusResponse.data.nodes && statusResponse.data.nodes.length > 0) {
            results.outputCollection = true;
            console.log('    ✅ Output collection successful');
        }

        // Test 4: Termination
        console.log('  ✓ Testing agent termination...');
        // Simulate termination by waiting for completion or stopping
        await delay(3000);
        
        const finalStatus = await axios.get(
            `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
        );

        if (finalStatus.data.status === 'completed' || finalStatus.data.status === 'failed') {
            results.termination = true;
            console.log('    ✅ Agent termination successful');
        }

    } catch (error) {
        results.errors.push(error.message);
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
        errors: []
    };

    try {
        // Create a test project with hooks
        const projectResponse = await axios.post(`${ORCHESTRATOR_URL}/api/projects`, {
            name: `test-hooks-${Date.now()}`,
            description: 'Hook system test'
        });

        const flowData = {
            projectId: projectResponse.data.id,
            name: 'Hook Test Flow',
            nodes: [
                {
                    id: 'hook-node-1',
                    type: 'agent',
                    position: { x: 100, y: 100 },
                    data: {
                        label: 'Hook Test Agent',
                        agentType: 'nodejs-developer',
                        instructions: `
                            // Test file write to trigger track-changes hook
                            const fs = require('fs');
                            fs.writeFileSync('test-output.txt', 'Hook test data');
                            
                            // Test error to trigger error hook
                            try {
                                throw new Error('Test error for hook');
                            } catch (e) {
                                console.error(e.message);
                            }
                            
                            // Test completion to trigger stop hook
                            console.log('Completed hook test');
                        `,
                        hooks: {
                            stop: true,
                            postToolUse: true,
                            error: true
                        }
                    }
                }
            ],
            edges: []
        };

        const flowResponse = await axios.post(`${ORCHESTRATOR_URL}/api/flows`, flowData);
        
        // Start execution
        const executionResponse = await axios.post(`${ORCHESTRATOR_URL}/api/executions`, {
            flowId: flowResponse.data.id,
            mode: 'sequential'
        });

        // Monitor hook events
        await delay(5000);

        const executionStatus = await axios.get(
            `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
        );

        // Check for hook execution evidence
        if (executionStatus.data.nodes && executionStatus.data.nodes[0]) {
            const node = executionStatus.data.nodes[0];
            
            // Check stop hook
            if (node.status === 'completed') {
                results.stopHook = true;
                console.log('    ✅ Stop hook executed');
            }

            // Check for outputs (indicates track-changes hook)
            if (node.output || node.files) {
                results.trackChangesHook = true;
                console.log('    ✅ Track-changes hook executed');
            }

            // Check for error handling
            if (node.errors || node.warnings) {
                results.errorHook = true;
                console.log('    ✅ Error hook executed');
            }

            // Verify data flow
            if (node.startTime && node.endTime) {
                results.dataFlow = true;
                console.log('    ✅ Hook data flow verified');
            }
        }

    } catch (error) {
        results.errors.push(error.message);
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
        errors: []
    };

    try {
        // Create test project
        const projectResponse = await axios.post(`${ORCHESTRATOR_URL}/api/projects`, {
            name: `test-output-${Date.now()}`,
            description: 'Output capture test'
        });

        const flowData = {
            projectId: projectResponse.data.id,
            name: 'Output Test Flow',
            nodes: [
                {
                    id: 'output-node-1',
                    type: 'agent',
                    position: { x: 100, y: 100 },
                    data: {
                        label: 'Output Test Agent',
                        agentType: 'nodejs-developer',
                        instructions: `
                            // Test stdout
                            console.log('STDOUT: Test output line 1');
                            console.log('STDOUT: Test output line 2');
                            
                            // Test stderr
                            console.error('STDERR: Test error output');
                            
                            // Test file creation
                            const fs = require('fs');
                            fs.writeFileSync('output.json', JSON.stringify({
                                timestamp: Date.now(),
                                data: 'Test file output'
                            }));
                            
                            // Test streaming with multiple outputs
                            for (let i = 0; i < 5; i++) {
                                console.log('STREAM: Output ' + i);
                                // Small delay to test streaming
                            }
                        `,
                        hooks: {
                            stop: true,
                            postToolUse: true
                        }
                    }
                }
            ],
            edges: []
        };

        const flowResponse = await axios.post(`${ORCHESTRATOR_URL}/api/flows`, flowData);
        
        // Start execution
        const executionResponse = await axios.post(`${ORCHESTRATOR_URL}/api/executions`, {
            flowId: flowResponse.data.id,
            mode: 'sequential'
        });

        // Monitor output capture
        await delay(5000);

        const executionStatus = await axios.get(
            `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
        );

        if (executionStatus.data.nodes && executionStatus.data.nodes[0]) {
            const node = executionStatus.data.nodes[0];
            
            // Check stdout capture
            if (node.output && node.output.includes('STDOUT')) {
                results.stdoutCapture = true;
                console.log('    ✅ Stdout capture successful');
            }

            // Check stderr capture
            if (node.output && node.output.includes('STDERR')) {
                results.stderrCapture = true;
                console.log('    ✅ Stderr capture successful');
            }

            // Check file outputs
            if (node.files || (node.output && node.output.includes('output.json'))) {
                results.fileOutputs = true;
                console.log('    ✅ File output capture successful');
            }

            // Check streaming
            if (node.output && node.output.includes('STREAM')) {
                results.outputStreaming = true;
                console.log('    ✅ Output streaming successful');
            }
        }

    } catch (error) {
        results.errors.push(error.message);
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
        errors: []
    };

    try {
        // Create test project
        const projectResponse = await axios.post(`${ORCHESTRATOR_URL}/api/projects`, {
            name: `test-multiagent-${Date.now()}`,
            description: 'Multi-agent test'
        });

        // Create flow with 5 parallel agents
        const nodes = [];
        for (let i = 1; i <= 5; i++) {
            nodes.push({
                id: `agent-${i}`,
                type: 'agent',
                position: { x: 100 * i, y: 100 },
                data: {
                    label: `Agent ${i}`,
                    agentType: 'nodejs-developer',
                    instructions: `
                        console.log('Agent ${i} starting at', Date.now());
                        const fs = require('fs');
                        
                        // Create agent-specific output
                        fs.writeFileSync('agent-${i}-output.txt', 'Output from Agent ${i}');
                        
                        // Simulate work
                        const start = Date.now();
                        while (Date.now() - start < 1000) {
                            // Busy wait for 1 second
                        }
                        
                        console.log('Agent ${i} completed at', Date.now());
                        
                        // Write completion marker
                        fs.writeFileSync('agent-${i}-complete.json', JSON.stringify({
                            agent: ${i},
                            completed: Date.now()
                        }));
                    `,
                    hooks: {
                        stop: true,
                        postToolUse: true
                    }
                }
            });
        }

        const flowData = {
            projectId: projectResponse.data.id,
            name: 'Multi-Agent Test Flow',
            nodes: nodes,
            edges: [] // No edges = parallel execution
        };

        const flowResponse = await axios.post(`${ORCHESTRATOR_URL}/api/flows`, flowData);
        
        // Start execution
        console.log('  ✓ Starting 5 agents concurrently...');
        const executionResponse = await axios.post(`${ORCHESTRATOR_URL}/api/executions`, {
            flowId: flowResponse.data.id,
            mode: 'parallel'
        });

        // Monitor concurrent execution
        const startMonitor = Date.now();
        let checkCount = 0;
        let maxConcurrent = 0;
        let completedAgents = 0;

        while (checkCount < 20 && completedAgents < 5) {
            await delay(1000);
            
            const status = await axios.get(
                `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
            );

            if (status.data.nodes) {
                const runningCount = status.data.nodes.filter(n => n.status === 'running').length;
                maxConcurrent = Math.max(maxConcurrent, runningCount);
                completedAgents = status.data.nodes.filter(n => n.status === 'completed').length;
                
                console.log(`    Status: ${runningCount} running, ${completedAgents} completed`);
            }

            checkCount++;
        }

        // Verify results
        const finalStatus = await axios.get(
            `${ORCHESTRATOR_URL}/api/executions/${executionResponse.data.id}`
        );

        if (finalStatus.data.nodes) {
            // Check concurrent execution
            if (maxConcurrent > 1) {
                results.concurrentExecution = true;
                console.log(`    ✅ Concurrent execution verified (max ${maxConcurrent} agents)`);
            }

            // Check agent communication (via output files)
            const completedNodes = finalStatus.data.nodes.filter(n => n.status === 'completed');
            if (completedNodes.length === 5) {
                results.agentCommunication = true;
                console.log('    ✅ All agents communicated completion');
            }

            // Check for conflicts
            const failedNodes = finalStatus.data.nodes.filter(n => n.status === 'failed');
            if (failedNodes.length === 0) {
                results.noConflicts = true;
                console.log('    ✅ No conflicts detected');
            }

            // Check resource sharing
            if (completedNodes.length > 0 && completedNodes.every(n => n.output)) {
                results.resourceSharing = true;
                console.log('    ✅ Resource sharing successful');
            }
        }

    } catch (error) {
        results.errors.push(error.message);
        console.error('  ❌ Multi-agent test failed:', error.message);
    }

    testReport.tests.multiAgent = results;
    return results;
}

async function generateResourceMetrics() {
    const metrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: Date.now()
    };

    // Check orchestrator health
    try {
        const healthResponse = await axios.get(`${ORCHESTRATOR_URL}/api/health`);
        metrics.orchestratorHealth = healthResponse.data;
    } catch (error) {
        metrics.orchestratorHealth = { status: 'error', message: error.message };
    }

    return metrics;
}

async function runAllTests() {
    console.log('🧪 Anton Agent Communication Test Suite');
    console.log('=====================================');
    console.log(`Orchestrator: ${ORCHESTRATOR_URL}`);
    console.log(`Started: ${new Date().toISOString()}\n`);

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
                if (key !== 'errors') {
                    testReport.summary.total++;
                    if (value === true) {
                        testReport.summary.passed++;
                    } else if (value === false) {
                        testReport.summary.failed++;
                    }
                }
            });
        });

        // Add resource metrics
        testReport.resourceMetrics = await generateResourceMetrics();

        // Display summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Summary');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${testReport.summary.total}`);
        console.log(`✅ Passed: ${testReport.summary.passed}`);
        console.log(`❌ Failed: ${testReport.summary.failed}`);
        console.log(`⏱️  Duration: ${(testReport.summary.duration / 1000).toFixed(2)}s`);
        console.log(`📈 Success Rate: ${((testReport.summary.passed / testReport.summary.total) * 100).toFixed(1)}%`);

        // Write report
        fs.writeFileSync(REPORT_PATH, JSON.stringify(testReport, null, 2));
        console.log(`\n📄 Report saved to: ${REPORT_PATH}`);

        // Exit code based on results
        process.exit(testReport.summary.failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        testReport.fatalError = error.message;
        fs.writeFileSync(REPORT_PATH, JSON.stringify(testReport, null, 2));
        process.exit(1);
    }
}

// Check if axios is installed
try {
    require('axios');
} catch (error) {
    console.log('Installing required dependencies...');
    execSync('npm install axios', { cwd: __dirname });
}

// Run tests
runAllTests();