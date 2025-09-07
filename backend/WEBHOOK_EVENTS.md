# Anton Webhook Events

## Planning Events

### `plan.started`
Emitted when a planning session begins.

**Payload:**
```json
{
  "sessionId": "string",
  "step": "initializing",
  "message": "Starting planning process"
}
```

### `plan.step`
Emitted for each step in the planning process.

**Payload:**
```json
{
  "sessionId": "string",
  "step": "validating | project-created | planning | reviewing",
  "message": "string",
  "status": "complete",  // Optional: when step completes
  "isValid": true,        // Optional: for validation step
  "projectName": "string" // Optional: project name when available
}
```

**Steps:**
- `validating` - Validating if the prompt describes a software project
- `project-created` - Project folder and git repo initialized
- `planning` - Generating the execution plan
- `reviewing` - Reviewing and optimizing the plan

### `plan.completed`
Emitted when planning completes successfully.

**Payload:**
```json
{
  "sessionId": "string",
  "projectName": "string",
  "outputDir": "string",
  "nodeCount": 10
}
```

### `plan.failed`
Emitted when planning fails.

**Payload:**
```json
{
  "sessionId": "string",
  "error": "string",
  "step": "validating | project-creation | planning | reviewing"
}
```

## Execution Events

### `execution.started`
Emitted when execution begins.

### `execution.completed`
Emitted when execution completes.

### `node.started`
Emitted when a node begins execution.

### `node.completed`
Emitted when a node completes successfully.

### `node.failed`
Emitted when a node fails.

## Registering Webhooks

To receive webhook events, register your endpoint:

```bash
curl -X POST http://localhost:3001/api/webhooks/register \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-endpoint.com/webhooks",
    "events": ["plan.started", "plan.step", "plan.completed", "plan.failed"],
    "secret": "your-secret-key"
  }'
```

## Webhook Payload Structure

All webhooks are sent as POST requests with:

**Headers:**
- `Content-Type: application/json`
- `X-Anton-Event: {event-name}`
- `X-Anton-Timestamp: {ISO-8601-timestamp}`
- `X-Anton-Signature: {HMAC-SHA256-signature}` (if secret configured)

**Body:**
```json
{
  "event": "plan.step",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    // Event-specific data
  }
}
```