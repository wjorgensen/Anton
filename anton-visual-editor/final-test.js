const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  
  console.log('🎯 Final Circuit Board UI Test\n');
  
  // Clear localStorage first
  await page.goto('http://localhost:3001');
  await page.evaluate(() => localStorage.clear());
  console.log('✅ Cleared previous data\n');
  
  // 1. Create new project
  console.log('1️⃣ Creating new project...');
  await page.click('button:has-text("New Project")');
  await page.fill('input[placeholder="My Amazing Project"]', 'AI Assistant Platform');
  await page.fill('textarea', 'Create an AI assistant platform with natural language processing, multiple LLM integrations, user management, conversation history, API endpoints, and real-time chat interface');
  
  console.log('2️⃣ Generating circuit board...');
  await page.click('button:has-text("Create & View Circuit Board")');
  
  // Wait for navigation and generation
  await page.waitForURL('**/circuit-board**');
  await page.waitForTimeout(3000);
  
  // Check results
  console.log('\n📊 Circuit Board Analysis:');
  const nodes = await page.$$('.react-flow__node');
  console.log('   Nodes found:', nodes.length);
  
  if (nodes.length > 0) {
    // Get node details
    for (let i = 0; i < Math.min(3, nodes.length); i++) {
      const nodeText = await nodes[i].textContent();
      console.log(`   Node ${i+1}: ${nodeText.substring(0, 50)}...`);
    }
    
    // Test execution
    console.log('\n3️⃣ Testing execution...');
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(2000);
    
    const isPaused = await page.$('button:has-text("Pause")');
    console.log('   Execution running:', !!isPaused);
    
    // Test node interaction
    console.log('\n4️⃣ Testing node interaction...');
    await nodes[0].click();
    await page.waitForTimeout(1000);
    
    const editPanel = await page.$('text="Edit Node"');
    console.log('   Edit panel opened:', !!editPanel);
  } else {
    console.log('   ⚠️ No nodes rendered - circuit board may not be generating properly');
  }
  
  // Take final screenshots
  await page.screenshot({ path: 'final-ui-test.png', fullPage: true });
  console.log('\n✅ Screenshot saved: final-ui-test.png');
  
  console.log('\n🎉 UI Test Complete!');
  console.log('URL:', page.url());
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
