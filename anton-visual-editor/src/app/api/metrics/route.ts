import { NextResponse } from 'next/server';
import client from 'prom-client';

// Create registry for Next.js metrics
const register = new client.Registry();

// Collect default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'nextjs_',
});

// Custom metrics for the visual editor
const pageViews = new client.Counter({
  name: 'nextjs_page_views_total',
  help: 'Total number of page views',
  labelNames: ['path'],
  registers: [register],
});

const flowEditorOperations = new client.Counter({
  name: 'nextjs_flow_editor_operations_total',
  help: 'Total number of flow editor operations',
  labelNames: ['operation'], // add_node, delete_node, connect_nodes, etc.
  registers: [register],
});

const websocketConnections = new client.Gauge({
  name: 'nextjs_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

const apiCalls = new client.Counter({
  name: 'nextjs_api_calls_total',
  help: 'Total number of API calls to backend',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new Response(metrics, {
      status: 200,
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    return new Response('Error collecting metrics', { status: 500 });
  }
}

// Export metrics for use in other components
export { pageViews, flowEditorOperations, websocketConnections, apiCalls };