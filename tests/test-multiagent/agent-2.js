
const fs = require('fs');
const agentId = 2;
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
