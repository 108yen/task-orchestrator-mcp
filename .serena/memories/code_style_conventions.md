# Code Style and Conventions

## TypeScript Configuration

- **Strict Mode**: All strict TypeScript settings enabled
- **Target**: ESNext for modern JavaScript features
- **Module System**: ESNext with verbatim module syntax
- **Advanced Checks**: noUncheckedIndexedAccess, noImplicitOverride enabled

## Code Style Guidelines

### Naming Conventions

- **Files**: kebab-case for file names (e.g., `task-orchestrator.ts`)
- **Functions**: camelCase for function names
- **Types/Interfaces**: PascalCase for type definitions
- **Constants**: UPPER_SNAKE_CASE for constants

### File Organization

- **Co-location**: Test files next to source files with `.test.ts` suffix
- **Single Responsibility**: Each file has clear, focused purpose
- **Interface-First**: TypeScript interfaces define contracts
- **Functional Style**: Pure functions for business logic, side effects isolated

### Import/Export Patterns

- **Named exports**: Prefer named exports over default exports
- **Module path mapping**: Use relative imports for local modules
- **Type imports**: Use `import type` for type-only imports

## ESLint Rules (Zero Warnings Policy)

- **Import organization**: Automatic sorting and unused import removal
- **Perfectionist**: Alphabetical sorting of object properties and imports
- **TypeScript-specific**: Comprehensive TypeScript linting rules
- **Prettier integration**: Automatic code formatting

## Error Handling Patterns

- **Structured responses**: Tools return JSON with `isError: true` for failures
- **Error format**: `{ code: string, message: string }` structure
- **Storage operations**: Try-catch with console.error fallbacks
- **Validation**: Zod schemas for runtime type validation

## Testing Conventions

- **Vitest**: Primary test runner
- **Mocking**: Use `vi.mock()` for module mocking
- **Integration tests**: Separate `test/integration/` directory
- **Test data**: Use utility functions like `createTestTask()`
- **Coverage**: Aim for comprehensive test coverage

## Documentation

- **JSDoc**: Document public APIs and complex functions
- **README**: Keep README.md updated with usage examples
- **Comments**: Explain business logic and complex algorithms
