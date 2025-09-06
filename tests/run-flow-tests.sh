#!/bin/bash

set -e

echo "🚀 Starting Flow Execution Tests"
echo "================================"

# Set test ID for unique ports
TEST_ID=$(date +%s)
ORCH_PORT=$((5000 + $TEST_ID % 100))
FRONT_PORT=$((4000 + $TEST_ID % 100))
PLAN_PORT=$((6000 + $TEST_ID % 100))
DB_PORT=$((6400 + $TEST_ID % 100))
REDIS_PORT=$((7300 + $TEST_ID % 100))

echo "Test configuration:"
echo "  Orchestrator: http://localhost:$ORCH_PORT"
echo "  Frontend: http://localhost:$FRONT_PORT"
echo "  Planning: http://localhost:$PLAN_PORT"
echo ""

# Create test directories
mkdir -p test-reports
mkdir -p test-data

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker run -d --name postgres-flow-$TEST_ID \
  -p $DB_PORT:5432 \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=flow_test \
  postgres:15-alpine > /dev/null 2>&1

# Start Redis
echo "Starting Redis..."
docker run -d --name redis-flow-$TEST_ID \
  -p $REDIS_PORT:6379 \
  redis:7-alpine > /dev/null 2>&1

# Wait for databases
echo "Waiting for databases to start..."
sleep 5

# Set environment variables
export DATABASE_URL="postgresql://postgres:testpass@localhost:$DB_PORT/flow_test"
export REDIS_URL="redis://localhost:$REDIS_PORT"
export JWT_SECRET="test-secret-key"
export CLAUDE_API_KEY=${CLAUDE_API_KEY:-"test-key"}

# Start orchestration service
echo "Starting orchestration service..."
cd orchestration
npm run build > /dev/null 2>&1 || true
PORT=$ORCH_PORT npm run start:prod > ../test-data/orchestration.log 2>&1 &
ORCH_PID=$!
cd ..

# Start frontend service
echo "Starting frontend service..."
cd anton-visual-editor
npm run build > /dev/null 2>&1 || true
PORT=$FRONT_PORT NEXT_PUBLIC_API_URL=http://localhost:$ORCH_PORT npm run start > ../test-data/frontend.log 2>&1 &
FRONT_PID=$!
cd ..

# Start planning service
echo "Starting planning service..."
cd planning-service
PORT=$PLAN_PORT npm run start > ../test-data/planning.log 2>&1 &
PLAN_PID=$!
cd ..

echo "Waiting for services to start (15s)..."
sleep 15

# Run migrations
echo "Running database migrations..."
cd orchestration
npx prisma migrate deploy > /dev/null 2>&1 || true
cd ..

# Run tests
echo ""
echo "Running flow execution tests..."
echo "================================"

cd tests/integration
ORCHESTRATOR_URL=http://localhost:$ORCH_PORT \
FRONTEND_URL=http://localhost:$FRONT_PORT \
PLANNING_URL=http://localhost:$PLAN_PORT \
npx jest flow-execution-real.test.ts \
  --testTimeout=300000 \
  --forceExit \
  --detectOpenHandles \
  --runInBand

TEST_EXIT_CODE=$?

echo ""
echo "Cleaning up..."
echo "================================"

# Kill services
kill $ORCH_PID $FRONT_PID $PLAN_PID 2>/dev/null || true

# Stop containers
docker stop postgres-flow-$TEST_ID redis-flow-$TEST_ID > /dev/null 2>&1 || true
docker rm postgres-flow-$TEST_ID redis-flow-$TEST_ID > /dev/null 2>&1 || true

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ Tests completed successfully!"
  echo "📊 Report available at: test-reports/flow-execution.json"
else
  echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
  echo "Check logs in test-data/ directory"
fi

exit $TEST_EXIT_CODE