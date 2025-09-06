#!/bin/bash

# E2E Test Runner Script for New UI
# This script starts all services in isolation on custom ports for testing

echo "🚀 Starting E2E Test Suite for New UI..."
echo "================================================"

# Define custom ports for isolated testing
ORCHESTRATOR_PORT=5001
FRONTEND_PORT=4001  
PLANNING_PORT=6001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill processes on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up test services...${NC}"
    
    # Kill all background processes
    if [ ! -z "$ORCH_PID" ]; then
        kill $ORCH_PID 2>/dev/null
        echo "Stopped orchestrator (PID: $ORCH_PID)"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "Stopped frontend (PID: $FRONTEND_PID)"
    fi
    
    if [ ! -z "$PLANNING_PID" ]; then
        kill $PLANNING_PID 2>/dev/null
        echo "Stopped planning service (PID: $PLANNING_PID)"
    fi
    
    # Also kill any processes on our custom ports
    lsof -ti:$ORCHESTRATOR_PORT | xargs kill 2>/dev/null
    lsof -ti:$FRONTEND_PORT | xargs kill 2>/dev/null
    lsof -ti:$PLANNING_PORT | xargs kill 2>/dev/null
    
    echo -e "${GREEN}Cleanup complete!${NC}"
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Change to Anton directory
cd /Users/wes/Programming/Anton

echo -e "${YELLOW}Starting isolated services...${NC}"
echo "================================================"

# Start orchestrator on custom port
echo "Starting orchestrator on port $ORCHESTRATOR_PORT..."
cd orchestration
PORT=$ORCHESTRATOR_PORT npm run dev > ../tests/e2e/logs/orchestrator.log 2>&1 &
ORCH_PID=$!
cd ..
echo "Orchestrator PID: $ORCH_PID"

# Start frontend on custom port
echo "Starting frontend on port $FRONTEND_PORT..."
cd anton-visual-editor
PORT=$FRONTEND_PORT npm run dev > ../tests/e2e/logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "Frontend PID: $FRONTEND_PID"

# Start planning service on custom port
echo "Starting planning service on port $PLANNING_PORT..."
cd planning-service
PORT=$PLANNING_PORT npm run dev > ../tests/e2e/logs/planning.log 2>&1 &
PLANNING_PID=$!
cd ..
echo "Planning Service PID: $PLANNING_PID"

echo -e "\n${YELLOW}Waiting for services to start...${NC}"
echo "================================================"

# Function to check if a service is ready
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "Checking $service on port $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            echo -e " ${GREEN}Ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e " ${RED}Failed to start!${NC}"
    return 1
}

# Wait for all services to be ready
sleep 5 # Initial wait

if ! wait_for_service $ORCHESTRATOR_PORT "Orchestrator"; then
    echo -e "${RED}Failed to start orchestrator!${NC}"
    cat tests/e2e/logs/orchestrator.log
    exit 1
fi

if ! wait_for_service $FRONTEND_PORT "Frontend"; then
    echo -e "${RED}Failed to start frontend!${NC}"
    cat tests/e2e/logs/frontend.log
    exit 1
fi

if ! wait_for_service $PLANNING_PORT "Planning Service"; then
    echo -e "${RED}Failed to start planning service!${NC}"
    cat tests/e2e/logs/planning.log
    exit 1
fi

echo -e "\n${GREEN}All services started successfully!${NC}"
echo "================================================"

# Run E2E tests with custom URLs
echo -e "\n${YELLOW}Running E2E tests...${NC}"
echo "================================================"

# Create logs directory if it doesn't exist
mkdir -p tests/e2e/logs
mkdir -p tests/e2e/screenshots

# Set environment variables for tests
export FRONTEND_URL="http://localhost:$FRONTEND_PORT"
export ORCHESTRATOR_URL="http://localhost:$ORCHESTRATOR_PORT"
export PLANNING_URL="http://localhost:$PLANNING_PORT"

# Run Playwright tests
echo "Frontend URL: $FRONTEND_URL"
echo "Orchestrator URL: $ORCHESTRATOR_URL"
echo "Planning URL: $PLANNING_URL"
echo ""

# Run tests with detailed output
npx playwright test tests/e2e/new-ui-flows.spec.js --reporter=list,html

# Capture exit code
TEST_EXIT_CODE=$?

echo "================================================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed successfully!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check the report for details.${NC}"
fi

# Generate HTML report
echo -e "\n${YELLOW}Generating test report...${NC}"
npx playwright show-report --port=9323 &
REPORT_PID=$!

echo -e "${GREEN}Test report available at: http://localhost:9323${NC}"
echo "Press Ctrl+C to stop the report server and cleanup"

# Wait for user to stop
wait $REPORT_PID

exit $TEST_EXIT_CODE