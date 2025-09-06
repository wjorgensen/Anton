import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiCallsCounter = new Counter('api_calls');
const apiResponseTime = new Trend('api_response_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3002';

// Test options
export const options = {
  scenarios: {
    // Stress test: Gradually increase load
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },  // Ramp up to 10 users
        { duration: '5m', target: 10 },  // Stay at 10 users
        { duration: '2m', target: 20 },  // Ramp up to 20 users
        { duration: '5m', target: 20 },  // Stay at 20 users
        { duration: '2m', target: 50 },  // Ramp up to 50 users
        { duration: '5m', target: 50 },  // Stay at 50 users
        { duration: '5m', target: 0 },   // Ramp down
      ],
    },
    
    // Spike test: Sudden load increase
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 10 },   // Normal load
        { duration: '1m', target: 100 },  // Spike
        { duration: '2m', target: 10 },   // Return to normal
      ],
      startTime: '20m', // Start after stress test
    },
    
    // Soak test: Extended duration at moderate load
    soak_test: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30m',
      startTime: '25m', // Start after spike test
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must be below 500ms
    http_req_failed: ['rate<0.05'],   // Error rate must be below 5%
    errors: ['rate<0.05'],
    api_response_time: ['p(95)<200'], // API response time target
  },
};

// Test data
const testProjects = [
  {
    name: 'Test React App',
    description: 'A simple React application for testing',
    flow: {
      nodes: {
        '1': { id: '1', type: 'setup', agent: 'nextjs-setup', position: { x: 100, y: 100 } },
        '2': { id: '2', type: 'execution', agent: 'react-developer', position: { x: 300, y: 100 } },
        '3': { id: '3', type: 'testing', agent: 'jest-tester', position: { x: 500, y: 100 } },
      },
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
      ],
    },
  },
  {
    name: 'API Service',
    description: 'Node.js API service with database',
    flow: {
      nodes: {
        '1': { id: '1', type: 'setup', agent: 'nodejs-backend', position: { x: 100, y: 100 } },
        '2': { id: '2', type: 'setup', agent: 'postgres-setup', position: { x: 300, y: 100 } },
        '3': { id: '3', type: 'testing', agent: 'jest-tester', position: { x: 500, y: 100 } },
      },
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
      ],
    },
  },
];

// Helper function to make authenticated requests
function makeAuthenticatedRequest(endpoint, method = 'GET', payload = null) {
  const headers = {
    'Content-Type': 'application/json',
    // Add auth headers if needed
  };
  
  const params = {
    headers,
    timeout: '30s',
  };
  
  let response;
  const start = new Date().getTime();
  
  switch (method) {
    case 'POST':
      response = http.post(`${BASE_URL}${endpoint}`, JSON.stringify(payload), params);
      break;
    case 'PUT':
      response = http.put(`${BASE_URL}${endpoint}`, JSON.stringify(payload), params);
      break;
    case 'DELETE':
      response = http.del(`${BASE_URL}${endpoint}`, null, params);
      break;
    default:
      response = http.get(`${BASE_URL}${endpoint}`, params);
  }
  
  const duration = new Date().getTime() - start;
  
  // Record metrics
  apiCallsCounter.add(1);
  apiResponseTime.add(duration);
  
  const success = check(response, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  return response;
}

// Main test function
export default function() {
  // Health check
  const healthCheck = makeAuthenticatedRequest('/health');
  check(healthCheck, {
    'health check returns 200': (r) => r.status === 200,
    'health check has status ok': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok';
      } catch (e) {
        return false;
      }
    },
  });
  
  // Metrics endpoint check
  const metricsCheck = makeAuthenticatedRequest('/metrics');
  check(metricsCheck, {
    'metrics endpoint returns 200': (r) => r.status === 200,
    'metrics has prometheus format': (r) => r.body.includes('# HELP'),
  });
  
  // Test project operations
  const testProject = testProjects[Math.floor(Math.random() * testProjects.length)];
  
  // Create project
  const createProjectResponse = makeAuthenticatedRequest('/api/projects', 'POST', testProject);
  let projectId = null;
  
  if (createProjectResponse.status === 201) {
    try {
      const projectData = JSON.parse(createProjectResponse.body);
      projectId = projectData.id;
    } catch (e) {
      console.error('Failed to parse project creation response');
    }
  }
  
  if (projectId) {
    // Get project details
    const getProjectResponse = makeAuthenticatedRequest(`/api/projects/${projectId}`);
    check(getProjectResponse, {
      'get project returns 200': (r) => r.status === 200,
    });
    
    // Execute project (if available)
    const executeResponse = makeAuthenticatedRequest('/api/executions', 'POST', { projectId });
    let executionId = null;
    
    if (executeResponse.status === 201) {
      try {
        const executionData = JSON.parse(executeResponse.body);
        executionId = executionData.id;
      } catch (e) {
        console.error('Failed to parse execution response');
      }
    }
    
    if (executionId) {
      // Check execution status
      const executionStatusResponse = makeAuthenticatedRequest(`/api/executions/${executionId}`);
      check(executionStatusResponse, {
        'execution status returns 200': (r) => r.status === 200,
      });
    }
    
    // List projects
    const listProjectsResponse = makeAuthenticatedRequest('/api/projects');
    check(listProjectsResponse, {
      'list projects returns 200': (r) => r.status === 200,
    });
    
    // Clean up: delete project
    makeAuthenticatedRequest(`/api/projects/${projectId}`, 'DELETE');
  }
  
  // Test planning service
  const planningRequest = {
    requirements: 'Create a simple React application with user authentication and a dashboard',
  };
  
  const planningResponse = http.post(`${BASE_URL.replace('3002', '3003')}/generate-flow`, 
    JSON.stringify(planningRequest), 
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(planningResponse, {
    'planning service returns 200': (r) => r.status === 200,
    'planning response has flow': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.flow;
      } catch (e) {
        return false;
      }
    },
  });
  
  // Random sleep to simulate user think time
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once per VU)
export function setup() {
  console.log('Starting performance tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`WebSocket URL: ${WS_URL}`);
  
  // Verify services are available
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Service not available: ${healthResponse.status}`);
  }
  
  return { timestamp: new Date().toISOString() };
}

// Teardown function (runs once after all VUs finish)
export function teardown(data) {
  console.log('Performance tests completed.');
  console.log(`Started at: ${data.timestamp}`);
  console.log(`Completed at: ${new Date().toISOString()}`);
}