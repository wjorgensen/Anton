const axios = require('axios');
const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3002';
const SOCKET_URL = 'http://localhost:3002';

describe('Review Feedback Processing Tests', () => {
  let socket;
  let executionId;
  let projectId;

  beforeAll(async () => {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 100,
      reconnectionAttempts: 3
    });

    await new Promise(resolve => {
      socket.on('connect', resolve);
      setTimeout(resolve, 1000);
    });
  });

  afterAll(() => {
    if (socket) socket.disconnect();
  });

  beforeEach(async () => {
    executionId = uuidv4();
    projectId = uuidv4();
    
    socket.removeAllListeners();
  });

  async function createFlowWithReview(config = {}) {
    const flow = {
      nodes: [
        { 
          id: 'dev', 
          agentId: 'react-developer',
          instructions: config.instructions || 'Create a React component with proper error handling',
          maxRetries: config.maxRetries || 3
        },
        { 
          id: 'review', 
          agentId: 'manual-review', 
          type: 'review',
          requiresReview: true,
          requiresApproval: true,
          criteria: ['Error handling', 'Code quality', 'Best practices']
        },
        { 
          id: 'deploy', 
          agentId: 'deployment',
          instructions: 'Deploy the reviewed component'
        }
      ],
      edges: [
        { source: 'dev', target: 'review' },
        { source: 'review', target: 'deploy' }
      ]
    };

    const response = await axios.post(`${BASE_URL}/api/projects`, {
      id: projectId,
      name: 'Review Feedback Test',
      flow,
      metadata: { test: 'feedback-processing' }
    });

    return response.data;
  }

  async function executeFlowWithReview(project) {
    const response = await axios.post(`${BASE_URL}/api/execute`, {
      projectId: project.id,
      executionId,
      options: {
        pauseOnReview: true,
        trackRetries: true,
        enhanceRetryContext: true
      }
    });
    
    return response.data;
  }

  async function submitReviewFeedback(nodeId, feedback) {
    const response = await axios.post(`${BASE_URL}/api/review-feedback`, {
      executionId,
      nodeId,
      ...feedback
    });
    
    return response.data;
  }

  async function waitFor(condition, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  test('processes review feedback and retries', async () => {
    const project = await createFlowWithReview();
    
    let reviewReached = false;
    let retryCount = 0;
    let retryContext = null;
    
    socket.on('node:review', async (data) => {
      if (!reviewReached) {
        reviewReached = true;
        
        await submitReviewFeedback(data.nodeId, {
          approved: false,
          feedback: 'Please add error handling for null props and API failures',
          actionItems: [
            'Add null check for props',
            'Add try-catch for API calls',
            'Add error boundary component'
          ]
        });
      }
    });
    
    socket.on('node:retry', (data) => {
      retryCount++;
      retryContext = data.context;
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => retryCount > 0);
    
    expect(retryCount).toBeGreaterThan(0);
    expect(retryContext).toMatchObject({
      reviewFeedback: expect.stringContaining('error handling'),
      actionItems: expect.arrayContaining([
        expect.stringContaining('null check'),
        expect.stringContaining('try-catch'),
        expect.stringContaining('error boundary')
      ])
    });
  });

  test('handles approval feedback correctly', async () => {
    const project = await createFlowWithReview();
    
    let deployStarted = false;
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: true,
        feedback: 'Looks good! Code is clean and follows best practices.',
        comments: 'Great work on the error handling'
      });
    });
    
    socket.on('node:start', (data) => {
      if (data.nodeId === 'deploy') {
        deployStarted = true;
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => deployStarted);
    
    expect(deployStarted).toBe(true);
  });

  test('processes rejection feedback and aborts flow', async () => {
    const project = await createFlowWithReview();
    
    let flowAborted = false;
    let abortReason = null;
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        decision: 'reject',
        feedback: 'Major architectural issues. Please redesign the component.',
        severity: 'error'
      });
    });
    
    socket.on('flow:aborted', (data) => {
      flowAborted = true;
      abortReason = data.reason;
    });
    
    socket.on('node:error', (data) => {
      if (data.nodeId === 'review') {
        flowAborted = true;
        abortReason = data.error;
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => flowAborted);
    
    expect(flowAborted).toBe(true);
    expect(abortReason).toContain('architectural issues');
  });

  test('enhances retry context with reviewer feedback', async () => {
    const project = await createFlowWithReview();
    
    let originalInstructions = null;
    let enhancedInstructions = null;
    
    socket.on('node:start', (data) => {
      if (data.nodeId === 'dev' && !originalInstructions) {
        originalInstructions = data.instructions;
      }
    });
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        feedback: 'Please implement the following changes:\n- Use TypeScript interfaces\n- Add unit tests\n- Improve variable naming',
        actionItems: [
          'Convert to TypeScript',
          'Add comprehensive tests',
          'Rename variables for clarity'
        ]
      });
    });
    
    socket.on('node:retry', (data) => {
      enhancedInstructions = data.instructions;
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => enhancedInstructions !== null);
    
    expect(enhancedInstructions).not.toBe(originalInstructions);
    expect(enhancedInstructions).toContain('TypeScript');
    expect(enhancedInstructions).toContain('tests');
    expect(enhancedInstructions).toContain('variable naming');
  });

  test('tracks multiple retry iterations', async () => {
    const project = await createFlowWithReview({ maxRetries: 3 });
    
    const iterations = [];
    let currentIteration = 0;
    
    socket.on('node:review', async (data) => {
      currentIteration++;
      iterations.push({
        iteration: currentIteration,
        timestamp: Date.now()
      });
      
      if (currentIteration < 3) {
        await submitReviewFeedback(data.nodeId, {
          approved: false,
          feedback: `Iteration ${currentIteration}: Still needs improvements`,
          actionItems: [`Fix issue ${currentIteration}`]
        });
      } else {
        await submitReviewFeedback(data.nodeId, {
          approved: true,
          feedback: 'All issues resolved'
        });
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => iterations.length >= 3);
    
    expect(iterations.length).toBe(3);
    expect(iterations[0].iteration).toBe(1);
    expect(iterations[2].iteration).toBe(3);
  });

  test('respects maximum retry limit', async () => {
    const project = await createFlowWithReview({ maxRetries: 2 });
    
    let retryCount = 0;
    let maxRetriesExceeded = false;
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        feedback: 'Always request changes',
        actionItems: ['Fix something']
      });
    });
    
    socket.on('node:retry', () => {
      retryCount++;
    });
    
    socket.on('node:maxRetriesExceeded', () => {
      maxRetriesExceeded = true;
    });
    
    socket.on('flow:error', (data) => {
      if (data.reason && data.reason.includes('max retries')) {
        maxRetriesExceeded = true;
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => maxRetriesExceeded || retryCount >= 2, 15000);
    
    expect(retryCount).toBeLessThanOrEqual(2);
  });

  test('parses different feedback formats', async () => {
    const project = await createFlowWithReview();
    
    const feedbackFormats = [
      {
        format: 'json',
        feedback: JSON.stringify({
          approved: false,
          comments: 'Need improvements',
          actionItems: ['Fix A', 'Fix B']
        })
      },
      {
        format: 'natural',
        feedback: 'Please request changes. The following needs to be fixed:\n- Issue 1\n- Issue 2\n* Problem 3'
      },
      {
        format: 'structured',
        feedback: 'DECISION: request-changes\nCOMMENTS: Multiple issues found\nACTIONS:\n- Fix error handling\n- Add validation'
      }
    ];
    
    let parsedFeedback = null;
    
    socket.on('node:review', async (data) => {
      const format = feedbackFormats[Math.floor(Math.random() * feedbackFormats.length)];
      
      await axios.post(`${BASE_URL}/api/review-feedback`, {
        executionId,
        nodeId: data.nodeId,
        feedback: format.feedback,
        format: format.format
      });
    });
    
    socket.on('review:feedback', (data) => {
      parsedFeedback = data;
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => parsedFeedback !== null);
    
    expect(parsedFeedback).toBeDefined();
    expect(parsedFeedback.decision).toBeDefined();
  });

  test('maintains feedback history across iterations', async () => {
    const project = await createFlowWithReview();
    
    const feedbackHistory = [];
    
    socket.on('node:review', async (data) => {
      const iteration = feedbackHistory.length + 1;
      const feedback = {
        approved: iteration >= 3,
        feedback: `Iteration ${iteration} feedback`,
        timestamp: Date.now()
      };
      
      feedbackHistory.push(feedback);
      await submitReviewFeedback(data.nodeId, feedback);
    });
    
    socket.on('node:complete', async (data) => {
      if (data.nodeId === 'review') {
        const response = await axios.get(`${BASE_URL}/api/execution/${executionId}/reviews`);
        const history = response.data;
        
        expect(history.length).toBe(feedbackHistory.length);
        expect(history[0].feedback).toContain('Iteration 1');
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => feedbackHistory.length >= 3);
    
    expect(feedbackHistory.length).toBeGreaterThanOrEqual(3);
  });

  test('handles concurrent feedback from multiple reviewers', async () => {
    const project = await createFlowWithReview();
    
    const reviewers = ['reviewer1', 'reviewer2', 'reviewer3'];
    const feedbackReceived = [];
    
    socket.on('node:review', async (data) => {
      const feedbackPromises = reviewers.map(async (reviewerId, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 100));
        
        const feedback = {
          reviewerId,
          approved: index === 2,
          feedback: `Feedback from ${reviewerId}`,
          priority: index
        };
        
        return axios.post(`${BASE_URL}/api/review-feedback`, {
          executionId,
          nodeId: data.nodeId,
          ...feedback
        });
      });
      
      await Promise.all(feedbackPromises);
    });
    
    socket.on('review:feedback', (data) => {
      feedbackReceived.push(data);
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => feedbackReceived.length >= reviewers.length);
    
    expect(feedbackReceived.length).toBeGreaterThanOrEqual(reviewers.length);
    
    const reviewerIds = feedbackReceived.map(f => f.reviewerId).filter(Boolean);
    expect(new Set(reviewerIds).size).toBeGreaterThanOrEqual(1);
  });

  test('processes feedback with severity levels', async () => {
    const project = await createFlowWithReview();
    
    let severityProcessed = false;
    let processedSeverity = null;
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        feedback: 'Critical security vulnerability found',
        severity: 'error',
        actionItems: ['Fix XSS vulnerability', 'Add input sanitization']
      });
    });
    
    socket.on('review:feedback', (data) => {
      if (data.severity) {
        severityProcessed = true;
        processedSeverity = data.severity;
      }
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => severityProcessed);
    
    expect(processedSeverity).toBe('error');
  });

  test('generates modified instructions from feedback', async () => {
    const project = await createFlowWithReview();
    
    let modifiedInstructions = null;
    
    socket.on('node:review', async (data) => {
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        feedback: 'The component needs the following changes:\n1. Add PropTypes validation\n2. Implement error boundaries\n3. Add loading states',
        suggestions: [
          'Use PropTypes.shape for complex objects',
          'Create a reusable ErrorBoundary component',
          'Show skeleton loader during data fetch'
        ]
      });
    });
    
    socket.on('node:retry', (data) => {
      modifiedInstructions = data.modifiedInstructions || data.instructions;
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => modifiedInstructions !== null);
    
    expect(modifiedInstructions).toContain('PropTypes');
    expect(modifiedInstructions).toContain('error boundaries');
    expect(modifiedInstructions).toContain('loading states');
  });

  test('tracks feedback processing performance metrics', async () => {
    const project = await createFlowWithReview();
    
    const metrics = {
      feedbackSubmitTime: null,
      feedbackProcessTime: null,
      retryStartTime: null,
      processingDuration: null
    };
    
    socket.on('node:review', async (data) => {
      metrics.feedbackSubmitTime = Date.now();
      await submitReviewFeedback(data.nodeId, {
        approved: false,
        feedback: 'Needs improvements',
        actionItems: ['Fix issues']
      });
    });
    
    socket.on('review:processed', (data) => {
      metrics.feedbackProcessTime = Date.now();
      metrics.processingDuration = metrics.feedbackProcessTime - metrics.feedbackSubmitTime;
    });
    
    socket.on('node:retry', () => {
      metrics.retryStartTime = Date.now();
    });

    await executeFlowWithReview(project);
    
    await waitFor(() => metrics.retryStartTime !== null);
    
    expect(metrics.processingDuration).toBeLessThan(5000);
    expect(metrics.retryStartTime).toBeGreaterThan(metrics.feedbackProcessTime);
  });
});