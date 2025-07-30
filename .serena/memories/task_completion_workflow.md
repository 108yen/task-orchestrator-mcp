# Task Completion Workflow

## What to do when a task is completed

### 1. Quality Gate (MANDATORY)

Run the complete quality check before any commit:

```bash
pnpm quality
```

This executes in sequence:

- `pnpm format` - Format code with Prettier
- `pnpm lint:fix` - Fix ESLint issues automatically
- `pnpm typecheck` - Verify TypeScript types
- `pnpm test` - Run all tests

### 2. Git Workflow

The project uses Lefthook for automated quality checks:

#### Pre-commit (automatic)

- **Prettier** (priority 1): Formats staged files
- **ESLint** (priority 2): Lints and auto-fixes staged files
- Both tools automatically stage fixed files

#### Commit Message

- **Commitlint**: Enforces conventional commit format
- Use format: `type(scope): description`
- Examples: `feat: add new task validation`, `fix: resolve storage issue`

#### Post-merge (automatic)

- **Auto-install**: Runs `pnpm install` if package files changed

### 3. Testing Requirements

- All tests must pass (zero tolerance for failing tests)
- Maintain or improve code coverage
- Integration tests must pass with MCP client simulation
- Unit tests should cover new functionality

### 4. Code Quality Standards

- **Zero ESLint warnings**: Must maintain clean linting
- **TypeScript strict**: No type errors allowed
- **Formatted code**: Prettier must pass without changes

### 5. Build Verification

Ensure the project builds successfully:

```bash
pnpm build
```

### 6. Release Process (when applicable)

For releases:

```bash
pnpm release:canary  # For testing releases
pnpm release         # For stable releases
```

## Critical Workflow Pattern

For MCP server functionality, maintain the mandatory workflow:

1. Create task → 2. Call `startTask` → 3. Work → 4. Call `completeTask` → 5. Repeat if next task assigned

## File Changes Checklist

- [ ] Run `pnpm quality` and ensure it passes
- [ ] Verify build works with `pnpm build`
- [ ] Update tests if functionality changed
- [ ] Update documentation if public API changed
- [ ] Follow conventional commit message format
