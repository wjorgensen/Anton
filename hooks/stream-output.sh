#!/bin/bash

# Anton v2 - Stream Output Hook Utility
# Captures and streams Claude Code output to terminal preview
# Used by various hooks to provide real-time output streaming

set -euo pipefail

# Configuration
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
NODE_ID="${NODE_ID:-}"
EXECUTION_ID="${EXECUTION_ID:-}"
OUTPUT_BASE="${OUTPUT_BASE:-/projects}"

# Parse command line arguments
MESSAGE=""
STREAM="stdout"
LEVEL="info"
ANSI_COLOR=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --node-id)
            NODE_ID="$2"
            shift 2
            ;;
        --execution-id)
            EXECUTION_ID="$2"
            shift 2
            ;;
        --message|-m)
            MESSAGE="$2"
            shift 2
            ;;
        --stream|-s)
            STREAM="$2"
            shift 2
            ;;
        --level|-l)
            LEVEL="$2"
            shift 2
            ;;
        --color|-c)
            ANSI_COLOR="$2"
            shift 2
            ;;
        *)
            # Treat remaining args as the message
            MESSAGE="$*"
            break
            ;;
    esac
done

# Validate required parameters
if [[ -z "$NODE_ID" ]] || [[ -z "$EXECUTION_ID" ]]; then
    echo "Error: --node-id and --execution-id are required" >&2
    exit 1
fi

# Create output directory structure
OUTPUT_DIR="${OUTPUT_BASE}/${EXECUTION_ID}/${NODE_ID}"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="${OUTPUT_DIR}/output.log"
ERROR_FILE="${OUTPUT_DIR}/error.log"
METADATA_FILE="${OUTPUT_DIR}/metadata.json"

# Function to add timestamp
add_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')]"
}

# Function to apply ANSI color codes
apply_color() {
    local text="$1"
    local color="$2"
    
    case "$color" in
        black)   echo -e "\033[30m${text}\033[0m" ;;
        red)     echo -e "\033[31m${text}\033[0m" ;;
        green)   echo -e "\033[32m${text}\033[0m" ;;
        yellow)  echo -e "\033[33m${text}\033[0m" ;;
        blue)    echo -e "\033[34m${text}\033[0m" ;;
        magenta) echo -e "\033[35m${text}\033[0m" ;;
        cyan)    echo -e "\033[36m${text}\033[0m" ;;
        white)   echo -e "\033[37m${text}\033[0m" ;;
        bold)    echo -e "\033[1m${text}\033[0m" ;;
        dim)     echo -e "\033[2m${text}\033[0m" ;;
        *)       echo "$text" ;;
    esac
}

# Function to format message based on level
format_message() {
    local msg="$1"
    local lvl="$2"
    local prefix=""
    
    case "$lvl" in
        error)
            prefix="❌ ERROR: "
            ANSI_COLOR="${ANSI_COLOR:-red}"
            ;;
        warning)
            prefix="⚠️  WARN: "
            ANSI_COLOR="${ANSI_COLOR:-yellow}"
            ;;
        success)
            prefix="✅ SUCCESS: "
            ANSI_COLOR="${ANSI_COLOR:-green}"
            ;;
        info)
            prefix="ℹ️  INFO: "
            ANSI_COLOR="${ANSI_COLOR:-cyan}"
            ;;
        debug)
            prefix="🔍 DEBUG: "
            ANSI_COLOR="${ANSI_COLOR:-dim}"
            ;;
        *)
            prefix=""
            ;;
    esac
    
    echo "${prefix}${msg}"
}

# Function to update metadata
update_metadata() {
    local current_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local line_count_out=$(wc -l < "$OUTPUT_FILE" 2>/dev/null || echo "0")
    local line_count_err=$(wc -l < "$ERROR_FILE" 2>/dev/null || echo "0")
    local size_out=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "0")
    local size_err=$(stat -f%z "$ERROR_FILE" 2>/dev/null || stat -c%s "$ERROR_FILE" 2>/dev/null || echo "0")
    
    jq -n \
        --arg node "$NODE_ID" \
        --arg exec "$EXECUTION_ID" \
        --arg time "$current_time" \
        --arg lines_out "$line_count_out" \
        --arg lines_err "$line_count_err" \
        --arg size_out "$size_out" \
        --arg size_err "$size_err" \
        '{
            nodeId: $node,
            executionId: $exec,
            lastUpdated: $time,
            output: {
                lines: ($lines_out | tonumber),
                bytes: ($size_out | tonumber)
            },
            error: {
                lines: ($lines_err | tonumber),
                bytes: ($size_err | tonumber)
            }
        }' > "$METADATA_FILE"
}

# Main execution
if [[ -n "$MESSAGE" ]]; then
    # Format the message
    FORMATTED_MSG=$(format_message "$MESSAGE" "$LEVEL")
    TIMESTAMPED_MSG="$(add_timestamp) $FORMATTED_MSG"
    
    # Apply color if specified
    if [[ -n "$ANSI_COLOR" ]]; then
        OUTPUT=$(apply_color "$TIMESTAMPED_MSG" "$ANSI_COLOR")
    else
        OUTPUT="$TIMESTAMPED_MSG"
    fi
    
    # Write to appropriate file
    if [[ "$STREAM" == "stderr" ]] || [[ "$LEVEL" == "error" ]]; then
        echo "$OUTPUT" >> "$ERROR_FILE"
        # Also write to stdout file with error indicator
        echo "$OUTPUT" >> "$OUTPUT_FILE"
    else
        echo "$OUTPUT" >> "$OUTPUT_FILE"
    fi
    
    # Update metadata
    update_metadata
    
    # Echo to stdout for immediate feedback
    echo "$OUTPUT"
else
    # Read from stdin if no message provided
    while IFS= read -r line; do
        TIMESTAMPED_LINE="$(add_timestamp) $line"
        
        if [[ "$STREAM" == "stderr" ]]; then
            echo "$TIMESTAMPED_LINE" >> "$ERROR_FILE"
            echo "$TIMESTAMPED_LINE" >> "$OUTPUT_FILE"
        else
            echo "$TIMESTAMPED_LINE" >> "$OUTPUT_FILE"
        fi
        
        echo "$TIMESTAMPED_LINE"
    done
    
    # Update metadata after processing stdin
    update_metadata
fi

exit 0