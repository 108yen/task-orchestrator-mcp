import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Task } from "./storage.js"
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  startTask,
  updateTask,
} from "./task.js"

// Mock the fs module for I/O error testing
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

// Mock the storage module for business logic testing
vi.mock("./storage.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./storage.js")>()
  let mockTasks: Task[] = []
  let shouldThrowReadError = false
  let shouldThrowWriteError = false

  return {
    ...original,
    __getMockTasks: () => mockTasks,
    __resetMockTasks: () => {
      mockTasks = []
      shouldThrowReadError = false
      shouldThrowWriteError = false
    },
    __setMockTasks: (tasks: Task[]) => {
      mockTasks = [...tasks]
    },
    __setShouldThrowReadError: (shouldThrow: boolean) => {
      shouldThrowReadError = shouldThrow
    },
    __setShouldThrowWriteError: (shouldThrow: boolean) => {
      shouldThrowWriteError = shouldThrow
    },
    readTasks: vi.fn(() => {
      if (shouldThrowReadError) {
        throw new Error("Simulated read error")
      }
      return mockTasks
    }),
    writeTasks: vi.fn((tasks: Task[]) => {
      if (shouldThrowWriteError) {
        throw new Error("Simulated write error")
      }
      mockTasks = [...tasks]
    }),
  }
})

// Import mocked functions
const {
  __resetMockTasks,
  __setMockTasks,
  __setShouldThrowReadError,
  __setShouldThrowWriteError,
} = (await import("./storage.js")) as any

describe("Error Handling Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetMockTasks()
  })

  describe("Validation Errors", () => {
    describe("createTask validation", () => {
      it("should throw error for missing name", () => {
        expect(() => createTask({ name: undefined as any })).toThrow(
          "Task name is required and must be a non-empty string",
        )
      })

      it("should throw error for null name", () => {
        expect(() => createTask({ name: null as any })).toThrow(
          "Task name is required and must be a non-empty string",
        )
      })

      it("should throw error for empty string name", () => {
        expect(() => createTask({ name: "" })).toThrow(
          "Task name is required and must be a non-empty string",
        )
      })

      it("should throw error for whitespace-only name", () => {
        expect(() => createTask({ name: "   " })).toThrow(
          "Task name is required and must be a non-empty string",
        )
      })

      it("should throw error for non-string name", () => {
        expect(() => createTask({ name: 123 as any })).toThrow(
          "Task name is required and must be a non-empty string",
        )
        expect(() => createTask({ name: {} as any })).toThrow(
          "Task name is required and must be a non-empty string",
        )
        expect(() => createTask({ name: [] as any })).toThrow(
          "Task name is required and must be a non-empty string",
        )
      })

      it("should throw error for non-existent parentId", () => {
        expect(() =>
          createTask({ name: "Test", parentId: "non-existent-id" }),
        ).toThrow("Parent task with id 'non-existent-id' not found")
      })
    })

    describe("getTask validation", () => {
      it("should throw error for missing id", () => {
        expect(() => getTask(undefined as any)).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for null id", () => {
        expect(() => getTask(null as any)).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for empty string id", () => {
        expect(() => getTask("")).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for non-string id", () => {
        expect(() => getTask(123 as any)).toThrow(
          "Task ID is required and must be a string",
        )
        expect(() => getTask({} as any)).toThrow(
          "Task ID is required and must be a string",
        )
      })
    })

    describe("updateTask validation", () => {
      it("should throw error for missing id", () => {
        expect(() => updateTask({ id: undefined as any })).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for invalid status", () => {
        const { task } = createTask({ name: "Test" })
        expect(() => updateTask({ id: task.id, status: "invalid" })).toThrow(
          "Invalid status 'invalid'. Must be one of: todo, in_progress, done",
        )
        expect(() => updateTask({ id: task.id, status: "DONE" })).toThrow(
          "Invalid status 'DONE'. Must be one of: todo, in_progress, done",
        )
      })

      it("should throw error for empty name", () => {
        const { task } = createTask({ name: "Test" })
        expect(() => updateTask({ id: task.id, name: "" })).toThrow(
          "Task name must be a non-empty string",
        )
        expect(() => updateTask({ id: task.id, name: "   " })).toThrow(
          "Task name must be a non-empty string",
        )
      })

      it("should throw error for non-string name", () => {
        const { task } = createTask({ name: "Test" })
        expect(() => updateTask({ id: task.id, name: 123 as any })).toThrow(
          "Task name must be a non-empty string",
        )
      })

      // Note: Order-related tests are no longer applicable as order is now handled by array index
      // Keeping tests for backward compatibility documentation

      it("should not throw error for invalid order parameter (deprecated)", () => {
        const { task } = createTask({ name: "Test" })
        // These properties no longer exist in the new structure
        expect(() => updateTask({ id: task.id } as any)).not.toThrow()
      })

      // Note: Parent-child relationship tests are no longer applicable for updateTask
      // as parentId is not part of updateTask parameters in the new structure
    })

    describe("deleteTask validation", () => {
      it("should throw error for missing id", () => {
        expect(() => deleteTask(undefined as any)).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for empty string id", () => {
        expect(() => deleteTask("")).toThrow(
          "Task ID is required and must be a string",
        )
      })
    })

    describe("startTask validation", () => {
      it("should throw error for missing id", () => {
        expect(() => startTask(undefined as any)).toThrow(
          "Task ID is required and must be a string",
        )
      })

      it("should throw error for empty string id", () => {
        expect(() => startTask("")).toThrow(
          "Task ID is required and must be a string",
        )
      })
    })

    describe("completeTask validation", () => {
      it("should throw error for missing id", () => {
        expect(() =>
          completeTask({ id: undefined as any, resolution: "Done" }),
        ).toThrow("Task ID is required and must be a string")
      })

      it("should throw error for missing resolution", () => {
        const { task } = createTask({ name: "Test" })
        expect(() =>
          completeTask({ id: task.id, resolution: undefined as any }),
        ).toThrow("Resolution is required and must be a non-empty string")
      })

      it("should throw error for empty resolution", () => {
        const { task } = createTask({ name: "Test" })
        expect(() => completeTask({ id: task.id, resolution: "" })).toThrow(
          "Resolution is required and must be a non-empty string",
        )
        expect(() => completeTask({ id: task.id, resolution: "   " })).toThrow(
          "Resolution is required and must be a non-empty string",
        )
      })

      it("should throw error for non-string resolution", () => {
        const { task } = createTask({ name: "Test" })
        expect(() =>
          completeTask({ id: task.id, resolution: 123 as any }),
        ).toThrow("Resolution is required and must be a non-empty string")
      })
    })
  })

  describe("Data Integrity Errors", () => {
    describe("Non-existent task operations", () => {
      it("should throw error when getting non-existent task", () => {
        expect(() => getTask("non-existent-id")).toThrow(
          "Task with id 'non-existent-id' not found",
        )
      })

      it("should throw error when updating non-existent task", () => {
        expect(() =>
          updateTask({ id: "non-existent-id", name: "New Name" }),
        ).toThrow("Task with id 'non-existent-id' not found")
      })

      it("should throw error when deleting non-existent task", () => {
        expect(() => deleteTask("non-existent-id")).toThrow(
          "Task with id 'non-existent-id' not found",
        )
      })

      it("should throw error when starting non-existent task", () => {
        expect(() => startTask("non-existent-id")).toThrow(
          "Task with id 'non-existent-id' not found",
        )
      })

      it("should throw error when completing non-existent task", () => {
        expect(() =>
          completeTask({ id: "non-existent-id", resolution: "Done" }),
        ).toThrow("Task with id 'non-existent-id' not found")
      })
    })

    describe("Task state consistency errors", () => {
      it("should throw error when starting already completed task", () => {
        const { task } = createTask({ name: "Test" })
        updateTask({ id: task.id, status: "done" })

        expect(() => startTask(task.id)).toThrow(
          `Task '${task.id}' is already completed`,
        )
      })

      it("should throw error when starting already in-progress task", () => {
        const { task } = createTask({ name: "Test" })
        startTask(task.id)

        expect(() => startTask(task.id)).toThrow(
          `Task '${task.id}' is already in progress`,
        )
      })

      it("should throw error when completing already completed task", () => {
        const { task } = createTask({ name: "Test" })
        completeTask({ id: task.id, resolution: "First completion" })

        expect(() =>
          completeTask({ id: task.id, resolution: "Second completion" }),
        ).toThrow(`Task '${task.id}' is already completed`)
      })

      it("should throw error when deleting task with children", () => {
        const { task: parentTask } = createTask({ name: "Parent" })
        createTask({ name: "Child", parentId: parentTask.id })

        expect(() => deleteTask(parentTask.id)).toThrow(
          `Cannot delete task '${parentTask.id}' because it has child tasks`,
        )
      })
    })

    describe("Hierarchical relationship errors", () => {
      it("should prevent creating task with non-existent parent", () => {
        expect(() =>
          createTask({ name: "Child", parentId: "fake-parent-id" }),
        ).toThrow("Parent task with id 'fake-parent-id' not found")
      })

      // Note: Parent-child relationship management has changed in the new structure
      // Parent relationships are no longer managed through updateTask parameters
      // They are managed through nested task arrays in the new structure
    })
  })

  describe("Boundary Value Tests", () => {
    describe("insertIndex field boundaries", () => {
      it("should accept insertIndex value of 0", () => {
        expect(() => createTask({ insertIndex: 0, name: "Test" })).not.toThrow()
      })

      it("should accept large positive insertIndex values", () => {
        expect(() =>
          createTask({ insertIndex: Number.MAX_SAFE_INTEGER, name: "Test" }),
        ).not.toThrow()
      })

      it("should handle negative insertIndex values gracefully", () => {
        expect(() =>
          createTask({ insertIndex: -1, name: "Test" }),
        ).not.toThrow()
      })

      it("should handle non-finite insertIndex values gracefully", () => {
        expect(() =>
          createTask({ insertIndex: Number.POSITIVE_INFINITY, name: "Test" }),
        ).not.toThrow()
        expect(() =>
          createTask({ insertIndex: Number.NEGATIVE_INFINITY, name: "Test" }),
        ).not.toThrow()
        expect(() =>
          createTask({ insertIndex: NaN, name: "Test" }),
        ).not.toThrow()
      })
    })

    describe("String field boundaries", () => {
      it("should handle very long task names", () => {
        const longName = "a".repeat(10000)
        expect(() => createTask({ name: longName })).not.toThrow()
        const { task } = createTask({ name: "Test" })
        expect(() => updateTask({ id: task.id, name: longName })).not.toThrow()
      })

      it("should handle very long descriptions", () => {
        const longDescription = "a".repeat(10000)
        expect(() =>
          createTask({ description: longDescription, name: "Test" }),
        ).not.toThrow()
        const { task } = createTask({ name: "Test" })
        expect(() =>
          updateTask({ description: longDescription, id: task.id }),
        ).not.toThrow()
      })

      it("should handle very long resolutions", () => {
        const { task } = createTask({ name: "Test" })
        const longResolution = "a".repeat(10000)
        expect(() =>
          completeTask({ id: task.id, resolution: longResolution }),
        ).not.toThrow()
      })

      it("should handle special characters in strings", () => {
        const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
        expect(() => createTask({ name: specialChars })).not.toThrow()
        expect(() =>
          createTask({ description: specialChars, name: "Test" }),
        ).not.toThrow()

        const { task } = createTask({ name: "Test" })
        expect(() =>
          completeTask({ id: task.id, resolution: specialChars }),
        ).not.toThrow()
      })

      it("should handle unicode characters", () => {
        const unicode = "こんにちは 🌟 emojis nono"
        expect(() => createTask({ name: unicode })).not.toThrow()
        expect(() =>
          createTask({ description: unicode, name: "Test" }),
        ).not.toThrow()

        const { task } = createTask({ name: "Test" })
        expect(() =>
          completeTask({ id: task.id, resolution: unicode }),
        ).not.toThrow()
      })
    })

    describe("Task list boundaries", () => {
      it("should handle empty task list operations", () => {
        expect(() => listTasks()).not.toThrow()
        expect(listTasks()).toEqual([])
        expect(() => listTasks({ parentId: "non-existent" })).not.toThrow()
        expect(listTasks({ parentId: "non-existent" })).toEqual([])
      })

      it("should handle large number of tasks", () => {
        const tasks: Task[] = []
        for (let i = 0; i < 1000; i++) {
          tasks.push({
            createdAt: new Date(),
            description: `Description ${i}`,
            id: `task-${i}`,
            name: `Task ${i}`,
            status: "todo",
            tasks: [], // New nested structure
            updatedAt: new Date(),
          })
        }
        __setMockTasks(tasks)

        expect(() => listTasks()).not.toThrow()
        expect(listTasks()).toHaveLength(1000)
      })
    })
  })

  describe("Edge Cases", () => {
    describe("Whitespace handling", () => {
      it("should trim whitespace from task names and descriptions", () => {
        const { task } = createTask({
          description: "  Test Description  ",
          name: "  Test Task  ",
        })
        expect(task.name).toBe("Test Task")
        expect(task.description).toBe("Test Description")

        const updatedTask = updateTask({
          description: "  Updated Description  ",
          id: task.id,
          name: "  Updated Name  ",
        })
        expect(updatedTask.name).toBe("Updated Name")
        expect(updatedTask.description).toBe("Updated Description")
      })

      it("should trim whitespace from resolution", () => {
        const { task } = createTask({ name: "Test" })
        completeTask({
          id: task.id,
          resolution: "  Completed successfully  ",
        })

        const completedTask = getTask(task.id)
        expect(completedTask.resolution).toBe("Completed successfully")
      })
    })

    describe("Undefined and null handling", () => {
      it("should handle undefined optional fields gracefully", () => {
        expect(() =>
          createTask({
            description: undefined,
            insertIndex: undefined,
            name: "Test",
            parentId: undefined,
          }),
        ).not.toThrow()

        const { task } = createTask({ name: "Test" })
        expect(() =>
          updateTask({
            description: undefined,
            id: task.id,
            name: undefined,
            resolution: undefined,
            status: undefined,
          }),
        ).not.toThrow()
      })

      it("should convert undefined description to empty string", () => {
        const { task } = createTask({ description: undefined, name: "Test" })
        expect(task.description).toBe("")
      })

      it("should handle null values in update operations", () => {
        const { task } = createTask({ name: "Test" })
        expect(() =>
          updateTask({
            description: null as any,
            id: task.id,
            resolution: null as any,
          }),
        ).not.toThrow()

        const updatedTask = getTask(task.id)
        expect(updatedTask.description).toBe("")
        expect(updatedTask.resolution).toBeUndefined()
      })
    })

    describe("Status transition edge cases", () => {
      it("should allow updating from any status to any valid status", () => {
        const { task } = createTask({ name: "Test" })

        // todo -> in_progress
        expect(() =>
          updateTask({ id: task.id, status: "in_progress" }),
        ).not.toThrow()

        // in_progress -> done
        expect(() => updateTask({ id: task.id, status: "done" })).not.toThrow()

        // done -> todo (should be allowed via updateTask)
        expect(() => updateTask({ id: task.id, status: "todo" })).not.toThrow()

        // todo -> done (skip in_progress)
        expect(() => updateTask({ id: task.id, status: "done" })).not.toThrow()
      })

      it("should prevent startTask on completed tasks but allow updateTask", () => {
        const { task } = createTask({ name: "Test" })
        updateTask({ id: task.id, status: "done" })

        expect(() => startTask(task.id)).toThrow("is already completed")
        expect(() =>
          updateTask({ id: task.id, status: "in_progress" }),
        ).not.toThrow()
      })
    })

    describe("Parent-child relationship edge cases", () => {
      // Note: Parent-child relationship management has changed in the new structure
      // These tests are no longer applicable as parentId is not used in updateTask

      it("should handle parent-child relationships through nested structure", () => {
        const { task: parent } = createTask({ name: "Parent" })
        const { task: child } = createTask({
          name: "Child",
          parentId: parent.id,
        })

        // In the new structure, parent-child relationships are managed
        // through the nested tasks array, not updateTask parameters
        expect(child).toBeDefined()
        expect(parent).toBeDefined()
      })

      it("should allow deleting parent after removing all children", () => {
        const { task: parent } = createTask({ name: "Parent" })
        const { task: child1 } = createTask({
          name: "Child 1",
          parentId: parent.id,
        })
        const { task: child2 } = createTask({
          name: "Child 2",
          parentId: parent.id,
        })

        // Should fail initially
        expect(() => deleteTask(parent.id)).toThrow("has child tasks")

        // Remove children
        deleteTask(child1.id)
        deleteTask(child2.id)

        // Should succeed now
        expect(() => deleteTask(parent.id)).not.toThrow()
      })
    })
  })

  describe("I/O Errors", () => {
    describe("Storage write errors", () => {
      it("should propagate write errors through task operations", () => {
        // Use the mocked storage that can simulate write errors
        __setShouldThrowWriteError(true)

        // Any operation that writes should fail
        expect(() => createTask({ name: "Test" })).toThrow(
          "Simulated write error",
        )
      })
    })

    describe("System errors", () => {
      it("should handle unexpected errors in task operations", () => {
        // Simulate a scenario where storage throws an unexpected error
        __setShouldThrowReadError(true)

        // Operations that read should fail
        expect(() => getTask("any-id")).toThrow("Simulated read error")
        expect(() => listTasks()).toThrow("Simulated read error")
        expect(() => createTask({ name: "Test" })).toThrow(
          "Simulated read error",
        )
      })
    })

    describe("MCP Tool Error Responses", () => {
      it("should return proper error responses from tools", async () => {
        // Import tools to test error handling
        const { registerTools } = await import("./tools.js")
        const { server } = await import("./server.js")

        // Mock server.registerTool to capture tool handlers
        const toolHandlers: { [key: string]: any } = {}
        const mockRegisterTool = vi.fn(
          (name: string, _config: any, handler: any) => {
            toolHandlers[name] = handler
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            return {} as any
          },
        )
        server.registerTool = mockRegisterTool

        registerTools()

        // Test createTask error response
        const createTaskHandler = toolHandlers.createTask
        const errorResponse = createTaskHandler({ name: "" }) // Invalid name

        expect(errorResponse).toEqual({
          content: [
            {
              text: expect.stringContaining("TASK_CREATION_ERROR"),
              type: "text",
            },
          ],
          isError: true,
        })

        // Parse the error response to verify structure
        const errorContent = JSON.parse(errorResponse.content[0].text)
        expect(errorContent.error).toEqual({
          code: "TASK_CREATION_ERROR",
          message: expect.stringContaining("Task name is required"),
        })
      })

      it("should return proper error codes for different operations", async () => {
        const { registerTools } = await import("./tools.js")
        const { server } = await import("./server.js")

        // Mock server.registerTool to capture tool handlers
        const toolHandlers: { [key: string]: any } = {}
        const mockRegisterTool = vi.fn(
          (name: string, _config: any, handler: any) => {
            toolHandlers[name] = handler
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            return {} as any
          },
        )
        server.registerTool = mockRegisterTool

        registerTools()

        // Test different error codes
        const testCases = [
          {
            args: { id: "non-existent" },
            expectedCode: "TASK_NOT_FOUND",
            tool: "getTask",
          },
          {
            args: { id: "non-existent", name: "test" },
            expectedCode: "TASK_UPDATE_ERROR",
            tool: "updateTask",
          },
          {
            args: { id: "non-existent" },
            expectedCode: "TASK_DELETE_ERROR",
            tool: "deleteTask",
          },
          {
            args: { id: "non-existent" },
            expectedCode: "TASK_START_ERROR",
            tool: "startTask",
          },
          {
            args: { id: "non-existent", resolution: "done" },
            expectedCode: "TASK_COMPLETE_ERROR",
            tool: "completeTask",
          },
        ]

        for (const testCase of testCases) {
          const handler = toolHandlers[testCase.tool]
          const response = handler(testCase.args)

          expect(response.isError).toBe(true)
          const errorContent = JSON.parse(response.content[0].text)
          expect(errorContent.error.code).toBe(testCase.expectedCode)
        }
      })
    })
  })
})
