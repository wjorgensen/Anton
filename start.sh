#!/bin/bash

# Anton v2 Startup Script
echo "🚀 Starting Anton v2..."
echo "================================"

# Kill any existing processes on required ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null

# Check if Redis is running, if not start it
if ! redis-cli ping > /dev/null 2>&1; then
    echo "📦 Starting Redis..."
    if command -v docker &> /dev/null; then
        docker run -d --name anton-redis -p 6379:6379 redis:7-alpine > /dev/null 2>&1
        echo "✅ Redis started in Docker"
    else
        redis-server --daemonize yes
        echo "✅ Redis started"
    fi
else
    echo "✅ Redis already running"
fi

# Initialize database if needed
echo "🗄️ Checking database..."
cd orchestration
if [ ! -f "prisma/dev.db" ]; then
    echo "📝 Initializing database..."
    npx prisma migrate dev --name init > /dev/null 2>&1
    echo "✅ Database initialized"
else
    echo "✅ Database already exists"
fi

# Start Orchestrator Service with environment variables
echo "🔧 Starting Orchestrator Service..."
npm run dev > ../orchestrator.log 2>&1 &
ORCH_PID=$!
echo "✅ Orchestrator started (PID: $ORCH_PID)"
cd ..

# Wait for orchestrator to be ready
echo "⏳ Waiting for orchestrator to be ready..."
sleep 5

# Check if orchestrator is running
if ! kill -0 $ORCH_PID 2>/dev/null; then
    echo "❌ Orchestrator failed to start. Check orchestrator.log for details"
    exit 1
fi

# Start Frontend
echo "🎨 Starting Frontend..."
cd anton-visual-editor
PORT=3001 npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

# Save PIDs for stop script
echo $ORCH_PID > .anton-pids
echo $FRONTEND_PID >> .anton-pids

# Wait for frontend to be ready
sleep 3

echo ""
echo "================================"
echo "✨ Anton v2 is running!"
echo "================================"
echo ""
echo "📍 Frontend:     http://localhost:3001"
echo "📍 Orchestrator: http://localhost:3002"
echo "📍 Database:     orchestration/prisma/dev.db"
echo ""
echo "📁 Project Storage Locations:"
echo "   - Database: orchestration/prisma/dev.db (SQLite)"
echo "   - Claude Projects: /tmp/anton-agents/ (temporary)"
echo ""
echo "🛑 To stop: ./stop.sh or press Ctrl+C"
echo ""
echo "Opening browser..."
sleep 2
open http://localhost:3001 2>/dev/null || xdg-open http://localhost:3001 2>/dev/null || echo "Please open http://localhost:3001 in your browser"