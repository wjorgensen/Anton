# E2E Test Suite - Manual Review Checkpoint

## Overview
Comprehensive end-to-end tests for the manual review checkpoint functionality in Anton's orchestration flow.

## Test Coverage

### 1. Setup Review Flow
- Creates project with review checkpoint
- Configures review after development and before deployment
- Verifies review node creation in flow
- Starts execution and monitors progress

### 2. Review Interface
- Tests review notification system
- Validates all UI elements (diff viewer, file browser, preview, comments)
- Tests inline commenting functionality
- Verifies comment persistence

### 3. Review Actions

#### 3a. Approval Flow
- Tests approval with comments
- Verifies criteria selection
- Confirms flow continuation after approval
- Validates approval history

#### 3b. Request Changes
- Tests feedback submission
- Monitors agent revision process
- Verifies changes implementation
- Tests re-review and approval

#### 3c. Rejection Flow
- Tests rejection with reasons
- Verifies flow termination
- Validates error state
- Confirms rejection history

### 4. Multiple Iterations
- Tests revision loops with max iteration limits
- Verifies iteration counter
- Tests max iteration enforcement

### 5. Concurrent Reviews
- Tests parallel branch reviews
- Verifies independent review handling
- Tests review dashboard for multiple pending reviews

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure Anton services are running
npm run dev
```

### Run Full Test Suite
```bash
npm run test:e2e:review
```

### Run with Options
```bash
# Run in headless mode
HEADLESS=true npm run test:e2e:review

# Use custom URLs
BASE_URL=http://localhost:3001 API_URL=http://localhost:3003 npm run test:e2e:review
```

### Run Individual Test Scenarios
```bash
# Run the scenario-based tests
npm run test:e2e:review:scenarios
```

## Test Configuration

Edit test configuration in `review-checkpoint.test.js`:

```javascript
{
  baseURL: 'http://localhost:3000',    // Frontend URL
  apiURL: 'http://localhost:3002',      // Backend API URL
  headless: false,                      // Browser visibility
  slowMo: 100,                         // Slow down actions (ms)
  timeout: 30000                        // Default timeout (ms)
}
```

## Test Artifacts

After running tests, check:

- **Screenshots**: `tests/e2e/screenshots/review/`
- **Videos**: `tests/e2e/screenshots/review/videos/`
- **Test Report**: `tests/e2e/screenshots/review/test-report.json`

## Expected Results

### Success Criteria
- All navigation completes without errors
- UI elements are responsive and visible
- Review checkpoint pauses execution correctly
- Feedback is properly sent to agents
- Approval continues flow execution
- Rejection terminates flow with error state
- Changes requested trigger agent revision
- Multiple iterations work within limits
- Concurrent reviews are handled independently

### Performance Benchmarks
- Review checkpoint reached: < 30s
- Interface load time: < 2s
- Feedback processing: < 5s
- Agent revision completion: < 30s
- Approval/rejection processing: < 5s

## Debugging Failed Tests

1. **Check Screenshots**: Review screenshots in the screenshots directory
2. **Check Videos**: Watch test execution videos for visual debugging
3. **Review Logs**: Check console output for API errors
4. **Manual Testing**: Run tests with `headless: false` to watch execution
5. **Network Tab**: Enable network monitoring in test configuration

## Integration with CI/CD

```yaml
# Example GitHub Actions workflow
- name: Run Review Tests
  run: |
    npm run dev &
    sleep 10
    HEADLESS=true npm run test:e2e:review
  env:
    BASE_URL: http://localhost:3000
    API_URL: http://localhost:3002
```

## Troubleshooting

### Common Issues

1. **Tests fail to find elements**
   - Ensure Anton is fully running before tests
   - Check that test selectors match current UI

2. **Timeout errors**
   - Increase timeout in configuration
   - Check that backend services are responding

3. **Screenshot directory errors**
   - Ensure write permissions for test directory
   - Create screenshots directory if missing

4. **Browser launch fails**
   - Install browser: `npx playwright install chromium`
   - Check system requirements for Playwright

## Contributing

When adding new review features, update tests:

1. Add test case to `review-checkpoint.test.js`
2. Update selectors if UI changes
3. Add new scenarios to test matrix
4. Document expected behavior
5. Run full test suite before committing

## Related Tests

- `review-system.test.js` - Scenario definitions
- `agent-execution-monitor.test.js` - Agent monitoring
- `create-project.test.js` - Project creation flow
- `run-tests-with-mcp.js` - MCP integration tests