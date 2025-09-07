# Anton Backend v2.0 - Claude Code Integration

A modern backend for the Anton AI orchestration system that integrates directly with Claude Code CLI for intelligent planning and execution of software development workflows.

## 🚀 Features

- **Claude Code Integration**: Direct integration with Claude CLI for AI-powered planning and execution
- **Real-time Streaming**: WebSocket support for live streaming of Claude outputs
- **Plan Generation**: Automatic generation of execution plans from natural language prompts
- **Plan Execution**: Orchestrated execution of plans with parallel node support
- **Webhook System**: Configurable webhooks for event notifications
- **REST API**: Comprehensive REST API for all operations

## 📋 Prerequisites

- Node.js 18+
- npm 9+
- Claude CLI installed and configured (`claude` command available)
- Planning agent test framework set up in `../planning-agent-test-framework`

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## 🏃‍♂️ Running the Server

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build
npm start
```

The server will start on `http://localhost:3001` by default.

## 📡 API Endpoints

### Planning Endpoints

#### Generate Plan
```http
POST /api/planning/generate-plan
Content-Type: application/json

{
  "prompt": "Create a todo list application with React and Node.js",
  "runFixer": true,
  "config": {
    "maxParallelization": true,
    "includeTests": true,
    "includeDocs": true
  }
}
```

#### Get Planning Status
```http
GET /api/planning/status/:sessionId
```

#### Cancel Planning
```http
POST /api/planning/cancel/:sessionId
```

#### Validate Plan
```http
POST /api/planning/validate
Content-Type: application/json

{
  "plan": { /* plan object */ }
}
```

### Execution Endpoints

#### Execute Plan
```http
POST /api/execution/execute
Content-Type: application/json

{
  "planPath": "/path/to/plan.json",
  "mode": "full",
  "config": {
    "failFast": false,
    "parallel": true,
    "maxConcurrency": 3
  }
}
```

Or with file upload:
```http
POST /api/execution/execute
Content-Type: multipart/form-data

planFile: [plan.json file]
mode: "selective"
selectedNodes: ["node-1", "node-2"]
```

#### Get Execution Status
```http
GET /api/execution/status/:executionId
```

#### Pause/Resume/Cancel Execution
```http
POST /api/execution/pause/:executionId
POST /api/execution/resume/:executionId
POST /api/execution/cancel/:executionId
```

#### Get Node Logs
```http
GET /api/execution/logs/:executionId/:nodeId
```

### Webhook Endpoints

#### Register Webhook
```http
POST /api/webhooks/register
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["plan.completed", "node.started", "node.completed"],
  "secret": "your-secret-key",
  "active": true
}
```

#### List Webhooks
```http
GET /api/webhooks
```

#### Update Webhook
```http
PUT /api/webhooks/:webhookId
```

#### Delete Webhook
```http
DELETE /api/webhooks/:webhookId
```

#### Test Webhook
```http
POST /api/webhooks/test/:webhookId
```

## 🔌 WebSocket Connection

Connect to the WebSocket server for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  // Subscribe to planning session
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'planning',
    sessionId: 'session-id-here'
  }));
  
  // Subscribe to execution
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'execution',
    executionId: 'execution-id-here'
  }));
  
  // Subscribe to specific node
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'node',
    nodeId: 'node-id-here'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  if (message.type === 'stream') {
    // Handle streamed Claude output
    console.log('Claude message:', message.data);
  }
});
```

### WebSocket Message Types

#### Subscribe
```json
{
  "type": "subscribe",
  "channel": "planning|execution|node",
  "sessionId": "...",
  "executionId": "...",
  "nodeId": "..."
}
```

#### Unsubscribe
```json
{
  "type": "unsubscribe",
  "subscriptionKey": "planning-session-123"
}
```

#### Get Status
```json
{
  "type": "get-status",
  "sessionId": "..."
}
```

## 📊 Claude Message Format

The backend parses and streams Claude's JSON output format:

```json
{
  "type": "system|assistant|user|result",
  "subtype": "init|...",
  "message": {
    "id": "msg_...",
    "content": [...],
    "tool_use": [...]
  },
  "session_id": "...",
  "uuid": "..."
}
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `LOG_LEVEL` | Logging level | info |
| `PLANNING_OUTPUT_DIR` | Directory for planning outputs | ./planning-outputs |
| `EXECUTION_OUTPUT_DIR` | Directory for execution outputs | ./execution-outputs |
| `CLAUDE_CONFIG_DIR` | Claude configuration directory | ../planning-agent-test-framework/.claude |
| `MAX_CONCURRENT_NODES` | Max parallel node executions | 3 |
| `WEBHOOK_SECRET` | Secret for webhook signatures | - |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:3000 |

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/               # API route handlers
│   │   ├── planning.ts       # Planning endpoints
│   │   ├── execution.ts      # Execution endpoints
│   │   └── webhooks.ts       # Webhook endpoints
│   ├── services/             # Business logic services
│   │   ├── PlanningService.ts    # Claude planning integration
│   │   ├── ExecutionService.ts   # Plan execution orchestration
│   │   ├── ClaudeStreamManager.ts # Stream parsing and management
│   │   └── WebhookManager.ts     # Webhook delivery system
│   ├── websocket/            # WebSocket handlers
│   │   └── handlers.ts       # WS connection and message handling
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts          # Shared types
│   └── utils/                # Utility functions
│       └── logger.ts         # Winston logger configuration
├── planning-outputs/         # Generated plans output
├── execution-outputs/        # Execution workspace
├── logs/                     # Application logs
├── uploads/                  # Temporary file uploads
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
└── .env                     # Environment variables
```

## 🔍 Monitoring & Logs

Logs are written to the `logs/` directory:
- `combined.log` - All application logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

## 🧪 Testing

```bash
# Run tests
npm test

# Test plan generation
curl -X POST http://localhost:3001/api/planning/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a simple hello world app"}'

# Test WebSocket connection
wscat -c ws://localhost:3001/ws
```

## 🐛 Debugging

Set `LOG_LEVEL=debug` in your `.env` file for verbose logging.

Monitor Claude process output in real-time through WebSocket connections.

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request