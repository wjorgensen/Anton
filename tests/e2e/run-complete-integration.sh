#!/bin/bash

# Complete System Integration Test Runner
# This script starts all infrastructure, services, and runs comprehensive tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TEST_ID="system-test-$$"
POSTGRES_PORT=6434
REDIS_PORT=7382
ORCHESTRATOR_PORT=5006
FRONTEND_PORT=4007
PLANNING_PORT=6007

# Paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo -e "${GREEN}🚀 Starting Complete System Integration Tests${NC}"
echo "Test ID: $TEST_ID"
echo "========================================="

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up test environment...${NC}"
    
    # Kill services
    if [ ! -z "$ORCH_PID" ]; then
        echo "  Stopping orchestrator..."
        kill $ORCH_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "  Stopping frontend..."
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$PLANNING_PID" ]; then
        echo "  Stopping planning service..."
        kill $PLANNING_PID 2>/dev/null || true
    fi
    
    # Stop and remove Docker containers
    echo "  Stopping Docker containers..."
    docker stop postgres-$TEST_ID redis-$TEST_ID 2>/dev/null || true
    docker rm postgres-$TEST_ID redis-$TEST_ID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Start infrastructure
echo -e "\n${YELLOW}📦 Starting infrastructure services...${NC}"

# Start PostgreSQL
echo "  Starting PostgreSQL on port $POSTGRES_PORT..."
docker run -d --name postgres-$TEST_ID \
    -p $POSTGRES_PORT:5432 \
    -e POSTGRES_PASSWORD=testpass \
    -e POSTGRES_DB=system_test \
    postgres:15-alpine

# Start Redis
echo "  Starting Redis on port $REDIS_PORT..."
docker run -d --name redis-$TEST_ID \
    -p $REDIS_PORT:6379 \
    redis:7-alpine

# Wait for services to be ready
echo "  Waiting for infrastructure..."
sleep 5

# Check if services are running
docker ps | grep postgres-$TEST_ID > /dev/null || (echo -e "${RED}❌ PostgreSQL failed to start${NC}" && exit 1)
docker ps | grep redis-$TEST_ID > /dev/null || (echo -e "${RED}❌ Redis failed to start${NC}" && exit 1)

echo -e "${GREEN}✅ Infrastructure ready${NC}"

# Start orchestration service
echo -e "\n${YELLOW}🎯 Starting orchestration service...${NC}"
cd "$PROJECT_ROOT/orchestration"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing orchestration dependencies..."
    npm install
fi

# Set up database
export DATABASE_URL="postgresql://postgres:testpass@localhost:$POSTGRES_PORT/system_test"
export REDIS_URL="redis://localhost:$REDIS_PORT"

echo "  Running database migrations..."
npx prisma migrate deploy 2>/dev/null || true
npx prisma db seed 2>/dev/null || true

# Start orchestrator
echo "  Starting orchestrator on port $ORCHESTRATOR_PORT..."
PORT=$ORCHESTRATOR_PORT npm run dev > /tmp/orch-$TEST_ID.log 2>&1 &
ORCH_PID=$!

# Start frontend
echo -e "\n${YELLOW}🌐 Starting frontend service...${NC}"
cd "$PROJECT_ROOT/anton-visual-editor"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing frontend dependencies..."
    npm install
fi

echo "  Starting frontend on port $FRONTEND_PORT..."
PORT=$FRONTEND_PORT \
NEXT_PUBLIC_API_URL=http://localhost:$ORCHESTRATOR_PORT \
NEXT_PUBLIC_WS_URL=ws://localhost:$ORCHESTRATOR_PORT \
npm run dev > /tmp/frontend-$TEST_ID.log 2>&1 &
FRONTEND_PID=$!

# Start planning service
echo -e "\n${YELLOW}🤖 Starting planning service...${NC}"
cd "$PROJECT_ROOT/planning-service"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing planning service dependencies..."
    npm install
fi

echo "  Starting planning service on port $PLANNING_PORT..."
PORT=$PLANNING_PORT npm run dev > /tmp/planning-$TEST_ID.log 2>&1 &
PLANNING_PID=$!

# Wait for all services to be ready
echo -e "\n${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 20

# Check service health
echo -e "\n${YELLOW}🏥 Checking service health...${NC}"

# Check orchestrator
curl -s http://localhost:$ORCHESTRATOR_PORT/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} Orchestrator is healthy"
else
    echo -e "  ${RED}✗${NC} Orchestrator is not responding"
    echo "  Check logs: tail -f /tmp/orch-$TEST_ID.log"
fi

# Check frontend
curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} Frontend is healthy"
else
    echo -e "  ${RED}✗${NC} Frontend is not responding"
    echo "  Check logs: tail -f /tmp/frontend-$TEST_ID.log"
fi

# Check planning service
curl -s http://localhost:$PLANNING_PORT/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} Planning service is healthy"
else
    echo -e "  ${RED}✗${NC} Planning service is not responding"
    echo "  Check logs: tail -f /tmp/planning-$TEST_ID.log"
fi

# Run integration tests
echo -e "\n${YELLOW}🧪 Running complete system tests...${NC}"
cd "$PROJECT_ROOT/tests/e2e"

# Install test dependencies if needed
if [ ! -f "package.json" ]; then
    echo '{
  "name": "anton-e2e-tests",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "ws": "^8.14.0",
    "playwright": "^1.40.0"
  }
}' > package.json
    npm install
fi

# Set environment variables for tests
export ORCHESTRATOR_URL="http://localhost:$ORCHESTRATOR_PORT"
export FRONTEND_URL="http://localhost:$FRONTEND_PORT"
export PLANNING_URL="http://localhost:$PLANNING_PORT"

# Run the test suite
echo "========================================="
node system-integration-complete.js

TEST_EXIT_CODE=$?

# Show service logs if tests failed
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo -e "\n${RED}❌ Tests failed! Showing recent logs...${NC}"
    echo -e "\n${YELLOW}Orchestrator logs:${NC}"
    tail -n 50 /tmp/orch-$TEST_ID.log || true
    echo -e "\n${YELLOW}Frontend logs:${NC}"
    tail -n 50 /tmp/frontend-$TEST_ID.log || true
    echo -e "\n${YELLOW}Planning logs:${NC}"
    tail -n 50 /tmp/planning-$TEST_ID.log || true
fi

# Show test report location
echo -e "\n${GREEN}📄 Test report saved to: $PROJECT_ROOT/test-reports/system-integration.json${NC}"

# Exit with test status
exit $TEST_EXIT_CODE