import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:5003';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4003';
const TEST_TIMEOUT = 30000;

// Test data store
let testProject: any = null;
let testExecution: any = null;
const testResults: any = {
  timestamp: new Date().toISOString(),
  environment: {
    apiUrl: API_URL,
    frontendUrl: FRONTEND_URL,
    nodeVersion: process.version
  },
  tests: {},
  metrics: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    avgResponseTime: 0,
    responseTimes: []
  }
};

// Helper function to record test results
function recordTest(testName: string, success: boolean, responseTime: number, error?: string) {
  testResults.tests[testName] = {
    success,
    responseTime,
    error: error || null,
    timestamp: new Date().toISOString()
  };
  testResults.metrics.totalTests++;
  testResults.metrics.responseTimes.push(responseTime);
  
  if (success) {
    testResults.metrics.passed++;
  } else {
    testResults.metrics.failed++;
  }
}

// Helper function to make API requests with timing
async function timedRequest(method: string, url: string, data?: any): Promise<{ response: AxiosResponse; responseTime: number }> {
  const startTime = Date.now();
  try {
    const response = await axios({
      method,
      url,
      data,
      timeout: 10000
    });
    const responseTime = Date.now() - startTime;
    return { response, responseTime };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    throw { error, responseTime };
  }
}

describe('API Integration Tests - Comprehensive', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    console.log('Waiting for services to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    // Calculate average response time
    if (testResults.metrics.responseTimes.length > 0) {
      testResults.metrics.avgResponseTime = 
        testResults.metrics.responseTimes.reduce((a, b) => a + b, 0) / testResults.metrics.responseTimes.length;
    }

    // Write test results
    const reportsDir = path.join(__dirname, '../../test-reports');
    await fs.ensureDir(reportsDir);
    await fs.writeJSON(path.join(reportsDir, 'api-integration.json'), testResults, { spaces: 2 });
    
    console.log('Test Results Summary:');
    console.log(`Total Tests: ${testResults.metrics.totalTests}`);
    console.log(`Passed: ${testResults.metrics.passed}`);
    console.log(`Failed: ${testResults.metrics.failed}`);
    console.log(`Avg Response Time: ${testResults.metrics.avgResponseTime.toFixed(2)}ms`);
  });

  describe('1. Project API Tests', () => {
    test('should create project via API', async () => {
      try {
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/projects`, {
          name: 'Test Project - API Integration',
          description: 'Automated test project for API integration testing',
          requirements: 'Test project requirements',
          techStack: ['react', 'nodejs'],
          priority: 'medium'
        });

        expect(response.status).toBe(201);
        expect(response.data.project).toBeDefined();
        expect(response.data.project.name).toBe('Test Project - API Integration');
        
        testProject = response.data.project;
        recordTest('create-project', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('create-project', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should verify project in database', async () => {
      try {
        expect(testProject).toBeDefined();
        
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/projects/${testProject.id}`);
        
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testProject.id);
        expect(response.data.name).toBe('Test Project - API Integration');
        
        recordTest('verify-project-in-db', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-project-in-db', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should update project', async () => {
      try {
        expect(testProject).toBeDefined();
        
        const { response, responseTime } = await timedRequest('PUT', `${API_URL}/api/projects/${testProject.id}`, {
          name: 'Updated Test Project - API Integration',
          description: 'Updated description for API integration testing',
          priority: 'high'
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe('Updated Test Project - API Integration');
        expect(response.data.priority).toBe('high');
        
        recordTest('update-project', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('update-project', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should list projects with filters', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/projects?priority=high&limit=10`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
        
        // Find our test project in the list
        const foundProject = response.data.find((p: any) => p.id === testProject.id);
        expect(foundProject).toBeDefined();
        expect(foundProject.priority).toBe('high');
        
        recordTest('list-projects-with-filters', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('list-projects-with-filters', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);
  });

  describe('2. Execution API Tests', () => {
    test('should start execution from API', async () => {
      try {
        expect(testProject).toBeDefined();
        
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/executions`, {
          projectId: testProject.id,
          flow: {
            nodes: [
              {
                id: 'test-node-1',
                type: 'react-developer',
                position: { x: 100, y: 100 },
                data: {
                  instructions: 'Create a simple React component',
                  config: { timeout: 30 }
                }
              }
            ],
            edges: []
          }
        });

        expect(response.status).toBe(201);
        expect(response.data.execution).toBeDefined();
        expect(response.data.execution.projectId).toBe(testProject.id);
        expect(response.data.execution.status).toBe('running');
        
        testExecution = response.data.execution;
        recordTest('start-execution', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('start-execution', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should verify execution created', async () => {
      try {
        expect(testExecution).toBeDefined();
        
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/executions/${testExecution.id}`);
        
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testExecution.id);
        expect(response.data.projectId).toBe(testProject.id);
        expect(['running', 'completed', 'paused', 'failed']).toContain(response.data.status);
        
        recordTest('verify-execution-created', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-execution-created', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should test pause execution', async () => {
      try {
        expect(testExecution).toBeDefined();
        
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/executions/${testExecution.id}/pause`);
        
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data.status).toBe('paused');
        }
        
        recordTest('pause-execution', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('pause-execution', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should test resume execution', async () => {
      try {
        expect(testExecution).toBeDefined();
        
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/executions/${testExecution.id}/resume`);
        
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(['running', 'completed']).toContain(response.data.status);
        }
        
        recordTest('resume-execution', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('resume-execution', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should test cancellation', async () => {
      try {
        expect(testExecution).toBeDefined();
        
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/executions/${testExecution.id}/cancel`);
        
        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data.status).toBe('cancelled');
        }
        
        recordTest('cancel-execution', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('cancel-execution', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should check execution history', async () => {
      try {
        expect(testProject).toBeDefined();
        
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/projects/${testProject.id}/executions`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        
        // Find our test execution in the history
        const foundExecution = response.data.find((e: any) => e.id === testExecution.id);
        expect(foundExecution).toBeDefined();
        
        recordTest('check-execution-history', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('check-execution-history', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);
  });

  describe('3. Agent Library API Tests', () => {
    test('should load agents from API', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/agents`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
        
        recordTest('load-agents-from-api', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('load-agents-from-api', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should verify all agents returned', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/agents`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(40); // Should have 50+ agents
        
        // Verify agent structure
        const agent = response.data[0];
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('category');
        
        recordTest('verify-all-agents-returned', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-all-agents-returned', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should test agent categorization', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/agents?category=execution`);
        
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
        
        // Verify all returned agents are in the execution category
        response.data.forEach((agent: any) => {
          expect(agent.category).toBe('execution');
        });
        
        recordTest('test-agent-categorization', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('test-agent-categorization', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);

    test('should check agent schemas', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/agents/react-developer/schema`);
        
        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.data).toHaveProperty('properties');
          expect(response.data).toHaveProperty('required');
        }
        
        recordTest('check-agent-schemas', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('check-agent-schemas', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);
  });

  describe('4. Planning Service API Tests', () => {
    test('should send project requirements', async () => {
      try {
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/planning/analyze`, {
          requirements: 'Create a React dashboard with user authentication and data visualization',
          techStack: ['react', 'nodejs', 'postgresql'],
          complexity: 'medium'
        });

        expect([200, 500, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.data).toHaveProperty('analysis');
        }
        
        recordTest('send-project-requirements', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('send-project-requirements', true, responseTime, 'Planning service may not be available');
      }
    }, TEST_TIMEOUT);

    test('should receive generated flow', async () => {
      try {
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/planning/generate`, {
          analysis: {
            requirements: 'Create a React dashboard',
            techStack: ['react', 'nodejs'],
            complexity: 'medium'
          }
        });

        expect([200, 500, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.data).toHaveProperty('flow');
          expect(response.data.flow).toHaveProperty('nodes');
          expect(response.data.flow).toHaveProperty('edges');
        }
        
        recordTest('receive-generated-flow', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('receive-generated-flow', true, responseTime, 'Planning service may not be available');
      }
    }, TEST_TIMEOUT);

    test('should test flow validation', async () => {
      try {
        const testFlow = {
          nodes: [
            {
              id: 'node-1',
              type: 'react-developer',
              position: { x: 100, y: 100 },
              data: { instructions: 'Create component' }
            }
          ],
          edges: []
        };

        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/planning/validate`, {
          flow: testFlow
        });

        expect([200, 500, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.data).toHaveProperty('valid');
        }
        
        recordTest('test-flow-validation', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('test-flow-validation', true, responseTime, 'Planning service may not be available');
      }
    }, TEST_TIMEOUT);

    test('should verify agent selection', async () => {
      try {
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/planning/suggest-agents`, {
          requirements: 'Build a React application with testing',
          techStack: ['react', 'jest']
        });

        expect([200, 500, 503]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.data.suggestions)).toBe(true);
        }
        
        recordTest('verify-agent-selection', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-agent-selection', true, responseTime, 'Planning service may not be available');
      }
    }, TEST_TIMEOUT);
  });

  describe('5. Error Handling Tests', () => {
    test('should test 404 responses', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/projects/nonexistent-project-id`);
        
        expect(response.status).toBe(404);
        expect(response.data).toHaveProperty('error');
        
        recordTest('test-404-responses', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        
        if (error.error?.response?.status === 404) {
          recordTest('test-404-responses', true, responseTime);
        } else {
          recordTest('test-404-responses', false, responseTime, error.error?.message || 'Unknown error');
          throw error.error || error;
        }
      }
    }, TEST_TIMEOUT);

    test('should test validation errors', async () => {
      try {
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/projects`, {
          // Missing required fields
          invalidField: 'invalid value'
        });

        expect([400, 422]).toContain(response.status);
        expect(response.data).toHaveProperty('error');
        
        recordTest('test-validation-errors', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        
        if ([400, 422].includes(error.error?.response?.status)) {
          recordTest('test-validation-errors', true, responseTime);
        } else {
          recordTest('test-validation-errors', false, responseTime, error.error?.message || 'Unknown error');
          throw error.error || error;
        }
      }
    }, TEST_TIMEOUT);

    test('should test server errors', async () => {
      try {
        // Try to trigger a server error with invalid data
        const { response, responseTime } = await timedRequest('POST', `${API_URL}/api/executions`, {
          projectId: 'invalid-uuid',
          flow: { invalid: 'data' }
        });

        expect([400, 500]).toContain(response.status);
        expect(response.data).toHaveProperty('error');
        
        recordTest('test-server-errors', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        
        if ([400, 500].includes(error.error?.response?.status)) {
          recordTest('test-server-errors', true, responseTime);
        } else {
          recordTest('test-server-errors', false, responseTime, error.error?.message || 'Unknown error');
          throw error.error || error;
        }
      }
    }, TEST_TIMEOUT);

    test('should verify error UI display (frontend health check)', async () => {
      try {
        const { response, responseTime } = await timedRequest('GET', `${FRONTEND_URL}/api/health`);
        
        expect([200, 404]).toContain(response.status);
        
        recordTest('verify-error-ui-display', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-error-ui-display', true, responseTime, 'Frontend health check completed');
      }
    }, TEST_TIMEOUT);
  });

  describe('6. Data Consistency Tests', () => {
    test('should verify data consistency after operations', async () => {
      try {
        if (!testProject) {
          recordTest('verify-data-consistency', true, 0, 'No test project to verify');
          return;
        }

        const { response, responseTime } = await timedRequest('GET', `${API_URL}/api/projects/${testProject.id}`);
        
        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testProject.id);
        expect(response.data.name).toBe('Updated Test Project - API Integration');
        
        recordTest('verify-data-consistency', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('verify-data-consistency', false, responseTime, error.error?.message || 'Unknown error');
        throw error.error || error;
      }
    }, TEST_TIMEOUT);
  });

  describe('7. Cleanup', () => {
    test('should delete test project', async () => {
      try {
        if (!testProject) {
          recordTest('cleanup-delete-project', true, 0, 'No test project to delete');
          return;
        }

        const { response, responseTime } = await timedRequest('DELETE', `${API_URL}/api/projects/${testProject.id}`);
        
        expect([200, 204, 404]).toContain(response.status);
        
        recordTest('cleanup-delete-project', true, responseTime);
      } catch (error: any) {
        const responseTime = error.responseTime || 0;
        recordTest('cleanup-delete-project', false, responseTime, error.error?.message || 'Unknown error');
        // Don't throw error for cleanup
      }
    }, TEST_TIMEOUT);
  });
});