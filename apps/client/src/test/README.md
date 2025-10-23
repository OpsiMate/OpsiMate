# Testing Guide

This directory contains the testing setup and utilities for the OpsiMate client application.

## Setup

The project uses:

- **Vitest** - Fast unit test framework
- **React Testing Library** - Testing utilities for React components
- **@testing-library/jest-dom** - Custom matchers for better assertions
- **@testing-library/user-event** - User interaction simulation

## Running Tests

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## File Structure

```
src/
├── test/
│   ├── setup.ts          # Global test setup
│   ├── test-utils.tsx    # Custom render function with providers
│   └── README.md         # This file
└── components/
    └── Dashboard/
        ├── Dashboard.tsx
        ├── Dashboard.test.tsx     # Test file next to component
        ├── useServiceFilters.ts
        └── useServiceFilters.test.tsx
```

## Writing Tests

### Component Tests

Place test files next to the component they test:

```typescript
// MyComponent.test.tsx (next to MyComponent.tsx)
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/test-utils'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Hook Tests

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

### Using Test Utils

The `test-utils.tsx` file provides a custom render function that wraps components with necessary providers:

- QueryClientProvider (React Query)
- ThemeProvider
- BrowserRouter (React Router)

Use it instead of RTL's default render:

```typescript
import { render, screen } from '@/test/test-utils';
```

## Best Practices

1. **Test user behavior, not implementation details**
    - Query by accessible roles/labels
    - Avoid testing internal state

2. **Use meaningful test descriptions**

    ```typescript
    it('displays error message when form submission fails', () => {
    	// test code
    });
    ```

3. **Mock external dependencies**

    ```typescript
    vi.mock('@/hooks/queries', () => ({
    	useServices: vi.fn().mockReturnValue({ data: [] }),
    }));
    ```

4. **Clean up after tests**
    - The setup file automatically cleans up after each test
    - Use `beforeEach` and `afterEach` for test-specific setup

5. **Test accessibility**
    - Use accessible queries: `getByRole`, `getByLabelText`
    - Ensure interactive elements are keyboard accessible

## Common Patterns

### Testing Async Behavior

```typescript
import { waitFor } from '@testing-library/react'

it('loads data', async () => {
  render(<MyComponent />)
  await waitFor(() => {
    expect(screen.getByText('Loaded!')).toBeInTheDocument()
  })
})
```

### Testing User Interactions

```typescript
import { fireEvent } from '@testing-library/react'

it('handles click', () => {
  const onClick = vi.fn()
  render(<Button onClick={onClick} />)

  fireEvent.click(screen.getByRole('button'))
  expect(onClick).toHaveBeenCalled()
})
```

### Testing Forms

```typescript
import userEvent from '@testing-library/user-event'

it('submits form', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<Form onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Name'), 'John')
  await user.click(screen.getByRole('button', { name: 'Submit' }))

  expect(onSubmit).toHaveBeenCalledWith({ name: 'John' })
})
```

## Example Tests

See the following files for examples:

- `components/Dashboard/Dashboard.test.tsx` - Component with hooks
- `components/Dashboard/FilterPanel/FilterPanel.test.tsx` - Interactive component
- `components/Dashboard/useServiceFilters.test.tsx` - Custom hook

## Troubleshooting

### Import Path Issues

If you see import errors, make sure:

1. The `vitest.config.ts` has correct path aliases
2. You're using `@/` prefix for absolute imports

### Mock Not Working

Ensure mocks are defined before imports:

```typescript
vi.mock('./module', () => ({...}))
import { Component } from './component'
```

### Test Timeout

Increase timeout for slow tests:

```typescript
it('slow test', async () => {
	// test code
}, 10000); // 10 seconds
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
