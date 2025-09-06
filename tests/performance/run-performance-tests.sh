#!/bin/bash

# Anton v2 Performance Testing Suite
# Runs comprehensive performance tests including load, stress, and spike tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3002}"
WS_URL="${WS_URL:-ws://localhost:3002}"
RESULTS_DIR="./test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Functions
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')] ✅ $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ❌ $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        error "k6 is not installed. Please install k6: https://k6.io/docs/get-started/installation/"
    fi
    
    # Check if services are running
    if ! curl -f -s "$BASE_URL/health" > /dev/null; then
        error "Anton services are not running or not accessible at $BASE_URL"
    fi
    
    success "Prerequisites check completed"
}

# Create results directory
setup_results_dir() {
    mkdir -p "$RESULTS_DIR"
    log "Results will be saved to: $RESULTS_DIR"
}

# Run load test
run_load_test() {
    log "Running load test..."
    
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --env WS_URL="$WS_URL" \
        --out json="$RESULTS_DIR/load_test_$TIMESTAMP.json" \
        --summary-export="$RESULTS_DIR/load_test_summary_$TIMESTAMP.json" \
        load-test.js
    
    if [ $? -eq 0 ]; then
        success "Load test completed successfully"
    else
        warn "Load test completed with issues"
    fi
}

# Run API-specific tests
run_api_test() {
    log "Running API-specific performance test..."
    
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json="$RESULTS_DIR/api_test_$TIMESTAMP.json" \
        --summary-export="$RESULTS_DIR/api_test_summary_$TIMESTAMP.json" \
        api-performance-test.js
    
    if [ $? -eq 0 ]; then
        success "API test completed successfully"
    else
        warn "API test completed with issues"
    fi
}

# Run WebSocket tests
run_websocket_test() {
    log "Running WebSocket performance test..."
    
    k6 run \
        --env WS_URL="$WS_URL" \
        --out json="$RESULTS_DIR/websocket_test_$TIMESTAMP.json" \
        --summary-export="$RESULTS_DIR/websocket_test_summary_$TIMESTAMP.json" \
        websocket-test.js
    
    if [ $? -eq 0 ]; then
        success "WebSocket test completed successfully"
    else
        warn "WebSocket test completed with issues"
    fi
}

# Run database performance test
run_database_test() {
    log "Running database performance test..."
    
    # This test focuses on database-heavy operations
    k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json="$RESULTS_DIR/database_test_$TIMESTAMP.json" \
        --summary-export="$RESULTS_DIR/database_test_summary_$TIMESTAMP.json" \
        database-performance-test.js
    
    if [ $? -eq 0 ]; then
        success "Database test completed successfully"
    else
        warn "Database test completed with issues"
    fi
}

# Generate performance report
generate_report() {
    log "Generating performance report..."
    
    cat > "$RESULTS_DIR/performance_report_$TIMESTAMP.md" << EOF
# Anton v2 Performance Test Report

**Date:** $(date)
**Environment:** $BASE_URL
**Test Duration:** Approximately 60 minutes

## Test Results Summary

### Load Test
- **File:** load_test_$TIMESTAMP.json
- **Focus:** Overall system performance under varying load
- **Scenarios:** Stress test, Spike test, Soak test

### API Test  
- **File:** api_test_$TIMESTAMP.json
- **Focus:** API endpoint performance and reliability
- **Target:** < 200ms average response time

### WebSocket Test
- **File:** websocket_test_$TIMESTAMP.json  
- **Focus:** Real-time communication performance
- **Target:** Low latency message handling

### Database Test
- **File:** database_test_$TIMESTAMP.json
- **Focus:** Database query performance and connection handling
- **Target:** < 100ms query response time

## Performance Targets

- **API Response Time:** < 200ms (95th percentile)
- **Error Rate:** < 5%
- **Concurrent Users:** 50+ users
- **Database Queries:** < 100ms average
- **WebSocket Latency:** < 50ms

## Files Generated

- Summary reports: *_summary_$TIMESTAMP.json
- Detailed results: *_test_$TIMESTAMP.json
- This report: performance_report_$TIMESTAMP.md

## How to Analyze Results

1. **Load Distribution:** Check if response times increase linearly with load
2. **Error Patterns:** Identify which endpoints have highest error rates  
3. **Resource Utilization:** Monitor CPU, memory, and database connections
4. **Bottlenecks:** Look for requests that consistently exceed thresholds

## Recommendations

1. Monitor the metrics endpoints during tests: $BASE_URL/metrics
2. Check Grafana dashboards if monitoring is enabled
3. Review application logs for errors during peak load
4. Consider scaling strategies if targets are not met

EOF

    success "Performance report generated: $RESULTS_DIR/performance_report_$TIMESTAMP.md"
}

# Display results summary
display_summary() {
    log "Performance test suite completed!"
    echo ""
    echo "📊 Results Summary:"
    echo "  - Results directory: $RESULTS_DIR"
    echo "  - Timestamp: $TIMESTAMP"
    echo ""
    
    if [ -f "$RESULTS_DIR/load_test_summary_$TIMESTAMP.json" ]; then
        echo "🔍 Quick Stats (Load Test):"
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            local summary_file="$RESULTS_DIR/load_test_summary_$TIMESTAMP.json"
            echo "  - Average Response Time: $(jq -r '.metrics.http_req_duration.avg' "$summary_file" 2>/dev/null || echo 'N/A')ms"
            echo "  - 95th Percentile: $(jq -r '.metrics.http_req_duration.p95' "$summary_file" 2>/dev/null || echo 'N/A')ms"
            echo "  - Error Rate: $(jq -r '.metrics.http_req_failed.rate' "$summary_file" 2>/dev/null || echo 'N/A')%"
            echo "  - Total Requests: $(jq -r '.metrics.http_reqs.count' "$summary_file" 2>/dev/null || echo 'N/A')"
        fi
    fi
    
    echo ""
    echo "📈 Next Steps:"
    echo "  1. Review detailed results in $RESULTS_DIR"
    echo "  2. Check performance_report_$TIMESTAMP.md for analysis"
    echo "  3. Monitor system metrics during peak usage"
    echo "  4. Consider scaling if targets not met"
    echo ""
    
    if command -v jq &> /dev/null; then
        echo "💡 Tip: Use 'jq' to analyze JSON results:"
        echo "  jq '.metrics' $RESULTS_DIR/load_test_summary_$TIMESTAMP.json"
    else
        echo "💡 Tip: Install 'jq' for easier JSON result analysis"
    fi
    echo ""
}

# Main execution
main() {
    log "Starting Anton v2 Performance Test Suite"
    echo "Target: $BASE_URL"
    echo "WebSocket: $WS_URL"
    echo ""
    
    check_prerequisites
    setup_results_dir
    
    # Run all performance tests
    run_load_test
    
    # Run additional tests if they exist
    if [ -f "api-performance-test.js" ]; then
        run_api_test
    fi
    
    if [ -f "websocket-test.js" ]; then
        run_websocket_test
    fi
    
    if [ -f "database-performance-test.js" ]; then
        run_database_test
    fi
    
    generate_report
    display_summary
}

# Handle script arguments
case "${1:-}" in
    "load")
        log "Running load test only..."
        check_prerequisites
        setup_results_dir
        run_load_test
        ;;
    "api")
        log "Running API test only..."
        check_prerequisites
        setup_results_dir
        run_api_test
        ;;
    "websocket")
        log "Running WebSocket test only..."
        check_prerequisites
        setup_results_dir
        run_websocket_test
        ;;
    "database")
        log "Running database test only..."
        check_prerequisites
        setup_results_dir
        run_database_test
        ;;
    "report")
        log "Generating report from latest results..."
        TIMESTAMP=$(ls -t $RESULTS_DIR/load_test_summary_*.json 2>/dev/null | head -1 | grep -o '[0-9]\{8\}_[0-9]\{6\}' || echo "latest")
        generate_report
        ;;
    *)
        main
        ;;
esac