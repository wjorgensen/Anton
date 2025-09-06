import { NextRequest, NextResponse } from 'next/server';
import { alertManager } from '@/lib/monitoring/alert-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const summary = alertManager.exportAlertSummary();
    
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, alertId } = body;
    
    switch (action) {
      case 'resolve':
        alertManager.resolveAlert(alertId);
        return NextResponse.json({ success: true });
        
      case 'clear':
        alertManager.clearAlerts();
        return NextResponse.json({ success: true });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Alerts POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}