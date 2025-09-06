#!/bin/bash

# Anton v2 - Subagent Complete Hook
# Handles subagent completion and data propagation
# Triggered when a Claude Code subagent completes

set -euo pipefail

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3002}"
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOG_FILE="${CLAUDE_PROJECT_DIR}/hooks.log"

# Parse command line arguments
PARENT_NODE_ID=""
SUBAGENT_ID=""
STATUS=""
OUTPUT_FILE=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --parent)
            PARENT_NODE_ID="$2"
            shift 2
            ;;
        --subagent-id)
            SUBAGENT_ID="$2"
            shift 2
            ;;
        --status)
            STATUS="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
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
if [[ -z "$PARENT_NODE_ID" ]]; then
    echo "Error: --parent is required" >&2
    exit 1
fi

if [[ -z "$SUBAGENT_ID" ]]; then
    SUBAGENT_ID="subagent_$(date +%s)"
fi

if [[ -z "$STATUS" ]]; then
    STATUS="completed"
fi

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUBAGENT: $*" >> "$LOG_FILE"
}

# Function to safely read output
read_subagent_output() {
    local output_file="${OUTPUT_FILE:-${CLAUDE_PROJECT_DIR}/subagent_output.json}"
    
    if [[ -f "$output_file" ]]; then
        cat "$output_file" 2>/dev/null || echo "{}"
    else
        echo "{}"
    fi
}

# Function to aggregate subagent results
aggregate_results() {
    local subagent_output=$(read_subagent_output)
    local parent_context_file="${CLAUDE_PROJECT_DIR}/.parent_context.json"
    
    # Read parent context if exists
    local parent_context="{}"
    if [[ -f "$parent_context_file" ]]; then
        parent_context=$(cat "$parent_context_file" 2>/dev/null || echo "{}")
    fi
    
    # Merge subagent output with parent context
    echo "$parent_context" | jq \
        --argjson subagent "$subagent_output" \
        --arg subagent_id "$SUBAGENT_ID" \
        '.subagents[$subagent_id] = $subagent'
}

# Function to validate subagent output
validate_output() {
    local output="$1"
    local schema_file="${CLAUDE_PROJECT_DIR}/.output_schema.json"
    
    # If schema exists, validate against it
    if [[ -f "$schema_file" ]] && command -v ajv &> /dev/null; then
        echo "$output" | ajv validate -s "$schema_file" 2>&1 | grep -q "valid" && echo "valid" || echo "invalid"
    else
        # Basic validation - check if JSON is valid
        echo "$output" | jq empty 2>/dev/null && echo "valid" || echo "invalid"
    fi
}

# Function to extract key metrics
extract_metrics() {
    local output="$1"
    
    # Extract common metrics
    local files_modified=$(echo "$output" | jq -r '.filesModified // [] | length' 2>/dev/null || echo "0")
    local tests_passed=$(echo "$output" | jq -r '.testsResults.passed // 0' 2>/dev/null || echo "0")
    local tests_failed=$(echo "$output" | jq -r '.testsResults.failed // 0' 2>/dev/null || echo "0")
    local errors_count=$(echo "$output" | jq -r '.errors // [] | length' 2>/dev/null || echo "0")
    
    jq -n \
        --arg files "$files_modified" \
        --arg passed "$tests_passed" \
        --arg failed "$tests_failed" \
        --arg errors "$errors_count" \
        '{
            filesModified: ($files | tonumber),
            testsResults: {
                passed: ($passed | tonumber),
                failed: ($failed | tonumber)
            },
            errorCount: ($errors | tonumber)
        }'
}

# Function to determine next action
determine_next_action() {
    local status="$1"
    local validation="$2"
    
    if [[ "$status" == "completed" ]] && [[ "$validation" == "valid" ]]; then
        echo "continue"
    elif [[ "$status" == "failed" ]]; then
        echo "retry"
    elif [[ "$validation" == "invalid" ]]; then
        echo "review"
    else
        echo "continue"
    fi
}

# Main execution
log "Subagent complete hook triggered for parent: $PARENT_NODE_ID, subagent: $SUBAGENT_ID"

# Read and process subagent output
SUBAGENT_OUTPUT=$(read_subagent_output)
log "Retrieved subagent output"

# Validate output
VALIDATION_RESULT=$(validate_output "$SUBAGENT_OUTPUT")
log "Output validation: $VALIDATION_RESULT"

# Aggregate results
AGGREGATED_DATA=$(aggregate_results)

# Extract metrics
METRICS=$(extract_metrics "$SUBAGENT_OUTPUT")

# Determine next action
NEXT_ACTION=$(determine_next_action "$STATUS" "$VALIDATION_RESULT")

# Build the hook event payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD=$(jq -n \
    --arg parent_id "$PARENT_NODE_ID" \
    --arg subagent_id "$SUBAGENT_ID" \
    --arg status "$STATUS" \
    --arg timestamp "$TIMESTAMP" \
    --arg validation "$VALIDATION_RESULT" \
    --arg next_action "$NEXT_ACTION" \
    --arg session_id "${SESSION_ID:-}" \
    --argjson output "$SUBAGENT_OUTPUT" \
    --argjson aggregated "$AGGREGATED_DATA" \
    --argjson metrics "$METRICS" \
    '{
        event: "subagent-complete",
        parentNodeId: $parent_id,
        subagentId: $subagent_id,
        timestamp: $timestamp,
        status: $status,
        validation: $validation,
        sessionId: $session_id,
        output: $output,
        aggregated: $aggregated,
        metrics: $metrics,
        next: {
            action: $next_action
        }
    }')

log "Sending subagent completion event to orchestrator"

# Send to orchestrator with retry logic
MAX_RETRIES=3
RETRY_COUNT=0
SUCCESS=false

while [[ $RETRY_COUNT -lt $MAX_RETRIES ]] && [[ "$SUCCESS" == "false" ]]; do
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "X-Hook-Type: subagent-complete" \
        -H "X-Parent-Node-ID: ${PARENT_NODE_ID}" \
        -H "X-Subagent-ID: ${SUBAGENT_ID}" \
        -d "$PAYLOAD" \
        "${ORCHESTRATOR_URL}/api/hooks/subagent-complete" 2>/dev/null || echo "000")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [[ "$HTTP_CODE" == "200" ]] || [[ "$HTTP_CODE" == "201" ]] || [[ "$HTTP_CODE" == "202" ]]; then
        SUCCESS=true
        log "Successfully sent subagent completion event (HTTP $HTTP_CODE)"
        
        # Process response - may contain instructions for parent
        if [[ -n "$RESPONSE_BODY" ]]; then
            PARENT_INSTRUCTIONS=$(echo "$RESPONSE_BODY" | jq -r '.parentInstructions // empty' 2>/dev/null || echo "")
            if [[ -n "$PARENT_INSTRUCTIONS" ]]; then
                echo "$PARENT_INSTRUCTIONS" > "${CLAUDE_PROJECT_DIR}/parent_instructions.txt"
                log "Saved parent instructions"
            fi
        fi
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        log "Failed to send subagent event (HTTP $HTTP_CODE), retry $RETRY_COUNT/$MAX_RETRIES"
        
        if [[ $RETRY_COUNT -lt $MAX_RETRIES ]]; then
            sleep 2
        fi
    fi
done

if [[ "$SUCCESS" == "false" ]]; then
    log "ERROR: Failed to send subagent completion event after $MAX_RETRIES retries"
    
    # Save to fallback file
    FALLBACK_FILE="${CLAUDE_PROJECT_DIR}/failed_subagent_$(date +%s).json"
    echo "$PAYLOAD" > "$FALLBACK_FILE"
    log "Saved failed subagent event to: $FALLBACK_FILE"
    
    exit 1
fi

# Update parent context with subagent results
PARENT_CONTEXT_FILE="${CLAUDE_PROJECT_DIR}/.parent_context.json"
echo "$AGGREGATED_DATA" > "$PARENT_CONTEXT_FILE"

# Clean up subagent temporary files
if [[ -n "$OUTPUT_FILE" ]] && [[ -f "$OUTPUT_FILE" ]]; then
    rm -f "$OUTPUT_FILE" 2>/dev/null || true
fi

log "Subagent complete hook finished successfully"
exit 0