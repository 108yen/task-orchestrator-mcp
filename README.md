# task-orchestrator-mcp

[![NPM Version](https://img.shields.io/npm/v/task-orchestrator-mcp)](https://www.npmjs.com/package/task-orchestrator-mcp)
[![codecov](https://codecov.io/gh/108yen/task-orchestrator-mcp/graph/badge.svg?token=7C4VJLGXX9)](https://codecov.io/gh/108yen/task-orchestrator-mcp)
[![MIT License](https://img.shields.io/github/license/108yen/task-orchestrator-mcp)](https://img.shields.io/github/license/108yen/task-orchestrator-mcp)

`task-orchestrator-mcp` is an MCP (Model Context Protocol) server that provides a set of tools for managing tasks. It enables agents to perform CRUD operations on tasks and manage their progress.

## Features

The main tools provided by `task-orchestrator-mcp` are as follows:

| Tool Name    | Description                                       |
| ------------ | ------------------------------------------------- |
| createTask   | Create a new task                                 |
| getTasks     | Retrieve all tasks                                |
| getTask      | Retrieve a task by specified ID                   |
| updateTask   | Update a task by specified ID                     |
| deleteTask   | Delete a task by specified ID                     |
| startTask    | Start a task (change status to 'in_progress')     |
| completeTask | Complete a task and find the next task to execute |

## Usage

`DB_PATH` is optional. (default: `task.json`)

```json
{
  "mcpServers": {
    "task-orchestrator-mcp": {
      "command": "npx",
      "args": ["-y", "task-orchestrator-mcp"],
      "env": {
        "DB_PATH": "path/to/json_file.json"
      }
    }
  }
}
```

### VS Code Installation Instructions

For quick installation, use one of the one-click installation buttons below:

[![Install with NPX in VS Code](https://img.shields.io/badge/VS_Code-NPM-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=task-orchestrator-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22task-orchestrator-mcp%22%5D%7D)

For manual installation, add the following JSON block to your User Settings (JSON) file in VS Code. You can do this by pressing `Ctrl + Shift + P` and typing `Preferences: Open Settings (JSON)`.

Optionally, you can add it to a file called `.vscode/mcp.json` in your workspace. This will allow you to share the configuration with others.

```json
{
  "servers": {
    "canary": {
      "command": "npx",
      "args": ["-y", "task-orchestrator-mcp"]
    }
  }
}
```
