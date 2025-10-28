# Linting and Code Quality Guide

This project uses **ESLint** and **Prettier** to enforce code quality and consistent formatting.

## 🎯 Code Quality Rules

### Your Specific Requirements ✅

- **Semicolons**: Enforced on every line (`semi: "always"`)
- **File Length**: Maximum 300 lines per file (`max-lines: 300`)
- **Empty Lines**: Maximum 1 empty line between functions (`no-multiple-empty-lines: 1`)
- **React Components**: Only functional components allowed (`react/prefer-function-component`)

### Additional Quality Rules

- **Function Length**: Maximum 50 lines per function
- **Parameters**: Maximum 4 parameters per function
- **Complexity**: Maximum complexity of 10
- **Nesting**: Maximum 4 levels deep
- **Callbacks**: Maximum 3 nested callbacks

## 🛠️ Available Commands

```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint-fix

# Format code with Prettier
npm run format

# Check formatting without fixing
npm run format-check

# Format and fix linting in one command
npm run format-fix
```

## 📋 Pre-commit Checklist

Before committing, run:

```bash
npm run format-fix
```

This will:

1. Format your code with Prettier
2. Fix ESLint issues automatically
3. Ensure consistent code style

## 🔧 Editor Integration

### VS Code

Install these extensions:

- **ESLint** (`ms-vscode.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)

The project includes `.vscode/settings.json` for automatic formatting on save.

### Other Editors

- **WebStorm/IntelliJ**: Enable ESLint and Prettier plugins
- **Sublime Text**: Install SublimeLinter-eslint and JsPrettier
- **Vim/Neovim**: Use ALE or coc.nvim with ESLint and Prettier

## 📏 Code Style Examples

### ✅ Good Examples

```typescript
// Functional component with arrow function
const MyComponent = ({ title, onClick }: Props) => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(prev => prev + 1);
    onClick?.(count);
  };

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleClick}>Count: {count}</button>
    </div>
  );
};
```

### ❌ Bad Examples

```typescript
// Class component (not allowed)
class MyComponent extends React.Component {
  render() {
    return <div>Hello</div>;
  }
}

// Missing semicolons
const name = 'John'
const age = 25

// Too many empty lines
function myFunction() {



  return 'hello';
}

// Too many parameters
const badFunction = (a, b, c, d, e, f) => {
  return a + b + c + d + e + f;
};
```

## 🚨 Common Issues and Fixes

### Semicolon Issues

```typescript
// ❌ Missing semicolon
const name = "John";

// ✅ Correct
const name = "John";
```

### File Too Long

If a file exceeds 300 lines:

1. Extract components into separate files
2. Move utility functions to separate modules
3. Split large components into smaller ones

### Too Many Empty Lines

```typescript
// ❌ Too many empty lines
function func1() {
  return "hello";
}

function func2() {
  return "world";
}

// ✅ Correct
function func1() {
  return "hello";
}

function func2() {
  return "world";
}
```

## 🔍 Rule Explanations

| Rule                              | Purpose                        | Example             |
| --------------------------------- | ------------------------------ | ------------------- |
| `semi: "always"`                  | Enforces semicolons            | `const x = 1;`      |
| `max-lines: 300`                  | Limits file size               | Split large files   |
| `no-multiple-empty-lines: 1`      | Controls spacing               | Max 1 empty line    |
| `react/prefer-function-component` | Enforces functional components | Use arrow functions |
| `max-lines-per-function: 50`      | Limits function size           | Extract logic       |
| `complexity: 10`                  | Limits code complexity         | Simplify logic      |

## 🎨 Prettier Configuration

- **Semicolons**: Always
- **Quotes**: Single quotes
- **Trailing Commas**: ES5 style
- **Print Width**: 100 characters
- **Tab Width**: 2 spaces
- **Bracket Spacing**: Always

## 🚀 Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Run linting:

   ```bash
   pnpm run lint
   ```

3. Fix issues automatically:
   ```bash
   pnpm run format-fix
   ```

## 📚 Additional Resources

- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [React ESLint Plugin](https://github.com/jsx-eslint/eslint-plugin-react)
- [TypeScript ESLint](https://typescript-eslint.io/)
