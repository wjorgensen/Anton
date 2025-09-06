#!/bin/bash

# Claude Code Output Collector Hook
# Captures and streams output from Claude Code instances to the preview system

NODE_ID="${NODE_ID:-unknown}"
PROJECT_ID="${PROJECT_ID:-unknown}"
HOOK_TYPE="${1:-output}"
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3002}"
CHANNEL_ID="${CHANNEL_ID:-}"

# Create output directory if it doesn't exist
OUTPUT_DIR="${CLAUDE_PROJECT_DIR:-/tmp}/output"
mkdir -p "$OUTPUT_DIR"

# Function to send data to orchestrator
send_to_orchestrator() {
    local data="$1"
    local type="$2"
    
    curl -s -X POST "${ORCHESTRATOR_URL}/api/preview/stream" \
        -H "Content-Type: application/json" \
        -d "{
            \"nodeId\": \"${NODE_ID}\",
            \"projectId\": \"${PROJECT_ID}\",
            \"channelId\": \"${CHANNEL_ID}\",
            \"type\": \"${type}\",
            \"data\": $(echo "$data" | jq -Rs .),
            \"timestamp\": $(date +%s)
        }" > /dev/null 2>&1
}

# Function to capture terminal output
capture_terminal_output() {
    local output_file="${OUTPUT_DIR}/terminal.log"
    
    # Use script command to capture terminal output with ANSI codes
    if command -v script >/dev/null 2>&1; then
        # macOS/BSD script syntax
        if [[ "$OSTYPE" == "darwin"* ]]; then
            script -q -F "$output_file" "$@"
        else
            # Linux script syntax
            script -q -f "$output_file" -c "$*"
        fi
        
        # Stream the output
        tail -f "$output_file" 2>/dev/null | while IFS= read -r line; do
            send_to_orchestrator "$line" "terminal"
        done &
        
        TAIL_PID=$!
        
        # Clean up on exit
        trap "kill $TAIL_PID 2>/dev/null; exit" EXIT INT TERM
    else
        # Fallback: just run the command and capture output
        "$@" 2>&1 | tee "$output_file" | while IFS= read -r line; do
            send_to_orchestrator "$line" "terminal"
        done
    fi
}

# Function to monitor file changes and stream them
monitor_file_changes() {
    local watch_dir="${1:-$CLAUDE_PROJECT_DIR}"
    
    if command -v fswatch >/dev/null 2>&1; then
        # macOS with fswatch
        fswatch -r --exclude="\.git" --exclude="node_modules" "$watch_dir" | while read -r file; do
            send_to_orchestrator "{\"event\": \"file_changed\", \"path\": \"$file\"}" "file_watch"
        done &
    elif command -v inotifywait >/dev/null 2>&1; then
        # Linux with inotify
        inotifywait -mr --exclude="(\.git|node_modules)" \
            -e modify,create,delete,move "$watch_dir" \
            --format '%w%f %e' | while IFS=' ' read -r file event; do
            send_to_orchestrator "{\"event\": \"$event\", \"path\": \"$file\"}" "file_watch"
        done &
    fi
}

# Function to collect tool output
collect_tool_output() {
    local tool="$1"
    local output="$2"
    
    # Send tool output to preview system
    send_to_orchestrator "{\"tool\": \"$tool\", \"output\": $(echo "$output" | jq -Rs .)}" "tool_output"
    
    # Special handling for certain tools
    case "$tool" in
        "Write"|"Edit"|"MultiEdit")
            # Trigger hot reload for file changes
            send_to_orchestrator "{\"event\": \"reload\", \"tool\": \"$tool\"}" "hot_reload"
            ;;
        "Bash")
            # Stream bash output to terminal preview
            echo "$output" >> "${OUTPUT_DIR}/terminal.log"
            ;;
    esac
}

# Main hook logic based on type
case "$HOOK_TYPE" in
    "start")
        # Session start - initialize channels
        CHANNEL_ID="term-${NODE_ID}-$(date +%s)"
        echo "$CHANNEL_ID" > "${OUTPUT_DIR}/channel.id"
        
        send_to_orchestrator "{\"status\": \"started\"}" "session"
        
        # Start monitoring
        monitor_file_changes &
        
        echo "Output collection initialized for node ${NODE_ID}"
        ;;
        
    "stop")
        # Session stop - cleanup
        send_to_orchestrator "{\"status\": \"stopped\"}" "session"
        
        # Kill any background processes
        pkill -P $$
        
        echo "Output collection stopped for node ${NODE_ID}"
        ;;
        
    "tool")
        # Tool execution hook
        TOOL_NAME="$2"
        TOOL_OUTPUT="$3"
        
        collect_tool_output "$TOOL_NAME" "$TOOL_OUTPUT"
        ;;
        
    "command")
        # Execute command with output capture
        shift
        capture_terminal_output "$@"
        ;;
        
    "stream")
        # Direct streaming
        DATA="$2"
        TYPE="${3:-output}"
        
        send_to_orchestrator "$DATA" "$TYPE"
        ;;
        
    *)
        echo "Unknown hook type: $HOOK_TYPE"
        exit 1
        ;;
esac

exit 0