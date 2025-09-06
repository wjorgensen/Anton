#!/bin/bash

# Anton v2 Stop Script
echo "🛑 Stopping Anton v2..."
echo "================================"

# Kill processes from PID file if it exists
if [ -f .anton-pids ]; then
    while read pid; do
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid 2>/dev/null
            echo "✅ Stopped process $pid"
        fi
    done < .anton-pids
    rm .anton-pids
fi

# Kill any remaining Node.js processes for Anton
pkill -f "npm run dev.*orchestration" 2>/dev/null
pkill -f "npm run dev.*anton-visual-editor" 2>/dev/null
pkill -f "tsx.*index.ts" 2>/dev/null
pkill -f "next dev" 2>/dev/null

# Stop Redis if running in Docker
docker stop anton-redis 2>/dev/null && docker rm anton-redis 2>/dev/null && echo "✅ Redis stopped"

echo ""
echo "================================"
echo "✅ Anton v2 stopped"
echo "================================"