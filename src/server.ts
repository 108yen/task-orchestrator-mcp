import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * MCP Server instance for task management
 * Configured with project information and ready for tool registration
 */
export const server = new McpServer(
  {
    description:
      "A Model Context Protocol server for task management and orchestration",
    name: "task-orchestrator-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)
