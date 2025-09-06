#!/bin/bash

# Anton v2 - Parse Test Results Hook
# Extracts and processes test results from various testing frameworks
# Triggered after test execution commands

set -euo pipefail

# Configuration
ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:3002}"
CLAUDE_PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
LOG_FILE="${CLAUDE_PROJECT_DIR}/hooks.log"

# Parse command line arguments
NODE_ID=""
TEST_COMMAND=""
OUTPUT_FILE=""
TEST_FRAMEWORK=""
SESSION_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --node-id)
            NODE_ID="$2"
            shift 2
            ;;
        --command)
            TEST_COMMAND="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --framework)
            TEST_FRAMEWORK="$2"
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
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] TEST-RESULTS: $*" >> "$LOG_FILE"
}

# Auto-detect test framework from command or output
detect_framework() {
    local cmd="${TEST_COMMAND:-}"
    local output="${1:-}"
    
    if [[ -n "$TEST_FRAMEWORK" ]]; then
        echo "$TEST_FRAMEWORK"
        return
    fi
    
    # Check command patterns
    if [[ "$cmd" =~ jest ]] || [[ "$output" =~ "PASS|FAIL" ]] && [[ "$output" =~ "Test Suites:" ]]; then
        echo "jest"
    elif [[ "$cmd" =~ pytest ]] || [[ "$output" =~ "pytest" ]] || [[ "$output" =~ "collected.*items" ]]; then
        echo "pytest"
    elif [[ "$cmd" =~ "go test" ]] || [[ "$output" =~ "PASS|FAIL" ]] && [[ "$output" =~ "ok.*\t" ]]; then
        echo "go"
    elif [[ "$cmd" =~ mocha ]] || [[ "$output" =~ "passing|pending|failing" ]] && [[ "$output" =~ "✓|✗" ]]; then
        echo "mocha"
    elif [[ "$cmd" =~ vitest ]] || [[ "$output" =~ "✓ |× " ]] && [[ "$output" =~ "Duration:" ]]; then
        echo "vitest"
    elif [[ "$cmd" =~ playwright ]] || [[ "$output" =~ "Running.*test" ]] && [[ "$output" =~ "chromium|firefox|webkit" ]]; then
        echo "playwright"
    elif [[ "$cmd" =~ cypress ]] || [[ "$output" =~ "Cypress" ]] || [[ "$output" =~ "Running:.*spec" ]]; then
        echo "cypress"
    elif [[ "$cmd" =~ "cargo test" ]] || [[ "$output" =~ "running.*test" ]] && [[ "$output" =~ "test result:" ]]; then
        echo "rust"
    else
        echo "unknown"
    fi
}

# Parse Jest test results
parse_jest() {
    local output="$1"
    
    # Extract summary
    local total=$(echo "$output" | grep -oE "Tests:.*([0-9]+) total" | grep -oE "[0-9]+" | tail -1 || echo "0")
    local passed=$(echo "$output" | grep -oE "([0-9]+) passed" | grep -oE "[0-9]+" | head -1 || echo "0")
    local failed=$(echo "$output" | grep -oE "([0-9]+) failed" | grep -oE "[0-9]+" | head -1 || echo "0")
    local skipped=$(echo "$output" | grep -oE "([0-9]+) skipped" | grep -oE "[0-9]+" | head -1 || echo "0")
    
    # Extract duration
    local duration=$(echo "$output" | grep -oE "Time:.*([0-9.]+)s" | grep -oE "[0-9.]+" | tail -1 || echo "0")
    
    # Extract failed tests
    local failures=$(echo "$output" | awk '/FAIL/,/^$/' | grep -E "✕|×" | sed 's/^[[:space:]]*//' | jq -R -s -c 'split("\n") | map(select(length > 0))')
    
    jq -n \
        --arg total "$total" \
        --arg passed "$passed" \
        --arg failed "$failed" \
        --arg skipped "$skipped" \
        --arg duration "$duration" \
        --argjson failures "$failures" \
        '{
            framework: "jest",
            summary: {
                total: ($total | tonumber),
                passed: ($passed | tonumber),
                failed: ($failed | tonumber),
                skipped: ($skipped | tonumber)
            },
            duration: ($duration | tonumber),
            failures: $failures,
            success: (($failed | tonumber) == 0)
        }'
}

# Parse pytest results
parse_pytest() {
    local output="$1"
    
    # Extract summary line
    local summary_line=$(echo "$output" | grep -E "^=+.*passed|failed|error" | tail -1)
    
    local passed=$(echo "$summary_line" | grep -oE "([0-9]+) passed" | grep -oE "[0-9]+" || echo "0")
    local failed=$(echo "$summary_line" | grep -oE "([0-9]+) failed" | grep -oE "[0-9]+" || echo "0")
    local errors=$(echo "$summary_line" | grep -oE "([0-9]+) error" | grep -oE "[0-9]+" || echo "0")
    local skipped=$(echo "$summary_line" | grep -oE "([0-9]+) skipped" | grep -oE "[0-9]+" || echo "0")
    
    local total=$((passed + failed + errors + skipped))
    
    # Extract duration
    local duration=$(echo "$summary_line" | grep -oE "in ([0-9.]+)s" | grep -oE "[0-9.]+" || echo "0")
    
    # Extract failed test names
    local failures=$(echo "$output" | grep "FAILED" | sed 's/FAILED //' | jq -R -s -c 'split("\n") | map(select(length > 0))')
    
    jq -n \
        --arg total "$total" \
        --arg passed "$passed" \
        --arg failed "$failed" \
        --arg errors "$errors" \
        --arg skipped "$skipped" \
        --arg duration "$duration" \
        --argjson failures "$failures" \
        '{
            framework: "pytest",
            summary: {
                total: ($total | tonumber),
                passed: ($passed | tonumber),
                failed: ($failed | tonumber),
                errors: ($errors | tonumber),
                skipped: ($skipped | tonumber)
            },
            duration: ($duration | tonumber),
            failures: $failures,
            success: ((($failed | tonumber) + ($errors | tonumber)) == 0)
        }'
}

# Parse Go test results
parse_go() {
    local output="$1"
    
    local passed=$(echo "$output" | grep -c "^PASS" || echo "0")
    local failed=$(echo "$output" | grep -c "^FAIL" || echo "0")
    local total=$((passed + failed))
    
    # Extract duration (sum of all test durations)
    local duration=$(echo "$output" | grep -oE "\([0-9.]+s\)" | grep -oE "[0-9.]+" | awk '{s+=$1} END {print s}' || echo "0")
    
    # Extract failed tests
    local failures=$(echo "$output" | grep "^FAIL" | awk '{print $2}' | jq -R -s -c 'split("\n") | map(select(length > 0))')
    
    jq -n \
        --arg total "$total" \
        --arg passed "$passed" \
        --arg failed "$failed" \
        --arg duration "$duration" \
        --argjson failures "$failures" \
        '{
            framework: "go",
            summary: {
                total: ($total | tonumber),
                passed: ($passed | tonumber),
                failed: ($failed | tonumber)
            },
            duration: ($duration | tonumber),
            failures: $failures,
            success: (($failed | tonumber) == 0)
        }'
}

# Parse Playwright results
parse_playwright() {
    local output="$1"
    
    # Extract summary
    local passed=$(echo "$output" | grep -oE "([0-9]+) passed" | grep -oE "[0-9]+" | tail -1 || echo "0")
    local failed=$(echo "$output" | grep -oE "([0-9]+) failed" | grep -oE "[0-9]+" | tail -1 || echo "0")
    local skipped=$(echo "$output" | grep -oE "([0-9]+) skipped" | grep -oE "[0-9]+" | tail -1 || echo "0")
    local flaky=$(echo "$output" | grep -oE "([0-9]+) flaky" | grep -oE "[0-9]+" | tail -1 || echo "0")
    
    local total=$((passed + failed + skipped + flaky))
    
    # Extract duration
    local duration=$(echo "$output" | grep -oE "Finished.*\(([0-9.]+)s\)" | grep -oE "[0-9.]+" | tail -1 || echo "0")
    
    # Extract failed tests
    local failures=$(echo "$output" | grep "✘\|×" | sed 's/^[[:space:]]*//' | jq -R -s -c 'split("\n") | map(select(length > 0))')
    
    jq -n \
        --arg total "$total" \
        --arg passed "$passed" \
        --arg failed "$failed" \
        --arg skipped "$skipped" \
        --arg flaky "$flaky" \
        --arg duration "$duration" \
        --argjson failures "$failures" \
        '{
            framework: "playwright",
            summary: {
                total: ($total | tonumber),
                passed: ($passed | tonumber),
                failed: ($failed | tonumber),
                skipped: ($skipped | tonumber),
                flaky: ($flaky | tonumber)
            },
            duration: ($duration | tonumber),
            failures: $failures,
            success: (($failed | tonumber) == 0)
        }'
}

# Generic parser for unknown frameworks
parse_generic() {
    local output="$1"
    
    # Try to find common patterns
    local passed=$(echo "$output" | grep -ciE "pass|✓|✔|success" || echo "0")
    local failed=$(echo "$output" | grep -ciE "fail|✗|✘|error" || echo "0")
    local total=$((passed + failed))
    
    jq -n \
        --arg total "$total" \
        --arg passed "$passed" \
        --arg failed "$failed" \
        '{
            framework: "unknown",
            summary: {
                total: ($total | tonumber),
                passed: ($passed | tonumber),
                failed: ($failed | tonumber)
            },
            success: (($failed | tonumber) == 0),
            raw: true
        }'
}

# Main parsing function
parse_test_output() {
    local output="$1"
    local framework=$(detect_framework "$output")
    
    log "Detected test framework: $framework"
    
    case "$framework" in
        jest)
            parse_jest "$output"
            ;;
        pytest)
            parse_pytest "$output"
            ;;
        go)
            parse_go "$output"
            ;;
        playwright)
            parse_playwright "$output"
            ;;
        mocha|vitest|cypress|rust)
            # These would have similar parsers
            parse_generic "$output"
            ;;
        *)
            parse_generic "$output"
            ;;
    esac
}

# Function to read test output
read_test_output() {
    if [[ -n "$OUTPUT_FILE" ]] && [[ -f "$OUTPUT_FILE" ]]; then
        cat "$OUTPUT_FILE"
    elif [[ -f "${CLAUDE_PROJECT_DIR}/test_output.log" ]]; then
        cat "${CLAUDE_PROJECT_DIR}/test_output.log"
    else
        echo ""
    fi
}

# Function to generate recommendations
generate_recommendations() {
    local results="$1"
    local failed_count=$(echo "$results" | jq -r '.summary.failed // 0')
    
    local recommendations="[]"
    
    if [[ "$failed_count" -gt 0 ]]; then
        recommendations=$(jq -n '[
            "Review failed test cases for common patterns",
            "Check recent code changes that might have broken tests",
            "Run tests in isolation to identify flaky tests",
            "Verify test environment setup and dependencies"
        ]')
    fi
    
    echo "$recommendations"
}

# Main execution
log "Parse test results hook triggered for node: $NODE_ID"

# Read test output
TEST_OUTPUT=$(read_test_output)

if [[ -z "$TEST_OUTPUT" ]]; then
    log "Warning: No test output found"
    TEST_RESULTS='{"framework": "unknown", "summary": {"total": 0}, "success": true, "error": "No output found"}'
else
    # Parse test results
    TEST_RESULTS=$(parse_test_output "$TEST_OUTPUT")
    log "Parsed test results successfully"
fi

# Generate recommendations
RECOMMENDATIONS=$(generate_recommendations "$TEST_RESULTS")

# Build the hook event payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PAYLOAD=$(jq -n \
    --arg node_id "$NODE_ID" \
    --arg command "$TEST_COMMAND" \
    --arg timestamp "$TIMESTAMP" \
    --arg session_id "${SESSION_ID:-}" \
    --argjson results "$TEST_RESULTS" \
    --argjson recommendations "$RECOMMENDATIONS" \
    '{
        event: "test-results",
        nodeId: $node_id,
        timestamp: $timestamp,
        command: $command,
        sessionId: $session_id,
        results: $results,
        recommendations: $recommendations
    }')

log "Sending test results to orchestrator"

# Send to orchestrator
curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "X-Hook-Type: test-results" \
    -H "X-Node-ID: ${NODE_ID}" \
    -d "$PAYLOAD" \
    "${ORCHESTRATOR_URL}/api/hooks/test-results" 2>&1 | \
    while IFS= read -r line; do
        log "Orchestrator response: $line"
    done &

# Store results locally
RESULTS_FILE="${CLAUDE_PROJECT_DIR}/.test_results.json"
echo "$TEST_RESULTS" > "$RESULTS_FILE"
log "Saved test results to: $RESULTS_FILE"

# Exit with appropriate code based on test success
if echo "$TEST_RESULTS" | jq -e '.success' > /dev/null 2>&1; then
    log "Tests passed successfully"
    exit 0
else
    log "Tests failed"
    exit 1
fi