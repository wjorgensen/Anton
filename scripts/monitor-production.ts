#!/usr/bin/env node

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MONITORING_DURATION = parseInt(process.env.MONITORING_DURATION || '300000'); // 5 minutes default
const REPORT_DIR = path.join(process.cwd(), 'test-reports');

interface MonitoringReport {
  startTime: string;
  endTime: string;
  duration: number;
  environment: string;
  healthChecks: any[];
  metrics: {
    snapshots: any[];
    summary: any;
  };
  alerts: any;
  performance: {
    averageApiResponseTime: number;
    averageMemoryUsage: number;
    averageCpuUtilization: number;
    maxMemoryUsage: number;
    maxCpuUtilization: number;
  };
  errors: {
    total: number;
    byType: {
      failedNodes: number;
      hookFailures: number;
      webSocketDisconnections: number;
      uncaughtExceptions: number;
    };
  };
  stability: {
    uptime: number;
    serviceAvailability: number;
    errorRate: number;
  };
  recommendations: string[];
}

class ProductionMonitor {
  private report: MonitoringReport;
  private metricsHistory: any[] = [];
  private healthHistory: any[] = [];
  private serverProcess: any;

  constructor() {
    this.report = {
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0,
      environment: 'production',
      healthChecks: [],
      metrics: {
        snapshots: [],
        summary: {}
      },
      alerts: {},
      performance: {
        averageApiResponseTime: 0,
        averageMemoryUsage: 0,
        averageCpuUtilization: 0,
        maxMemoryUsage: 0,
        maxCpuUtilization: 0
      },
      errors: {
        total: 0,
        byType: {
          failedNodes: 0,
          hookFailures: 0,
          webSocketDisconnections: 0,
          uncaughtExceptions: 0
        }
      },
      stability: {
        uptime: 0,
        serviceAvailability: 0,
        errorRate: 0
      },
      recommendations: []
    };
  }

  async start() {
    console.log('🚀 Starting Production Monitoring...');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Duration: ${MONITORING_DURATION}ms`);

    // Ensure report directory exists
    await fs.mkdir(REPORT_DIR, { recursive: true });

    // Start the production server if not already running
    if (!await this.isServerRunning()) {
      await this.startProductionServer();
    }

    // Wait for server to be ready
    await this.waitForServer();

    // Start monitoring
    await this.runMonitoring();

    // Generate report
    await this.generateReport();

    // Stop server if we started it
    if (this.serverProcess) {
      this.stopProductionServer();
    }

    console.log('✅ Monitoring Complete');
  }

  private async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async startProductionServer() {
    console.log('⚠️ Starting production server...');
    
    this.serverProcess = spawn('npm', ['run', 'build'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });

    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for build

    this.serverProcess = spawn('npm', ['run', 'start'], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
    });

    this.serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[SERVER] ${data.toString().trim()}`);
    });

    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });
  }

  private stopProductionServer() {
    if (this.serverProcess) {
      console.log('⚠️ Stopping production server...');
      this.serverProcess.kill('SIGTERM');
    }
  }

  private async waitForServer(maxAttempts = 30) {
    console.log('Waiting for server to be ready...');
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${BASE_URL}/api/health`);
        if (response.ok) {
          console.log('✅ Server is ready!');
          return;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Server failed to start');
  }

  private async runMonitoring() {
    const startTime = Date.now();
    const checkInterval = 5000; // Check every 5 seconds
    const iterations = Math.floor(MONITORING_DURATION / checkInterval);

    console.log(`\n📊 Monitoring for ${MONITORING_DURATION / 1000} seconds...\n`);

    for (let i = 0; i < iterations; i++) {
      const progress = ((i + 1) / iterations * 100).toFixed(0);
      process.stdout.write(`\rProgress: ${this.createProgressBar(parseInt(progress))} ${progress}%`);

      await this.collectMetrics();
      await this.checkHealth();
      await this.checkAlerts();
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.log('\n');
    this.report.duration = Date.now() - startTime;
    this.report.endTime = new Date().toISOString();
  }

  private createProgressBar(percentage: number): string {
    const width = 30;
    const filled = Math.floor(width * percentage / 100);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private async collectMetrics() {
    try {
      const response = await fetch(`${BASE_URL}/api/monitoring?action=snapshot`);
      if (response.ok) {
        const snapshot = await response.json();
        this.metricsHistory.push(snapshot);
        this.updatePerformanceMetrics(snapshot);
        this.updateErrorMetrics(snapshot);
      }
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error);
    }
  }

  private async checkHealth() {
    try {
      const response = await fetch(`${BASE_URL}/api/health?verbose=true`);
      const health = await response.json();
      this.healthHistory.push(health);
    } catch (error) {
      console.error('❌ Failed to check health:', error);
    }
  }

  private async checkAlerts() {
    try {
      const response = await fetch(`${BASE_URL}/api/monitoring/alerts`);
      if (response.ok) {
        const alerts = await response.json();
        this.report.alerts = alerts;
      }
    } catch (error) {
      console.error('❌ Failed to check alerts:', error);
    }
  }

  private updatePerformanceMetrics(snapshot: any) {
    if (snapshot.performance) {
      // Update max values
      if (snapshot.performance.memoryUsage > this.report.performance.maxMemoryUsage) {
        this.report.performance.maxMemoryUsage = snapshot.performance.memoryUsage;
      }
      if (snapshot.performance.cpuUtilization > this.report.performance.maxCpuUtilization) {
        this.report.performance.maxCpuUtilization = snapshot.performance.cpuUtilization;
      }
    }
  }

  private updateErrorMetrics(snapshot: any) {
    if (snapshot.errors) {
      this.report.errors.byType.failedNodes += snapshot.errors.failedNodes || 0;
      this.report.errors.byType.hookFailures += snapshot.errors.hookFailures || 0;
      this.report.errors.byType.webSocketDisconnections += snapshot.errors.webSocketDisconnections || 0;
      this.report.errors.byType.uncaughtExceptions += snapshot.errors.uncaughtExceptions || 0;
    }
  }

  private calculateAverages() {
    if (this.metricsHistory.length === 0) return;

    const totalApiResponseTime = this.metricsHistory.reduce((sum, s) => 
      sum + (s.performance?.apiResponseTime || 0), 0);
    const totalMemoryUsage = this.metricsHistory.reduce((sum, s) => 
      sum + (s.performance?.memoryUsage || 0), 0);
    const totalCpuUtilization = this.metricsHistory.reduce((sum, s) => 
      sum + (s.performance?.cpuUtilization || 0), 0);

    const count = this.metricsHistory.length;
    this.report.performance.averageApiResponseTime = totalApiResponseTime / count;
    this.report.performance.averageMemoryUsage = totalMemoryUsage / count;
    this.report.performance.averageCpuUtilization = totalCpuUtilization / count;
  }

  private calculateStability() {
    // Calculate uptime percentage
    const healthyChecks = this.healthHistory.filter(h => h.status === 'healthy').length;
    const totalChecks = this.healthHistory.length;
    this.report.stability.uptime = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;

    // Calculate service availability
    const servicesHealthy = this.metricsHistory.filter(m => 
      m.health?.servicesHealthy === true).length;
    this.report.stability.serviceAvailability = 
      this.metricsHistory.length > 0 ? (servicesHealthy / this.metricsHistory.length) * 100 : 0;

    // Calculate error rate
    this.report.errors.total = Object.values(this.report.errors.byType)
      .reduce((sum, count) => sum + count, 0);
    
    const totalOperations = this.metricsHistory.reduce((sum, m) => 
      sum + (m.realTime?.activeExecutions || 0), 0);
    
    this.report.stability.errorRate = totalOperations > 0 ? 
      (this.report.errors.total / totalOperations) * 100 : 0;
  }

  private generateRecommendations() {
    const recommendations = [];

    // Performance recommendations
    if (this.report.performance.averageApiResponseTime > 500) {
      recommendations.push('⚡ API response time is high. Consider optimizing database queries and implementing caching.');
    }

    if (this.report.performance.maxMemoryUsage > 800) {
      recommendations.push('💾 Memory usage peaked above 800MB. Review for memory leaks and optimize data structures.');
    }

    if (this.report.performance.averageCpuUtilization > 70) {
      recommendations.push('🖥️ CPU usage is high. Consider optimizing algorithms or scaling horizontally.');
    }

    // Stability recommendations
    if (this.report.stability.uptime < 99) {
      recommendations.push('🔧 Service uptime is below 99%. Investigate health check failures.');
    }

    if (this.report.stability.errorRate > 5) {
      recommendations.push('❌ Error rate exceeds 5%. Review error logs and implement better error handling.');
    }

    // Error-specific recommendations
    if (this.report.errors.byType.failedNodes > 10) {
      recommendations.push('📝 High number of failed nodes. Review node execution logic and dependencies.');
    }

    if (this.report.errors.byType.webSocketDisconnections > 5) {
      recommendations.push('🌐 Multiple WebSocket disconnections detected. Check network stability and implement reconnection logic.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ System is performing well within expected parameters.');
    }

    this.report.recommendations = recommendations;
  }

  private async generateReport() {
    console.log('\n📄 Generating Report...\n');

    // Calculate final metrics
    this.calculateAverages();
    this.calculateStability();
    this.generateRecommendations();

    // Add snapshots and health checks to report
    this.report.metrics.snapshots = this.metricsHistory.slice(-10); // Last 10 snapshots
    this.report.healthChecks = this.healthHistory.slice(-5); // Last 5 health checks

    // Save report
    const reportPath = path.join(REPORT_DIR, 'phase8-production-monitoring.json');
    await fs.writeFile(reportPath, JSON.stringify(this.report, null, 2));

    // Display summary
    this.displaySummary();

    console.log(`\n✅ Report saved to: ${reportPath}`);
  }

  private displaySummary() {
    console.log('\n=== MONITORING SUMMARY ===\n');

    // Performance
    console.log('📊 Performance Metrics:');
    console.log(`  • Avg API Response: ${this.report.performance.averageApiResponseTime.toFixed(2)}ms`);
    console.log(`  • Avg Memory Usage: ${this.report.performance.averageMemoryUsage.toFixed(2)}MB`);
    console.log(`  • Avg CPU Usage: ${this.report.performance.averageCpuUtilization.toFixed(2)}%`);
    console.log(`  • Max Memory: ${this.report.performance.maxMemoryUsage.toFixed(2)}MB`);
    console.log(`  • Max CPU: ${this.report.performance.maxCpuUtilization.toFixed(2)}%`);

    // Stability
    console.log('\n🛡️ Stability Metrics:');
    console.log(`  • Uptime: ${this.report.stability.uptime.toFixed(2)}%`);
    console.log(`  • Service Availability: ${this.report.stability.serviceAvailability.toFixed(2)}%`);
    console.log(`  • Error Rate: ${this.report.stability.errorRate.toFixed(2)}%`);

    // Errors
    console.log('\n❌ Error Summary:');
    console.log(`  • Total Errors: ${this.report.errors.total}`);
    console.log(`  • Failed Nodes: ${this.report.errors.byType.failedNodes}`);
    console.log(`  • Hook Failures: ${this.report.errors.byType.hookFailures}`);
    console.log(`  • WebSocket Disconnections: ${this.report.errors.byType.webSocketDisconnections}`);
    console.log(`  • Uncaught Exceptions: ${this.report.errors.byType.uncaughtExceptions}`);

    // Alerts
    if (this.report.alerts.total > 0) {
      console.log('\n🔔 Alerts:');
      console.log(`  • Total: ${this.report.alerts.total}`);
      console.log(`  • Active: ${this.report.alerts.active}`);
      console.log(`  • Resolved: ${this.report.alerts.resolved}`);
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    this.report.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });

    // Overall Status
    const isHealthy = this.report.stability.uptime >= 99 && 
                     this.report.stability.errorRate < 5 &&
                     this.report.performance.averageApiResponseTime < 500;

    console.log('\n📋 Overall Status:');
    if (isHealthy) {
      console.log('  ✅ System is healthy and performing well');
    } else {
      console.log('  ⚠️ System requires attention - review recommendations');
    }
  }
}

// Run monitoring
const monitor = new ProductionMonitor();
monitor.start().catch(error => {
  console.error('❌ Monitoring failed:', error);
  process.exit(1);
});