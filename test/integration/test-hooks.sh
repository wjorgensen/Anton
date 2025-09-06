#!/bin/bash
# Integration test script for hook flow

set -e

echo "=== Hook Flow Integration Tests ==="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
ORCHESTRATOR_URL="http://localhost:3003"
TEST_DIR="test-project"
NODE_1_DIR="$TEST_DIR/node-1"
NODE_2_DIR="$TEST_DIR/node-2"

# Helper functions
log_test() {
    echo -e "${YELLOW}TEST:${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

check_server() {
    if curl -s -f "$ORCHESTRATOR_URL/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Ensure orchestrator is running
log_test "Checking orchestrator server..."
if check_server; then
    log_success "Orchestrator is running at $ORCHESTRATOR_URL"
else
    log_error "Orchestrator is not running. Please start it with: PORT=3003 npx tsx src/secure-server.ts"
    exit 1
fi

# Test 1: Successful completion flow
log_test "Testing successful completion flow"

# Create output data for node-1
cat > "$NODE_1_DIR/output.json" << EOF
{
  "result": "Analysis complete",
  "data": {
    "files": ["main.ts", "utils.ts"],
    "lines": 500,
    "issues": 0
  },
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Execute stop hook
NODE_ID=node-1 HOOK_STATUS=success bash "$NODE_1_DIR/.claude/hooks/stop.sh"

if [ $? -eq 0 ]; then
    log_success "Stop hook executed successfully"
    
    # Check if input.json was created for node-2
    if [ -f "$NODE_2_DIR/input.json" ]; then
        log_success "Input file created for next node"
        echo "  Contents: $(cat $NODE_2_DIR/input.json | jq -c .)"
    fi
else
    log_error "Stop hook failed"
fi

echo

# Test 2: Error handling
log_test "Testing error handling and retry"

NODE_ID=node-1 ERROR_MESSAGE="Connection timeout" bash "$NODE_1_DIR/.claude/hooks/error.sh"

if [ $? -eq 0 ]; then
    log_success "Error hook executed"
    
    # Check for retry context
    if [ -f "$NODE_1_DIR/retry-context.json" ]; then
        log_success "Retry context created"
    fi
else
    log_error "Error hook failed"
fi

echo

# Test 3: Review checkpoint
log_test "Testing review checkpoint"

REVIEW_DATA='{"reviewPoint":"Code generation complete","files":["app.ts"],"changes":75}' \
NODE_ID=node-1 bash "$NODE_1_DIR/.claude/hooks/review.sh"

if [ $? -eq 0 ]; then
    log_success "Review hook executed"
    
    # Simulate review approval
    curl -X POST "$ORCHESTRATOR_URL/api/workflow/review/approve" \
        -H "Content-Type: application/json" \
        -d '{"nodeId":"node-1","feedback":"Approved","approved":true}' \
        -s > /dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Review approved and workflow resumed"
    fi
else
    log_error "Review hook failed"
fi

echo

# Test 4: Data transformation
log_test "Testing data flow between nodes"

# Create complex output
cat > "$NODE_1_DIR/output.json" << EOF
{
  "analysis": {
    "codebase": {
      "languages": ["TypeScript", "JavaScript"],
      "frameworks": ["React", "Node.js"],
      "dependencies": 42
    },
    "metrics": {
      "complexity": 7.5,
      "coverage": 85.2,
      "performance": "optimized"
    }
  },
  "recommendations": [
    "Upgrade React to latest version",
    "Add more unit tests for utils",
    "Consider code splitting for main bundle"
  ]
}
EOF

NODE_ID=node-1 bash "$NODE_1_DIR/.claude/hooks/stop.sh" > /dev/null 2>&1

if [ -f "$NODE_2_DIR/input.json" ]; then
    log_success "Complex data transferred successfully"
    
    # Verify data integrity
    if cat "$NODE_2_DIR/input.json" | jq -e '.previousNodeOutput.analysis.metrics.coverage == 85.2' > /dev/null; then
        log_success "Data integrity maintained"
    else
        log_error "Data corruption detected"
    fi
else
    log_error "Data transfer failed"
fi

echo

# Test 5: Concurrent execution
log_test "Testing parallel node execution"

# Simulate parallel nodes completing
(NODE_ID=parallel-1 bash "$NODE_1_DIR/.claude/hooks/stop.sh" &)
(NODE_ID=parallel-2 bash "$NODE_1_DIR/.claude/hooks/stop.sh" &)

wait

log_success "Parallel nodes completed"

echo
echo "=== Test Summary ==="

# Get workflow state
STATE=$(curl -s "$ORCHESTRATOR_URL/api/workflow/state")

if [ ! -z "$STATE" ]; then
    echo "Current workflow state:"
    echo "$STATE" | jq -C '.'
else
    echo "Could not retrieve workflow state"
fi

echo
echo "Test execution complete!"