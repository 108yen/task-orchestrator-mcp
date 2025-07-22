# Copilot Instructions for task-orchestrator-mcp

## Documentation Structure

This project follows a structured documentation approach. For comprehensive project understanding, refer to:

### Core Documentation

- **Requirements**: `.kiro/specs/task-management-mcp-server/requirements.md` - Functional requirements and use cases
- **Design**: `.kiro/specs/task-management-mcp-server/design.md` - Architecture and system design
- **Tasks**: `.kiro/specs/task-management-mcp-server/tasks.md` - Implementation tasks and priorities

### Steering Documents

- **Product**: `.kiro/steering/product.md` - Product vision and strategy
- **Technical**: `.kiro/steering/tech.md` - Technical decisions and architecture principles
- **Structure**: `.kiro/steering/structure.md` - Project organization and conventions

## Quick Reference

### Core Architecture

- **Entry Point**: `src/index.ts` → `bin/index.js` (CLI executable)
- **MCP Server**: `src/server.ts` - Single server instance with tool registration
- **Tools Layer**: `src/tools.ts` - Registers 7 main tools
- **Business Logic**: `src/task.ts` - Hierarchical task operations with auto-completion
- **Storage**: `src/storage.ts` - Dual-mode storage (file-based or in-memory)

### Critical Workflow Pattern

The `createTask` tool enforces a mandatory workflow:

1. Create task → 2. Call `startTask` → 3. Work → 4. Call `completeTask` → 5. Repeat if next task assigned

## Development Workflows

**Refer to `.kiro/steering/tech.md` for detailed technical guidelines and architecture decisions.**

### Build System

- **Primary build**: `pnpm build` uses `tsdown` (not tsc) → outputs CJS+ESM to `dist/`
- **Test runner**: Vitest with V8 coverage, includes integration tests with MCP client simulation
- **Quality gate**: `pnpm quality` = format + lint + typecheck + test (run before commits)

### Git Hooks (Lefthook)

- **pre-commit**: Prettier (priority 1) → ESLint with auto-fix (priority 2)
- **commit-msg**: Commitlint validation
- **post-merge**: Auto `pnpm install` on lockfile changes

### Key Scripts

- `pnpm start`: Runs built server directly (`node .`)
- `pnpm test:ui`: Interactive test UI with coverage visualization
- `pnpm lint:inspect`: Opens ESLint config inspector
- `pnpm release:canary`: Snapshot release with canary tag

## Testing Patterns

**For complete testing strategy, see `.kiro/specs/task-management-mcp-server/design.md`.**

### Integration Test Structure (`test/integration/`)

- **shared.ts**: MCP client setup, test environment management, response parsing utilities
- **workflow.test.ts**: Complex hierarchy scenarios, auto-completion edge cases
- **hierarchy.test.ts**: Parent-child relationship validation
- **basic-operations.test.ts**: CRUD operations testing

### Test Environment

- Uses actual MCP client via `@modelcontextprotocol/sdk` to test tool interactions
- `setupTestEnvironment()` helper manages test isolation
- `createTestTask()` utility for consistent test data creation

## Project Conventions

**For complete project structure and conventions, refer to `.kiro/steering/structure.md`.**

### Error Handling

- Tools return structured JSON responses with `isError: true` for failures
- Error objects follow `{ code: string, message: string }` format
- Storage operations use try-catch with console.error fallbacks

### Code Organization

- **Single responsibility**: Each file has clear purpose (server setup, tool registration, business logic, storage)
- **Interface-first**: TypeScript interfaces define contracts (Task, HierarchySummary, ProgressSummary)
- **Functional style**: Pure functions for business logic, side effects isolated to storage layer

### Dependencies

- **Runtime**: Only MCP SDK + Zod for validation
- **Dev tooling**: Comprehensive ESLint config, Prettier, TypeScript, Vitest, tsdown builder
- **Package management**: pnpm with exact version locking (`packageManager` field)

## MCP-Specific Considerations

**For complete MCP implementation details, see `.kiro/specs/task-management-mcp-server/requirements.md`.**

- Server registers tools at startup via `registerTools()` - tools are not dynamically added
- All tool responses must follow MCP content format: `{ content: [{ type: "text", text: string }] }`
- Uses stdio transport exclusively - no HTTP/WebSocket variants
- Tool schemas use Zod for runtime validation and automatic JSON Schema generation

## Common Pitfalls to Avoid

1. **Don't skip `startTask`** - The workflow expects explicit task state transitions
2. **Validate parentId existence** - `createTask` throws if parent doesn't exist
3. **Handle Date serialization** - File storage requires Date ↔ string conversion
4. **Order conflicts** - System auto-resolves but be aware of sibling reordering
5. **Memory vs File mode** - Check `FILE_PATH` env var behavior in tests vs production
