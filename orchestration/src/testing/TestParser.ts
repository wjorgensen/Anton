export interface TestResult {
  framework: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration: number;
  testSuites: TestSuite[];
  failures: TestFailure[];
  coverage?: Coverage;
  timestamp: Date;
}

export interface TestSuite {
  name: string;
  file?: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: IndividualTest[];
}

export interface IndividualTest {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  error?: TestError;
  assertions?: number;
}

export interface TestError {
  message: string;
  stack?: string;
  expected?: string;
  actual?: string;
  diff?: string;
}

export interface TestFailure {
  testName: string;
  suiteName: string;
  file?: string;
  error: TestError;
  line?: number;
  column?: number;
}

export interface Coverage {
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches?: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions?: {
    total: number;
    covered: number;
    percentage: number;
  };
}

abstract class BaseParser {
  abstract parse(output: string, exitCode?: number): TestResult;
  
  protected extractStackTrace(stack: string): { file?: string; line?: number; column?: number } {
    const match = stack.match(/at.*\((.*):(\d+):(\d+)\)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10)
      };
    }
    return {};
  }

  protected calculatePercentage(covered: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((covered / total) * 100);
  }
}

class JestParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'jest',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse JSON output if available (jest --json)
    if (output.includes('{"numFailedTestSuites"')) {
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          return this.parseJsonOutput(jsonData);
        }
      } catch (e) {
        // Fall back to text parsing
      }
    }

    // Parse text output
    const lines = output.split('\n');
    
    // Extract summary
    const summaryMatch = output.match(/Tests:\s+(\d+) failed, (\d+) passed(?:, (\d+) skipped)?(?:, (\d+) total)?/);
    if (summaryMatch) {
      result.failed = parseInt(summaryMatch[1], 10);
      result.passed = parseInt(summaryMatch[2], 10);
      result.skipped = summaryMatch[3] ? parseInt(summaryMatch[3], 10) : 0;
      result.total = summaryMatch[4] ? parseInt(summaryMatch[4], 10) : 
                     result.passed + result.failed + result.skipped;
    }

    // Extract duration
    const timeMatch = output.match(/Time:\s+([\d.]+)s/);
    if (timeMatch) {
      result.duration = parseFloat(timeMatch[1]) * 1000;
    }

    // Extract test suites and failures
    const failureRegex = /● (.+) › (.+)\n\n([\s\S]+?)(?=\n● |\n\nTest Suites:|\n\nSnapshot Summary:|$)/g;
    let match;
    while ((match = failureRegex.exec(output)) !== null) {
      const [, suiteName, testName, errorDetails] = match;
      
      const error: TestError = {
        message: errorDetails.trim().split('\n')[0]
      };

      // Extract stack trace
      const stackMatch = errorDetails.match(/at .+/g);
      if (stackMatch) {
        error.stack = stackMatch.join('\n');
        const location = this.extractStackTrace(error.stack);
        
        result.failures.push({
          testName,
          suiteName,
          error,
          file: location.file,
          line: location.line,
          column: location.column
        });
      } else {
        result.failures.push({
          testName,
          suiteName,
          error
        });
      }
    }

    // Parse coverage if present
    const coverageMatch = output.match(/All files.*?\|([\d.]+)\s*\|([\d.]+)\s*\|([\d.]+)\s*\|([\d.]+)/);
    if (coverageMatch) {
      result.coverage = {
        lines: {
          total: 100,
          covered: parseFloat(coverageMatch[2]),
          percentage: parseFloat(coverageMatch[2])
        },
        branches: {
          total: 100,
          covered: parseFloat(coverageMatch[3]),
          percentage: parseFloat(coverageMatch[3])
        },
        functions: {
          total: 100,
          covered: parseFloat(coverageMatch[4]),
          percentage: parseFloat(coverageMatch[4])
        }
      };
    }

    return result;
  }

  private parseJsonOutput(jsonData: any): TestResult {
    const result: TestResult = {
      framework: 'jest',
      passed: jsonData.numPassedTests || 0,
      failed: jsonData.numFailedTests || 0,
      skipped: jsonData.numPendingTests || 0,
      total: jsonData.numTotalTests || 0,
      duration: jsonData.testResults?.reduce((sum: number, r: any) => 
        sum + (r.perfStats?.runtime || 0), 0) || 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse test results
    if (jsonData.testResults) {
      for (const suite of jsonData.testResults) {
        const testSuite: TestSuite = {
          name: suite.testFilePath || suite.name,
          file: suite.testFilePath,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: suite.perfStats?.runtime || 0,
          tests: []
        };

        if (suite.testResults) {
          for (const test of suite.testResults) {
            const status = test.status as 'passed' | 'failed' | 'skipped' | 'pending';
            
            testSuite.tests.push({
              name: test.title,
              status,
              duration: test.duration
            });

            if (status === 'passed') testSuite.passed++;
            else if (status === 'failed') testSuite.failed++;
            else testSuite.skipped++;

            if (status === 'failed' && test.failureMessages?.length > 0) {
              result.failures.push({
                testName: test.title,
                suiteName: suite.testFilePath || suite.name,
                file: suite.testFilePath,
                error: {
                  message: test.failureMessages[0],
                  stack: test.failureDetails?.[0]?.stack
                }
              });
            }
          }
        }

        result.testSuites.push(testSuite);
      }
    }

    // Parse coverage
    if (jsonData.coverageMap) {
      const coverage = jsonData.coverageMap;
      const summary = coverage.getCoverageSummary?.() || coverage;
      
      if (summary.lines) {
        result.coverage = {
          lines: {
            total: summary.lines.total,
            covered: summary.lines.covered,
            percentage: summary.lines.pct
          },
          branches: {
            total: summary.branches.total,
            covered: summary.branches.covered,
            percentage: summary.branches.pct
          },
          functions: {
            total: summary.functions.total,
            covered: summary.functions.covered,
            percentage: summary.functions.pct
          }
        };
      }
    }

    return result;
  }
}

class PytestParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'pytest',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse JSON output if available (pytest --json-report)
    if (output.includes('"pytest_json_report"')) {
      try {
        const jsonData = JSON.parse(output);
        return this.parseJsonOutput(jsonData);
      } catch (e) {
        // Fall back to text parsing
      }
    }

    // Parse text output
    const lines = output.split('\n');
    
    // Extract summary
    const summaryMatch = output.match(/=+ ([\d]+) passed(?:, ([\d]+) skipped)?(?:, ([\d]+) failed)?(?:, ([\d]+) error)?.*in ([\d.]+)s/);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[1] || '0', 10);
      result.skipped = parseInt(summaryMatch[2] || '0', 10);
      result.failed = parseInt(summaryMatch[3] || '0', 10) + parseInt(summaryMatch[4] || '0', 10);
      result.total = result.passed + result.failed + result.skipped;
      result.duration = parseFloat(summaryMatch[5]) * 1000;
    }

    // Extract failures
    const failureSection = output.match(/=+ FAILURES =+([\s\S]+?)(?==+ |$)/);
    if (failureSection) {
      const failureBlocks = failureSection[1].split(/_{3,} \w+ _{3,}/);
      
      for (const block of failureBlocks) {
        if (!block.trim()) continue;
        
        const testMatch = block.match(/def (test_\w+)|^(test_\w+)/);
        const errorMatch = block.match(/E\s+(.+)/);
        const fileMatch = block.match(/(\S+\.py):(\d+):/);
        
        if (testMatch && errorMatch) {
          const failure: TestFailure = {
            testName: testMatch[1] || testMatch[2],
            suiteName: fileMatch ? fileMatch[1] : 'unknown',
            error: {
              message: errorMatch[1],
              stack: block
            }
          };
          
          if (fileMatch) {
            failure.file = fileMatch[1];
            failure.line = parseInt(fileMatch[2], 10);
          }
          
          result.failures.push(failure);
        }
      }
    }

    // Parse coverage if present
    const coverageMatch = output.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);
    if (coverageMatch) {
      const percentage = parseInt(coverageMatch[1], 10);
      result.coverage = {
        lines: {
          total: 100,
          covered: percentage,
          percentage
        }
      };
    }

    return result;
  }

  private parseJsonOutput(jsonData: any): TestResult {
    const result: TestResult = {
      framework: 'pytest',
      passed: jsonData.summary?.passed || 0,
      failed: jsonData.summary?.failed || 0,
      skipped: jsonData.summary?.skipped || 0,
      total: jsonData.summary?.total || 0,
      duration: jsonData.duration * 1000 || 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse test results
    if (jsonData.tests) {
      const suiteMap = new Map<string, TestSuite>();
      
      for (const test of jsonData.tests) {
        const suiteName = test.nodeid.split('::')[0];
        
        if (!suiteMap.has(suiteName)) {
          suiteMap.set(suiteName, {
            name: suiteName,
            file: suiteName,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            tests: []
          });
        }
        
        const suite = suiteMap.get(suiteName)!;
        const status = test.outcome as 'passed' | 'failed' | 'skipped';
        
        suite.tests.push({
          name: test.nodeid.split('::').slice(1).join('::'),
          status,
          duration: test.duration * 1000
        });
        
        suite.duration += test.duration * 1000;
        
        if (status === 'passed') suite.passed++;
        else if (status === 'failed') suite.failed++;
        else suite.skipped++;
        
        if (status === 'failed' && test.call?.longrepr) {
          result.failures.push({
            testName: test.nodeid,
            suiteName,
            file: suiteName,
            error: {
              message: test.call.longrepr,
              stack: test.call.longrepr
            }
          });
        }
      }
      
      result.testSuites = Array.from(suiteMap.values());
    }

    return result;
  }
}

class GoTestParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'go test',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    const lines = output.split('\n');
    const suiteMap = new Map<string, TestSuite>();
    
    for (const line of lines) {
      // Parse test results
      const testMatch = line.match(/^(PASS|FAIL|SKIP):\s+(\S+)\s+\(([^)]+)\)/);
      if (testMatch) {
        const [, status, testPath, duration] = testMatch;
        const packageName = testPath.split('/').pop() || testPath;
        
        if (!suiteMap.has(packageName)) {
          suiteMap.set(packageName, {
            name: packageName,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            tests: []
          });
        }
        
        const suite = suiteMap.get(packageName)!;
        const durationMs = this.parseDuration(duration);
        suite.duration = durationMs;
        
        if (status === 'PASS') {
          result.passed++;
          suite.passed++;
        } else if (status === 'FAIL') {
          result.failed++;
          suite.failed++;
        }
      }
      
      // Parse individual test results
      const individualMatch = line.match(/^(---)\s+(PASS|FAIL|SKIP):\s+(\S+)\s+\(([^)]+)\)/);
      if (individualMatch) {
        const [, , status, testName, duration] = individualMatch;
        const durationMs = this.parseDuration(duration);
        
        // Find the appropriate suite
        for (const suite of suiteMap.values()) {
          const testStatus = status === 'PASS' ? 'passed' : 
                           status === 'FAIL' ? 'failed' : 'skipped';
          
          suite.tests.push({
            name: testName,
            status: testStatus,
            duration: durationMs
          });
          
          if (status === 'FAIL') {
            result.failures.push({
              testName,
              suiteName: suite.name,
              error: {
                message: `Test ${testName} failed`
              }
            });
          }
          break;
        }
      }
      
      // Parse coverage
      const coverageMatch = line.match(/coverage:\s+([\d.]+)%/);
      if (coverageMatch) {
        const percentage = parseFloat(coverageMatch[1]);
        result.coverage = {
          lines: {
            total: 100,
            covered: percentage,
            percentage
          }
        };
      }
    }
    
    result.testSuites = Array.from(suiteMap.values());
    result.total = result.passed + result.failed + result.skipped;
    
    return result;
  }
  
  private parseDuration(duration: string): number {
    const match = duration.match(/([\d.]+)([a-z]+)/);
    if (!match) return 0;
    
    const [, value, unit] = match;
    const num = parseFloat(value);
    
    switch (unit) {
      case 's': return num * 1000;
      case 'ms': return num;
      case 'µs': case 'us': return num / 1000;
      case 'ns': return num / 1000000;
      default: return num;
    }
  }
}

class PlaywrightParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'playwright',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse JSON reporter output if available
    if (output.includes('"stats":')) {
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          return this.parseJsonOutput(jsonData);
        }
      } catch (e) {
        // Fall back to text parsing
      }
    }

    // Parse text output
    const summaryMatch = output.match(/(\d+) passed(?:.*?(\d+) failed)?(?:.*?(\d+) skipped)?.*?\(([\d.]+)[ms]\)/);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[1], 10);
      result.failed = parseInt(summaryMatch[2] || '0', 10);
      result.skipped = parseInt(summaryMatch[3] || '0', 10);
      result.total = result.passed + result.failed + result.skipped;
      
      const durationStr = summaryMatch[4];
      result.duration = durationStr.includes('s') ? 
        parseFloat(durationStr) * 1000 : 
        parseFloat(durationStr);
    }

    // Extract failures
    const failureBlocks = output.match(/\d+\) .+\n[\s\S]+?(?=\n\d+\)|$)/g);
    if (failureBlocks) {
      for (const block of failureBlocks) {
        const headerMatch = block.match(/\d+\) (.+) › (.+)/);
        const errorMatch = block.match(/Error: (.+)/);
        const fileMatch = block.match(/at (.+):(\d+):(\d+)/);
        
        if (headerMatch && errorMatch) {
          const [, suiteName, testName] = headerMatch;
          const failure: TestFailure = {
            testName,
            suiteName,
            error: {
              message: errorMatch[1],
              stack: block
            }
          };
          
          if (fileMatch) {
            failure.file = fileMatch[1];
            failure.line = parseInt(fileMatch[2], 10);
            failure.column = parseInt(fileMatch[3], 10);
          }
          
          result.failures.push(failure);
        }
      }
    }

    return result;
  }

  private parseJsonOutput(jsonData: any): TestResult {
    const result: TestResult = {
      framework: 'playwright',
      passed: jsonData.stats?.expected || 0,
      failed: jsonData.stats?.unexpected || 0,
      skipped: jsonData.stats?.skipped || 0,
      total: jsonData.stats?.total || 0,
      duration: jsonData.stats?.duration || 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    if (jsonData.suites) {
      for (const suite of jsonData.suites) {
        const testSuite: TestSuite = {
          name: suite.title || suite.file,
          file: suite.file,
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0,
          tests: []
        };

        if (suite.specs) {
          for (const spec of suite.specs) {
            for (const test of spec.tests || []) {
              const status = test.status as 'passed' | 'failed' | 'skipped';
              
              testSuite.tests.push({
                name: spec.title,
                status,
                duration: test.duration
              });

              testSuite.duration += test.duration || 0;

              if (status === 'passed') testSuite.passed++;
              else if (status === 'failed') testSuite.failed++;
              else testSuite.skipped++;

              if (status === 'failed' && test.results?.[0]?.error) {
                result.failures.push({
                  testName: spec.title,
                  suiteName: suite.title || suite.file,
                  file: suite.file,
                  error: {
                    message: test.results[0].error.message,
                    stack: test.results[0].error.stack
                  }
                });
              }
            }
          }
        }

        result.testSuites.push(testSuite);
      }
    }

    return result;
  }
}

class CypressParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'cypress',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse Cypress output
    const summaryMatch = output.match(/Specs:\s+(\d+) found.*?Tests:\s+(\d+) passed(?:, (\d+) failed)?(?:, (\d+) pending)?/s);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[2], 10);
      result.failed = parseInt(summaryMatch[3] || '0', 10);
      result.skipped = parseInt(summaryMatch[4] || '0', 10);
      result.total = result.passed + result.failed + result.skipped;
    }

    // Extract duration
    const durationMatch = output.match(/Duration:\s+([\d:]+)/);
    if (durationMatch) {
      const parts = durationMatch[1].split(':');
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      result.duration = (minutes * 60 + seconds) * 1000;
    }

    // Parse spec results
    const specBlocks = output.match(/Running:\s+(.+?)\n[\s\S]+?(?=Running:|$)/g);
    if (specBlocks) {
      for (const block of specBlocks) {
        const specMatch = block.match(/Running:\s+(.+)/);
        const testsMatch = block.match(/(\d+) passing(?:.*?(\d+) failing)?(?:.*?(\d+) pending)?/);
        
        if (specMatch && testsMatch) {
          const suite: TestSuite = {
            name: specMatch[1],
            file: specMatch[1],
            passed: parseInt(testsMatch[1], 10),
            failed: parseInt(testsMatch[2] || '0', 10),
            skipped: parseInt(testsMatch[3] || '0', 10),
            duration: 0,
            tests: []
          };
          
          // Extract individual test failures
          const failureMatches = block.matchAll(/\d+\) (.+)\n/g);
          for (const match of failureMatches) {
            result.failures.push({
              testName: match[1],
              suiteName: suite.name,
              file: suite.file,
              error: {
                message: `Test failed: ${match[1]}`
              }
            });
          }
          
          result.testSuites.push(suite);
        }
      }
    }

    return result;
  }
}

class VitestParser extends BaseParser {
  parse(output: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework: 'vitest',
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Parse Vitest output
    const summaryMatch = output.match(/Test Files\s+(\d+) passed(?:.*?(\d+) failed)?.*?Tests\s+(\d+) passed(?:.*?(\d+) failed)?(?:.*?(\d+) skipped)?/s);
    if (summaryMatch) {
      result.passed = parseInt(summaryMatch[3], 10);
      result.failed = parseInt(summaryMatch[4] || '0', 10);
      result.skipped = parseInt(summaryMatch[5] || '0', 10);
      result.total = result.passed + result.failed + result.skipped;
    }

    // Extract duration
    const durationMatch = output.match(/Duration\s+([\d.]+)ms/);
    if (durationMatch) {
      result.duration = parseFloat(durationMatch[1]);
    }

    // Parse failures
    const failureSection = output.match(/⎯+ Failed Tests \d+ ⎯+([\s\S]+?)(?=⎯+|$)/);
    if (failureSection) {
      const failureBlocks = failureSection[1].split(/FAIL\s+/);
      
      for (const block of failureBlocks) {
        if (!block.trim()) continue;
        
        const fileMatch = block.match(/^(.+?)\s+>/);
        const testMatch = block.match(/× (.+)/);
        const errorMatch = block.match(/Error: (.+)/);
        
        if (fileMatch && testMatch && errorMatch) {
          result.failures.push({
            testName: testMatch[1],
            suiteName: fileMatch[1],
            file: fileMatch[1],
            error: {
              message: errorMatch[1],
              stack: block
            }
          });
        }
      }
    }

    return result;
  }
}

export class UniversalTestParser {
  private parsers: Map<string, BaseParser> = new Map();
  
  constructor() {
    this.parsers.set('jest', new JestParser());
    this.parsers.set('pytest', new PytestParser());
    this.parsers.set('go', new GoTestParser());
    this.parsers.set('playwright', new PlaywrightParser());
    this.parsers.set('cypress', new CypressParser());
    this.parsers.set('vitest', new VitestParser());
  }

  parse(output: string, framework?: string, exitCode?: number): TestResult {
    // Try to detect framework if not specified
    if (!framework) {
      framework = this.detectFramework(output);
    }

    const parser = this.parsers.get(framework);
    if (!parser) {
      return this.genericParse(output, framework || 'unknown', exitCode);
    }

    try {
      return parser.parse(output, exitCode);
    } catch (error) {
      console.error(`Error parsing ${framework} output:`, error);
      return this.genericParse(output, framework, exitCode);
    }
  }

  private detectFramework(output: string): string {
    if (output.includes('PASS') && output.includes('Test Suites:')) return 'jest';
    if (output.includes('pytest') || output.includes('=== test session starts ===')) return 'pytest';
    if (output.match(/^(PASS|FAIL):\s+\S+\s+\(/m)) return 'go';
    if (output.includes('[chromium]') || output.includes('[webkit]') || output.includes('[firefox]')) return 'playwright';
    if (output.includes('(Run Starting)') && output.includes('cypress')) return 'cypress';
    if (output.includes('VITEST') || output.includes('Test Files')) return 'vitest';
    
    return 'unknown';
  }

  private genericParse(output: string, framework: string, exitCode?: number): TestResult {
    const result: TestResult = {
      framework,
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      duration: 0,
      testSuites: [],
      failures: [],
      timestamp: new Date()
    };

    // Try to extract basic information
    const lines = output.split('\n');
    const passedMatch = output.match(/(\d+)\s+(?:test[s]?|spec[s]?|scenario[s]?)\s+pass/i);
    const failedMatch = output.match(/(\d+)\s+(?:test[s]?|spec[s]?|scenario[s]?)\s+fail/i);
    const skippedMatch = output.match(/(\d+)\s+(?:test[s]?|spec[s]?|scenario[s]?)\s+skip/i);

    if (passedMatch) result.passed = parseInt(passedMatch[1], 10);
    if (failedMatch) result.failed = parseInt(failedMatch[1], 10);
    if (skippedMatch) result.skipped = parseInt(skippedMatch[1], 10);

    result.total = result.passed + result.failed + result.skipped;

    // If no tests found but exit code indicates failure
    if (result.total === 0 && exitCode && exitCode !== 0) {
      result.failed = 1;
      result.total = 1;
      result.failures.push({
        testName: 'Test execution',
        suiteName: framework,
        error: {
          message: `Test execution failed with exit code ${exitCode}`,
          stack: output
        }
      });
    }

    return result;
  }

  addParser(framework: string, parser: BaseParser): void {
    this.parsers.set(framework, parser);
  }

  getSupportedFrameworks(): string[] {
    return Array.from(this.parsers.keys());
  }
}