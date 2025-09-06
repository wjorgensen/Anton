
console.log('STDOUT: Line 1');
console.log('STDOUT: Line 2');
console.error('STDERR: Error line');

// Write output file
const fs = require('fs');
fs.writeFileSync('output.json', JSON.stringify({
    timestamp: Date.now(),
    data: 'Test output'
}));

// Stream output
for (let i = 0; i < 5; i++) {
    console.log('STREAM: Output ' + i);
}
