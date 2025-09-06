const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: false, 
    devtools: true  // Open with DevTools
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log('BROWSER CONSOLE:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('BROWSER ERROR:', error);
  });
  
  console.log('Opening dashboard...');
  await page.goto('http://localhost:3001');
  await page.evaluate(() => localStorage.clear());
  
  // Create project
  await page.click('button:has-text("New Project")');
  await page.fill('input[placeholder="My Amazing Project"]', 'Debug Test');
  await page.fill('textarea', 'Build a test application with frontend and backend');
  
  console.log('Creating project and navigating to circuit board...');
  await page.click('button:has-text("Create & View Circuit Board")');
  
  // Wait for navigation
  await page.waitForURL('**/circuit-board**');
  await page.waitForTimeout(5000);
  
  // Check localStorage
  const storageData = await page.evaluate(() => {
    const data = localStorage.getItem('anton_projects');
    return data ? JSON.parse(data) : null;
  });
  
  console.log('\nLocalStorage projects:', storageData ? storageData.length : 0);
  if (storageData && storageData[0]) {
    console.log('First project has circuit board:', !!storageData[0].circuitBoard);
    console.log('Number of nodes:', storageData[0].circuitBoard?.nodes?.length || 0);
  }
  
  // Check DOM
  const nodes = await page.$$('.react-flow__node');
  console.log('DOM nodes found:', nodes.length);
  
  console.log('\nKeeping browser open for inspection...');
  console.log('Check the DevTools console for more details.');
  
  // Keep browser open
  await page.waitForTimeout(30000);
  await browser.close();
})();
