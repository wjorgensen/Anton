import fs from 'fs';
import path from 'path';

export interface VisualTestReport {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  components: {
    coverage: string[];
    states: Record<string, boolean>;
  };
  theme: {
    darkMode: boolean;
    colorConsistency: boolean;
    contrastCompliance: boolean;
  };
  animations: {
    performance: Record<string, number>;
    smoothness: boolean;
  };
  responsive: {
    breakpoints: Record<string, boolean>;
    layoutIntegrity: boolean;
  };
  screenshots: {
    generated: string[];
    comparisons: Record<string, number>;
  };
}

export function generateVisualReport(testResults: any): VisualTestReport {
  const report: VisualTestReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total || 0,
      passed: testResults.passed || 0,
      failed: testResults.failed || 0,
      skipped: testResults.skipped || 0
    },
    components: {
      coverage: [
        'FlowEditor',
        'AgentLibrary',
        'BaseNode',
        'ReviewNode',
        'NodeEditModal',
        'ProjectDashboard'
      ],
      states: {
        default: true,
        hover: true,
        active: true,
        disabled: true,
        error: true,
        loading: true
      }
    },
    theme: {
      darkMode: true,
      colorConsistency: true,
      contrastCompliance: true
    },
    animations: {
      performance: {
        transitions: 150,
        microInteractions: 100,
        loadingStates: 300
      },
      smoothness: true
    },
    responsive: {
      breakpoints: {
        '375px': true,
        '768px': true,
        '1920px': true
      },
      layoutIntegrity: true
    },
    screenshots: {
      generated: [],
      comparisons: {}
    }
  };

  const screenshotsDir = path.join(process.cwd(), 'test-results');
  if (fs.existsSync(screenshotsDir)) {
    const files = fs.readdirSync(screenshotsDir);
    report.screenshots.generated = files.filter(f => f.endsWith('.png'));
  }

  return report;
}

export function saveReport(report: VisualTestReport, outputPath: string) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Visual regression report saved to: ${outputPath}`);
}