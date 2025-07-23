import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { beforeAll, beforeEach } from "vitest"
import { server } from "../../src/server.js"
import { clearTasks } from "../../src/storage.js"
import { registerTools } from "../../src/tools.js"

// Helper type for MCP tool responses
export interface MCPResponse {
  content?: { text: string; type: string }[]
  isError?: boolean
}

// Helper function to safely parse MCP response
export function parseMCPResponse(response: MCPResponse): any {
  if (!response.content?.[0]?.text) {
    throw new Error("Invalid MCP response format")
  }
  return JSON.parse(response.content[0].text)
}

// Shared client instance
export const client = new Client({
  name: "test client",
  version: "0.1.0",
})

// Setup MCP connection
export async function setupMCPConnection() {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  registerTools()
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])
}

// Clear all tasks helper function
export function clearAllTasks() {
  // Use the direct storage clear function for reliable test isolation
  clearTasks()
}

// Helper function to create test tasks
export async function createTestTask(
  name: string,
  parentId?: string,
  description?: string,
  insertIndex?: number,
) {
  const result = (await client.callTool({
    arguments: {
      name,
      ...(description && { description }),
      ...(parentId && { parentId: parentId }),
      ...(insertIndex !== undefined && { insertIndex }),
    },
    name: "createTask",
  })) as MCPResponse

  const response = parseMCPResponse(result)

  // If there's an error, throw it to make tests fail clearly
  if (response.error) {
    throw new Error(`createTestTask failed: ${response.error.message}`)
  }

  return response.task
}

// Helper function to setup common test environment
export function setupTestEnvironment() {
  beforeAll(async () => {
    await setupMCPConnection()
  })

  beforeEach(() => {
    clearAllTasks()
  })
}
