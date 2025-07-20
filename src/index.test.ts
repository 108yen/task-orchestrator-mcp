import { describe, expect, it, vi } from "vitest"
import { run } from "./index.js"

// Mock the StdioServerTransport and server
vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    // Mock transport methods if needed
  })),
}))

vi.mock("./server.js", () => ({
  server: {
    connect: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("./tools.js", () => ({
  registerTools: vi.fn(),
}))

describe("index", () => {
  it("should start the server successfully", async () => {
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    )
    const { server } = await import("./server.js")
    const { registerTools } = await import("./tools.js")

    await expect(run()).resolves.toBeUndefined()

    // Verify that tools were registered
    expect(registerTools).toHaveBeenCalledOnce()

    // Verify that StdioServerTransport was created
    expect(StdioServerTransport).toHaveBeenCalledOnce()

    // Verify that server.connect was called
    expect(server.connect).toHaveBeenCalledOnce()
  })

  it("should handle startup errors gracefully", async () => {
    const { server } = await import("./server.js")

    // Mock server.connect to throw an error
    vi.mocked(server.connect).mockRejectedValueOnce(
      new Error("Connection failed"),
    )

    await expect(run()).rejects.toThrow("Connection failed")
  })
})
