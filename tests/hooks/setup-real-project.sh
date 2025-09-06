#!/bin/bash

# Setup script for testing hooks with real project structure
# This creates a realistic project environment for hook testing

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up real project for hook testing...${NC}"

# Get absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_PROJECT_DIR="$SCRIPT_DIR/test-project"

# Clean up existing test project
if [ -d "$TEST_PROJECT_DIR" ]; then
    echo -e "${YELLOW}Cleaning up existing test project...${NC}"
    rm -rf "$TEST_PROJECT_DIR"
fi

# Create project structure
echo "Creating test project structure..."
mkdir -p "$TEST_PROJECT_DIR/node-1/.claude-code/hooks"
mkdir -p "$TEST_PROJECT_DIR/node-1/src"
mkdir -p "$TEST_PROJECT_DIR/node-1/tests"
mkdir -p "$TEST_PROJECT_DIR/node-2/.claude-code/hooks"
mkdir -p "$TEST_PROJECT_DIR/node-2/src"

# Copy hook scripts to test project
echo "Copying hook scripts..."
if [ -f "$PROJECT_ROOT/hooks/stop.sh" ]; then
    cp "$PROJECT_ROOT/hooks/stop.sh" "$TEST_PROJECT_DIR/node-1/.claude-code/hooks/"
    cp "$PROJECT_ROOT/hooks/stop.sh" "$TEST_PROJECT_DIR/node-2/.claude-code/hooks/"
fi

if [ -f "$PROJECT_ROOT/hooks/track-changes.sh" ]; then
    cp "$PROJECT_ROOT/hooks/track-changes.sh" "$TEST_PROJECT_DIR/node-1/.claude-code/hooks/"
    cp "$PROJECT_ROOT/hooks/track-changes.sh" "$TEST_PROJECT_DIR/node-2/.claude-code/hooks/"
fi

# Create sample hook configurations for different agent types
echo "Creating agent-specific hook configurations..."

# Setup agent hooks
cat > "$TEST_PROJECT_DIR/node-1/.claude-code/hooks/hooks.json" << 'EOF'
{
  "hooks": {
    "Start": [
      {
        "event": "Start",
        "command": "echo 'Starting agent ${NODE_ID}' && date",
        "type": "log"
      }
    ],
    "Stop": [
      {
        "event": "Stop",
        "command": "bash ${CLAUDE_PROJECT_DIR}/.claude-code/hooks/stop.sh",
        "type": "callback"
      }
    ],
    "FileChange": [
      {
        "event": "FileChange",
        "command": "bash ${CLAUDE_PROJECT_DIR}/.claude-code/hooks/track-changes.sh",
        "type": "track"
      }
    ]
  }
}
EOF

# Execution agent hooks
cat > "$TEST_PROJECT_DIR/node-2/.claude-code/hooks/hooks.json" << 'EOF'
{
  "hooks": {
    "Start": [
      {
        "event": "Start",
        "command": "echo 'Execution agent ${NODE_ID} starting' && pwd",
        "type": "log"
      }
    ],
    "TestResult": [
      {
        "event": "TestResult",
        "command": "echo 'Test results: ${TEST_STATUS}'",
        "type": "log"
      }
    ],
    "Stop": [
      {
        "event": "Stop",
        "command": "bash ${CLAUDE_PROJECT_DIR}/.claude-code/hooks/stop.sh",
        "type": "callback"
      }
    ],
    "FileChange": [
      {
        "event": "FileChange",
        "command": "bash ${CLAUDE_PROJECT_DIR}/.claude-code/hooks/track-changes.sh",
        "type": "track"
      }
    ]
  }
}
EOF

# Create sample project files
echo "Creating sample project files..."

# Node 1 - Setup agent project
cat > "$TEST_PROJECT_DIR/node-1/package.json" << 'EOF'
{
  "name": "test-setup-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "echo 'Running dev server'",
    "build": "echo 'Building project'",
    "test": "echo 'Running tests'"
  }
}
EOF

cat > "$TEST_PROJECT_DIR/node-1/src/index.js" << 'EOF'
// Sample source file for testing
console.log("Hello from test project");

function processData(data) {
    return data.map(item => item * 2);
}

module.exports = { processData };
EOF

# Node 2 - Execution agent project
cat > "$TEST_PROJECT_DIR/node-2/app.js" << 'EOF'
// Sample application file
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({ message: 'Test API' });
});

module.exports = app;
EOF

cat > "$TEST_PROJECT_DIR/node-2/test.spec.js" << 'EOF'
// Sample test file
describe('API Tests', () => {
    test('should return message', () => {
        expect(true).toBe(true);
    });
});
EOF

# Create environment configuration
echo "Creating environment configuration..."
cat > "$TEST_PROJECT_DIR/.env.test" << EOF
# Test environment configuration
CLAUDE_PROJECT_DIR=$TEST_PROJECT_DIR/node-1
NODE_ID=node-1
EXECUTION_ID=exec-test-123
ORCHESTRATOR_URL=http://localhost:3002
PROJECT_NAME=test-project
STATUS=success
TEST_MODE=true
EOF

# Create helper script for hook execution
cat > "$TEST_PROJECT_DIR/run-hook.sh" << 'EOF'
#!/bin/bash
# Helper script to execute hooks with proper environment

set -a
source .env.test
set +a

# Override NODE_ID if provided
if [ -n "$1" ]; then
    export NODE_ID="$1"
    export CLAUDE_PROJECT_DIR="$TEST_PROJECT_DIR/$1"
fi

# Execute hook command
if [ -n "$2" ]; then
    eval "$2"
else
    echo "Usage: ./run-hook.sh <node-id> <hook-command>"
fi
EOF

chmod +x "$TEST_PROJECT_DIR/run-hook.sh"

# Create hook execution logs directory
mkdir -p "$TEST_PROJECT_DIR/logs"

echo -e "${GREEN}Test project setup complete!${NC}"
echo "Project location: $TEST_PROJECT_DIR"
echo ""
echo "To test hooks:"
echo "  cd $TEST_PROJECT_DIR"
echo "  source .env.test"
echo "  bash node-1/.claude-code/hooks/stop.sh"
echo ""
echo "Or use the helper:"
echo "  ./run-hook.sh node-1 'bash \$CLAUDE_PROJECT_DIR/.claude-code/hooks/stop.sh'"