import { describe, expect, it } from "vitest"
import type { MCPResponse } from "./shared.js"
import {
  client,
  createTestTask,
  parseMCPResponse,
  setupTestEnvironment,
} from "./shared.js"

describe("Basic CRUD Operations Integration Tests", () => {
  setupTestEnvironment()

  describe("createTask", () => {
    it("should create a task with minimal parameters", async () => {
      const result = (await client.callTool({
        arguments: {
          name: "test task",
        },
        name: "createTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response).toHaveProperty("task")
      expect(response).toHaveProperty("message")
      expect(response.task).toEqual({
        description: "",
        id: expect.any(String),
        name: "test task",
        status: "todo",
        tasks: [],
      })
    })

    it("should create a task with all parameters", async () => {
      // First create a parent task
      const parentTask = await createTestTask(
        "parent task",
        undefined,
        "parent description",
      )

      const result = (await client.callTool({
        arguments: {
          description: "child description",
          insertIndex: 0,
          name: "child task",
          parentId: parentTask.id,
        },
        name: "createTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response).toHaveProperty("task")
      // For child tasks, there should not be a message
      expect(response.task).toEqual({
        description: "child description",
        id: expect.any(String),
        name: "child task",
        status: "todo",
        tasks: [],
      })
    })

    it("should assign order automatically if not provided", async () => {
      // Create first task, should be at index 0
      await createTestTask("task 1")

      // Get all tasks to verify position
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const listResponse = parseMCPResponse(listResult)

      expect(listResponse.tasks).toHaveLength(1)
      expect(listResponse.tasks[0].name).toBe("task 1")

      // Create second task, should be at index 1
      await createTestTask("task 2")

      const listResult2 = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const listResponse2 = parseMCPResponse(listResult2)

      expect(listResponse2.tasks).toHaveLength(2)
      expect(listResponse2.tasks[1].name).toBe("task 2")
    })

    it("should shift orders correctly on conflict", async () => {
      // Create task at specific position
      await createTestTask("task 1")
      await createTestTask("task 2")

      // Create a new task at index 0 (should shift others)
      const result3 = (await client.callTool({
        arguments: { insertIndex: 0, name: "task 3" },
        name: "createTask",
      })) as MCPResponse
      const task3 = parseMCPResponse(result3).task
      expect(task3.name).toBe("task 3")

      // Verify all tasks and their positions
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const { tasks } = parseMCPResponse(listResult)

      expect(tasks).toHaveLength(3)
      expect(tasks[0].name).toBe("task 3") // At index 0
      expect(tasks[1].name).toBe("task 1") // Shifted to index 1
      expect(tasks[2].name).toBe("task 2") // Shifted to index 2
    })

    it("should treat order = 0 as unspecified and assign to end", async () => {
      // Create some existing tasks
      await createTestTask("task 1")
      await createTestTask("task 2")
      await createTestTask("task 3")

      // Create task without insertIndex, should be added to the end
      const result0 = (await client.callTool({
        arguments: { name: "task at end" },
        name: "createTask",
      })) as MCPResponse
      parseMCPResponse(result0) // Just validate it was created

      // Verify it was added to the end
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const { tasks } = parseMCPResponse(listResult)

      expect(tasks).toHaveLength(4)
      expect(tasks[3].name).toBe("task at end") // Should be at the end
      expect(tasks[0].name).toBe("task 1")
      expect(tasks[1].name).toBe("task 2")
      expect(tasks[2].name).toBe("task 3")
    })

    it("should handle order = 0 with parent tasks correctly", async () => {
      // Create parent task
      const parent = await createTestTask("parent task")

      // Create child tasks
      await createTestTask("child 1", parent.id)
      await createTestTask("child 2", parent.id)
      await createTestTask("child 3", parent.id)

      // Create child without insertIndex, should be added to end
      const result0 = (await client.callTool({
        arguments: {
          name: "child at end",
          parentId: parent.id,
        },
        name: "createTask",
      })) as MCPResponse
      parseMCPResponse(result0) // Just validate creation

      // Verify all children are in the parent's tasks array
      const parentResult = (await client.callTool({
        arguments: { id: parent.id },
        name: "getTask",
      })) as MCPResponse
      const updatedParent = parseMCPResponse(parentResult).task

      expect(updatedParent.tasks).toHaveLength(4)
      expect(updatedParent.tasks[0].name).toBe("child 1")
      expect(updatedParent.tasks[1].name).toBe("child 2")
      expect(updatedParent.tasks[2].name).toBe("child 3")
      expect(updatedParent.tasks[3].name).toBe("child at end")
    })
  })

  describe("getTask", () => {
    it("should return error when task does not exist", async () => {
      const result = (await client.callTool({
        arguments: {
          id: "non-existent-id",
        },
        name: "getTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
        isError: true,
      })

      const response = parseMCPResponse(result)
      expect(response.error).toEqual({
        code: "TASK_NOT_FOUND",
        message: expect.any(String),
      })
    })

    it("should get a task by ID", async () => {
      const createdTask = await createTestTask(
        "test task",
        undefined,
        "test description",
      )

      const result = (await client.callTool({
        arguments: {
          id: createdTask.id,
        },
        name: "getTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.task).toEqual(createdTask)
    })
  })

  describe("listTasks", () => {
    it("should return empty array when no tasks exist", async () => {
      const result = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.tasks).toEqual([])
    })

    it("should get all tasks after creating multiple", async () => {
      await createTestTask("task 1")
      await createTestTask("task 2")

      const result = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.tasks).toHaveLength(2)
      expect(response.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "task 1" }),
          expect.objectContaining({ name: "task 2" }),
        ]),
      )
    })

    it("should filter tasks by parentId", async () => {
      // Create parent task
      const parentTask = await createTestTask("parent task")

      // Create child tasks
      await createTestTask("child 1", parentTask.id)
      await createTestTask("child 2", parentTask.id)

      // Create another top-level task
      await createTestTask("other task")

      const result = (await client.callTool({
        arguments: {
          parentId: parentTask.id,
        },
        name: "listTasks",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.tasks).toHaveLength(2)
      expect(response.tasks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "child 1",
          }),
          expect.objectContaining({
            name: "child 2",
          }),
        ]),
      )
    })
  })

  describe("updateTask", () => {
    it("should return error when updating non-existent task", async () => {
      const result = (await client.callTool({
        arguments: {
          id: "non-existent-id",
          name: "new name",
        },
        name: "updateTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
        isError: true,
      })

      const response = parseMCPResponse(result)
      expect(response.error).toEqual({
        code: "TASK_UPDATE_ERROR",
        message: expect.any(String),
      })
    })

    it("should update a task", async () => {
      const createdTask = await createTestTask(
        "original task",
        undefined,
        "original description",
      )

      const result = (await client.callTool({
        arguments: {
          description: "updated description",
          id: createdTask.id,
          name: "updated task",
          status: "in_progress",
        },
        name: "updateTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.task).toEqual({
        ...createdTask,
        description: "updated description",
        name: "updated task",
        status: "in_progress",
      })
    })
  })

  describe("deleteTask", () => {
    it("should return error when deleting non-existent task", async () => {
      const result = (await client.callTool({
        arguments: {
          id: "non-existent-id",
        },
        name: "deleteTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
        isError: true,
      })

      const response = parseMCPResponse(result)
      expect(response.error).toEqual({
        code: "TASK_DELETE_ERROR",
        message: expect.any(String),
      })
    })

    it("should delete a task", async () => {
      const createdTask = await createTestTask("task to delete")

      const result = (await client.callTool({
        arguments: {
          id: createdTask.id,
        },
        name: "deleteTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response).toEqual({
        id: createdTask.id,
      })

      // Verify task is actually deleted
      const getResult = (await client.callTool({
        arguments: {
          id: createdTask.id,
        },
        name: "getTask",
      })) as MCPResponse
      expect(getResult.isError).toBe(true)
    })
  })

  describe("startTask", () => {
    it("should return error when starting non-existent task", async () => {
      const result = (await client.callTool({
        arguments: {
          id: "non-existent-id",
        },
        name: "startTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
        isError: true,
      })

      const response = parseMCPResponse(result)
      expect(response.error).toEqual({
        code: "TASK_START_ERROR",
        message: expect.any(String),
      })
    })

    it("should start a task", async () => {
      const createdTask = await createTestTask("task to start")

      const result = (await client.callTool({
        arguments: {
          id: createdTask.id,
        },
        name: "startTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response.task).toEqual({
        ...createdTask,
        status: "in_progress",
      })
    })
  })

  describe("completeTask", () => {
    it("should return error when completing non-existent task", async () => {
      const result = (await client.callTool({
        arguments: {
          id: "non-existent-id",
          resolution: "completed successfully",
        },
        name: "completeTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
        isError: true,
      })

      const response = parseMCPResponse(result)
      expect(response.error).toEqual({
        code: "TASK_COMPLETE_ERROR",
        message: expect.any(String),
      })
    })

    it("should complete a task", async () => {
      const createdTask = await createTestTask("task to complete")

      const result = (await client.callTool({
        arguments: {
          id: createdTask.id,
          resolution: "completed successfully",
        },
        name: "completeTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })

      const response = parseMCPResponse(result)
      expect(response).toEqual({
        message: expect.any(String),
        next_task_id: undefined,
        progress_summary: expect.objectContaining({
          completed_tasks: expect.any(Number),
          completion_percentage: expect.any(Number),
          in_progress_tasks: expect.any(Number),
          table: expect.any(String),
          todo_tasks: expect.any(Number),
          total_tasks: expect.any(Number),
        }),
      })

      // Verify task status was updated
      const getResult = (await client.callTool({
        arguments: {
          id: createdTask.id,
        },
        name: "getTask",
      })) as MCPResponse
      const updatedTask = parseMCPResponse(getResult).task
      expect(updatedTask.status).toBe("done")
      expect(updatedTask.resolution).toBe("completed successfully")
    })

    it("should complete a task and return next task", async () => {
      // Create parent task
      const parentTask = await createTestTask("parent task")

      // Create first child task
      const child1Task = await createTestTask("child task 1", parentTask.id)

      // Create second child task
      await createTestTask("child task 2", parentTask.id)

      // Complete first child task
      const result = (await client.callTool({
        arguments: {
          id: child1Task.id,
          resolution: "first task completed",
        },
        name: "completeTask",
      })) as MCPResponse

      expect(result).toEqual({
        content: [{ text: expect.any(String), type: "text" }],
      })
    })
  })
})
