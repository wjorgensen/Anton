# Anton v2 - Improvements Plan

## Current Status Report

### ✅ Working Features
1. **Frontend Application** - Loads successfully on port 3001 with retro circuit board UI
2. **Project Dashboard** - Displays projects and allows creation of new projects (client-side storage)
3. **UI Components** - Retro-themed interface renders correctly
4. **Claude Code Integration** - Properly configured to use local `claude` CLI without API keys
5. **Database Migrations** - Successfully applied when DATABASE_URL is provided
6. **Basic Navigation** - Dashboard and circuit board routes work

### 🔴 Broken/Missing Features
1. **Orchestrator Service Issues**
   - Requires DATABASE_URL environment variable to start
   - Database connection not persisting between frontend and backend
   - Projects created in frontend not syncing to backend database
   - WebSocket connections failing (ws://localhost:3002/ws)

2. **Circuit Board Editor**
   - Cannot open projects due to database sync issues
   - Returns "Project not found" error when trying to load
   - Node editing and flow execution not accessible

3. **Backend API Endpoints**
   - `/api/projects/:id` returns 500 errors due to Prisma issues
   - Agent execution endpoints untested
   - Preview services not functional

4. **Missing Configuration**
   - No .env file with required environment variables
   - Redis connection not properly configured
   - Hooks and agent execution paths not verified

## Priority Fixes (To Get Fully Working)

### 1. Fix Database Configuration (CRITICAL)
```bash
# Create .env file in orchestration directory
cd orchestration
cat > .env << EOF
DATABASE_URL="file:./prisma/dev.db"
REDIS_HOST="localhost"
REDIS_PORT="6379"
JWT_SECRET="your-secret-key-here"
CORS_ORIGIN="http://localhost:3001"
PORT=3002
EOF
```

### 2. Fix Start Script
Update `start.sh` to properly handle environment variables and port conflicts:
```bash
#!/bin/bash
# Kill any existing processes on required ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null

# Start Redis
redis-cli ping > /dev/null 2>&1 || redis-server --daemonize yes

# Start Orchestrator with environment
cd orchestration
npm run dev &
ORCH_PID=$!
cd ..

# Start Frontend (will use port 3001 if 3000 is taken)
cd anton-visual-editor
npm run dev &
FRONTEND_PID=$!
cd ..
```

### 3. Fix WebSocket Service
- Update `WebSocketService.ts` to properly initialize Socket.io
- Fix CORS configuration for WebSocket connections
- Add reconnection logic with exponential backoff

### 4. Fix Project Storage
- Implement proper project persistence in SQLite database
- Sync client-side project storage with backend
- Add proper error handling for database operations

### 5. Fix Claude Code Integration
Update `ClaudeCodeManager.ts` spawn command:
```typescript
const childProcess = spawn('claude', [
  'code',  // Add 'code' subcommand
  '-p',
  '--dangerously-skip-permissions',
  instructions
], {
  cwd: projectDir,
  env: {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDir,
    NO_COLOR: '1'  // Disable color output for parsing
  }
});
```

### 6. Implement Missing Features
- [ ] Real-time execution monitoring via WebSocket
- [ ] Terminal preview for agent output
- [ ] Web preview for generated content
- [ ] Agent library loading and selection
- [ ] Flow execution with proper error handling
- [ ] Review checkpoints and manual approval flow

## Testing Checklist
- [ ] Create new project persists to database
- [ ] Open project loads circuit board editor
- [ ] Add nodes to circuit board
- [ ] Connect nodes with edges
- [ ] Execute flow with Claude Code agents
- [ ] Monitor execution in real-time
- [ ] View agent output in preview panels
- [ ] Handle errors gracefully
- [ ] Complete full workflow from start to finish

## Configuration Files Needed

### 1. orchestration/.env
```env
DATABASE_URL="file:./prisma/dev.db"
REDIS_HOST="localhost"
REDIS_PORT="6379"
JWT_SECRET="anton-secret-key-2024"
CORS_ORIGIN="http://localhost:3001"
PORT=3002
WORKER_CONCURRENCY=5
NODE_ENV=development
```

### 2. anton-visual-editor/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

### 3. Docker Compose (Optional)
For production deployment, add proper Docker configuration for:
- Redis container
- PostgreSQL (instead of SQLite)
- Nginx reverse proxy
- Service orchestration

## Recommended Architecture Improvements

1. **State Management**
   - Implement Redux or Zustand for frontend state
   - Add optimistic updates for better UX
   - Cache API responses

2. **Error Handling**
   - Global error boundary in React
   - Retry logic for failed API calls
   - User-friendly error messages

3. **Security**
   - Add authentication middleware
   - Implement rate limiting
   - Sanitize user inputs
   - Secure WebSocket connections

4. **Performance**
   - Implement connection pooling for database
   - Add caching layer (Redis)
   - Optimize bundle size
   - Lazy load components

5. **Developer Experience**
   - Add comprehensive logging
   - Implement health check endpoints
   - Create development seeds for database
   - Add integration tests

## Next Steps to Full Functionality

1. **Immediate** (Required for basic operation):
   - Fix environment configuration
   - Restart services with proper environment
   - Test database connectivity
   - Verify Claude Code execution

2. **Short-term** (Within a day):
   - Fix WebSocket connections
   - Implement project persistence
   - Test agent execution flow
   - Add error recovery

3. **Medium-term** (Within a week):
   - Complete preview features
   - Add execution monitoring
   - Implement review system
   - Create test suite

4. **Long-term** (Future enhancements):
   - Multi-user support
   - Cloud deployment
   - Agent marketplace
   - Advanced workflow templates

## Success Criteria
The system will be considered fully functional when:
1. Users can create and persist projects
2. Circuit board editor allows visual flow creation
3. Flows execute using local Claude Code
4. Real-time monitoring shows execution progress
5. Results are captured and displayed
6. No API keys are required for operation
7. All services communicate properly
8. Error states are handled gracefully