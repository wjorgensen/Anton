# Anton v2 Orchestration Engine

The orchestration engine manages Claude Code instances and coordinates flow execution for the Anton v2 visual AI orchestration platform.

## Architecture Overview

The orchestration engine consists of several key components:

- **ClaudeCodeManager**: Spawns and manages Claude Code instances with isolated project directories
- **FlowExecutor**: Reads flow.json and manages dependency resolution and parallel execution
- **HookHandler**: HTTP endpoints for receiving callbacks from Claude Code hooks
- **JobQueueManager**: Redis/BullMQ-based job queue for scalable execution
- **WebSocketService**: Real-time updates to connected clients
- **ErrorHandler**: Comprehensive error handling and recovery strategies

## Setup

### Prerequisites

- Node.js 18+
- Redis server
- Claude Code CLI installed and accessible in PATH

### Installation

```bash
cd orchestration
npm install
```

### Environment Variables

Create a `.env` file:

```env
PORT=3002
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
WORKER_CONCURRENCY=5
NODE_ENV=development
```

### Running the Server

Development mode:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## API Endpoints

### Flow Execution
- `POST /api/flow/execute` - Execute a flow
- `POST /api/flow/pause/:flowId` - Pause flow execution
- `POST /api/flow/resume/:flowId` - Resume flow execution
- `POST /api/flow/abort/:flowId` - Abort flow execution

### Hook Callbacks
- `POST /api/agent-complete` - Agent completion hook
- `POST /api/file-changed` - File change hook
- `POST /api/agent-error` - Error hook
- `POST /api/checkpoint` - Checkpoint hook
- `POST /api/review/:nodeId` - Review response

### Queue Management
- `GET /api/queue/stats` - Queue statistics
- `POST /api/queue/clear` - Clear all queues

### Monitoring
- `GET /health` - Health check and stats
- `GET /api/errors` - Error log
- `GET /api/hook-history/:nodeId` - Hook history for a node

## WebSocket Events

### Client -> Server
- `subscribe:flow` - Subscribe to flow updates
- `subscribe:node` - Subscribe to node updates
- `flow:pause` - Request flow pause
- `flow:resume` - Request flow resume
- `flow:abort` - Request flow abort

### Server -> Client
- `flow:started` - Flow execution started
- `flow:completed` - Flow execution completed
- `flow:failed` - Flow execution failed
- `node:started` - Node execution started
- `node:completed` - Node execution completed
- `node:failed` - Node execution failed
- `terminal:output` - Terminal output streaming
- `files:changed` - File changes detected

## Flow JSON Schema

```json
{
  "id": "string",
  "version": "number",
  "name": "string",
  "description": "string",
  "nodes": [
    {
      "id": "string",
      "agentId": "string",
      "label": "string",
      "instructions": "string",
      "inputs": {},
      "position": { "x": 100, "y": 100 },
      "config": {
        "retryOnFailure": true,
        "maxRetries": 3,
        "timeout": 60000,
        "requiresReview": false
      },
      "status": "pending"
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "node-id",
      "target": "node-id",
      "sourceHandle": "output",
      "targetHandle": "input"
    }
  ],
  "metadata": {}
}
```

## Hook Configuration

Each Claude Code instance is configured with hooks that callback to the orchestration engine:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "/path/to/hooks/stop.sh NODE_ID $STATUS"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "/path/to/hooks/track-changes.sh NODE_ID"
      }]
    }]
  }
}
```

## Error Handling

The engine includes comprehensive error handling:

- Automatic retry with exponential backoff
- Context enhancement for retries
- Recovery strategies per error type
- Error categorization and logging
- Graceful degradation

## Scaling

The orchestration engine is designed for horizontal scaling:

- Multiple worker instances can process jobs
- Redis-based queue for distributed processing
- WebSocket clustering support
- Stateless design for easy scaling

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Type Checking
```bash
npm run typecheck
```

### Docker Build
```bash
npm run docker:build
npm run docker:run
```

## Architecture Decisions

1. **Claude Code as Execution Units**: Each node spawns a real Claude Code instance with isolated environment
2. **Hook-Based Communication**: Uses Claude Code's hook system for orchestration
3. **Job Queue Architecture**: BullMQ for reliable, scalable job processing
4. **Real-time Updates**: WebSocket for live streaming of execution status
5. **Error Recovery**: Multiple retry strategies with context enhancement

## License

MIT