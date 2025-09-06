#!/bin/bash

# Capture review feedback from UserPromptSubmit hook
# This script is called when a reviewer submits feedback during manual review

NODE_ID=$1
FEEDBACK=$2
REVIEWER=${3:-"manual_reviewer"}
TIMESTAMP=$(date +%s)

# Create output directory if it doesn't exist
OUTPUT_DIR="$CLAUDE_PROJECT_DIR/review_feedback"
mkdir -p "$OUTPUT_DIR"

# Parse the feedback to extract decision and comments
# Expected format: "DECISION: approve|reject|request-changes COMMENTS: ..."
DECISION=$(echo "$FEEDBACK" | grep -oP 'DECISION:\s*\K(approve|reject|request-changes)' || echo "request-changes")
COMMENTS=$(echo "$FEEDBACK" | sed 's/DECISION:[^C]*COMMENTS://' | xargs)

# Extract action items if present (lines starting with "- " or "* ")
ACTION_ITEMS=$(echo "$FEEDBACK" | grep -E '^\s*[-*]\s+' | sed 's/^\s*[-*]\s*//' | jq -R -s -c 'split("\n") | map(select(length > 0))')

# Determine severity based on decision
SEVERITY="info"
if [ "$DECISION" = "reject" ]; then
    SEVERITY="error"
elif [ "$DECISION" = "request-changes" ]; then
    SEVERITY="warning"
fi

# Create feedback JSON
FEEDBACK_JSON=$(cat <<EOF
{
  "id": "feedback_${TIMESTAMP}_${RANDOM}",
  "nodeId": "$NODE_ID",
  "reviewerId": "$REVIEWER",
  "decision": "$DECISION",
  "comments": "$COMMENTS",
  "actionItems": $ACTION_ITEMS,
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "severity": "$SEVERITY"
}
EOF
)

# Save feedback to file
FEEDBACK_FILE="$OUTPUT_DIR/feedback_${NODE_ID}_${TIMESTAMP}.json"
echo "$FEEDBACK_JSON" > "$FEEDBACK_FILE"

# Send feedback to orchestrator via API
if [ -n "$ORCHESTRATOR_API_URL" ]; then
    curl -X POST "$ORCHESTRATOR_API_URL/api/review/feedback" \
        -H "Content-Type: application/json" \
        -d "$FEEDBACK_JSON" \
        --silent --output /dev/null
fi

# Log the feedback capture
echo "[$(date)] Review feedback captured for node $NODE_ID: $DECISION" >> "$CLAUDE_PROJECT_DIR/hooks.log"

# If this is an approval or rejection, signal completion
if [ "$DECISION" = "approve" ] || [ "$DECISION" = "reject" ]; then
    # Create a completion signal file
    echo "$DECISION" > "$OUTPUT_DIR/review_complete_${NODE_ID}.signal"
fi

exit 0