# Contributing to OpsiMate

Thank you for your interest in contributing to OpsiMate! This guide will help you get started with development and understand our contribution process.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Getting Help](#getting-help)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v9.12.0 or higher)
- **Docker** and **Docker Compose** (for containerized development)
- **Git**

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/opsimate.git
cd opsimate
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Choose Your Development Method

#### Option A: Local Development
```bash
# Build the project
pnpm run build

# Start development servers
pnpm run dev
```

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:3001`

#### Option B: Docker Development
```bash
# Start with Docker (recommended for full-stack development)
pnpm run start:docker
```

This will:
- Create necessary data directories
- Set up configuration files
- Build and start the complete stack in Docker

### 4. Verify Setup

Visit `http://localhost:8080` to confirm the application is running correctly.

## Project Structure

OpsiMate uses a monorepo structure managed by Turbo:

```
opsimate/
├── apps/
│   ├── client/          # Frontend application
│   └── server/          # Backend API
├── packages/            # Shared packages
├── data/               # Persistent data (generated)
├── config.yml          # Application configuration
├── docker-compose.yml  # Docker setup
├── start.sh           # Docker startup script
└── turbo.json         # Turbo configuration
```

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start development servers |
| `pnpm run build` | Build all packages |
| `pnpm run start` | Start production server |
| `pnpm run debug` | Start in debug mode |
| `pnpm run lint` | Check code quality |
| `pnpm run lint-fix` | Fix linting issues |
| `pnpm run test` | Run test suite |
| `pnpm run clean` | Clean build artifacts |
| `pnpm run format` | Format code with Prettier |
| `pnpm run start:docker` | Start with Docker |

### Making Changes

1. **Create a branch** for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following our code standards

3. **Test your changes**:
   ```bash
   pnpm run test
   pnpm run lint
   ```

4. **Commit your changes** with a descriptive message:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Convention

We follow conventional commits format:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## Code Standards

### Code Quality

- Run `pnpm run lint` before committing
- Use `pnpm run format` to format code consistently
- Follow TypeScript best practices
- Write meaningful variable and function names
- Add comments for complex logic

### File Organization

- Place shared utilities in the `packages/` directory
- Keep component files organized by feature
- Use barrel exports (`index.ts`) for clean imports
- Follow the existing directory structure

### Configuration

- Environment-specific settings go in `config.yml`
- Use TypeScript for type safety
- Validate configuration at startup

## Testing

### Running Tests

```bash
# Run all tests
pnpm run test

# Run tests for specific package
pnpm --filter @OpsiMate/server test
```

### Writing Tests

- Write unit tests for new functions and components
- Include integration tests for API endpoints
- Test edge cases and error conditions
- Aim for good test coverage

## Submitting Changes

### Pull Request Process

1. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub with:
   - Clear title describing the change
   - Detailed description of what was changed and why
   - Reference any related issues (`Fixes #123`)
   - Screenshots for UI changes

3. **Ensure your PR**:
   - ✅ Passes all CI checks
   - ✅ Includes appropriate tests
   - ✅ Updates documentation if needed
   - ✅ Follows code standards

### Review Process

- All PRs require at least one review
- Address feedback promptly
- Keep discussions constructive and professional
- Update your branch if needed:
  ```bash
  git checkout main
  git pull upstream main
  git checkout your-branch
  git rebase main
  ```

## Docker Development

### Working with Docker

The Docker setup provides:
- Consistent development environment
- Automatic data directory setup
- Configuration management
- Easy cleanup and reset

### Common Docker Commands

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop and remove containers
docker compose down

# Rebuild and restart
docker compose up --build -d

# Access container shell
docker compose exec server bash
```

## Getting Help

- **Documentation**: Check the `/docs` directory
- **Issues**: Search existing [GitHub Issues](https://github.com/opsimate/opsimate/issues)
- **Discussions**: Use [GitHub Discussions](https://github.com/opsimate/opsimate/discussions) for questions
- **Discord**: Join our community Discord server (link in README)

## Code of Conduct

Please be respectful and professional in all interactions. We're committed to providing a welcoming environment for all contributors.

## License

By contributing to OpsiMate, you agree that your contributions will be licensed under the same license as the project.

---

**Ready to contribute?** Start by looking at issues labeled `good first issue` or `help wanted`!

Thank you for helping make OpsiMate better! 🚀