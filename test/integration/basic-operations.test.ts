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
        createdAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        description: "",
        id: expect.any(String),
        name: "test task",
        order: 1,
        parentId: undefined,
        resolution: undefined,
        status: "todo",
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
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
          name: "child task",
          order: 5,
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
        createdAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        description: "child description",
        id: expect.any(String),
        name: "child task",
        order: 5,
        parentId: parentTask.id,
        resolution: undefined,
        status: "todo",
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
      })
    })

    it("should assign order automatically if not provided", async () => {
      // Create first task, should have order 1
      const task1 = await createTestTask("task 1")
      expect(task1.order).toBe(1)

      // Create second task, should have order 2
      const task2 = await createTestTask("task 2")
      expect(task2.order).toBe(2)
    })

    it("should shift orders correctly on conflict", async () => {
      // Create task with order 1
      const task1 = await createTestTask("task 1", undefined, undefined, 1)

      // Create task with order 2
      await createTestTask("task 2", undefined, undefined, 2)

      // Create a new task with conflicting order 1
      const result3 = (await client.callTool({
        arguments: { name: "task 3", order: 1 },
        name: "createTask",
      })) as MCPResponse
      const task3 = parseMCPResponse(result3).task
      expect(task3.order).toBe(1)

      // Verify other tasks were shifted
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const { tasks } = parseMCPResponse(listResult)

      const updatedTask1 = tasks.find((t: any) => t.id === task1.id)
      expect(updatedTask1?.order).toBe(2)

      const originalTask2 = tasks.find((t: any) => t.name === "task 2")
      expect(originalTask2?.order).toBe(3)
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
            parentId: parentTask.id,
          }),
          expect.objectContaining({
            name: "child 2",
            parentId: parentTask.id,
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
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
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
        updatedAt: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
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
      const child1Task = await createTestTask(
        "child task 1",
        parentTask.id,
        undefined,
        1,
      )

      // Create second child task
      const child2Task = await createTestTask(
        "child task 2",
        parentTask.id,
        undefined,
        2,
      )

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

      const response = parseMCPResponse(result)
      expect(response).toEqual({
        message: expect.any(String),
        next_task_id: child2Task.id,
        progress_summary: expect.objectContaining({
          completed_tasks: expect.any(Number),
          completion_percentage: expect.any(Number),
          in_progress_tasks: expect.any(Number),
          table: expect.any(String),
          todo_tasks: expect.any(Number),
          total_tasks: expect.any(Number),
        }),
      })
    })
  })
})
