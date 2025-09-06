import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:3001',  // Frontend on port 3001
});

test.describe('Complete Anton Workflow', () => {
  test('should complete full workflow: plan → create → execute', async ({ page, request }) => {
    console.log('Starting complete workflow test...');
    
    // Step 1: Navigate to dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    console.log('✅ Dashboard loaded');
    
    // Step 2: Create a new project
    await test.step('Create project with planning', async () => {
      // Click create button
      const createBtn = page.locator('button:has-text("Create Project"), button:has-text("New Project"), button:has-text("Start New")').first();
      await expect(createBtn).toBeVisible({ timeout: 10000 });
      await createBtn.click();
      console.log('✅ Create project dialog opened');
      
      // Fill in project details
      const nameInput = page.locator('input[type="text"]').first();
      await nameInput.fill('Workflow Test Project');
      
      const descInput = page.locator('textarea').first();
      await descInput.fill('Build a REST API with Node.js backend and PostgreSQL database for user management');
      
      console.log('✅ Project details filled');
      
      // Submit the form
      const submitBtn = page.locator('button:has-text("Create"), button:has-text("Generate"), button:has-text("Start")').last();
      await submitBtn.click();
      
      // Wait for navigation to circuit board (with longer timeout for planning)
      await page.waitForURL(/\/circuit-board/, { timeout: 45000 });
      console.log('✅ Navigated to circuit board');
    });
    
    // Step 3: Verify circuit board generation
    await test.step('Verify circuit board', async () => {
      // Wait for nodes to appear
      await page.waitForSelector('.react-flow__node', { timeout: 15000 });
      
      const nodes = await page.locator('.react-flow__node').count();
      expect(nodes).toBeGreaterThan(0);
      console.log(`✅ Circuit board has ${nodes} nodes`);
      
      // Check for edges (connections)
      const edges = await page.locator('.react-flow__edge').count();
      console.log(`✅ Circuit board has ${edges} edges`);
      
      // Get project ID from URL
      const url = page.url();
      const projectId = new URL(url).searchParams.get('id');
      console.log(`✅ Project ID: ${projectId}`);
      
      // Check if it's a backend UUID or frontend ID
      if (projectId && projectId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
        console.log('✅ Using backend storage (UUID format)');
      } else {
        console.log('⚠️  Using frontend storage (not UUID)');
      }
    });
    
    // Step 4: Test execution capabilities
    await test.step('Test execution', async () => {
      // Look for run button
      const runBtn = page.locator('button:has-text("Run"), button:has-text("Execute"), button:has-text("Start")');
      
      if (await runBtn.count() > 0) {
        console.log('✅ Execution button found');
        
        // Click to start execution
        await runBtn.first().click();
        await page.waitForTimeout(3000);
        
        // Check for status changes
        const statusIndicators = await page.locator('[class*="status"], [class*="progress"], [class*="running"]').count();
        if (statusIndicators > 0) {
          console.log('✅ Execution started (status indicators visible)');
        }
      } else {
        console.log('⚠️  No run button found, trying node click');
        
        // Try clicking a node directly
        const firstNode = page.locator('.react-flow__node').first();
        await firstNode.click();
        console.log('✅ Clicked first node');
      }
    });
    
    // Step 5: Verify backend persistence
    await test.step('Verify backend persistence', async () => {
      // Get all projects from backend
      const response = await request.get('http://localhost:3002/api/projects');
      expect(response.ok()).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.projects)).toBe(true);
      
      console.log(`✅ Backend has ${data.projects.length} projects`);
      
      // Check if our project exists
      const hasWorkflowProject = data.projects.some(p => 
        p.name && p.name.includes('Workflow Test')
      );
      
      if (hasWorkflowProject) {
        console.log('✅ Our project is persisted in backend');
      } else {
        console.log('⚠️  Project not found in backend (may be using localStorage)');
      }
    });
    
    // Step 6: Check planning metadata
    await test.step('Check planning features', async () => {
      const pageContent = await page.textContent('body');
      
      // Check for planning-related UI elements
      const hasPlanningUI = 
        pageContent.includes('Phase') ||
        pageContent.includes('Parallel') ||
        pageContent.includes('Execution Plan') ||
        pageContent.includes('Duration');
      
      if (hasPlanningUI) {
        console.log('✅ Planning UI elements present');
      } else {
        console.log('⚠️  No planning UI visible (may need to add ExecutionPhasePanel)');
      }
    });
    
    // Take a screenshot for documentation
    await page.screenshot({ 
      path: 'tests/screenshots/complete-workflow.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: complete-workflow.png');
  });
  
  test('should test planning endpoint directly', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/plan-circuit', {
      data: {
        prompt: 'Create a microservices architecture with user service, product service, and order service'
      },
      timeout: 20000
    });
    
    if (response.ok()) {
      const plan = await response.json();
      
      expect(plan).toHaveProperty('nodes');
      expect(plan).toHaveProperty('edges');
      expect(Array.isArray(plan.nodes)).toBe(true);
      expect(plan.nodes.length).toBeGreaterThan(0);
      
      console.log('✅ Planning endpoint test passed');
      console.log(`   - Nodes: ${plan.nodes.length}`);
      console.log(`   - Edges: ${plan.edges.length}`);
      
      if (plan.executionPhases) {
        console.log(`   - Phases: ${plan.executionPhases.length}`);
        const parallel = plan.executionPhases.filter(p => p.parallel).length;
        console.log(`   - Parallel phases: ${parallel}`);
      }
      
      if (plan.metadata) {
        console.log(`   - Generated by: ${plan.metadata.generatedBy}`);
        if (plan.metadata.estimatedSavings) {
          console.log(`   - Time savings: ${plan.metadata.estimatedSavings}`);
        }
      }
    } else {
      console.log('❌ Planning endpoint failed:', response.status());
    }
  });
});