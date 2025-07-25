# Project Structure

## Root Directory Organization

```
├── src/                    # Source code
├── test/                   # Integration tests
├── bin/                    # Built executable files
├── dist/                   # Build output (generated)
├── @types/                 # Custom TypeScript declarations
├── .eslint/                # ESLint configuration modules
├── .changeset/             # Changeset configuration for releases
├── .kiro/                  # Kiro AI assistant configuration
├── .github/                # GitHub workflows and templates
└── node_modules/           # Dependencies (generated)
```

## Source Code Structure (`src/`)

- **`index.ts`**: Main entry point and MCP server implementation
- **`storage.ts`**: Task storage abstraction layer with file/memory backends
- **`*.test.ts`**: Test files co-located with source files

## Key Architectural Patterns

### Storage Abstraction

- Dual storage modes: file-based (`FILE_PATH` env var) or in-memory
- Centralized storage functions: `readTasks()` and `writeTasks()`
- Task interface with hierarchical relationships via nested `tasks` arrays

### Task Model

```typescript
interface Task {
  id: string // UUID identifier
  name: string // Task name
  description: string // Detailed description
  status: string // 'todo' | 'in_progress' | 'done'
  resolution?: string // Completion details
  tasks: Task[] // Nested subtasks array
}
```

## Configuration Files

- **`eslint.config.ts`**: Flat ESLint configuration with modular imports
- **`tsconfig.json`**: Strict TypeScript configuration
- **`vitest.config.ts`**: Test configuration with environment loading
- **`package.json`**: Project metadata and scripts
- **`.prettierrc`**: Code formatting rules

## Build Artifacts

- **`bin/`**: Executable files for CLI usage
- **`dist/`**: Compiled TypeScript output (CJS + ESM)
- Generated files should not be edited directly

## Development Conventions

- Co-locate test files with source files using `.test.ts` suffix
- Use strict TypeScript settings with comprehensive error checking
- Follow conventional commit messages
- Maintain zero ESLint warnings policy
