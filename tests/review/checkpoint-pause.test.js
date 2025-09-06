const axios = require('axios');
const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const BASE_URL = 'http://localhost:3002';
const SOCKET_URL = 'http://localhost:3002';

describe('Review Checkpoint Pause Tests', () => {
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
          instructions: 'Create a simple React component'
        },
        { 
          id: 'review', 
          agentId: 'manual-review', 
          type: 'review',
          requiresReview: true,
          requiresApproval: config.requiresApproval !== false,
          timeout: config.timeout || 300000,
          criteria: config.criteria || ['Code quality', 'Best practices']
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
      name: 'Review Checkpoint Test',
      flow,
      metadata: { test: 'checkpoint-pause' }
    });

    return response.data;
  }

  async function startFlow(project) {
    const response = await axios.post(`${BASE_URL}/api/execute`, {
      projectId: project.id,
      executionId,
      options: {
        pauseOnReview: true,
        trackReviewState: true
      }
    });
    
    return response.data;
  }

  async function getNodeStatus(nodeId) {
    try {
      const response = await axios.get(`${BASE_URL}/api/execution/${executionId}/node/${nodeId}`);
      return response.data.status;
    } catch (error) {
      return 'pending';
    }
  }

  async function waitFor(condition, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  test('pauses execution at review checkpoint', async () => {
    const project = await createFlowWithReview();
    
    let reviewReached = false;
    let reviewNodeId = null;
    let reviewData = null;
    
    socket.on('node:review', (data) => {
      reviewReached = true;
      reviewNodeId = data.nodeId;
      reviewData = data;
      expect(data.nodeId).toBe('review');
      expect(data.executionId).toBe(executionId);
    });

    socket.on('review:requested', (data) => {
      expect(data.nodeId).toBe('review');
      expect(data.requiresApproval).toBe(true);
    });

    await startFlow(project);
    
    await waitFor(() => reviewReached);
    
    expect(reviewNodeId).toBe('review');
    expect(reviewData).toMatchObject({
      nodeId: 'review',
      executionId,
      type: 'review',
      state: 'waiting_for_review'
    });
    
    const deployStatus = await getNodeStatus('deploy');
    expect(deployStatus).toBe('pending');
    
    const reviewStatus = await getNodeStatus('review');
    expect(reviewStatus).toBe('in_review');
  });

  test('prevents downstream nodes from executing during review', async () => {
    const project = await createFlowWithReview();
    
    const nodeStates = {};
    
    socket.on('node:start', (data) => {
      nodeStates[data.nodeId] = 'started';
    });
    
    socket.on('node:complete', (data) => {
      nodeStates[data.nodeId] = 'completed';
    });
    
    socket.on('node:review', (data) => {
      nodeStates[data.nodeId] = 'in_review';
    });

    await startFlow(project);
    
    await waitFor(() => nodeStates.review === 'in_review');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    expect(nodeStates.dev).toBe('completed');
    expect(nodeStates.review).toBe('in_review');
    expect(nodeStates.deploy).toBeUndefined();
  });

  test('tracks review checkpoint timing', async () => {
    const project = await createFlowWithReview();
    
    let reviewStartTime = null;
    let reviewEndTime = null;
    
    socket.on('review:requested', (data) => {
      reviewStartTime = Date.now();
    });
    
    socket.on('review:cancelled', (data) => {
      reviewEndTime = Date.now();
    });

    await startFlow(project);
    
    await waitFor(() => reviewStartTime !== null);
    
    setTimeout(async () => {
      await axios.delete(`${BASE_URL}/api/review/review`);
    }, 3000);
    
    await waitFor(() => reviewEndTime !== null, 10000);
    
    const duration = reviewEndTime - reviewStartTime;
    expect(duration).toBeGreaterThanOrEqual(3000);
    expect(duration).toBeLessThan(10000);
  });

  test('maintains execution context during review pause', async () => {
    const project = await createFlowWithReview();
    
    let devOutput = null;
    let reviewContext = null;
    
    socket.on('node:complete', (data) => {
      if (data.nodeId === 'dev') {
        devOutput = data.output;
      }
    });
    
    socket.on('node:review', (data) => {
      reviewContext = data.context;
    });

    await startFlow(project);
    
    await waitFor(() => reviewContext !== null);
    
    expect(reviewContext).toMatchObject({
      previousNodes: expect.arrayContaining(['dev']),
      executionId,
      projectId
    });
    
    expect(devOutput).toBeDefined();
  });

  test('handles multiple review checkpoints in sequence', async () => {
    const flow = {
      nodes: [
        { id: 'dev1', agentId: 'react-developer' },
        { id: 'review1', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'dev2', agentId: 'react-developer' },
        { id: 'review2', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'deploy', agentId: 'deployment' }
      ],
      edges: [
        { source: 'dev1', target: 'review1' },
        { source: 'review1', target: 'dev2' },
        { source: 'dev2', target: 'review2' },
        { source: 'review2', target: 'deploy' }
      ]
    };

    const project = await axios.post(`${BASE_URL}/api/projects`, {
      id: projectId,
      name: 'Multiple Review Test',
      flow
    });

    const reviewCheckpoints = [];
    
    socket.on('node:review', (data) => {
      reviewCheckpoints.push(data.nodeId);
    });

    await startFlow(project.data);
    
    await waitFor(() => reviewCheckpoints.includes('review1'));
    
    await axios.post(`${BASE_URL}/api/review-feedback`, {
      executionId,
      nodeId: 'review1',
      approved: true,
      comments: 'First review approved'
    });
    
    await waitFor(() => reviewCheckpoints.includes('review2'));
    
    expect(reviewCheckpoints).toEqual(['review1', 'review2']);
    
    const deployStatus = await getNodeStatus('deploy');
    expect(deployStatus).toBe('pending');
  });

  test('respects timeout settings for review checkpoints', async () => {
    const project = await createFlowWithReview({ 
      timeout: 3000,
      requiresApproval: false
    });
    
    let reviewTimedOut = false;
    let timeoutData = null;
    
    socket.on('review:timeout', (data) => {
      reviewTimedOut = true;
      timeoutData = data;
    });
    
    socket.on('review:cancelled', (data) => {
      if (data.reason === 'timeout') {
        reviewTimedOut = true;
      }
    });

    await startFlow(project);
    
    await waitFor(() => reviewTimedOut, 5000);
    
    expect(reviewTimedOut).toBe(true);
    
    if (timeoutData) {
      expect(timeoutData.nodeId).toBe('review');
      expect(timeoutData.timeout).toBe(3000);
    }
  });

  test('preserves file changes during review pause', async () => {
    const project = await createFlowWithReview();
    
    let fileChanges = null;
    
    socket.on('node:review', async (data) => {
      const response = await axios.get(`${BASE_URL}/api/execution/${executionId}/files`);
      fileChanges = response.data;
    });

    await startFlow(project);
    
    await waitFor(() => fileChanges !== null);
    
    expect(fileChanges).toBeDefined();
    expect(Array.isArray(fileChanges)).toBe(true);
  });

  test('handles concurrent review checkpoints in parallel branches', async () => {
    const flow = {
      nodes: [
        { id: 'start', agentId: 'start' },
        { id: 'branch1', agentId: 'react-developer' },
        { id: 'branch2', agentId: 'vue-developer' },
        { id: 'review1', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'review2', agentId: 'manual-review', type: 'review', requiresReview: true },
        { id: 'merge', agentId: 'merge' }
      ],
      edges: [
        { source: 'start', target: 'branch1' },
        { source: 'start', target: 'branch2' },
        { source: 'branch1', target: 'review1' },
        { source: 'branch2', target: 'review2' },
        { source: 'review1', target: 'merge' },
        { source: 'review2', target: 'merge' }
      ]
    };

    const project = await axios.post(`${BASE_URL}/api/projects`, {
      id: projectId,
      name: 'Parallel Review Test',
      flow
    });

    const activeReviews = new Set();
    
    socket.on('node:review', (data) => {
      activeReviews.add(data.nodeId);
    });
    
    socket.on('node:reviewed', (data) => {
      activeReviews.delete(data.nodeId);
    });

    await startFlow(project.data);
    
    await waitFor(() => activeReviews.size === 2);
    
    expect(activeReviews.has('review1')).toBe(true);
    expect(activeReviews.has('review2')).toBe(true);
    
    const mergeStatus = await getNodeStatus('merge');
    expect(mergeStatus).toBe('pending');
  });

  test('tracks review checkpoint metrics', async () => {
    const project = await createFlowWithReview();
    
    const metrics = {
      pauseTime: null,
      resumeTime: null,
      pauseDuration: null
    };
    
    socket.on('node:review', (data) => {
      metrics.pauseTime = Date.now();
    });
    
    socket.on('node:reviewed', (data) => {
      metrics.resumeTime = Date.now();
      metrics.pauseDuration = metrics.resumeTime - metrics.pauseTime;
    });

    await startFlow(project);
    
    await waitFor(() => metrics.pauseTime !== null);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await axios.post(`${BASE_URL}/api/review-feedback`, {
      executionId,
      nodeId: 'review',
      approved: true
    });
    
    await waitFor(() => metrics.resumeTime !== null);
    
    expect(metrics.pauseDuration).toBeGreaterThanOrEqual(1500);
    expect(metrics.pauseDuration).toBeLessThan(5000);
  });
});