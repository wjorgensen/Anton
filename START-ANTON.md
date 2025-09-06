# 🚀 Anton v2 - Quick Start Guide

## Starting the System

### Option 1: Quick Start (All Services)
```bash
# Start all services with one command
cd /Users/wes/Programming/Anton
./start-all.sh
```

### Option 2: Manual Start (Individual Services)

#### 1. Start Database (PostgreSQL)
```bash
# If using Docker
docker run -d \
  --name anton-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=anton \
  -p 5432:5432 \
  postgres:15-alpine

# Or if PostgreSQL is installed locally
pg_ctl start
```

#### 2. Start Redis (for queues)
```bash
# Using Docker
docker run -d \
  --name anton-redis \
  -p 6379:6379 \
  redis:7-alpine

# Or if Redis is installed locally
redis-server
```

#### 3. Start Orchestration Service (Backend)
```bash
cd orchestration
npm run dev
# Runs on http://localhost:3002
```

#### 4. Start Frontend
```bash
cd anton-visual-editor
npm run dev
# Runs on http://localhost:3000
```

#### 5. Start Planning Service (Optional - for AI planning)
```bash
cd planning-service
npm run dev
# Runs on http://localhost:3003
```

---

## Accessing Anton v2

Once all services are running:

1. **Open Browser**: Navigate to http://localhost:3000
2. **Dashboard**: You'll see the Project Dashboard
3. **Create Project**: Click "New Project" button
4. **Follow Wizard**: Complete the 4-step wizard
5. **Flow Editor**: Design your AI orchestration flow

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Orchestrator API | 3002 | http://localhost:3002 |
| Planning Service | 3003 | http://localhost:3003 |
| PostgreSQL | 5432 | postgresql://localhost:5432/anton |
| Redis | 6379 | redis://localhost:6379 |

---

## Health Checks

Verify services are running:

```bash
# Check Frontend
curl http://localhost:3000

# Check Orchestrator
curl http://localhost:3002/health

# Check Planning Service  
curl http://localhost:3003/health

# Check Database
psql -U postgres -d anton -c "SELECT 1"

# Check Redis
redis-cli ping
```

---

## Stopping the System

### Option 1: Stop All
```bash
./stop-all.sh
```

### Option 2: Manual Stop
```bash
# Stop Frontend
# Press Ctrl+C in the terminal running npm run dev

# Stop Orchestrator
# Press Ctrl+C in the terminal running npm run dev

# Stop Docker containers
docker stop anton-postgres anton-redis
docker rm anton-postgres anton-redis
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port (e.g., 3000)
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Database Connection Issues
```bash
# Reset database
cd orchestration
npm run db:reset
npm run db:migrate
npm run db:seed
```

### Clear Redis Cache
```bash
redis-cli FLUSHALL
```

---

## Project File Storage

Projects are stored in multiple locations:

### 1. Database (Primary Storage)
- **Location**: PostgreSQL database `anton`
- **Tables**: 
  - `projects` - Project metadata
  - `flows` - Flow configurations
  - `executions` - Execution history
  - `node_executions` - Individual node results

### 2. File System (Generated Code)
- **Location**: `/Users/wes/Programming/Anton/projects/`
- **Structure**:
  ```
  projects/
  ├── <project-id>/
  │   ├── src/           # Generated source code
  │   ├── config/        # Configuration files
  │   ├── .anton/        # Anton metadata
  │   └── output/        # Build artifacts
  ```

### 3. Execution Artifacts
- **Location**: `/Users/wes/Programming/Anton/executions/`
- **Structure**:
  ```
  executions/
  ├── <execution-id>/
  │   ├── logs/          # Execution logs
  │   ├── artifacts/     # Generated files
  │   └── snapshots/     # State snapshots
  ```

### 4. Temporary Files
- **Location**: `/tmp/anton/` or OS temp directory
- **Used for**: Build processes, temporary artifacts

---

## Environment Variables

Create `.env` file in each service directory:

### orchestration/.env
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anton
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
PORT=3002
```

### anton-visual-editor/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

---

## Development Tools

### View Database
```bash
# Using psql
psql -U postgres -d anton

# List tables
\dt

# View projects
SELECT * FROM projects;
```

### Monitor Redis
```bash
redis-cli MONITOR
```

### View Logs
```bash
# Orchestrator logs
tail -f orchestration/logs/*.log

# Frontend logs
# Check browser console (F12)
```

---

## Quick Commands

```bash
# Start everything
cd /Users/wes/Programming/Anton && \
docker start anton-postgres anton-redis 2>/dev/null || \
(docker run -d --name anton-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15-alpine && \
docker run -d --name anton-redis -p 6379:6379 redis:7-alpine) && \
(cd orchestration && npm run dev &) && \
(cd anton-visual-editor && npm run dev &)

# Open in browser
open http://localhost:3000
```