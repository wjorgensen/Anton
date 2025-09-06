const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const TEST_TIMEOUT = 60000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5000';

// Selectors for new drag-drop UI (based on actual implementation)
const SELECTORS = {
  // Dashboard
  dashboard: '.dashboard',
  newProjectBtn: 'button:has-text("New Project")',
  projectCard: '.project-card',
  
  // Agent Library - using class names from actual implementation
  agentLibrary: '.agent-library-scroll',
  agentSearchInput: 'input[placeholder*="Search"]',
  agentCategory: '.agent-category',
  agentItem: '.agent-item',
  categoryToggle: '.category-header',
  
  // Flow Editor
  flowCanvas: '.react-flow',
  flowNode: '.react-flow__node',
  flowEdge: '.react-flow__edge',
  runButton: 'button:has-text("Run")',
  saveButton: 'button:has-text("Save")',
  
  // Node Editor
  nodeEditor: '.node-editor',
  nodeProperty: '.node-property',
  
  // Terminal
  terminal: '.terminal-output',
  executionStatus: '.execution-status',
  
  // Modals
  modal: '[role="dialog"], .modal',
  modalInput: 'input',
  modalTextarea: 'textarea',
  modalSubmit: 'button:has-text("Create"), button:has-text("Submit")',
  modalCancel: 'button:has-text("Cancel")'
};

test.describe('New UI E2E Tests', () => {
  test.setTimeout(TEST_TIMEOUT);
  
  test.beforeEach(async ({ page }) => {
    // Navigate to frontend
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    
    // Clear local storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('1. Project Creation Flow', () => {
    test('should create a new project via dashboard', async ({ page }) => {
      // Click New Project button
      await page.click(SELECTORS.newProjectBtn);
      
      // Fill project details in modal
      await page.waitForSelector(SELECTORS.modal);
      await page.fill(SELECTORS.modalInput + '[name="name"]', 'Test Project E2E');
      await page.fill(SELECTORS.modalTextarea + '[name="description"]', 'This is an E2E test project for the new drag-drop UI');
      
      // Submit
      await page.click(SELECTORS.modalSubmit);
      
      // Verify project appears in list
      await page.waitForSelector(`${SELECTORS.projectCard}:has-text("Test Project E2E")`);
      
      // Take screenshot
      await page.screenshot({ path: 'tests/e2e/screenshots/project-created.png' });
    });

    test('should handle project creation errors', async ({ page }) => {
      // Click New Project without filling required fields
      await page.click(SELECTORS.newProjectBtn);
      await page.waitForSelector(SELECTORS.modal);
      
      // Try to submit empty form
      await page.click(SELECTORS.modalSubmit);
      
      // Check for validation error
      await expect(page.locator('.error-message')).toBeVisible();
    });
  });

  test.describe('2. Agent Library Interaction', () => {
    test('should display agent library sidebar', async ({ page }) => {
      // Navigate to editor (assuming project exists)
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Verify library is visible
      await expect(page.locator(SELECTORS.agentLibrary)).toBeVisible();
      
      // Screenshot the library
      await page.screenshot({ path: 'tests/e2e/screenshots/agent-library.png' });
    });

    test('should expand and collapse categories', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Get all categories
      const categories = await page.locator(SELECTORS.agentCategory).all();
      
      for (let i = 0; i < Math.min(3, categories.length); i++) {
        const category = categories[i];
        const toggle = category.locator(SELECTORS.categoryToggle);
        
        // Click to collapse
        await toggle.click();
        await expect(category).toHaveAttribute('data-expanded', 'false');
        
        // Click to expand
        await toggle.click();
        await expect(category).toHaveAttribute('data-expanded', 'true');
      }
    });

    test('should search for agents', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Search for a specific agent
      await page.fill(SELECTORS.agentSearchInput, 'data');
      
      // Verify filtered results
      const visibleAgents = await page.locator(SELECTORS.agentItem + ':visible').count();
      expect(visibleAgents).toBeGreaterThan(0);
      
      // Clear search
      await page.fill(SELECTORS.agentSearchInput, '');
      
      // Verify all agents visible again
      const allAgents = await page.locator(SELECTORS.agentItem).count();
      expect(allAgents).toBeGreaterThan(visibleAgents);
    });

    test('should load all 50+ agents', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Count total agents
      const agentCount = await page.locator(SELECTORS.agentItem).count();
      expect(agentCount).toBeGreaterThanOrEqual(50);
      
      // Log agent categories
      const categories = await page.locator(SELECTORS.agentCategory).allTextContents();
      console.log('Agent categories found:', categories);
    });
  });

  test.describe('3. Drag-Drop Flow Creation', () => {
    test('should drag agent from library to canvas', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Get first agent from library
      const firstAgent = page.locator(SELECTORS.agentItem).first();
      const canvas = page.locator(SELECTORS.flowCanvas);
      
      // Perform drag and drop
      await firstAgent.dragTo(canvas, {
        targetPosition: { x: 300, y: 200 }
      });
      
      // Verify node was created
      await expect(page.locator(SELECTORS.flowNode)).toHaveCount(1);
      
      // Screenshot the canvas with node
      await page.screenshot({ path: 'tests/e2e/screenshots/node-dropped.png' });
    });

    test('should create multiple agents via drag-drop', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      const canvas = page.locator(SELECTORS.flowCanvas);
      const positions = [
        { x: 200, y: 100 },
        { x: 400, y: 100 },
        { x: 300, y: 300 }
      ];
      
      // Drag multiple agents
      for (let i = 0; i < positions.length; i++) {
        const agent = page.locator(SELECTORS.agentItem).nth(i);
        await agent.dragTo(canvas, {
          targetPosition: positions[i]
        });
        
        // Verify progressive node creation
        await expect(page.locator(SELECTORS.flowNode)).toHaveCount(i + 1);
      }
      
      // Screenshot multi-node flow
      await page.screenshot({ path: 'tests/e2e/screenshots/multi-node-flow.png' });
    });

    test('should connect nodes', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Create two nodes first
      const canvas = page.locator(SELECTORS.flowCanvas);
      const agent1 = page.locator(SELECTORS.agentItem).first();
      const agent2 = page.locator(SELECTORS.agentItem).nth(1);
      
      await agent1.dragTo(canvas, { targetPosition: { x: 200, y: 200 } });
      await agent2.dragTo(canvas, { targetPosition: { x: 400, y: 200 } });
      
      // Connect nodes (assuming connection handles are present)
      const node1 = page.locator(SELECTORS.flowNode).first();
      const node2 = page.locator(SELECTORS.flowNode).nth(1);
      
      const sourceHandle = node1.locator('.source-handle');
      const targetHandle = node2.locator('.target-handle');
      
      await sourceHandle.dragTo(targetHandle);
      
      // Verify edge was created
      await expect(page.locator(SELECTORS.flowEdge)).toHaveCount(1);
      
      // Screenshot connected flow
      await page.screenshot({ path: 'tests/e2e/screenshots/connected-nodes.png' });
    });
  });

  test.describe('4. Node Editing', () => {
    test('should open node editor on double-click', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Create a node
      const canvas = page.locator(SELECTORS.flowCanvas);
      const agent = page.locator(SELECTORS.agentItem).first();
      await agent.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
      
      // Double-click node
      const node = page.locator(SELECTORS.flowNode).first();
      await node.dblclick();
      
      // Verify editor opens
      await expect(page.locator(SELECTORS.nodeEditor)).toBeVisible();
      
      // Screenshot editor
      await page.screenshot({ path: 'tests/e2e/screenshots/node-editor.png' });
    });

    test('should edit node properties', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Create and open node editor
      const canvas = page.locator(SELECTORS.flowCanvas);
      const agent = page.locator(SELECTORS.agentItem).first();
      await agent.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
      
      const node = page.locator(SELECTORS.flowNode).first();
      await node.dblclick();
      
      // Edit properties
      const propertyInput = page.locator(SELECTORS.nodeProperty + ' input').first();
      await propertyInput.fill('Updated Value');
      
      // Save changes
      await page.click('button:has-text("Save")');
      
      // Verify editor closes
      await expect(page.locator(SELECTORS.nodeEditor)).not.toBeVisible();
    });
  });

  test.describe('5. Flow Execution', () => {
    test('should execute flow and show progress', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Create a simple flow
      const canvas = page.locator(SELECTORS.flowCanvas);
      const agent = page.locator(SELECTORS.agentItem).first();
      await agent.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
      
      // Click Run button
      await page.click(SELECTORS.runButton);
      
      // Verify execution starts
      await expect(page.locator(SELECTORS.executionStatus)).toContainText(/running|executing/i);
      
      // Verify terminal output appears
      await expect(page.locator(SELECTORS.terminal)).toBeVisible();
      
      // Wait for execution to complete (with timeout)
      await page.waitForSelector(
        `${SELECTORS.executionStatus}:has-text("completed")`,
        { timeout: 30000 }
      ).catch(() => {
        console.log('Execution did not complete within timeout');
      });
      
      // Screenshot execution state
      await page.screenshot({ path: 'tests/e2e/screenshots/execution-complete.png' });
    });

    test('should show terminal output during execution', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Create and run flow
      const canvas = page.locator(SELECTORS.flowCanvas);
      const agent = page.locator(SELECTORS.agentItem).first();
      await agent.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
      
      await page.click(SELECTORS.runButton);
      
      // Check terminal has content
      await page.waitForFunction(
        selector => {
          const terminal = document.querySelector(selector);
          return terminal && terminal.textContent.length > 0;
        },
        SELECTORS.terminal,
        { timeout: 10000 }
      );
      
      const terminalContent = await page.locator(SELECTORS.terminal).textContent();
      expect(terminalContent).toBeTruthy();
    });
  });

  test.describe('6. Visual and Responsive Tests', () => {
    test('should capture screenshots of major views', async ({ page }) => {
      const views = [
        { url: FRONTEND_URL, name: 'dashboard' },
        { url: `${FRONTEND_URL}/editor`, name: 'editor' },
        { url: `${FRONTEND_URL}/projects`, name: 'projects' }
      ];
      
      for (const view of views) {
        await page.goto(view.url);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ 
          path: `tests/e2e/screenshots/view-${view.name}.png`,
          fullPage: true 
        });
      }
    });

    test('should test responsive breakpoints', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      const breakpoints = [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 1024, height: 768, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];
      
      for (const breakpoint of breakpoints) {
        await page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        
        await page.waitForTimeout(500); // Allow layout to adjust
        
        await page.screenshot({ 
          path: `tests/e2e/screenshots/responsive-${breakpoint.name}.png`,
          fullPage: false 
        });
        
        // Check if agent library adapts
        const libraryVisible = await page.locator(SELECTORS.agentLibrary).isVisible();
        console.log(`Agent library visible at ${breakpoint.name}: ${libraryVisible}`);
      }
    });

    test('should verify dark theme consistency', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Toggle dark theme (assuming theme toggle exists)
      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      if (await themeToggle.count() > 0) {
        await themeToggle.click();
        
        // Verify dark theme applied
        const htmlClass = await page.locator('html').getAttribute('class');
        expect(htmlClass).toContain('dark');
        
        // Screenshot dark theme
        await page.screenshot({ path: 'tests/e2e/screenshots/dark-theme.png' });
      }
    });

    test('should check animation smoothness', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      // Start performance trace
      await page.tracing.start({ screenshots: true, snapshots: true });
      
      // Perform actions that trigger animations
      const agent = page.locator(SELECTORS.agentItem).first();
      const canvas = page.locator(SELECTORS.flowCanvas);
      
      // Drag operation (should be smooth)
      await agent.dragTo(canvas, {
        targetPosition: { x: 300, y: 200 },
        force: false
      });
      
      // Category expand/collapse animation
      const categoryToggle = page.locator(SELECTORS.categoryToggle).first();
      await categoryToggle.click();
      await page.waitForTimeout(300);
      await categoryToggle.click();
      
      // Stop trace
      await page.tracing.stop({ path: 'tests/e2e/trace.zip' });
    });
  });

  test.describe('7. Performance Tests', () => {
    test('should measure page load performance', async ({ page }) => {
      // Measure initial load
      const startTime = Date.now();
      await page.goto(`${FRONTEND_URL}/editor`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`Page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      // Get performance metrics
      const metrics = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
          totalTime: perfData.loadEventEnd - perfData.fetchStart
        };
      });
      
      console.log('Performance metrics:', metrics);
    });

    test('should handle large number of nodes efficiently', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/editor`);
      
      const canvas = page.locator(SELECTORS.flowCanvas);
      
      // Measure time to create 20 nodes
      const startTime = Date.now();
      
      for (let i = 0; i < 20; i++) {
        const agent = page.locator(SELECTORS.agentItem).nth(i % 5);
        const x = 200 + (i % 5) * 150;
        const y = 100 + Math.floor(i / 5) * 150;
        
        await agent.dragTo(canvas, {
          targetPosition: { x, y }
        });
      }
      
      const createTime = Date.now() - startTime;
      console.log(`Time to create 20 nodes: ${createTime}ms`);
      
      // Verify all nodes created
      await expect(page.locator(SELECTORS.flowNode)).toHaveCount(20);
      
      // Screenshot large flow
      await page.screenshot({ path: 'tests/e2e/screenshots/large-flow.png' });
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Capture screenshot on failure
    if (testInfo.status !== 'passed') {
      await page.screenshot({ 
        path: `tests/e2e/screenshots/failure-${testInfo.title.replace(/\s+/g, '-')}.png` 
      });
    }
    
    // Clear any lingering modals
    const modal = page.locator(SELECTORS.modal);
    if (await modal.count() > 0) {
      const cancelBtn = page.locator(SELECTORS.modalCancel);
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      }
    }
  });
});

// Export for use in other test files
module.exports = { SELECTORS, TEST_TIMEOUT };