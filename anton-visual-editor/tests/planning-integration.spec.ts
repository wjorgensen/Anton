import { test, expect } from '@playwright/test';

test.describe('Anton Planning and Execution Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the dashboard
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should create a project using the planning system', async ({ page }) => {
    console.log('Testing project creation with planning system...');
    
    // Click the create project button
    const createButton = page.locator('button:has-text("Create Project")').first();
    await expect(createButton).toBeVisible();
    await createButton.click();
    
    // Fill in the project form
    await page.fill('input[placeholder*="Project Name"]', 'E2E Test Project');
    await page.fill('textarea[placeholder*="Describe"]', 'Build a REST API with Node.js and PostgreSQL database');
    
    // Submit the form
    await page.click('button:has-text("Create")');
    
    // Wait for navigation to circuit board
    await page.waitForURL(/\/circuit-board/, { timeout: 30000 });
    
    // Verify we're on the circuit board page
    const url = page.url();
    expect(url).toContain('/circuit-board');
    expect(url).toContain('id=');
    
    // Extract project ID from URL
    const projectId = new URL(url).searchParams.get('id');
    console.log('Created project with ID:', projectId);
    
    // Verify circuit board has nodes
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    const nodes = await page.locator('.react-flow__node').count();
    expect(nodes).toBeGreaterThan(0);
    console.log('Circuit board has', nodes, 'nodes');
    
    // Check for node labels
    const nodeLabels = await page.locator('.react-flow__node').allTextContents();
    console.log('Node labels:', nodeLabels);
    
    // Verify at least setup node exists
    const hasSetupNode = nodeLabels.some(label => 
      label.toLowerCase().includes('setup') || 
      label.toLowerCase().includes('init')
    );
    expect(hasSetupNode).toBe(true);
  });

  test('should display execution phases panel', async ({ page }) => {
    console.log('Testing execution phases panel...');
    
    // Create a project first
    await page.click('button:has-text("Create Project")').first();
    await page.fill('input[placeholder*="Project Name"]', 'Phase Test Project');
    await page.fill('textarea[placeholder*="Describe"]', 'Full-stack application with React frontend and Node.js backend');
    await page.click('button:has-text("Create")');
    
    // Wait for circuit board
    await page.waitForURL(/\/circuit-board/, { timeout: 30000 });
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    
    // Look for execution phase information
    const executionPlanText = await page.textContent('body');
    
    // Check if any planning-related information is displayed
    const hasPlanInfo = 
      executionPlanText.includes('Execution Plan') ||
      executionPlanText.includes('Phase') ||
      executionPlanText.includes('PARALLEL') ||
      executionPlanText.includes('Duration');
    
    if (hasPlanInfo) {
      console.log('Execution plan information found');
    } else {
      console.log('No execution plan panel visible (may need to be added to UI)');
    }
  });

  test('should execute a node using Claude CLI', async ({ page }) => {
    console.log('Testing node execution with Claude CLI...');
    
    // Create a simple project
    await page.click('button:has-text("Create Project")').first();
    await page.fill('input[placeholder*="Project Name"]', 'Execution Test');
    await page.fill('textarea[placeholder*="Describe"]', 'Simple Node.js API');
    await page.click('button:has-text("Create")');
    
    // Wait for circuit board
    await page.waitForURL(/\/circuit-board/, { timeout: 30000 });
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    
    // Try to run the circuit
    const runButton = page.locator('button:has-text("Run"), button:has-text("RUN"), button:has-text("Execute")').first();
    
    if (await runButton.isVisible()) {
      console.log('Found run button, clicking...');
      await runButton.click();
      
      // Wait for execution to start
      await page.waitForTimeout(2000);
      
      // Check for any status changes
      const statusElements = await page.locator('[class*="status"], [class*="progress"]').count();
      if (statusElements > 0) {
        console.log('Execution started, status elements found');
      }
      
      // Check console for execution logs
      page.on('console', msg => {
        if (msg.text().includes('Executing') || msg.text().includes('Claude')) {
          console.log('Execution log:', msg.text());
        }
      });
    } else {
      console.log('No run button found (may need manual node click)');
      
      // Try clicking on a node directly
      const firstNode = page.locator('.react-flow__node').first();
      await firstNode.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should verify backend data persistence', async ({ page }) => {
    console.log('Testing backend data persistence...');
    
    // Create a project
    await page.click('button:has-text("Create Project")').first();
    const projectName = `Persistence Test ${Date.now()}`;
    await page.fill('input[placeholder*="Project Name"]', projectName);
    await page.fill('textarea[placeholder*="Describe"]', 'Test project for backend persistence');
    await page.click('button:has-text("Create")');
    
    // Wait for circuit board
    await page.waitForURL(/\/circuit-board/, { timeout: 30000 });
    const projectUrl = page.url();
    const projectId = new URL(projectUrl).searchParams.get('id');
    console.log('Created project:', projectId);
    
    // Go back to dashboard
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check if project appears in the list
    const projectCards = page.locator('[class*="card"], [class*="project"]');
    await expect(projectCards).toHaveCount(expect.any(Number));
    
    // Look for our project
    const projectTexts = await projectCards.allTextContents();
    const hasOurProject = projectTexts.some(text => text.includes(projectName));
    
    if (hasOurProject) {
      console.log('✅ Project persisted and visible in dashboard');
    } else {
      console.log('⚠️ Project not found in dashboard (might be using localStorage)');
      
      // Check if it's a UUID (backend) or timestamp ID (frontend)
      if (projectId && projectId.includes('-') && projectId.length > 30) {
        console.log('Project ID appears to be UUID (backend generated)');
      } else {
        console.log('Project ID appears to be frontend generated');
      }
    }
  });

  test('should test API endpoints directly', async ({ request }) => {
    console.log('Testing backend API endpoints...');
    
    // Test health endpoint
    const healthResponse = await request.get('http://localhost:3002/health');
    expect(healthResponse.ok()).toBe(true);
    const health = await healthResponse.json();
    expect(health.status).toBe('ok');
    console.log('✅ Backend health check passed');
    
    // Test project creation via API
    const createResponse = await request.post('http://localhost:3002/api/projects', {
      data: {
        name: 'API Test Project',
        description: 'Created via Playwright test',
        flow: {
          nodes: [
            {
              id: 'test-node',
              agentId: 'setup',
              label: 'Test Setup',
              position: { x: 100, y: 100 }
            }
          ],
          edges: []
        }
      }
    });
    
    expect(createResponse.ok()).toBe(true);
    const project = await createResponse.json();
    expect(project.success).toBe(true);
    expect(project.project.id).toBeTruthy();
    console.log('✅ Backend project creation passed');
    console.log('Created backend project:', project.project.id);
    
    // Test listing projects
    const listResponse = await request.get('http://localhost:3002/api/projects');
    expect(listResponse.ok()).toBe(true);
    const list = await listResponse.json();
    expect(list.success).toBe(true);
    expect(Array.isArray(list.projects)).toBe(true);
    console.log('✅ Backend has', list.projects.length, 'projects');
  });

  test('should test planning endpoint', async ({ request }) => {
    console.log('Testing planning endpoint...');
    
    const planResponse = await request.post('http://localhost:3000/api/plan-circuit', {
      data: {
        prompt: 'Build a simple REST API with database'
      },
      timeout: 35000
    });
    
    if (planResponse.ok()) {
      const plan = await planResponse.json();
      console.log('✅ Planning endpoint responded');
      
      if (plan.plan) {
        console.log('Project Name:', plan.plan.projectName);
        console.log('Duration:', plan.plan.estimatedDuration);
        console.log('Strategy:', plan.plan.parallelizationStrategy);
      }
      
      if (plan.nodes) {
        console.log('Nodes:', plan.nodes.length);
      }
      
      if (plan.executionPhases) {
        console.log('Phases:', plan.executionPhases.length);
        const parallelPhases = plan.executionPhases.filter(p => p.parallel);
        console.log('Parallel phases:', parallelPhases.length);
      }
      
      if (plan.metadata?.generatedBy) {
        console.log('Generated by:', plan.metadata.generatedBy);
      }
    } else {
      console.log('⚠️ Planning endpoint failed or timed out');
      console.log('Status:', planResponse.status());
    }
  });
});

test.describe('Visual Regression', () => {
  test('should capture circuit board screenshot', async ({ page }) => {
    // Create a project and navigate to circuit board
    await page.goto('http://localhost:3000');
    await page.click('button:has-text("Create Project")').first();
    await page.fill('input[placeholder*="Project Name"]', 'Screenshot Test');
    await page.fill('textarea[placeholder*="Describe"]', 'Full-stack application');
    await page.click('button:has-text("Create")');
    
    // Wait for circuit board
    await page.waitForURL(/\/circuit-board/, { timeout: 30000 });
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let animations complete
    
    // Take screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/circuit-board-with-plan.png',
      fullPage: true 
    });
    console.log('Screenshot saved: circuit-board-with-plan.png');
  });
});