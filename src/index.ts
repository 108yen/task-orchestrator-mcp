import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { server } from "./server.js"
import { registerTools } from "./tools.js"

/**
 * Main entry point for the MCP server
 * Registers tools, starts the server, and connects to StdioServerTransport
 */
export async function run(): Promise<void> {
  // Register all task management tools
  registerTools()

  // Create and connect to StdioServerTransport
  const transport = new StdioServerTransport()

  // Connect the server to the transport
  await server.connect(transport)
}

// Execute the run function if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start MCP server:", error)
    process.exit(1)
  })
}
