# Task Orchestrator MCP Server - Project Overview

## Purpose

`task-orchestrator-mcp` is a Model Context Protocol (MCP) server that provides a set of tools for managing hierarchical tasks. It enables AI assistants to perform CRUD operations on tasks and manage their progress with persistent storage.

## Key Features

- Task creation, management, and status tracking
- Hierarchical task organization with parent-child relationships
- Flexible storage options (file-based or in-memory)
- MCP protocol compliance for AI assistant integration
- Task ordering and resolution tracking
- Automatic parent task status management
- Task execution order validation

## Architecture

- **Entry Point**: `src/index.ts` → `bin/index.js` (CLI executable)
- **MCP Server**: `src/server.ts` - Single server instance with tool registration
- **Tools Layer**: `src/tools.ts` - Registers 7 main tools
- **Business Logic**: `src/task.ts` - Hierarchical task operations with auto-completion
- **Storage**: `src/storage.ts` - Dual-mode storage (file-based or in-memory)

## Main Tools

- `createTask`: Create a new task
- `getTasks`: Retrieve all tasks
- `getTask`: Retrieve a task by specified ID
- `updateTask`: Update a task by specified ID
- `deleteTask`: Delete a task by specified ID
- `startTask`: Start a task (change status to 'in_progress')
- `completeTask`: Complete a task and find the next task to execute
