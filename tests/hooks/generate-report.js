#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function generateHookTestReport() {
  console.log(`${colors.cyan}${colors.bold}=== Generating Hook Test Report ===${colors.reset}\n`);
  
  const reportPath = path.join(__dirname, '../../test-reports/phase2-hooks.json');
  
  // Check if report exists
  if (!fs.existsSync(reportPath)) {
    console.error(`${colors.red}Error: Test report not found at ${reportPath}${colors.reset}`);
    console.log(`${colors.yellow}Please run the hook tests first: npm run test:hooks:all${colors.reset}`);
    process.exit(1);
  }
  
  // Load the report
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  
  // Generate summary
  console.log(`${colors.bold}Test Execution Summary${colors.reset}`);
  console.log('─'.repeat(50));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Agents: ${report.totalAgents}`);
  console.log(`Tested Agents: ${report.testedAgents}`);
  console.log(`Success Rate: ${colors.green}${report.summary.successRate.toFixed(2)}%${colors.reset}`);
  console.log(`Average Execution Time: ${report.summary.avgExecutionTime.toFixed(2)}ms`);
  
  // Hook coverage
  console.log(`\n${colors.bold}Hook Coverage by Type${colors.reset}`);
  console.log('─'.repeat(50));
  
  const hookTypes = Object.entries(report.byHookType);
  const maxHookNameLength = Math.max(...hookTypes.map(([name]) => name.length));
  
  hookTypes.forEach(([hookType, count]) => {
    const percentage = (count / report.totalAgents * 100).toFixed(1);
    const bar = generateProgressBar(percentage);
    const padding = ' '.repeat(maxHookNameLength - hookType.length);
    
    let color = colors.green;
    if (percentage < 50) color = colors.red;
    else if (percentage < 80) color = colors.yellow;
    
    console.log(`${hookType}:${padding} ${bar} ${color}${percentage}%${colors.reset} (${count}/${report.totalAgents})`);
  });
  
  // Category breakdown
  console.log(`\n${colors.bold}Results by Category${colors.reset}`);
  console.log('─'.repeat(50));
  
  for (const [category, data] of Object.entries(report.byCategory)) {
    const stopHookPercentage = ((data.withStopHook / data.count) * 100).toFixed(0);
    const fileChangePercentage = ((data.withFileChangeHook / data.count) * 100).toFixed(0);
    
    console.log(`\n${colors.cyan}${category}${colors.reset} (${data.count} agents)`);
    console.log(`  Stop Hook: ${data.withStopHook}/${data.count} (${stopHookPercentage}%)`);
    console.log(`  FileChange Hook: ${data.withFileChangeHook}/${data.count} (${fileChangePercentage}%)`);
    
    if (data.errors && data.errors.length > 0) {
      const uniqueErrors = [...new Set(data.errors)];
      console.log(`  ${colors.red}Errors (${uniqueErrors.length} unique):${colors.reset}`);
      uniqueErrors.slice(0, 3).forEach(error => {
        console.log(`    - ${error.substring(0, 60)}${error.length > 60 ? '...' : ''}`);
      });
      if (uniqueErrors.length > 3) {
        console.log(`    ... and ${uniqueErrors.length - 3} more`);
      }
    }
  }
  
  // Failed agents
  const failedAgents = report.agentDetails.filter(agent => agent.errors.length > 0);
  if (failedAgents.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Agents with Issues (${failedAgents.length})${colors.reset}`);
    console.log('─'.repeat(50));
    
    failedAgents.slice(0, 10).forEach(agent => {
      console.log(`\n${colors.yellow}${agent.agentName}${colors.reset} (${agent.agentId})`);
      console.log(`  Category: ${agent.category}`);
      console.log(`  Errors:`);
      agent.errors.slice(0, 2).forEach(error => {
        console.log(`    - ${error}`);
      });
      if (agent.errors.length > 2) {
        console.log(`    ... and ${agent.errors.length - 2} more errors`);
      }
    });
    
    if (failedAgents.length > 10) {
      console.log(`\n... and ${failedAgents.length - 10} more agents with issues`);
    }
  }
  
  // Recommendations
  if (report.recommendations && report.recommendations.length > 0) {
    console.log(`\n${colors.bold}Recommendations${colors.reset}`);
    console.log('─'.repeat(50));
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
  
  // Performance metrics
  console.log(`\n${colors.bold}Performance Metrics${colors.reset}`);
  console.log('─'.repeat(50));
  
  const executionTimes = report.agentDetails.map(a => a.executionTime).sort((a, b) => a - b);
  const p50 = executionTimes[Math.floor(executionTimes.length * 0.5)];
  const p95 = executionTimes[Math.floor(executionTimes.length * 0.95)];
  const p99 = executionTimes[Math.floor(executionTimes.length * 0.99)];
  
  console.log(`P50 (Median): ${p50.toFixed(2)}ms`);
  console.log(`P95: ${p95.toFixed(2)}ms`);
  console.log(`P99: ${p99.toFixed(2)}ms`);
  console.log(`Max: ${Math.max(...executionTimes).toFixed(2)}ms`);
  
  // Generate HTML report
  generateHTMLReport(report);
  
  // Summary
  console.log(`\n${colors.green}${colors.bold}✓ Report Generation Complete${colors.reset}`);
  console.log(`JSON Report: ${reportPath}`);
  console.log(`HTML Report: ${path.join(__dirname, '../../test-reports/phase2-hooks.html')}`);
  
  // Exit code based on success rate
  if (report.summary.successRate < 80) {
    console.log(`\n${colors.red}⚠ Success rate below 80% threshold${colors.reset}`);
    process.exit(1);
  }
}

function generateProgressBar(percentage) {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function generateHTMLReport(report) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hook Test Report - Anton v2</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .subtitle { opacity: 0.9; }
    .content { padding: 2rem; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .metric-card {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 1.5rem;
      text-align: center;
    }
    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      color: #667eea;
      margin: 0.5rem 0;
    }
    .metric-label {
      color: #6c757d;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      margin: 2rem 0;
    }
    h2 {
      color: #333;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e9ecef;
    }
    .progress-bar {
      background: #e9ecef;
      border-radius: 10px;
      height: 30px;
      overflow: hidden;
      margin: 0.5rem 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      padding: 0 1rem;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th {
      background: #f8f9fa;
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #495057;
      border-bottom: 2px solid #dee2e6;
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #e9ecef;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: bold;
    }
    .badge-success { background: #28a745; color: white; }
    .badge-warning { background: #ffc107; color: #212529; }
    .badge-danger { background: #dc3545; color: white; }
    .recommendation {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 1rem;
      margin: 0.5rem 0;
      border-radius: 4px;
    }
    .footer {
      background: #f8f9fa;
      padding: 2rem;
      text-align: center;
      color: #6c757d;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🪝 Hook Test Report</h1>
      <p class="subtitle">Anton v2 - Agent Hook System Analysis</p>
      <p class="subtitle">${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="content">
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Total Agents</div>
          <div class="metric-value">${report.totalAgents}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Execution Time</div>
          <div class="metric-value">${report.summary.avgExecutionTime.toFixed(0)}ms</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Errors</div>
          <div class="metric-value">${report.summary.totalErrors}</div>
        </div>
      </div>
      
      <div class="section">
        <h2>Hook Coverage by Type</h2>
        ${Object.entries(report.byHookType).map(([type, count]) => {
          const percentage = (count / report.totalAgents * 100);
          return `
            <div>
              <div style="display: flex; justify-content: space-between; margin-top: 1rem;">
                <span>${type}</span>
                <span>${count}/${report.totalAgents} (${percentage.toFixed(1)}%)</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${percentage}%">
                  ${percentage.toFixed(0)}%
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="section">
        <h2>Results by Category</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Agents</th>
              <th>Stop Hook</th>
              <th>FileChange Hook</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(report.byCategory).map(([category, data]) => `
              <tr>
                <td><strong>${category}</strong></td>
                <td>${data.count}</td>
                <td>
                  <span class="badge ${data.withStopHook === data.count ? 'badge-success' : 'badge-warning'}">
                    ${data.withStopHook}/${data.count}
                  </span>
                </td>
                <td>
                  <span class="badge ${data.withFileChangeHook > data.count * 0.5 ? 'badge-success' : 'badge-warning'}">
                    ${data.withFileChangeHook}/${data.count}
                  </span>
                </td>
                <td>
                  <span class="badge ${data.errors.length === 0 ? 'badge-success' : 'badge-danger'}">
                    ${data.errors.length}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      ${report.recommendations.length > 0 ? `
        <div class="section">
          <h2>Recommendations</h2>
          ${report.recommendations.map(rec => `
            <div class="recommendation">
              💡 ${rec}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="section">
        <h2>Agent Details</h2>
        <details>
          <summary style="cursor: pointer; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
            View detailed results for all ${report.agentDetails.length} agents
          </summary>
          <table style="margin-top: 1rem;">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Category</th>
                <th>Stop</th>
                <th>Start</th>
                <th>FileChange</th>
                <th>Execution Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${report.agentDetails.map(agent => `
                <tr>
                  <td>${agent.agentName}</td>
                  <td>${agent.category}</td>
                  <td>${agent.hooks.Stop ? '✅' : '❌'}</td>
                  <td>${agent.hooks.Start ? '✅' : '⭕'}</td>
                  <td>${agent.hooks.FileChange ? '✅' : '⭕'}</td>
                  <td>${agent.executionTime.toFixed(0)}ms</td>
                  <td>
                    <span class="badge ${agent.errors.length === 0 ? 'badge-success' : 'badge-danger'}">
                      ${agent.errors.length === 0 ? 'PASS' : 'FAIL'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated by Anton v2 Hook Test Suite</p>
      <p>© 2024 Anton - Visual AI Orchestration Platform</p>
    </div>
  </div>
</body>
</html>`;
  
  const htmlPath = path.join(__dirname, '../../test-reports/phase2-hooks.html');
  fs.writeFileSync(htmlPath, html);
}

// Run the report generator
generateHookTestReport();