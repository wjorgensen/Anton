#!/bin/bash

# Anton v2 - Stop Hook
# Handles agent completion and communicates results to orchestrator
# This hook is triggered when a Claude Code instance completes execution

set -euo pipefail

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3002}"
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOG_FILE="${CLAUDE_PROJECT_DIR}/hooks.log"

# Parse command line arguments
NODE_ID=""
STATUS=""
EXIT_CODE=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --node-id)
            NODE_ID="$2"
            shift 2
            ;;
        --status)
            STATUS="$2"
            shift 2
            ;;
        --exit-code)
            EXIT_CODE="$2"
            shift 2
            ;;
        --session-id)
            SESSION_ID="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$NODE_ID" ]]; then
    echo "Error: --node-id is required" >&2
    exit 1
fi

if [[ -z "$STATUS" ]]; then
    STATUS="completed"
fi

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] STOP: $*" >> "$LOG_FILE"
}

# Function to safely read JSON file
read_json_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cat "$file" 2>/dev/null || echo "{}"
    else
        echo "{}"
    fi
}

# Function to collect agent output
collect_output() {
    local output_json="{}"
    
    # Check for standard output file
    if [[ -f "${CLAUDE_PROJECT_DIR}/output.json" ]]; then
        output_json=$(read_json_file "${CLAUDE_PROJECT_DIR}/output.json")
    fi
    
    # Collect modified files
    local modified_files="[]"
    if command -v git &> /dev/null && [[ -d "${CLAUDE_PROJECT_DIR}/.git" ]]; then
        modified_files=$(git -C "$CLAUDE_PROJECT_DIR" diff --name-only 2>/dev/null | \
                        jq -R -s -c 'split("\n") | map(select(length > 0))' || echo "[]")
    fi
    
    # Collect logs
    local logs="[]"
    if [[ -f "${CLAUDE_PROJECT_DIR}/execution.log" ]]; then
        logs=$(tail -n 100 "${CLAUDE_PROJECT_DIR}/execution.log" 2>/dev/null | \
               jq -R -s -c 'split("\n") | map(select(length > 0))' || echo "[]")
    fi
    
    # Combine all output data
    echo "$output_json" | jq \
        --argjson files "$modified_files" \
        --argjson logs "$logs" \
        '. + {modifiedFiles: $files, logs: $logs}'
}

# Function to calculate metrics
calculate_metrics() {
    local start_time_file="${CLAUDE_PROJECT_DIR}/.start_time"
    local duration=0
    
    if [[ -f "$start_time_file" ]]; then
        local start_time=$(cat "$start_time_file")
        local end_time=$(date +%s)
        duration=$((end_time - start_time))
    fi
    
    # Token usage would come from Claude Code metrics
    # For now, using placeholder
    local tokens_used=0
    if [[ -f "${CLAUDE_PROJECT_DIR}/.token_usage" ]]; then
        tokens_used=$(cat "${CLAUDE_PROJECT_DIR}/.token_usage" 2>/dev/null || echo "0")
    fi
    
    jq -n \
        --arg duration "$duration" \
        --arg tokens "$tokens_used" \
        '{duration: ($duration | tonumber), tokensUsed: ($tokens | tonumber)}'
}

# Main execution
log "Stop hook triggered for node: $NODE_ID with status: $STATUS"

# Collect all necessary data
OUTPUT_DATA=$(collect_output)
METRICS=$(calculate_metrics)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build the hook event payload
PAYLOAD=$(jq -n \
    --arg node_id "$NODE_ID" \
    --arg status "$STATUS" \
    --arg timestamp "$TIMESTAMP" \
    --arg exit_code "${EXIT_CODE:-0}" \
    --arg session_id "${SESSION_ID:-}" \
    --argjson output "$OUTPUT_DATA" \
    --argjson metrics "$METRICS" \
    '{
        event: "stop",
        nodeId: $node_id,
        timestamp: $timestamp,
        status: {
            code: ($exit_code | tonumber),
            message: $status
        },
        sessionId: $session_id,
        output: {
            data: $output,
            metrics: $metrics
        },
        next: {
            action: (if $status == "completed" then "continue" else "retry" end)
        }
    }')

log "Sending payload to orchestrator: $(echo "$PAYLOAD" | jq -c .)"

# Send to orchestrator with retry logic
MAX_RETRIES=3
RETRY_COUNT=0
SUCCESS=false

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]] && [[ "$SUCCESS" == "false" ]]; do
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-Hook-Type: stop" \
        -H "X-Node-ID: ${NODE_ID}" \
        -d "$PAYLOAD" \
        "${ORCHESTRATOR_URL}/api/hooks/stop" 2>/dev/null || echo "000")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]] || [[ "$HTTP_CODE" == "202" ]]; then
        SUCCESS=true
        log "Successfully sent stop event to orchestrator (HTTP $HTTP_CODE)"
        
        # Process orchestrator response if needed
        if [[ -n "$RESPONSE_BODY" ]]; then
            echo "$RESPONSE_BODY" | jq -r '.message // empty' 2>/dev/null || true
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "Failed to send stop event (HTTP $HTTP_CODE), retry $RETRY_COUNT/$MAX_RETRIES"
        
        if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
            sleep 2
        fi
    fi
done

if [[ "$SUCCESS" == "false" ]]; then
    log "ERROR: Failed to send stop event after $MAX_RETRIES retries"
    
    # Save payload to file for manual recovery
    FALLBACK_FILE="${CLAUDE_PROJECT_DIR}/failed_hook_$(date +%s).json"
    echo "$PAYLOAD" > "$FALLBACK_FILE"
    log "Saved failed hook payload to: $FALLBACK_FILE"
    
    exit 1
fi

# Cleanup temporary files
rm -f "${CLAUDE_PROJECT_DIR}/.start_time" 2>/dev/null || true
rm -f "${CLAUDE_PROJECT_DIR}/.token_usage" 2>/dev/null || true

log "Stop hook completed successfully"
exit 0