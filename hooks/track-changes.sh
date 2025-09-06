#!/bin/bash

# Anton v2 - Track Changes Hook
# Monitors file changes during agent execution
# Triggered after Write, Edit, or MultiEdit tool usage

set -euo pipefail

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3002}"
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOG_FILE="${CLAUDE_PROJECT_DIR}/hooks.log"

# Parse command line arguments
NODE_ID=""
TOOL_NAME=""
FILE_PATH=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --node-id)
            NODE_ID="$2"
            shift 2
            ;;
        --tool)
            TOOL_NAME="$2"
            shift 2
            ;;
        --file)
            FILE_PATH="$2"
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

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] TRACK-CHANGES: $*" >> "$LOG_FILE"
}

# Function to calculate file hash
calculate_hash() {
    local file="$1"
    if [[ -f "$file" ]]; then
        sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || echo ""
    else
        echo ""
    fi
}

# Function to get file metadata
get_file_metadata() {
    local file="$1"
    local rel_path="${file#$CLAUDE_PROJECT_DIR/}"
    
    if [[ ! -f "$file" ]]; then
        echo "{}"
        return
    fi
    
    local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
    local mime_type=$(file -b --mime-type "$file" 2>/dev/null || echo "text/plain")
    local line_count=0
    
    if [[ "$mime_type" == text/* ]]; then
        line_count=$(wc -l < "$file" 2>/dev/null || echo "0")
    fi
    
    local hash=$(calculate_hash "$file")
    
    jq -n \
        --arg path "$rel_path" \
        --arg size "$size" \
        --arg mime "$mime_type" \
        --arg lines "$line_count" \
        --arg hash "$hash" \
        '{
            path: $path,
            size: ($size | tonumber),
            mimeType: $mime,
            lineCount: ($lines | tonumber),
            hash: $hash
        }'
}

# Function to detect changes using git
detect_git_changes() {
    local changes="{}"
    
    if command -v git &> /dev/null && [[ -d "${CLAUDE_PROJECT_DIR}/.git" ]]; then
        # Get staged files
        local staged=$(git -C "$CLAUDE_PROJECT_DIR" diff --cached --name-only 2>/dev/null | \
                      jq -R -s -c 'split("\n") | map(select(length > 0))')
        
        # Get unstaged modifications
        local modified=$(git -C "$CLAUDE_PROJECT_DIR" diff --name-only 2>/dev/null | \
                        jq -R -s -c 'split("\n") | map(select(length > 0))')
        
        # Get untracked files
        local untracked=$(git -C "$CLAUDE_PROJECT_DIR" ls-files --others --exclude-standard 2>/dev/null | \
                         jq -R -s -c 'split("\n") | map(select(length > 0))')
        
        changes=$(jq -n \
            --argjson staged "$staged" \
            --argjson modified "$modified" \
            --argjson untracked "$untracked" \
            '{
                staged: $staged,
                modified: $modified,
                untracked: $untracked
            }')
    fi
    
    echo "$changes"
}

# Function to create change snapshot
create_change_snapshot() {
    local snapshot_dir="${CLAUDE_PROJECT_DIR}/.snapshots"
    mkdir -p "$snapshot_dir"
    
    local snapshot_id=$(date +%s)
    local snapshot_file="${snapshot_dir}/snapshot_${snapshot_id}.json"
    
    # Collect all file states
    local files_array="[]"
    
    # If specific file was provided, track that
    if [[ -n "$FILE_PATH" ]]; then
        local metadata=$(get_file_metadata "$FILE_PATH")
        files_array=$(echo "[$metadata]" | jq -c '.')
    else
        # Track all recently modified files (within last minute)
        while IFS= read -r -d '' file; do
            local metadata=$(get_file_metadata "$file")
            files_array=$(echo "$files_array" | jq --argjson m "$metadata" '. + [$m]')
        done < <(find "$CLAUDE_PROJECT_DIR" -type f -mmin -1 -print0 2>/dev/null)
    fi
    
    local git_changes=$(detect_git_changes)
    
    # Create snapshot
    jq -n \
        --arg id "$snapshot_id" \
        --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --argjson files "$files_array" \
        --argjson git "$git_changes" \
        '{
            id: $id,
            timestamp: $timestamp,
            files: $files,
            gitChanges: $git
        }' > "$snapshot_file"
    
    echo "$snapshot_id"
}

# Function to stream output to terminal preview
stream_output() {
    local output_dir="${CLAUDE_PROJECT_DIR}/output/${NODE_ID}"
    mkdir -p "$output_dir"
    
    local output_file="${output_dir}/output.log"
    local error_file="${output_dir}/error.log"
    
    # Capture Claude's recent output (if available)
    if [[ -n "${CLAUDE_LAST_OUTPUT:-}" ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') [${TOOL_NAME}]" >> "$output_file"
        echo "$CLAUDE_LAST_OUTPUT" >> "$output_file"
    fi
    
    # Log file change event
    echo "$(date '+%Y-%m-%d %H:%M:%S') File changed: ${FILE_PATH:-'(multiple files)'}" >> "$output_file"
    
    # If we have file metadata, log it
    if [[ -n "$FILE_METADATA" ]] && [[ "$FILE_METADATA" != "{}" ]]; then
        local file_info=$(echo "$FILE_METADATA" | jq -r '.path + " (" + (.size | tostring) + " bytes, " + (.lineCount | tostring) + " lines)"')
        echo "  → $file_info" >> "$output_file"
    fi
}

# Function to sync changes to preview
sync_to_preview() {
    local preview_url="${PREVIEW_URL:-http://localhost:3003}"
    
    # Check if preview service is available
    if curl -s --head --fail "${preview_url}/health" > /dev/null 2>&1; then
        # Send file update notification
        local payload=$(jq -n \
            --arg node_id "$NODE_ID" \
            --arg file "$FILE_PATH" \
            '{nodeId: $node_id, file: $file, event: "file-changed"}')
        
        curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$payload" \
            "${preview_url}/api/sync" > /dev/null 2>&1 || true
    fi
}

# Main execution
log "Track changes hook triggered for node: $NODE_ID, tool: $TOOL_NAME"

# Create change snapshot
SNAPSHOT_ID=$(create_change_snapshot)
log "Created snapshot: $SNAPSHOT_ID"

# Get file metadata if specific file was changed
FILE_METADATA="{}"
if [[ -n "$FILE_PATH" ]]; then
    FILE_METADATA=$(get_file_metadata "$FILE_PATH")
fi

# Stream output to terminal preview
stream_output

# Build the hook event payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD=$(jq -n \
    --arg node_id "$NODE_ID" \
    --arg tool "$TOOL_NAME" \
    --arg timestamp "$TIMESTAMP" \
    --arg snapshot_id "$SNAPSHOT_ID" \
    --arg session_id "${SESSION_ID:-}" \
    --argjson file_metadata "$FILE_METADATA" \
    '{
        event: "file-change",
        nodeId: $node_id,
        timestamp: $timestamp,
        tool: $tool,
        sessionId: $session_id,
        snapshotId: $snapshot_id,
        fileMetadata: $file_metadata
    }')

log "Sending change event to orchestrator"

# Send to orchestrator (non-blocking)
{
    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "X-Hook-Type: file-change" \
        -H "X-Node-ID: ${NODE_ID}" \
        -d "$PAYLOAD" \
        "${ORCHESTRATOR_URL}/api/hooks/file-change" 2>&1 | \
        while IFS= read -r line; do
            log "Orchestrator response: $line"
        done
} &

# Sync to preview service (non-blocking)
sync_to_preview &

# Track changes in local state file
STATE_FILE="${CLAUDE_PROJECT_DIR}/.change_state.json"
if [[ -f "$STATE_FILE" ]]; then
    # Update existing state
    CURRENT_STATE=$(cat "$STATE_FILE")
    UPDATED_STATE=$(echo "$CURRENT_STATE" | jq \
        --arg snapshot "$SNAPSHOT_ID" \
        --argjson metadata "$FILE_METADATA" \
        '.snapshots += [$snapshot] | .lastChange = $metadata')
    echo "$UPDATED_STATE" > "$STATE_FILE"
else
    # Create new state
    jq -n \
        --arg snapshot "$SNAPSHOT_ID" \
        --argjson metadata "$FILE_METADATA" \
        '{snapshots: [$snapshot], lastChange: $metadata}' > "$STATE_FILE"
fi

log "Track changes hook completed"
exit 0