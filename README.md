# Anton v2 - AI Orchestration Platform

An advanced AI orchestration platform that integrates directly with Claude Code CLI to automatically plan and execute complex software development workflows.

## 🎯 Overview

Anton v2 represents a complete redesign of the AI orchestration system, moving from a complex multi-service architecture to a streamlined approach that leverages Claude Code CLI for intelligent planning and execution.

### Key Features

- 🤖 **Claude Code Integration**: Direct integration with Claude CLI for AI-powered development
- 📋 **Automatic Planning**: Generate comprehensive execution plans from natural language prompts
- ⚡ **Parallel Execution**: Smart parallelization of tasks for faster completion
- 🔄 **Real-time Streaming**: Live updates via WebSocket as tasks execute
- 🎨 **Visual Editor**: Drag-and-drop interface for workflow creation and monitoring
- 🧪 **Test-Fix Loops**: Automatic testing and fixing cycles for quality assurance

## 🏗️ Architecture

```
Anton/
├── backend/                 # New Express/TypeScript backend
│   ├── src/
│   │   ├── routes/         # REST API endpoints
│   │   ├── services/       # Claude integration services
│   │   └── websocket/      # Real-time streaming
│   └── README.md
├── anton-visual-editor/     # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   └── services/       # API clients
│   └── README.md
├── agents/                  # Agent library (50+ pre-built agents)
│   └── library/
└── planning-agent-test-framework/  # Claude planning configuration
    └── .claude/            # System prompts and configurations
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Claude CLI installed (`claude` command available)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/anton.git
cd anton

# Install all dependencies
npm run install:all

# Copy environment configuration
cd backend
cp .env.example .env
# Edit .env with your configuration
```

### Running the Application

```bash
# From the root directory
npm run dev

# This starts:
# - Backend API on http://localhost:3001
# - Frontend UI on http://localhost:3000
# - WebSocket server on ws://localhost:3001/ws
```

## 📡 API Usage

### Generate a Plan

```bash
curl -X POST http://localhost:3001/api/planning/generate-plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a REST API with Node.js and Express that includes user authentication, CRUD operations for a blog, and PostgreSQL database"
  }'
```

### Execute a Plan

```bash
curl -X POST http://localhost:3001/api/execution/execute \
  -H "Content-Type: application/json" \
  -d '{
    "planPath": "./planning-outputs/plan-2024-01-01/plan.json",
    "mode": "full"
  }'
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  // Subscribe to planning updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'planning',
    sessionId: 'your-session-id'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Claude output:', message);
});
```

## 📚 Documentation

- [Backend Documentation](./backend/README.md) - API endpoints, WebSocket protocol, services
- [Frontend Documentation](./anton-visual-editor/README.md) - UI components and usage
- [Agent Library](./agents/README.md) - Available agents and their capabilities

## 🧪 Agent Library

Anton includes 50+ pre-built specialized agents:

- **Setup Agents**: Project initialization, dependency management
- **Development Agents**: Frontend, backend, database, API development
- **Testing Agents**: Unit testing, integration testing, E2E testing
- **Integration Agents**: API integration, service orchestration
- **Review Agents**: Code review, security audit, performance analysis
- **Documentation Agents**: README generation, API documentation

## 🔄 Workflow Example

1. **Describe Your Project**
   ```
   "Create a full-stack e-commerce application with React frontend, 
   Node.js backend, PostgreSQL database, user authentication, 
   product catalog, shopping cart, and payment integration"
   ```

2. **Anton Generates a Plan**
   - Analyzes requirements
   - Identifies parallelizable tasks
   - Creates execution nodes with dependencies
   - Includes testing and integration phases

3. **Execution Begins**
   - Multiple agents work in parallel
   - Real-time updates stream to the UI
   - Automatic testing and fixing
   - Integration at convergence points

4. **Project Delivered**
   - Complete, tested application
   - Documentation included
   - Ready for deployment

## 🛠️ Development

### Project Structure

- **Backend** (`/backend`): Express.js API with Claude CLI integration
- **Frontend** (`/anton-visual-editor`): React application with visual workflow editor
- **Agents** (`/agents`): Agent definitions and configurations
- **Planning Framework** (`/planning-agent-test-framework`): Claude planning system

### Key Technologies

- **Backend**: TypeScript, Express.js, WebSocket, Claude CLI
- **Frontend**: React, TypeScript, Zustand, React Flow
- **Agents**: JSON schemas with Claude MD instructions
- **Execution**: Child process spawning, stream parsing

## 📝 License

MIT

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 🔗 Links

- [Documentation](https://docs.anton.ai)
- [Discord Community](https://discord.gg/anton)
- [Issue Tracker](https://github.com/yourusername/anton/issues)

## ⚡ What's New in v2

- **Simplified Architecture**: Removed complex orchestration layers in favor of direct Claude CLI integration
- **Real-time Streaming**: Live Claude output streaming via WebSocket
- **Better Planning**: Two-phase planning with automatic plan fixing
- **Cleaner Codebase**: TypeScript throughout with modern patterns
- **Improved Performance**: Direct process spawning instead of queue-based execution

---

Built with ❤️ using Claude Code