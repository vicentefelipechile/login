// =========================================================================
// vitest.config.mts
// Test runner configuration.
// Uses vmForks pool (pure vitest — no Cloudflare bindings needed for unit tests).
// All unit tests in src/**/*.test.ts are self-contained pure-function tests.
// For integration tests against real D1/KV, use wrangler dev + manual testing.
// =========================================================================
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run each test file in its own isolated worker fork
    pool: 'vmForks',

    // Only pick up colocated test files — never ui/ or migrations/
    include: ['src/**/*.test.ts'],
    exclude: ['src/ui/**'],

    // Show each test name in the output, not just pass/fail counts
    // reporter: 'verbose',

    // Coverage report (run with: vitest --coverage)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.test.ts'],
      exclude: ['src/**/*.ts', 'src/ui/**'],
    },
  },
})
