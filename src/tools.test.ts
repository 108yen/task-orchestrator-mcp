import { beforeEach, describe, expect, it, vi } from "vitest"
import { server } from "./server.js"
import { registerTools } from "./tools.js"

// Mock the server's registerTool method
vi.mock("./server.js", () => ({
  server: {
    registerTool: vi.fn(),
  },
}))

// Mock the task functions
vi.mock("./task.js", () => ({
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
  listTasks: vi.fn(),
  startTask: vi.fn(),
  updateTask: vi.fn(),
}))

describe("registerTools", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should register all task management tools", () => {
    registerTools()

    // Verify that registerTool was called 7 times (one for each tool)
    expect(server.registerTool).toHaveBeenCalledTimes(7)

    // Verify each tool was registered with correct name
    const registerToolCalls = (server.registerTool as any).mock.calls
    const toolNames = registerToolCalls.map((call: any) => call[0])

    expect(toolNames).toContain("createTask")
    expect(toolNames).toContain("getTask")
    expect(toolNames).toContain("listTasks")
    expect(toolNames).toContain("updateTask")
    expect(toolNames).toContain("deleteTask")
    expect(toolNames).toContain("startTask")
    expect(toolNames).toContain("completeTask")
  })

  it("should register createTask tool with correct configuration", () => {
    registerTools()

    const createTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "createTask",
    )

    expect(createTaskCall).toBeDefined()
    expect(createTaskCall[0]).toBe("createTask")
    expect(createTaskCall[1]).toMatchObject({
      description: expect.stringContaining(
        "Create a new task with optional parent and ordering",
      ),
      inputSchema: expect.objectContaining({
        description: expect.any(Object),
        name: expect.any(Object),
        order: expect.any(Object),
        parent_id: expect.any(Object),
      }),
    })
    expect(createTaskCall[2]).toBeTypeOf("function")
  })

  it("should register getTask tool with correct configuration", () => {
    registerTools()

    const getTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "getTask",
    )

    expect(getTaskCall).toBeDefined()
    expect(getTaskCall[0]).toBe("getTask")
    expect(getTaskCall[1]).toMatchObject({
      description: "Get a task by its ID",
      inputSchema: expect.objectContaining({
        id: expect.any(Object),
      }),
    })
    expect(getTaskCall[2]).toBeTypeOf("function")
  })

  it("should register listTasks tool with correct configuration", () => {
    registerTools()

    const listTasksCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "listTasks",
    )

    expect(listTasksCall).toBeDefined()
    expect(listTasksCall[0]).toBe("listTasks")
    expect(listTasksCall[1]).toMatchObject({
      description: "List tasks, optionally filtered by parent_id",
      inputSchema: expect.objectContaining({
        parent_id: expect.any(Object),
      }),
    })
    expect(listTasksCall[2]).toBeTypeOf("function")
  })

  it("should register updateTask tool with correct configuration", () => {
    registerTools()

    const updateTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "updateTask",
    )

    expect(updateTaskCall).toBeDefined()
    expect(updateTaskCall[0]).toBe("updateTask")
    expect(updateTaskCall[1]).toMatchObject({
      description: "Update an existing task",
      inputSchema: expect.objectContaining({
        description: expect.any(Object),
        id: expect.any(Object),
        name: expect.any(Object),
        order: expect.any(Object),
        parent_id: expect.any(Object),
        resolution: expect.any(Object),
        status: expect.any(Object),
      }),
    })
    expect(updateTaskCall[2]).toBeTypeOf("function")
  })

  it("should register deleteTask tool with correct configuration", () => {
    registerTools()

    const deleteTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "deleteTask",
    )

    expect(deleteTaskCall).toBeDefined()
    expect(deleteTaskCall[0]).toBe("deleteTask")
    expect(deleteTaskCall[1]).toMatchObject({
      description: "Delete a task by its ID",
      inputSchema: expect.objectContaining({
        id: expect.any(Object),
      }),
    })
    expect(deleteTaskCall[2]).toBeTypeOf("function")
  })

  it("should register startTask tool with correct configuration", () => {
    registerTools()

    const startTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "startTask",
    )

    expect(startTaskCall).toBeDefined()
    expect(startTaskCall[0]).toBe("startTask")
    expect(startTaskCall[1]).toMatchObject({
      description: expect.stringContaining(
        "Start a task (change status to in_progress)",
      ),
      inputSchema: expect.objectContaining({
        id: expect.any(Object),
      }),
    })
    expect(startTaskCall[2]).toBeTypeOf("function")
  })

  it("should register completeTask tool with correct configuration", () => {
    registerTools()

    const completeTaskCall = (server.registerTool as any).mock.calls.find(
      (call: any) => call[0] === "completeTask",
    )

    expect(completeTaskCall).toBeDefined()
    expect(completeTaskCall[0]).toBe("completeTask")
    expect(completeTaskCall[1]).toMatchObject({
      description: expect.stringContaining(
        "Complete a task and get the next task to execute",
      ),
      inputSchema: expect.objectContaining({
        id: expect.any(Object),
        resolution: expect.any(Object),
      }),
    })
    expect(completeTaskCall[2]).toBeTypeOf("function")
  })
})
