import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/metrics-collector';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'snapshot':
        const snapshot = await metricsCollector.collectSnapshot();
        return NextResponse.json(snapshot);

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '100');
        const history = metricsCollector.getHistory(limit);
        return NextResponse.json(history);

      case 'export':
        const metrics = await metricsCollector.exportMetrics();
        return NextResponse.json(metrics);

      case 'health':
        const health = await metricsCollector.collectSnapshot();
        const isHealthy = health.health.servicesHealthy;
        
        return NextResponse.json(
          {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: Date.now(),
            services: health.health,
            uptime: process.uptime()
          },
          { status: isHealthy ? 200 : 503 }
        );

      default:
        const latest = metricsCollector.getLatestSnapshot();
        return NextResponse.json(latest || { message: 'No metrics available yet' });
    }
  } catch (error) {
    console.error('Monitoring API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'trackExecution':
        metricsCollector.trackExecution(data.executionId, data.status);
        return NextResponse.json({ success: true });

      case 'trackNode':
        metricsCollector.trackNode(data.nodeId, data.success);
        return NextResponse.json({ success: true });

      case 'trackHook':
        metricsCollector.trackHook(data.hookName, data.success);
        return NextResponse.json({ success: true });

      case 'reset':
        if (data.counter) {
          metricsCollector.resetCounter(data.counter);
        }
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Monitoring POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}