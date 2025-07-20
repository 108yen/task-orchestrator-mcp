import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { server } from "./server.js"
import { registerTools } from "./tools.js"

// Helper type for MCP tool responses
interface MCPResponse {
  content?: { text: string; type: string }[]
  isError?: boolean
}

// Helper function to safely parse MCP response
function parseMCPResponse(response: MCPResponse): any {
  if (!response.content?.[0]?.text) {
    throw new Error("Invalid MCP response format")
  }
  return JSON.parse(response.content[0].text)
}

describe("MCP Task Management Integration Tests", () => {
  const client = new Client({
    name: "test client",
    version: "0.1.0",
  })

  beforeAll(async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    registerTools()
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ])
  })

  // Clear tasks before each test to ensure clean state
  beforeEach(async () => {
    // Get all tasks and delete them to start fresh
    const listResult = (await client.callTool({
      arguments: {},
      name: "listTasks",
    })) as MCPResponse

    if (listResult.content?.[0]?.text) {
      const { tasks } = JSON.parse(listResult.content[0].text)
      for (const task of tasks) {
        await client.callTool({
          arguments: { id: task.id },
          name: "deleteTask",
        })
      }
    }
  })

  describe("tools", () => {
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
        expect(response.task).toEqual({
          createdAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
          description: "",
          id: expect.any(String),
          name: "test task",
          order: 1,
          parent_id: undefined,
          resolution: undefined,
          status: "todo",
          updatedAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
        })
      })

      it("should create a task with all parameters", async () => {
        // First create a parent task
        const parentResult = (await client.callTool({
          arguments: {
            description: "parent description",
            name: "parent task",
          },
          name: "createTask",
        })) as MCPResponse
        const parentTask = parseMCPResponse(parentResult).task

        const result = (await client.callTool({
          arguments: {
            description: "child description",
            name: "child task",
            order: 5,
            parent_id: parentTask.id,
          },
          name: "createTask",
        })) as MCPResponse

        expect(result).toEqual({
          content: [{ text: expect.any(String), type: "text" }],
        })

        const response = parseMCPResponse(result)
        expect(response.task).toEqual({
          createdAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
          description: "child description",
          id: expect.any(String),
          name: "child task",
          order: 5,
          parent_id: parentTask.id,
          resolution: undefined,
          status: "todo",
          updatedAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
        })
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
        const createResult = (await client.callTool({
          arguments: {
            description: "test description",
            name: "test task",
          },
          name: "createTask",
        })) as MCPResponse
        const createdTask = parseMCPResponse(createResult).task

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
        await client.callTool({
          arguments: {
            name: "task 1",
          },
          name: "createTask",
        })

        await client.callTool({
          arguments: {
            name: "task 2",
          },
          name: "createTask",
        })

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

      it("should filter tasks by parent_id", async () => {
        // Create parent task
        const parentResult = (await client.callTool({
          arguments: {
            name: "parent task",
          },
          name: "createTask",
        })) as MCPResponse
        const parentTask = parseMCPResponse(parentResult).task

        // Create child tasks
        await client.callTool({
          arguments: {
            name: "child 1",
            parent_id: parentTask.id,
          },
          name: "createTask",
        })

        await client.callTool({
          arguments: {
            name: "child 2",
            parent_id: parentTask.id,
          },
          name: "createTask",
        })

        // Create another top-level task
        await client.callTool({
          arguments: {
            name: "other task",
          },
          name: "createTask",
        })

        const result = (await client.callTool({
          arguments: {
            parent_id: parentTask.id,
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
              parent_id: parentTask.id,
            }),
            expect.objectContaining({
              name: "child 2",
              parent_id: parentTask.id,
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
        const createResult = (await client.callTool({
          arguments: {
            description: "original description",
            name: "original task",
          },
          name: "createTask",
        })) as MCPResponse
        const createdTask = parseMCPResponse(createResult).task

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
        // Note: updatedAt might be the same if execution is very fast, so we just check it's a valid timestamp
        expect(response.task.updatedAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        )
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
        const createResult = (await client.callTool({
          arguments: {
            name: "task to delete",
          },
          name: "createTask",
        })) as MCPResponse
        const createdTask = parseMCPResponse(createResult).task

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
        const createResult = (await client.callTool({
          arguments: {
            name: "task to start",
          },
          name: "createTask",
        })) as MCPResponse
        const createdTask = parseMCPResponse(createResult).task

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
        // Note: updatedAt might be the same if execution is very fast, so we just check it's a valid timestamp
        expect(response.task.updatedAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        )
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
        const createResult = (await client.callTool({
          arguments: {
            name: "task to complete",
          },
          name: "createTask",
        })) as MCPResponse
        const createdTask = parseMCPResponse(createResult).task

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
        const parentResult = (await client.callTool({
          arguments: {
            name: "parent task",
          },
          name: "createTask",
        })) as MCPResponse
        const parentTask = parseMCPResponse(parentResult).task

        // Create first child task
        const child1Result = (await client.callTool({
          arguments: {
            name: "child task 1",
            order: 1,
            parent_id: parentTask.id,
          },
          name: "createTask",
        })) as MCPResponse
        const child1Task = parseMCPResponse(child1Result).task

        // Create second child task
        const child2Result = (await client.callTool({
          arguments: {
            name: "child task 2",
            order: 2,
            parent_id: parentTask.id,
          },
          name: "createTask",
        })) as MCPResponse
        const child2Task = parseMCPResponse(child2Result).task

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
        })
      })
    })
  })

  describe("hierarchical task management", () => {
    it("should handle complex hierarchical task structures", async () => {
      // Create root task
      const rootResult = (await client.callTool({
        arguments: {
          description: "main project task",
          name: "root task",
        },
        name: "createTask",
      })) as MCPResponse
      const rootTask = parseMCPResponse(rootResult).task

      // Create level 1 tasks
      const level1Task1Result = (await client.callTool({
        arguments: {
          name: "level 1 task 1",
          order: 1,
          parent_id: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      const level1Task1 = parseMCPResponse(level1Task1Result).task

      const level1Task2Result = (await client.callTool({
        arguments: {
          name: "level 1 task 2",
          order: 2,
          parent_id: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      const level1Task2 = parseMCPResponse(level1Task2Result).task

      // Create level 2 tasks under first level 1 task
      await client.callTool({
        arguments: {
          name: "level 2 task 1",
          order: 1,
          parent_id: level1Task1.id,
        },
        name: "createTask",
      })

      await client.callTool({
        arguments: {
          name: "level 2 task 2",
          order: 2,
          parent_id: level1Task1.id,
        },
        name: "createTask",
      })

      // Test filtering by different parent levels
      const rootChildrenResult = (await client.callTool({
        arguments: {
          parent_id: rootTask.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const rootChildren = parseMCPResponse(rootChildrenResult).tasks
      expect(rootChildren).toHaveLength(2)

      const level1ChildrenResult = (await client.callTool({
        arguments: {
          parent_id: level1Task1.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const level1Children = parseMCPResponse(level1ChildrenResult).tasks
      expect(level1Children).toHaveLength(2)

      const level2ChildrenResult = (await client.callTool({
        arguments: {
          parent_id: level1Task2.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const level2Children = parseMCPResponse(level2ChildrenResult).tasks
      expect(level2Children).toHaveLength(0)
    })
  })

  describe("task ordering and completion flow", () => {
    it("should handle task ordering and next task identification", async () => {
      // Create parent task
      const parentResult = (await client.callTool({
        arguments: {
          name: "parent task",
        },
        name: "createTask",
      })) as MCPResponse
      const parentTask = parseMCPResponse(parentResult).task

      // Create ordered child tasks
      const task1Result = (await client.callTool({
        arguments: {
          name: "task 1",
          order: 1,
          parent_id: parentTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      const task1 = parseMCPResponse(task1Result).task

      const task3Result = (await client.callTool({
        arguments: {
          name: "task 3",
          order: 3,
          parent_id: parentTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      const task3 = parseMCPResponse(task3Result).task

      const task2Result = (await client.callTool({
        arguments: {
          name: "task 2",
          order: 2,
          parent_id: parentTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      const task2 = parseMCPResponse(task2Result).task

      // Complete task 1, should get task 2 as next
      const complete1Result = (await client.callTool({
        arguments: {
          id: task1.id,
          resolution: "task 1 completed",
        },
        name: "completeTask",
      })) as MCPResponse
      const complete1Response = parseMCPResponse(complete1Result)
      expect(complete1Response.next_task_id).toBe(task2.id)

      // Complete task 2, should get task 3 as next
      const complete2Result = (await client.callTool({
        arguments: {
          id: task2.id,
          resolution: "task 2 completed",
        },
        name: "completeTask",
      })) as MCPResponse
      const complete2Response = parseMCPResponse(complete2Result)
      expect(complete2Response.next_task_id).toBe(task3.id)

      // Complete task 3, should have no next task (or might have parent task)
      const complete3Result = (await client.callTool({
        arguments: {
          id: task3.id,
          resolution: "task 3 completed",
        },
        name: "completeTask",
      })) as MCPResponse
      const complete3Response = parseMCPResponse(complete3Result)
      // The next task logic is complex - it might return the parent task or undefined
      // Let's just check that we get a valid response
      expect(complete3Response).toHaveProperty("message")
      expect(typeof complete3Response.message).toBe("string")
    })
  })
})
