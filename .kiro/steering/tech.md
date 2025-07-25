# Technology Stack

## Core Technologies

- **TypeScript**: Primary language with strict type checking
- **Node.js**: Runtime environment (>=18.0.0)
- **MCP SDK**: `@modelcontextprotocol/sdk` for Model Context Protocol implementation

## Build System & Tools

- **tsdown**: TypeScript bundler for building both CJS and ESM formats
- **pnpm**: Package manager (v10.12.4)
- **tsx**: TypeScript execution for development

## Code Quality & Linting

- **ESLint**: Comprehensive linting with custom configuration
- **Prettier**: Code formatting
- **TypeScript**: Strict compiler settings with advanced options
- **Lefthook**: Git hooks for quality checks
- **Commitlint**: Conventional commit message enforcement

## Testing

- **Vitest**: Test runner with coverage support
- **@vitest/ui**: Interactive test UI
- **@vitest/coverage-v8**: Code coverage reporting

## Common Commands

### Development

```bash
pnpm install          # Install dependencies
pnpm build           # Build the project
pnpm start           # Run the built application
pnpm typecheck       # Type checking without emit
```

### Quality Assurance

```bash
pnpm lint            # Run ESLint with zero warnings policy
pnpm lint:fix        # Auto-fix linting issues
pnpm format          # Format code with Prettier
pnpm quality         # Run all quality checks (format, lint, typecheck, test)
```

### Testing

```bash
pnpm test            # Run tests
pnpm test:ui         # Run tests with UI
pnpm test:coverage   # Run tests with coverage report
```

### Release

```bash
pnpm release:canary  # Publish canary release
pnpm release         # Publish stable release
```

## Configuration Notes

- Uses flat ESLint config with TypeScript integration
- Supports both file-based and in-memory storage via `FILE_PATH` environment variable
- Builds to both CommonJS and ESM formats for maximum compatibility

## Technical Decisions

### Task Execution Order Validation

**Decision**: Implement strict execution order validation in `startTask` function to enforce sequential task completion within the same hierarchy level.

**Rationale**:

- Prevents workflow inconsistencies by ensuring tasks are completed in the intended order
- Improves user experience by providing clear guidance on which tasks need to be completed first
- Maintains data integrity in complex hierarchical task structures

**Implementation Details**:

- Validation occurs before any status changes are made
- Error messages include detailed information about blocking tasks
- Performance impact is minimal as it only involves array filtering operations on sibling tasks
- Consistent with existing order-based execution logic throughout the system
