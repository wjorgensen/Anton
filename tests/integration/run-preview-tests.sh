#!/bin/bash

# Integration test runner for preview streaming and synchronization
# Sets up required services and runs tests

set -e

echo "========================================="
echo "Preview Integration Test Suite"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo -e "\n${GREEN}Cleaning up test environment...${NC}"
    
    # Kill any remaining processes
    if [ ! -z "$ORCHESTRATION_PID" ]; then
        kill $ORCHESTRATION_PID 2>/dev/null || true
    fi
    
    # Clean up test directories
    rm -rf /tmp/test-preview 2>/dev/null || true
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set up trap for cleanup
trap cleanup EXIT

echo -e "${GREEN}1. Checking dependencies...${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is required but not installed${NC}"
    exit 1
fi

# Check if Jest is available
if ! npx jest --version &> /dev/null; then
    echo -e "${RED}Jest is required. Installing...${NC}"
    npm install --save-dev jest
fi

echo -e "${GREEN}2. Building orchestration service...${NC}"
cd orchestration
npm run build
cd ..

echo -e "${GREEN}3. Starting test orchestration server...${NC}"
# Start orchestration server in background for testing
cd orchestration
node dist/simple-server.js &
ORCHESTRATION_PID=$!
cd ..

# Wait for server to start
sleep 2

echo -e "${GREEN}4. Running integration tests...${NC}"
echo ""

# Run the tests with proper configuration
NODE_ENV=test npx jest tests/integration/preview.test.js \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --testTimeout=30000

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================="
    echo "All tests passed successfully!"
    echo "=========================================${NC}"
else
    echo -e "${RED}========================================="
    echo "Some tests failed. See output above."
    echo "=========================================${NC}"
fi

exit $TEST_EXIT_CODE