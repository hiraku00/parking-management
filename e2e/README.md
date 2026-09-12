# E2E Testing with Playwright

This document provides instructions for running and maintaining the E2E test suite.

## Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run tests with browser visible
npm run test:e2e:headed
```

## Test Placement and Naming

To avoid conflicts with the Vitest unit test runner (which may try to run E2E files), we use the following convention:

- **Directory**: `e2e/`
- **Extension**: `*.pw.ts` (Playwright-specific suffix)

Vitest is configured to ignore the `e2e/` directory, and by using the `.pw.ts` extension instead of `.spec.ts` or `.test.ts`, we ensure standard test runners don't pick them up by mistake.

## Test Coverage

### Contractor Flows ✅
- Login with valid credentials
- Login error handling
- Portal page display
- Payment success messages
- Payment error messages

### Owner Flows ⏭️
- Owner authentication tests are skipped by default
- Requires Supabase Auth account setup
- To enable: Set `TEST_OWNER_EMAIL` and `TEST_OWNER_PASSWORD` environment variables

## Adding New Tests

1. Create test files in the `e2e/` directory.
2. Use the `.pw.ts` extension.
3. Use existing tests as templates.
4. Follow Playwright best practices for selectors and assertions.

## CI Integration

E2E tests require a live database connection and are currently designed for local execution only. Future CI integration will require:
- Test database setup
- Environment variable configuration
- Playwright browser installation in CI environment

## Troubleshooting

If tests fail:
1. Ensure the development server is running (`npm run dev`).
2. Check that test data exists in the database (田中次郎 with phone 1234).
3. Review test output and screenshots in the `test-results/` directory.
4. Use `npm run test:e2e:ui` for interactive debugging.
