# Technology Stack

## Core Technologies

- **TypeScript**: Primary language with strict type checking
- **Node.js**: Runtime environment (>=18.0.0)
- **MCP SDK**: `@modelcontextprotocol/sdk` for Model Context Protocol implementation
- **Zod**: Runtime validation for tool schemas

## Build System & Tools

- **tsdown**: TypeScript bundler for building both CJS and ESM formats
- **pnpm**: Package manager (v10.12.4)
- **tsx**: TypeScript execution for development

## Code Quality & Development Tools

- **ESLint**: Comprehensive linting with flat config and zero warnings policy
- **Prettier**: Code formatting with automatic git hook integration
- **TypeScript**: Strict compiler settings with advanced options
- **Lefthook**: Git hooks for quality checks (prettier → eslint → commitlint)
- **Commitlint**: Conventional commit message enforcement

## Testing Framework

- **Vitest**: Test runner with V8 coverage support
- **@vitest/ui**: Interactive test UI with coverage visualization
- **Integration tests**: Uses actual MCP client simulation

## Storage

- **Dual-mode storage**: File-based (JSON) or in-memory based on `FILE_PATH` environment variable
- **Task model**: Hierarchical structure with nested `tasks` arrays
- **UUID-based identifiers**: Each task has unique string ID

## Build Output

- **CommonJS + ESM**: Dual format output for maximum compatibility
- **CLI executable**: `bin/index.js` for command-line usage
- **Source maps**: Generated for debugging support
