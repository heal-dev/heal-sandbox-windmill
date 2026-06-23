import { defineConfig, devices } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const FRONTEND_URL = process.env.WINDMILL_FRONTEND_URL ?? 'http://localhost:3000'
const BACKEND_URL = process.env.WINDMILL_BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
  testDir: './e2e',
  timeout: 600_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['@heal-dev/heal-playwright-tracer/reporter'],
  ],
  ...({
    '@playwright/test': {
      babelPlugins: [
        [
          require.resolve('@heal-dev/heal-playwright-tracer/code-hook-injector'),
          { include: [/\/e2e\//] },
        ],
      ],
    },
  } as any),
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on',
    video: 'on',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 90_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],
  // The Windmill stack is brought up out-of-band by sandbox/scripts/infra-up.sh
  // (docker compose); Playwright simply assumes the URLs above are healthy.
})
