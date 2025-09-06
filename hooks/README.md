# Anton v2 Hook System

This directory contains the hook system infrastructure for Anton v2, which enables communication between Claude Code instances and the orchestrator.

## Overview

The hook system allows Claude Code agents to:
- Report completion status to the orchestrator
- Track file changes in real-time
- Handle subagent completion and data aggregation
- Parse and report test results
- Implement security measures for safe execution

## Directory Structure

```
/hooks/
├── stop.sh                 # Handles agent completion
├── track-changes.sh        # Monitors file changes
├── subagent-complete.sh    # Handles subagent completion
├── parse-test-results.sh   # Extracts test results
├── security.sh             # Security validation and sandboxing
├── allowed-commands.txt    # Whitelist of allowed commands
├── types.ts                # TypeScript interfaces for hook payloads
├── examples/               # Example hook configurations
│   ├── setup-agent-hooks.json
│   ├── execution-agent-hooks.json
│   ├── testing-agent-hooks.json
│   ├── review-agent-hooks.json
│   └── integration-agent-hooks.json
└── README.md              # This file
```

## Hook Scripts

### stop.sh
Triggered when a Claude Code instance completes execution. Collects output, metrics, and signals the orchestrator.

**Usage:**
```bash
./hooks/stop.sh --node-id NODE_ID --status STATUS [--exit-code CODE] [--session-id SESSION]
```

### track-changes.sh
Monitors file changes during agent execution, triggered after Write/Edit operations.

**Usage:**
```bash
./hooks/track-changes.sh --node-id NODE_ID --tool TOOL_NAME [--file FILE_PATH] [--session-id SESSION]
```

### subagent-complete.sh
Handles subagent completion and aggregates results for the parent agent.

**Usage:**
```bash
./hooks/subagent-complete.sh --parent PARENT_ID --subagent-id SUBAGENT_ID --status STATUS [--output FILE]
```

### parse-test-results.sh
Extracts and parses test results from various testing frameworks.

**Usage:**
```bash
./hooks/parse-test-results.sh --node-id NODE_ID --command "TEST_COMMAND" [--output FILE] [--framework FRAMEWORK]
```

Supported frameworks:
- Jest
- Pytest
- Go test
- Playwright
- Mocha/Vitest
- Cypress

### security.sh
Implements security measures for hook execution including command validation, sandboxing, and resource limits.

**Usage:**
```bash
./hooks/security.sh {validate|check|execute} [arguments]
```

## Orchestrator CLI

The `anton-orchestrator` CLI tool handles hook events and manages agent orchestration.

### Starting the Server
```bash
./anton-orchestrator server --port 3002 --ws-port 3003
```

### Execute a Flow
```bash
./anton-orchestrator execute flow.json --parallel 5 --output ./results
```

### Test a Hook
```bash
./anton-orchestrator test-hook ./hooks/stop.sh --node-id test-node-1
```

### Check Status
```bash
./anton-orchestrator status --json
```

## Hook Configuration

Each agent type can have its own hook configuration. See the `examples/` directory for templates.

### Example Configuration Structure:
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/hooks/stop.sh --node-id $NODE_ID",
        "timeout": 30000
      }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/hooks/track-changes.sh --node-id $NODE_ID"
      }]
    }]
  }
}
```

## Security Features

The hook system implements multiple security layers:

1. **Command Whitelisting**: Only approved commands can be executed
2. **Pattern Detection**: Blocks dangerous command patterns
3. **Resource Limits**: CPU time and memory restrictions
4. **Environment Sanitization**: Removes dangerous environment variables
5. **Sandboxing**: Optional isolated execution environment
6. **Timeout Protection**: Automatic termination of long-running hooks

### Security Configuration

Edit `allowed-commands.txt` to control which commands can be executed by hooks.

Set environment variables for security limits:
```bash
export MAX_EXECUTION_TIME=30  # seconds
export MAX_MEMORY_MB=512
export SANDBOX_DIR=/tmp/anton-sandbox
```

## TypeScript Types

The `types.ts` file provides comprehensive TypeScript interfaces for:
- Hook event payloads
- Agent configurations
- Flow definitions
- Security contexts
- Orchestrator states

Import types in your TypeScript code:
```typescript
import { StopHookPayload, FlowNode, AgentConfig } from './hooks/types';
```

## Environment Variables

Key environment variables used by the hook system:

- `ORCHESTRATOR_URL`: Orchestrator API endpoint (default: http://localhost:3002)
- `CLAUDE_PROJECT_DIR`: Project directory for the Claude Code instance
- `PREVIEW_URL`: Live preview service URL (default: http://localhost:3003)
- `MAX_RETRIES`: Maximum retry attempts for failed hooks
- `HOOK_TIMEOUT`: Timeout for hook execution in milliseconds

## Phase 2 Integration

The hook system is designed to integrate with the orchestrator API that will be built in Phase 2:

1. **API Endpoints**: The orchestrator will expose REST endpoints for hook events
2. **WebSocket Updates**: Real-time updates will be streamed to connected clients
3. **State Management**: Hook events will update the flow execution state
4. **Error Handling**: Failed hooks will trigger retry or manual intervention logic

## Testing

Test individual hooks:
```bash
# Test stop hook
./hooks/stop.sh --node-id test-1 --status completed

# Test with security validation
./hooks/security.sh execute test-1 "./hooks/stop.sh --node-id test-1 --status completed" stop
```

## Troubleshooting

1. **Permission Denied**: Make sure scripts are executable: `chmod +x hooks/*.sh`
2. **Command Blocked**: Check if the command is in `allowed-commands.txt`
3. **Timeout Issues**: Adjust `MAX_EXECUTION_TIME` environment variable
4. **Missing Dependencies**: Ensure `jq` and `curl` are installed

## Next Steps

Phase 2 will implement:
- Full orchestrator API server
- WebSocket real-time updates
- State persistence and recovery
- Advanced retry strategies
- Distributed execution support