# React Testing Library Setup - Complete ✅

## Installation Summary

Successfully installed and configured React Testing Library with Vitest for the OpsiMate client application.

### Packages Installed

```bash
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
vitest
@vitest/ui
jsdom
```

## Configuration Files

### 1. `vitest.config.ts`

Vitest configuration with:

- React plugin (SWC)
- jsdom environment
- Path aliases (`@/` and `@OpsiMate/shared`)
- Setup file registration

### 2. `src/test/setup.ts`

Global test setup including:

- `@testing-library/jest-dom` matchers
- Automatic cleanup after each test
- `window.matchMedia` mock for theme provider

### 3. `src/test/test-utils.tsx`

Custom render function with providers:

- QueryClientProvider (React Query)
- ThemeProvider
- BrowserRouter (React Router)

## Test Scripts

Added to `package.json`:

```json
{
  "test": "vitest", // Watch mode
  "test:ui": "vitest --ui", // UI mode
  "test:run": "vitest run", // Single run
  "test:coverage": "vitest run --coverage"
}
```

## Example Tests Created

### 1. Dashboard Component Test

`src/components/Dashboard/Dashboard.test.tsx`

- Tests rendering with mocked hooks
- Tests loading states
- Tests service display

### 2. FilterPanel Component Test

`src/components/Dashboard/FilterPanel/FilterPanel.test.tsx`

- Tests expanded/collapsed modes
- Tests filter selection
- Tests reset functionality
- Tests active filter count

### 3. useServiceFilters Hook Test

`src/components/Dashboard/useServiceFilters.test.tsx`

- Tests initialization
- Tests URL parameter handling
- Tests filter changes
- Tests view application

## Running Tests

```bash
# Watch mode - runs tests as you change files
pnpm test

# Run once
pnpm test:run

# Interactive UI
pnpm test:ui

# With coverage report
pnpm test:coverage
```

## Writing New Tests

### Component Test Template

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MyComponent } from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Hook Test Template

```typescript
import { renderHook } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('returns expected value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe('expected');
  });
});
```

## File Structure

```
src/
├── test/
│   ├── setup.ts              # Global setup
│   ├── test-utils.tsx        # Custom render
│   └── README.md             # Testing guide
└── components/
    └── Dashboard/
        ├── Dashboard.tsx
        ├── Dashboard.test.tsx           # Test next to component
        ├── useServiceFilters.ts
        ├── useServiceFilters.test.tsx   # Test next to hook
        └── FilterPanel/
            ├── FilterPanel.tsx
            └── FilterPanel.test.tsx     # Test next to component
```

## Best Practices

1. **Use test-utils render** - Always import from `@/test/test-utils` for automatic provider wrapping
2. **Test user behavior** - Focus on what users see and do, not implementation details
3. **Use accessible queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
4. **Mock external dependencies** - Use `vi.mock()` for API calls and complex dependencies
5. **Clean test names** - Write descriptive test descriptions that explain what's being tested

## Troubleshooting

### Import Errors

- Check path aliases in `vitest.config.ts`
- Ensure you're using `@/` prefix for absolute imports

### Mock Not Working

- Place `vi.mock()` calls before imports
- Check mock implementation matches actual interface

### Test Timeout

- Increase timeout: `it('test', async () => {...}, 10000)`
- Use `waitFor` for async operations

## Documentation

Full testing guide available at: `src/test/README.md`

## Status

✅ Setup complete
✅ Configuration files created
✅ Example tests written
✅ Test scripts added
✅ matchMedia mock configured
✅ Documentation created

Ready to write tests for all components and pages!
