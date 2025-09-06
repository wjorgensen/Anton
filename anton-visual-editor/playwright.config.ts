import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-reports/html' }],
    ['json', { outputFile: 'test-reports/visual-regression.json' }],
    ['list']
  ],
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:4005',
    trace: 'on-first-retry',
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 }
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['iPad'],
        viewport: { width: 768, height: 1024 }
      },
    },
  ],

  webServer: process.env.FRONTEND_URL ? undefined : {
    command: 'PORT=4005 npm run dev',
    url: 'http://localhost:4005',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});