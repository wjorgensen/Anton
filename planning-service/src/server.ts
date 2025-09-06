import express from 'express';
import cors from 'cors';
import client from 'prom-client';
import { FlowPlanningService } from './index';

// Create metrics registry
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'planning_' });

// Custom metrics
const flowGenerationsTotal = new client.Counter({
  name: 'planning_flow_generations_total',
  help: 'Total number of flow generations',
  labelNames: ['status'],
  registers: [register],
});

const flowGenerationDuration = new client.Histogram({
  name: 'planning_flow_generation_duration_seconds',
  help: 'Flow generation duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const app = express();
const port = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize planning service
const planningService = new FlowPlanningService();

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).end('Error collecting metrics');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'planning-service' });
});

// Generate flow from requirements
app.post('/generate-flow', async (req, res) => {
  const start = Date.now();
  try {
    const { requirements } = req.body;
    
    if (!requirements) {
      flowGenerationsTotal.inc({ status: 'error' });
      return res.status(400).json({ error: 'Requirements are required' });
    }
    
    console.log('📝 Received requirements:', requirements.substring(0, 100) + '...');
    
    // Generate the flow using the planning service
    const result = await planningService.planFlow(requirements);
    
    // Send the generated flow to the orchestrator
    try {
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:3002';
      const response = await fetch(`${orchestratorUrl}/api/flows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flow: result.flow,
          metadata: {
            generated: true,
            requirements,
            metrics: result.metrics,
            validation: result.validation
          }
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to send flow to orchestrator:', response.status);
      } else {
        console.log('✅ Flow sent to orchestrator successfully');
      }
    } catch (error) {
      console.error('Error sending flow to orchestrator:', error);
      // Continue even if orchestrator communication fails
    }
    
    // Track success
    const duration = (Date.now() - start) / 1000;
    flowGenerationsTotal.inc({ status: 'success' });
    flowGenerationDuration.observe(duration);
    
    res.json({
      success: true,
      flow: result.flow,
      validation: result.validation,
      metrics: result.metrics
    });
  } catch (error) {
    console.error('Error generating flow:', error);
    
    // Track error
    const duration = (Date.now() - start) / 1000;
    flowGenerationsTotal.inc({ status: 'error' });
    flowGenerationDuration.observe(duration);
    
    res.status(500).json({ 
      error: 'Failed to generate flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Optimize existing flow
app.post('/optimize-flow', async (req, res) => {
  try {
    const { flow } = req.body;
    
    if (!flow) {
      return res.status(400).json({ error: 'Flow is required' });
    }
    
    const optimizedFlow = planningService.optimizeFlow(flow);
    
    res.json({
      success: true,
      flow: optimizedFlow
    });
  } catch (error) {
    console.error('Error optimizing flow:', error);
    res.status(500).json({ 
      error: 'Failed to optimize flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Suggest agents based on context
app.post('/suggest-agents', async (req, res) => {
  try {
    const { context, category } = req.body;
    
    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }
    
    // This would normally use AI to suggest relevant agents
    // For now, return mock suggestions
    const suggestions = [
      {
        id: 'nextjs-setup',
        name: 'Next.js Setup',
        category: 'setup',
        relevance: 0.95
      },
      {
        id: 'react-developer',
        name: 'React Developer',
        category: 'execution',
        relevance: 0.90
      },
      {
        id: 'jest-tester',
        name: 'Jest Tester',
        category: 'testing',
        relevance: 0.85
      }
    ];
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Error suggesting agents:', error);
    res.status(500).json({ 
      error: 'Failed to suggest agents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export flow in different formats
app.post('/export-flow', (req, res) => {
  try {
    const { flow, format = 'json' } = req.body;
    
    if (!flow) {
      return res.status(400).json({ error: 'Flow is required' });
    }
    
    const exported = planningService.exportFlow(flow, format as 'json' | 'yaml');
    
    res.json({
      success: true,
      data: exported,
      format
    });
  } catch (error) {
    console.error('Error exporting flow:', error);
    res.status(500).json({ 
      error: 'Failed to export flow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Planning Service running on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/health`);
});