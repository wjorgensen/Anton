import { test, expect } from '@playwright/test';

test.describe('Circuit Board UI', () => {
  test('should load the dashboard', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Check for the main title
    await expect(page.locator('h1')).toContainText('Circuit Board Studio');
    
    // Check for the new project button
    await expect(page.getByRole('button', { name: /New Project/i })).toBeVisible();
  });

  test('should create a new project and show circuit board', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Click the New Project button
    await page.getByRole('button', { name: /New Project/i }).click();
    
    // Wait for the wizard modal
    await expect(page.locator('h2:has-text("Create New Project")')).toBeVisible();
    
    // Fill in the project details
    await page.getByPlaceholder('My Amazing Project').fill('Test Playwright Project');
    await page.getByPlaceholder(/Describe your project in detail/i).fill(
      'Build a web scraping tool using Playwright that can navigate websites, extract data, and save it to a database'
    );
    
    // Click the create button
    await page.getByRole('button', { name: /Create & View Circuit Board/i }).click();
    
    // Wait for circuit board page to load
    await page.waitForURL(/circuit-board/);
    
    // Check for circuit board elements
    await expect(page.locator('text=Circuit Board Editor')).toBeVisible({ timeout: 10000 });
    
    // Check for the Run button
    await expect(page.getByRole('button', { name: /Run/i })).toBeVisible();
    
    // Check for the Add Node button
    await expect(page.getByRole('button', { name: /Add Node/i })).toBeVisible();
  });

  test('should add and edit a node', async ({ page }) => {
    // Navigate directly to circuit board with test data
    await page.goto('http://localhost:3001/circuit-board?name=TestProject&prompt=Test+prompt');
    
    // Wait for the page to load
    await page.waitForTimeout(2000);
    
    // Click Add Node button
    await page.getByRole('button', { name: /Add Node/i }).click();
    
    // Wait for the node to appear
    await page.waitForTimeout(500);
    
    // Click on the new node to edit it
    await page.locator('.react-flow__node').first().click();
    
    // Wait for edit panel
    await expect(page.locator('text=Edit Node')).toBeVisible();
    
    // Edit the node
    await page.getByPlaceholder('Enter node label').fill('Playwright Test Agent');
    await page.locator('select').selectOption('playwright-e2e');
    await page.getByPlaceholder('Enter node description').fill('Automated testing with Playwright');
    
    // Save the node
    await page.getByRole('button', { name: /Save/i }).click();
  });

  test('should run the circuit board with visual feedback', async ({ page }) => {
    await page.goto('http://localhost:3001/circuit-board?name=TestProject&prompt=Test+prompt');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Click the Run button
    await page.getByRole('button', { name: /Run/i }).click();
    
    // Check that the button changes to Pause
    await expect(page.getByRole('button', { name: /Pause/i })).toBeVisible();
    
    // Wait for execution to complete (or timeout)
    await page.waitForTimeout(3000);
    
    // Check for completion status
    const statusText = await page.locator('text=/completed/').textContent();
    expect(statusText).toBeTruthy();
  });
});