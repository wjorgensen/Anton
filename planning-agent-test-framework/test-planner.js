#!/usr/bin/env node

/**
 * Planning Agent Test Framework
 * 
 * This script tests the planning agent by spawning headless Claude instances
 * with the planning prompt and monitoring the output.
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const { getAgentList } = require('../agents/scan-agents.js');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class PlanningAgentTester {
  constructor() {
    this.testDir = __dirname;
    this.instructionsPath = path.join(this.testDir, 'instructions.md');
    this.outputDir = path.join(this.testDir, 'test-outputs');
    this.testCasesPath = path.join(this.testDir, 'test-cases.json');
  }

  async init() {
    // Create output directory if it doesn't exist
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Load test cases if they exist
    try {
      const testCasesContent = await fs.readFile(this.testCasesPath, 'utf-8');
      this.testCases = JSON.parse(testCasesContent);
    } catch (error) {
      this.testCases = this.getDefaultTestCases();
      await this.saveTestCases();
    }
  }

  getDefaultTestCases() {
    return [
      {
        id: 'ecommerce',
        name: 'E-commerce Platform',
        prompt: 'Build a full-stack e-commerce platform with React frontend, Node.js backend, PostgreSQL database, payment integration with Stripe, and admin dashboard'
      },
      {
        id: 'social-media',
        name: 'Social Media App',
        prompt: 'Create a social media application with real-time messaging, user profiles, post feed, likes/comments, and notification system using Next.js and Firebase'
      },
      {
        id: 'saas-dashboard',
        name: 'SaaS Analytics Dashboard',
        prompt: 'Develop a SaaS analytics dashboard with data visualization, user authentication, subscription management, and API for data ingestion'
      },
      {
        id: 'blog-platform',
        name: 'Blog Platform',
        prompt: 'Build a blog platform with markdown editor, SEO optimization, comment system, and content management system'
      },
      {
        id: 'task-manager',
        name: 'Task Management System',
        prompt: 'Create a collaborative task management system with project boards, real-time updates, team collaboration features, and reporting'
      }
    ];
  }

  async saveTestCases() {
    await fs.writeFile(
      this.testCasesPath,
      JSON.stringify(this.testCases, null, 2),
      'utf-8'
    );
  }

  async prepareInstructions(projectPrompt, templatePath = null) {
    // Get the dynamic agent list
    const agentList = await getAgentList();
    
    // Read the instructions template
    const instructionsPath = templatePath || this.instructionsPath;
    const instructionsTemplate = await fs.readFile(instructionsPath, 'utf-8');
    
    // Replace placeholders
    const instructions = instructionsTemplate
      .replace('[AGENT_LIST_PLACEHOLDER]', agentList)
      .replace('[PROJECT_PROMPT_PLACEHOLDER]', projectPrompt);
    
    return instructions;
  }

  async createTestEnvironment(testCaseId) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testRunDir = path.join(this.outputDir, `${testCaseId}-${timestamp}`);
    
    // Create test run directory
    await fs.mkdir(testRunDir, { recursive: true });
    
    // Create .anton/plan directory for output
    await fs.mkdir(path.join(testRunDir, '.anton', 'plan'), { recursive: true });
    
    return testRunDir;
  }

  async fixPlan(testRunDir, projectPrompt) {
    console.log(`\n${colors.yellow}Running plan fixer to review and fix the generated plan...${colors.reset}`);
    
    try {
      // Prepare fixer instructions
      const fixerInstructionsPath = path.join(this.testDir, 'instructions-fixer.md');
      const fixerInstructions = await this.prepareInstructions(projectPrompt, fixerInstructionsPath);
      
      // Read the plan-fixer.md for system prompt
      const planFixerPath = path.join(this.testDir, '.claude', 'plan-fixer.md');
      const planFixerPrompt = await fs.readFile(planFixerPath, 'utf-8');
      
      console.log(`${colors.dim}Starting plan fixer in ${testRunDir}...${colors.reset}`);
      
      // Spawn Claude for plan fixing
      const claudeProcess = spawn('claude', [
        '-p',  // Print mode (headless)
        fixerInstructions,  // The fixer instructions
        '--output-format', 'stream-json',  // Stream JSON output to see progress
        '--permission-mode', 'acceptEdits',  // Auto-accept edits in headless mode
        '--verbose',  // Show verbose output
        '--append-system-prompt', planFixerPrompt  // Append the plan-fixer system prompt
      ], {
        cwd: testRunDir,
        stdio: 'inherit',  // Inherit stdio - shows raw live output
        env: { ...process.env }
      });
      
      return new Promise((resolve, reject) => {
        claudeProcess.on('close', async (code) => {
          if (code === 0) {
            console.log(`\n${colors.green}✓ Plan review and fix completed${colors.reset}`);
            resolve({ success: true });
          } else {
            console.log(`\n${colors.red}✗ Plan fixer failed with code ${code}${colors.reset}`);
            resolve({ success: false, code });
          }
        });
        
        claudeProcess.on('error', (error) => {
          console.error(`${colors.red}Failed to run plan fixer: ${error.message}${colors.reset}`);
          reject(error);
        });
      });
    } catch (error) {
      console.error(`${colors.red}Error in plan fixer: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  async spawnClaude(testRunDir, instructions) {
    return new Promise(async (resolve, reject) => {
      try {
        
        console.log(`${colors.dim}Starting Claude in ${testRunDir}...${colors.reset}`);
        
        // Spawn Claude with inherited stdio for live output
        const claudeProcess = spawn('claude', [
          '-p',  // Print mode (headless)
          instructions,  // The task instructions
          '--output-format', 'stream-json',  // Stream JSON output to see progress
          '--permission-mode', 'acceptEdits',
          '--verbose'  // Auto-accept edits in headless mode
        ], {
          cwd: testRunDir,
          stdio: 'inherit',  // Inherit stdio - shows raw live output
          env: { ...process.env }
        });
        
        claudeProcess.on('close', async (code) => {
          
          // Check if plan.json was created
          const planPath = path.join(testRunDir, '.anton', 'plan', 'plan.json');
          try {
            await fs.access(planPath);
            console.log(`\n${colors.green}✓ Plan generated successfully at: ${planPath}${colors.reset}`);
            resolve({ 
              success: true, 
              planPath,
              code
            });
          } catch (error) {
            console.log(`\n${colors.red}✗ Failed to generate plan${colors.reset}`);
            if (code !== 0) {
              console.log(`${colors.red}Process exited with code ${code}${colors.reset}`);
            }
            resolve({ 
              success: false, 
              error: 'Plan file not generated',
              code
            });
          }
        });
        
        claudeProcess.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async runTest(testCase) {
    console.log(`\n${colors.cyan}Testing: ${testCase.name}${colors.reset}`);

    try {
      // Prepare instructions with dynamic agent list
      const instructions = await this.prepareInstructions(testCase.prompt);
      
      // Only output instructions in verbose mode
      if (process.env.VERBOSE === 'true') {
        console.log(`\n${colors.yellow}=== FULL INSTRUCTIONS (for debugging) ===${colors.reset}`);
        console.log(instructions);
        console.log(`${colors.yellow}=== END INSTRUCTIONS ===${colors.reset}\n`);
      }
      
      // Create test environment
      const testRunDir = await this.createTestEnvironment(testCase.id);
      
      // Save the prepared instructions for reference
      const instructionsPath = path.join(testRunDir, 'full-instructions.md');
      await fs.writeFile(instructionsPath, instructions, 'utf-8');
      
      console.log(`${colors.dim}Spawning Claude...${colors.reset}`);
      
      // Spawn Claude and wait for completion
      const result = await this.spawnClaude(testRunDir, instructions);
      
      // Always run the plan fixer after initial generation
      if (result.success) {
        await this.fixPlan(testRunDir, testCase.prompt);
        
        // Validate the fixed plan
        const fixedPlanPath = path.join(testRunDir, '.anton', 'plan', 'plan.json');
        await this.validatePlan(fixedPlanPath);
      }
      
      return testRunDir;
    } catch (error) {
      console.error(`${colors.red}Test failed: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  async validatePlan(planPath) {
    try {
      const planContent = await fs.readFile(planPath, 'utf-8');
      const plan = JSON.parse(planContent);
      
      console.log(`\n${colors.yellow}Plan Validation:${colors.reset}`);
      
      // Check required fields
      const checks = [
        { field: 'plan', present: !!plan.plan },
        { field: 'nodes', present: !!plan.nodes && Array.isArray(plan.nodes) },
        { field: 'executionFlow', present: !!plan.executionFlow }
      ];
      
      checks.forEach(check => {
        if (check.present) {
          console.log(`  ${colors.green}✓${colors.reset} ${check.field} present`);
        } else {
          console.log(`  ${colors.red}✗${colors.reset} ${check.field} missing`);
        }
      });
      
      if (plan.plan) {
        console.log(`\n  ${colors.blue}Project:${colors.reset} ${plan.plan.projectName}`);
        console.log(`  ${colors.dim}${plan.plan.description}${colors.reset}`);
      }
      
      if (plan.nodes) {
        console.log(`\n  ${colors.blue}Nodes (${plan.nodes.length} total):${colors.reset}`);
        
        // Count node types
        const nodeTypes = {};
        const testingLoops = [];
        
        plan.nodes.forEach(node => {
          nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
          if (node.testingLoop) {
            testingLoops.push(node);
          }
        });
        
        Object.entries(nodeTypes).forEach(([type, count]) => {
          console.log(`    ${colors.cyan}${type}:${colors.reset} ${count}`);
        });
        
        if (testingLoops.length > 0) {
          console.log(`    ${colors.green}Testing loops:${colors.reset} ${testingLoops.length}`);
        }
      }
      
      // Generate ASCII visualization
      if (plan.executionFlow && plan.nodes) {
        console.log(`\n${colors.yellow}=== ASCII Execution Flow ===${colors.reset}\n`);
        
        const nodeMap = {};
        plan.nodes.forEach(node => {
          nodeMap[node.id] = node;
        });
        
        const drawFlow = (flow, prefix = '', isLast = true, depth = 0) => {
          const connector = isLast ? '└── ' : '├── ';
          const extension = isLast ? '    ' : '│   ';
          
          if (flow.type === 'node') {
            const nodeId = flow.children;
            const node = nodeMap[nodeId];
            if (node) {
              const typeColor = {
                'setup': colors.yellow,
                'execution': colors.cyan,
                'testing': colors.green,
                'fix-execution': colors.red,
                'integration': colors.blue
              }[node.type] || colors.white;
              
              console.log(`${prefix}${connector}${typeColor}[${node.type}]${colors.reset} ${node.label || nodeId}`);
              
              // Show testing loop connections
              if (node.testingLoop) {
                console.log(`${prefix}${extension}    ${colors.dim}↳ loops: ${node.testingLoop.testNode} ↔ ${node.testingLoop.fixNode}${colors.reset}`);
              }
            } else {
              console.log(`${prefix}${connector}${colors.red}[missing]${colors.reset} ${nodeId}`);
            }
          } else if (flow.type === 'sequential') {
            console.log(`${prefix}${connector}${colors.yellow}▼ Sequential${colors.reset}${flow.id ? ` (${flow.id})` : ''}`);
            if (Array.isArray(flow.children)) {
              flow.children.forEach((child, index) => {
                drawFlow(child, prefix + extension, index === flow.children.length - 1, depth + 1);
              });
            }
          } else if (flow.type === 'parallel') {
            console.log(`${prefix}${connector}${colors.green}◆ Parallel${colors.reset}${flow.id ? ` (${flow.id})` : ''} ${colors.dim}[${flow.children?.length || 0} branches]${colors.reset}`);
            if (Array.isArray(flow.children)) {
              flow.children.forEach((child, index) => {
                drawFlow(child, prefix + extension, index === flow.children.length - 1, depth + 1);
              });
            }
          }
        };
        
        drawFlow(plan.executionFlow, '', true);
        
        console.log(`\n${colors.yellow}=== End ASCII Flow ===${colors.reset}`);
      }
      
      // Validate node references
      if (plan.nodes && plan.nodes.length > 0) {
        console.log(`\n  ${colors.yellow}Dependency Validation:${colors.reset}`);
        const nodeIds = new Set(plan.nodes.map(n => n.id));
        let invalidDeps = 0;
        
        plan.nodes.forEach(node => {
          if (node.dependencies) {
            node.dependencies.forEach(dep => {
              if (!nodeIds.has(dep)) {
                console.log(`    ${colors.red}✗${colors.reset} Node '${node.id}' references invalid dependency '${dep}'`);
                invalidDeps++;
              }
            });
          }
        });
        
        if (invalidDeps === 0) {
          console.log(`    ${colors.green}✓${colors.reset} All dependencies valid`);
        }
      }
      
    } catch (error) {
      console.error(`${colors.red}Failed to validate plan: ${error.message}${colors.reset}`);
    }
  }

  async interactiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    console.log(`\n${colors.bright}${colors.cyan}Planning Agent Test Framework${colors.reset}`);
    console.log(`${colors.dim}Test planning agent with headless Claude instances${colors.reset}\n`);

    while (true) {
      console.log(`\n${colors.yellow}Options:${colors.reset}`);
      console.log('1. Run predefined test case');
      console.log('2. Enter custom prompt');
      console.log('3. View recent test runs');
      console.log('4. Validate existing plan');
      console.log('5. Compare plans');
      console.log('6. Exit\n');

      const choice = await question(`${colors.cyan}Select option (1-6): ${colors.reset}`);

      switch(choice.trim()) {
        case '1':
          await this.selectTestCase(question);
          break;
        case '2':
          await this.customPrompt(question);
          break;
        case '3':
          await this.viewRecentRuns();
          break;
        case '4':
          await this.validateExistingPlan(question);
          break;
        case '5':
          await this.comparePlans(question);
          break;
        case '6':
          rl.close();
          return;
        default:
          console.log(`${colors.red}Invalid option${colors.reset}`);
      }
    }
  }

  async selectTestCase(question) {
    console.log(`\n${colors.yellow}Available test cases:${colors.reset}`);
    this.testCases.forEach((tc, index) => {
      console.log(`${index + 1}. ${tc.name}`);
      console.log(`   ${colors.dim}${tc.prompt.substring(0, 60)}...${colors.reset}`);
    });
    
    const selection = await question(`\n${colors.cyan}Select test case (1-${this.testCases.length}): ${colors.reset}`);
    const index = parseInt(selection) - 1;
    
    if (index >= 0 && index < this.testCases.length) {
      const testRunDir = await this.runTest(this.testCases[index]);
      console.log(`\n${colors.green}Test completed. Output directory: ${testRunDir}${colors.reset}`);
    } else {
      console.log(`${colors.red}Invalid selection${colors.reset}`);
    }
  }

  async customPrompt(question) {
    const prompt = await question(`\n${colors.cyan}Enter your project prompt: ${colors.reset}`);
    const testCase = {
      id: 'custom',
      name: 'Custom Test',
      prompt: prompt.trim()
    };
    const testRunDir = await this.runTest(testCase);
    console.log(`\n${colors.green}Test completed. Output directory: ${testRunDir}${colors.reset}`);
  }

  async viewRecentRuns() {
    const dirs = await fs.readdir(this.outputDir);
    const testRuns = dirs
      .filter(d => !d.endsWith('.md'))
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 10);
    
    console.log(`\n${colors.yellow}Recent test runs:${colors.reset}`);
    for (const dir of testRuns) {
      const planPath = path.join(this.outputDir, dir, '.anton', 'plan', 'plan.json');
      try {
        await fs.access(planPath);
        console.log(`  ${colors.green}✓${colors.reset} ${dir}`);
      } catch {
        console.log(`  ${colors.red}✗${colors.reset} ${dir} (no plan)`);
      }
    }
  }

  async validateExistingPlan(question) {
    const dirs = await fs.readdir(this.outputDir);
    const testRuns = dirs.filter(d => !d.endsWith('.md')).sort((a, b) => b.localeCompare(a));
    
    if (testRuns.length === 0) {
      console.log(`${colors.red}No test runs found${colors.reset}`);
      return;
    }
    
    console.log(`\n${colors.yellow}Select test run to validate:${colors.reset}`);
    testRuns.slice(0, 10).forEach((dir, index) => {
      console.log(`${index + 1}. ${dir}`);
    });
    
    const selection = await question(`\n${colors.cyan}Select run (1-${Math.min(10, testRuns.length)}): ${colors.reset}`);
    const index = parseInt(selection) - 1;
    
    if (index >= 0 && index < testRuns.length) {
      const planPath = path.join(this.outputDir, testRuns[index], '.anton', 'plan', 'plan.json');
      await this.validatePlan(planPath);
    } else {
      console.log(`${colors.red}Invalid selection${colors.reset}`);
    }
  }

  async comparePlans(question) {
    const dirs = await fs.readdir(this.outputDir);
    const testRuns = dirs.filter(d => !d.endsWith('.md')).sort((a, b) => b.localeCompare(a));
    
    if (testRuns.length < 2) {
      console.log(`${colors.red}Need at least 2 test runs to compare${colors.reset}`);
      return;
    }
    
    console.log(`\n${colors.yellow}Select test runs to compare:${colors.reset}`);
    testRuns.slice(0, 10).forEach((dir, index) => {
      console.log(`${index + 1}. ${dir}`);
    });
    
    const first = await question(`\n${colors.cyan}First run (1-${Math.min(10, testRuns.length)}): ${colors.reset}`);
    const second = await question(`${colors.cyan}Second run (1-${Math.min(10, testRuns.length)}): ${colors.reset}`);
    
    const firstIndex = parseInt(first) - 1;
    const secondIndex = parseInt(second) - 1;
    
    if (firstIndex >= 0 && firstIndex < testRuns.length && 
        secondIndex >= 0 && secondIndex < testRuns.length) {
      const plan1Path = path.join(this.outputDir, testRuns[firstIndex], '.anton', 'plan', 'plan.json');
      const plan2Path = path.join(this.outputDir, testRuns[secondIndex], '.anton', 'plan', 'plan.json');
      
      try {
        const plan1 = JSON.parse(await fs.readFile(plan1Path, 'utf-8'));
        const plan2 = JSON.parse(await fs.readFile(plan2Path, 'utf-8'));
        
        console.log(`\n${colors.yellow}Comparison:${colors.reset}`);
        console.log(`  ${testRuns[firstIndex]}:`);
        console.log(`    Total Nodes: ${plan1.nodes?.length || 0}`);
        if (plan1.nodes) {
          const types1 = {};
          plan1.nodes.forEach(n => types1[n.type] = (types1[n.type] || 0) + 1);
          Object.entries(types1).forEach(([type, count]) => {
            console.log(`      ${type}: ${count}`);
          });
        }
        console.log(`    Phases: ${plan1.executionFlow?.length || 0}`);
        
        console.log(`\n  ${testRuns[secondIndex]}:`);
        console.log(`    Total Nodes: ${plan2.nodes?.length || 0}`);
        if (plan2.nodes) {
          const types2 = {};
          plan2.nodes.forEach(n => types2[n.type] = (types2[n.type] || 0) + 1);
          Object.entries(types2).forEach(([type, count]) => {
            console.log(`      ${type}: ${count}`);
          });
        }
        console.log(`    Phases: ${plan2.executionFlow?.length || 0}`);
        
      } catch (error) {
        console.log(`${colors.red}Error comparing plans: ${error.message}${colors.reset}`);
      }
    } else {
      console.log(`${colors.red}Invalid selection${colors.reset}`);
    }
  }
}

// Main execution
async function main() {
  const tester = new PlanningAgentTester();
  await tester.init();
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const command = args[0];
    
    if (command === 'test' && args[1]) {
      // Run a specific test case
      const testCase = tester.testCases.find(tc => tc.id === args[1]);
      if (testCase) {
        await tester.runTest(testCase);
      } else {
        console.log(`${colors.red}Test case '${args[1]}' not found${colors.reset}`);
      }
    } else if (command === 'prompt' && args[1]) {
      // Run with custom prompt
      await tester.runTest({
        id: 'cli-custom',
        name: 'CLI Custom',
        prompt: args.slice(1).join(' ')
      });
    } else if (command === 'list') {
      // List test cases
      console.log(`${colors.yellow}Available test cases:${colors.reset}`);
      tester.testCases.forEach(tc => {
        console.log(`  ${colors.blue}${tc.id}${colors.reset}: ${tc.name}`);
      });
    } else if (command === 'validate' && args[1]) {
      // Validate a specific plan file
      await tester.validatePlan(args[1]);
    } else {
      console.log(`${colors.yellow}Usage:${colors.reset}`);
      console.log('  node test-planner.js           - Interactive mode');
      console.log('  node test-planner.js test <id> - Run specific test case');
      console.log('  node test-planner.js prompt <text> - Run with custom prompt');
      console.log('  node test-planner.js list      - List test cases');
      console.log('  node test-planner.js validate <path> - Validate plan file');
      console.log('');
      console.log(`${colors.yellow}Note:${colors.reset} Plans are automatically reviewed and fixed after generation`);
    }
  } else {
    // Interactive mode
    await tester.interactiveMode();
  }
}

main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});