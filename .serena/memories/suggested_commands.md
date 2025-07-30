# Development Commands

## Essential Development Commands

### Setup & Build

```bash
pnpm install          # Install dependencies
pnpm build            # Build the project using tsdown
pnpm start            # Run the built application
```

### Development & Testing

```bash
pnpm dev              # Run with MCP inspector for debugging
pnpm test             # Run all tests
pnpm test:ui          # Interactive test UI with coverage
pnpm test:coverage    # Generate coverage report
```

### Code Quality (Run before commits)

```bash
pnpm quality          # Complete quality check: format + lint + typecheck + test
pnpm format           # Format code with Prettier
pnpm format:check     # Check formatting without changes
pnpm lint             # Run ESLint with zero warnings policy
pnpm lint:fix         # Auto-fix linting issues
pnpm typecheck        # TypeScript type checking
```

### Git & Release Management

```bash
pnpm prepare          # Install lefthook git hooks (automatic)
pnpm release:canary   # Publish canary release with snapshot
pnpm release          # Publish stable release
```

### Utility Commands

```bash
pnpm lint:inspect     # Open ESLint config inspector UI
```

## System Commands (macOS/Darwin)

```bash
ls -la                # List files with details
find . -name "*.ts"   # Find TypeScript files
grep -r "pattern"     # Search for patterns
cd /path/to/dir       # Change directory
git status            # Check git status
git log --oneline     # View commit history
```

## Environment Variables

- `FILE_PATH`: Set to JSON file path for persistent storage (optional, defaults to in-memory)
- `NODE_ENV`: Set to "test" for test environment
