#!/bin/bash

# Anton v2 Startup Script
echo "🚀 Starting Anton v2..."
echo "================================"

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

# Start Orchestrator Service
echo "🔧 Starting Orchestrator Service..."
cd orchestration
npm run dev > ../orchestrator.log 2>&1 &
ORCH_PID=$!
echo "✅ Orchestrator started (PID: $ORCH_PID)"
cd ..

# Wait for orchestrator to be ready
echo "⏳ Waiting for orchestrator to be ready..."
sleep 3

# Start Frontend
echo "🎨 Starting Frontend..."
cd anton-visual-editor
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

# Save PIDs for stop script
echo $ORCH_PID > .anton-pids
echo $FRONTEND_PID >> .anton-pids

echo ""
echo "================================"
echo "✨ Anton v2 is running!"
echo "================================"
echo ""
echo "📍 Frontend:     http://localhost:3000"
echo "📍 Orchestrator: http://localhost:3002"
echo "📍 Database:     orchestration/prisma/dev.db"
echo ""
echo "📁 Project Storage Locations:"
echo "   - Database: orchestration/prisma/dev.db (SQLite)"
echo "   - Generated Files: /tmp/anton/ (temporary)"
echo ""
echo "🛑 To stop: ./stop.sh or press Ctrl+C"
echo ""
echo "Opening browser..."
sleep 2
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null || echo "Please open http://localhost:3000 in your browser"