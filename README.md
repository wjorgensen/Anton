# Anton v2 - AI Orchestration Platform

## Quick Start

```bash
# Start the system
./start.sh

# Stop the system
./stop.sh
```

The application will open at http://localhost:3000

## Project Structure

```
Anton/
├── start.sh                 # Start all services
├── stop.sh                  # Stop all services
├── START-ANTON.md           # Detailed startup documentation
├── EXECUTION_MONITOR.md     # Execution monitoring guide
│
├── orchestration/           # Backend orchestrator service (port 3002)
│   ├── src/                 # Source code
│   ├── prisma/              # Database schema and migrations
│   └── package.json         # Dependencies
│
├── anton-visual-editor/     # Frontend React application (port 3000)
│   ├── src/                 # Source code
│   │   ├── components/      # React components
│   │   ├── store/          # State management
│   │   └── services/       # API clients
│   └── package.json        # Dependencies
│
├── agents/                  # Agent library (50+ pre-built agents)
│   └── library/            # Agent definitions by category
│       ├── setup/          # Setup agents
│       ├── execution/      # Development agents
│       ├── testing/        # Testing agents
│       ├── integration/    # Integration agents
│       └── review/         # Review agents
│
├── planning-service/        # Optional AI planning service (port 3003)
├── hooks/                   # System hooks for customization
├── monitoring/              # Grafana/Prometheus configs
└── test-reports/           # Test execution reports
```

## Key Features

- **Visual Flow Editor**: Drag-and-drop AI agent orchestration
- **50+ Pre-built Agents**: Ready-to-use agents for various tasks
- **Real-time Execution**: Monitor agent execution in real-time
- **Project Management**: Create, edit, and manage AI workflows
- **SQLite Database**: Lightweight local data storage

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | React-based visual editor |
| Orchestrator | 3002 | Backend API and execution engine |
| Planning | 3003 | AI-powered workflow planning (optional) |
| Redis | 6379 | Queue and caching |

## Data Storage

- **Database**: `orchestration/prisma/dev.db` (SQLite)
- **Logs**: `.archive/logs/` (archived test logs)
- **Tests**: `.archive/test-files/` (archived test scripts)

## Development

```bash
# Frontend development
cd anton-visual-editor
npm run dev

# Backend development
cd orchestration
npm run dev

# Run tests
npm test
```

## Troubleshooting

See [START-ANTON.md](./START-ANTON.md) for detailed troubleshooting steps.

## Archived Files

Old test files, screenshots, and logs have been moved to `.archive/` to keep the project root clean.