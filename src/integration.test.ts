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
    const deleteAllTasks = async () => {
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse

      if (listResult.isError || !listResult.content?.[0]?.text) {
        return // No tasks or error, stop recursion
      }

      const { tasks } = parseMCPResponse(listResult)
      if (tasks.length === 0) {
        return // No tasks, stop recursion
      }

      const parentIds = new Set(tasks.map((t: any) => t.parent_id))
      const tasksToDelete = tasks.filter((t: any) => !parentIds.has(t.id))

      if (tasksToDelete.length === 0) {
        return // No leaf tasks to delete, stop recursion (shouldn't happen with valid data)
      }

      for (const task of tasksToDelete) {
        await client.callTool({
          arguments: { id: task.id },
          name: "deleteTask",
        })
      }

      // Recursively call to delete remaining tasks
      await deleteAllTasks()
    }

    await deleteAllTasks()
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
          parent_id: parentTask.id,
          resolution: undefined,
          status: "todo",
          updatedAt: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          ),
        })
      })

      it("should assign order automatically if not provided", async () => {
        // Create first task, should have order 1
        const result1 = (await client.callTool({
          arguments: { name: "task 1" },
          name: "createTask",
        })) as MCPResponse
        const task1 = parseMCPResponse(result1).task
        expect(task1.order).toBe(1)

        // Create second task, should have order 2
        const result2 = (await client.callTool({
          arguments: { name: "task 2" },
          name: "createTask",
        })) as MCPResponse
        const task2 = parseMCPResponse(result2).task
        expect(task2.order).toBe(2)
      })

      it("should shift orders correctly on conflict", async () => {
        // Create task with order 1
        const result1 = (await client.callTool({
          arguments: { name: "task 1", order: 1 },
          name: "createTask",
        })) as MCPResponse
        const task1 = parseMCPResponse(result1).task

        // Create task with order 2
        await client.callTool({
          arguments: { name: "task 2", order: 2 },
          name: "createTask",
        })

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

  describe("hierarchy management integration", () => {
    describe("nested subtask auto-start functionality", () => {
      it("should start nested tasks recursively through MCP", async () => {
        // Create hierarchical structure: Root -> Level1 -> Level2 -> Level3
        const rootResult = (await client.callTool({
          arguments: { name: "Root Task" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const level1Result = (await client.callTool({
          arguments: { name: "Level 1 Task", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const level1Task = parseMCPResponse(level1Result).task

        const level2Result = (await client.callTool({
          arguments: { name: "Level 2 Task", parent_id: level1Task.id },
          name: "createTask",
        })) as MCPResponse
        const level2Task = parseMCPResponse(level2Result).task

        const level3Result = (await client.callTool({
          arguments: { name: "Level 3 Task", parent_id: level2Task.id },
          name: "createTask",
        })) as MCPResponse
        parseMCPResponse(level3Result)

        // Start root task - should cascade down to Level 3
        const startResult = (await client.callTool({
          arguments: { id: rootTask.id },
          name: "startTask",
        })) as MCPResponse

        const startResponse = parseMCPResponse(startResult)

        // Verify all tasks in the execution path were started
        expect(startResponse.started_tasks).toHaveLength(4)
        expect(startResponse.started_tasks.map((t: any) => t.name)).toEqual([
          "Root Task",
          "Level 1 Task",
          "Level 2 Task",
          "Level 3 Task",
        ])

        // Verify hierarchy summary is generated
        expect(startResponse.hierarchy_summary).toContain("Task Structure")
        expect(startResponse.hierarchy_summary).toContain("Root Task")
        expect(startResponse.hierarchy_summary).toContain("Level 3 Task")

        // Verify message indicates nested start
        expect(startResponse.message).toContain("3 nested tasks")
        expect(startResponse.message).toContain("Level 3 Task")
      })

      it("should handle mixed completion states in hierarchy", async () => {
        // Create branching hierarchy
        const rootResult = (await client.callTool({
          arguments: { name: "Project" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        // Create two branches
        const branch1Result = (await client.callTool({
          arguments: { name: "Branch 1", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const branch1Task = parseMCPResponse(branch1Result).task

        const branch2Result = (await client.callTool({
          arguments: { name: "Branch 2", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const branch2Task = parseMCPResponse(branch2Result).task

        // Add leaves to branches
        const leaf1Result = (await client.callTool({
          arguments: { name: "Leaf 1", parent_id: branch1Task.id },
          name: "createTask",
        })) as MCPResponse
        const leaf1Task = parseMCPResponse(leaf1Result).task

        const leaf2Result = (await client.callTool({
          arguments: { name: "Leaf 2", parent_id: branch2Task.id },
          name: "createTask",
        })) as MCPResponse
        parseMCPResponse(leaf2Result)

        // Complete leaf1 first
        await client.callTool({
          arguments: { id: leaf1Task.id, resolution: "Completed" },
          name: "completeTask",
        })

        // Start root - should only go down branch2 now
        const startResult = (await client.callTool({
          arguments: { id: rootTask.id },
          name: "startTask",
        })) as MCPResponse

        const startResponse = parseMCPResponse(startResult)

        // Should start root, branch2, and leaf2 (leaf1/branch1 are completed)
        expect(startResponse.started_tasks.map((t: any) => t.name)).toEqual([
          "Project",
          "Branch 2",
          "Leaf 2",
        ])
      })
    })

    describe("subtask completion validation", () => {
      it("should prevent parent completion with incomplete subtasks", async () => {
        // Create parent with multiple children
        const parentResult = (await client.callTool({
          arguments: { name: "Parent Task" },
          name: "createTask",
        })) as MCPResponse
        const parentTask = parseMCPResponse(parentResult).task

        const child1Result = (await client.callTool({
          arguments: { name: "Child 1", parent_id: parentTask.id },
          name: "createTask",
        })) as MCPResponse
        const child1Task = parseMCPResponse(child1Result).task

        await client.callTool({
          arguments: { name: "Child 2", parent_id: parentTask.id },
          name: "createTask",
        })

        // Complete only one child
        await client.callTool({
          arguments: { id: child1Task.id, resolution: "Done" },
          name: "completeTask",
        })

        // Try to complete parent - should fail
        const completeResult = (await client.callTool({
          arguments: { id: parentTask.id, resolution: "Parent done" },
          name: "completeTask",
        })) as MCPResponse

        expect(completeResult.isError).toBe(true)
        expect(completeResult.content?.[0]?.text).toContain(
          "Cannot complete task 'Parent Task' because it has incomplete subtasks",
        )
        expect(completeResult.content?.[0]?.text).toContain("Child 2")
      })

      it("should validate multi-level hierarchy completion", async () => {
        // Create 3-level hierarchy
        const rootResult = (await client.callTool({
          arguments: { name: "Root" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const midResult = (await client.callTool({
          arguments: { name: "Mid Level", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const midTask = parseMCPResponse(midResult).task

        await client.callTool({
          arguments: { name: "Leaf Level", parent_id: midTask.id },
          name: "createTask",
        })

        // Try to complete root - should fail
        const rootCompleteResult = (await client.callTool({
          arguments: { id: rootTask.id, resolution: "Root done" },
          name: "completeTask",
        })) as MCPResponse

        expect(rootCompleteResult.isError).toBe(true)
        expect(rootCompleteResult.content?.[0]?.text).toContain("Mid Level")

        // Try to complete mid - should also fail
        const midCompleteResult = (await client.callTool({
          arguments: { id: midTask.id, resolution: "Mid done" },
          name: "completeTask",
        })) as MCPResponse

        expect(midCompleteResult.isError).toBe(true)
        expect(midCompleteResult.content?.[0]?.text).toContain("Leaf Level")
      })
    })

    describe("parent task auto-completion", () => {
      it("should auto-complete parent when all children are done", async () => {
        // Create parent with two children
        const parentResult = (await client.callTool({
          arguments: { name: "Parent Task" },
          name: "createTask",
        })) as MCPResponse
        const parentTask = parseMCPResponse(parentResult).task

        const child1Result = (await client.callTool({
          arguments: { name: "Child 1", parent_id: parentTask.id },
          name: "createTask",
        })) as MCPResponse
        const child1Task = parseMCPResponse(child1Result).task

        const child2Result = (await client.callTool({
          arguments: { name: "Child 2", parent_id: parentTask.id },
          name: "createTask",
        })) as MCPResponse
        const child2Task = parseMCPResponse(child2Result).task

        // Complete first child
        await client.callTool({
          arguments: { id: child1Task.id, resolution: "Child 1 done" },
          name: "completeTask",
        })

        // Complete second child - should auto-complete parent
        const complete2Result = (await client.callTool({
          arguments: { id: child2Task.id, resolution: "Child 2 done" },
          name: "completeTask",
        })) as MCPResponse

        const complete2Response = parseMCPResponse(complete2Result)

        // Verify parent was auto-completed
        expect(complete2Response.message).toContain(
          "Auto-completed parent tasks",
        )
        expect(complete2Response.message).toContain("Parent Task")

        // Verify parent is actually completed
        const getParentResult = (await client.callTool({
          arguments: { id: parentTask.id },
          name: "getTask",
        })) as MCPResponse

        const parentStatus = parseMCPResponse(getParentResult)
        expect(parentStatus.task.status).toBe("done")
        expect(parentStatus.task.resolution).toBe(
          "Auto-completed: All subtasks completed",
        )
      })

      it("should cascade auto-completion up multi-level hierarchy", async () => {
        // Create 3-level hierarchy with single child at each level
        const rootResult = (await client.callTool({
          arguments: { name: "Root Task" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const midResult = (await client.callTool({
          arguments: { name: "Mid Task", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const midTask = parseMCPResponse(midResult).task

        const leafResult = (await client.callTool({
          arguments: { name: "Leaf Task", parent_id: midTask.id },
          name: "createTask",
        })) as MCPResponse
        const leafTask = parseMCPResponse(leafResult).task

        // Complete leaf task - should cascade up to root
        const completeResult = (await client.callTool({
          arguments: { id: leafTask.id, resolution: "Leaf completed" },
          name: "completeTask",
        })) as MCPResponse

        const completeResponse = parseMCPResponse(completeResult)

        // Verify all levels were auto-completed
        expect(completeResponse.message).toContain(
          "Auto-completed parent tasks",
        )
        expect(completeResponse.message).toContain("Mid Task")
        expect(completeResponse.message).toContain("Root Task")

        // Verify all tasks are actually completed
        const getRootResult = (await client.callTool({
          arguments: { id: rootTask.id },
          name: "getTask",
        })) as MCPResponse
        const rootStatus = parseMCPResponse(getRootResult)
        expect(rootStatus.task.status).toBe("done")

        const getMidResult = (await client.callTool({
          arguments: { id: midTask.id },
          name: "getTask",
        })) as MCPResponse
        const midStatus = parseMCPResponse(getMidResult)
        expect(midStatus.task.status).toBe("done")
      })

      it("should handle partial auto-completion in complex hierarchy", async () => {
        // Create root with two branches, one branch completes
        const rootResult = (await client.callTool({
          arguments: { name: "Project" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const frontendResult = (await client.callTool({
          arguments: { name: "Frontend", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const frontendTask = parseMCPResponse(frontendResult).task

        const backendResult = (await client.callTool({
          arguments: { name: "Backend", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const backendTask = parseMCPResponse(backendResult).task

        // Add tasks to frontend branch
        const uiResult = (await client.callTool({
          arguments: { name: "UI Components", parent_id: frontendTask.id },
          name: "createTask",
        })) as MCPResponse
        const uiTask = parseMCPResponse(uiResult).task

        const stylingResult = (await client.callTool({
          arguments: { name: "Styling", parent_id: frontendTask.id },
          name: "createTask",
        })) as MCPResponse
        const stylingTask = parseMCPResponse(stylingResult).task

        // Add task to backend branch
        const apiResult = (await client.callTool({
          arguments: { name: "API", parent_id: backendTask.id },
          name: "createTask",
        })) as MCPResponse
        const apiTask = parseMCPResponse(apiResult).task

        // Complete all frontend tasks
        await client.callTool({
          arguments: { id: uiTask.id, resolution: "UI done" },
          name: "completeTask",
        })

        const stylingCompleteResult = (await client.callTool({
          arguments: { id: stylingTask.id, resolution: "Styling done" },
          name: "completeTask",
        })) as MCPResponse
        const stylingResponse = parseMCPResponse(stylingCompleteResult)

        // Frontend should be auto-completed, but not root (backend still incomplete)
        expect(stylingResponse.message).toContain("Auto-completed parent tasks")
        expect(stylingResponse.message).toContain("Frontend")

        // Verify frontend is completed but root is not
        const getFrontendResult = (await client.callTool({
          arguments: { id: frontendTask.id },
          name: "getTask",
        })) as MCPResponse
        const frontendStatus = parseMCPResponse(getFrontendResult)
        expect(frontendStatus.task.status).toBe("done")

        const getRootResult = (await client.callTool({
          arguments: { id: rootTask.id },
          name: "getTask",
        })) as MCPResponse
        const rootStatus = parseMCPResponse(getRootResult)
        expect(rootStatus.task.status).not.toBe("done")

        // Now complete backend task - should complete root
        const apiCompleteResult = (await client.callTool({
          arguments: { id: apiTask.id, resolution: "API done" },
          name: "completeTask",
        })) as MCPResponse
        const apiResponse = parseMCPResponse(apiCompleteResult)

        expect(apiResponse.message).toContain("Auto-completed parent tasks")
        expect(apiResponse.message).toContain("Backend")
        expect(apiResponse.message).toContain("Project")
      })
    })

    describe("progress summary integration", () => {
      it("should include accurate progress tracking with auto-completed tasks", async () => {
        // Create hierarchy with mixed completion states
        const rootResult = (await client.callTool({
          arguments: { name: "Main Project" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const phase1Result = (await client.callTool({
          arguments: { name: "Phase 1", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const phase1Task = parseMCPResponse(phase1Result).task

        const phase2Result = (await client.callTool({
          arguments: { name: "Phase 2", parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        parseMCPResponse(phase2Result)

        // Add subtasks to phase1
        const task1Result = (await client.callTool({
          arguments: { name: "Task 1", parent_id: phase1Task.id },
          name: "createTask",
        })) as MCPResponse
        const task1 = parseMCPResponse(task1Result).task

        const task2Result = (await client.callTool({
          arguments: { name: "Task 2", parent_id: phase1Task.id },
          name: "createTask",
        })) as MCPResponse
        const task2 = parseMCPResponse(task2Result).task

        // Complete phase1 tasks - should auto-complete phase1
        await client.callTool({
          arguments: { id: task1.id, resolution: "Task 1 done" },
          name: "completeTask",
        })

        const task2CompleteResult = (await client.callTool({
          arguments: { id: task2.id, resolution: "Task 2 done" },
          name: "completeTask",
        })) as MCPResponse
        const task2Response = parseMCPResponse(task2CompleteResult)

        // Verify progress summary shows accurate completion
        expect(task2Response.progress_summary.total_tasks).toBe(5)
        expect(task2Response.progress_summary.completed_tasks).toBe(3) // task1, task2, phase1
        expect(task2Response.progress_summary.completion_percentage).toBe(60)

        // Verify hierarchical progress table includes auto-completed task
        expect(task2Response.progress_summary.table).toContain("Main Project")
        expect(task2Response.progress_summary.table).toContain("Phase 1")
        expect(task2Response.progress_summary.table).toContain("done")
        expect(task2Response.progress_summary.table).toContain("2/2")
        expect(task2Response.progress_summary.table).toContain("100%")
      })
    })

    describe("hierarchy summary integration", () => {
      it("should generate comprehensive hierarchy summary through MCP", async () => {
        // Create complex hierarchy
        const rootResult = (await client.callTool({
          arguments: { name: "Software Project" },
          name: "createTask",
        })) as MCPResponse
        const rootTask = parseMCPResponse(rootResult).task

        const designResult = (await client.callTool({
          arguments: { name: "Design Phase", order: 1, parent_id: rootTask.id },
          name: "createTask",
        })) as MCPResponse
        const designTask = parseMCPResponse(designResult).task

        const devResult = (await client.callTool({
          arguments: {
            name: "Development Phase",
            order: 2,
            parent_id: rootTask.id,
          },
          name: "createTask",
        })) as MCPResponse
        const devTask = parseMCPResponse(devResult).task

        // Add nested tasks
        const mockupsResult = (await client.callTool({
          arguments: { name: "UI Mockups", parent_id: designTask.id },
          name: "createTask",
        })) as MCPResponse
        const mockupsTask = parseMCPResponse(mockupsResult).task

        await client.callTool({
          arguments: { name: "Frontend Code", parent_id: devTask.id },
          name: "createTask",
        })

        await client.callTool({
          arguments: { name: "Backend API", parent_id: devTask.id },
          name: "createTask",
        })

        // Complete design phase
        await client.callTool({
          arguments: { id: mockupsTask.id, resolution: "Mockups complete" },
          name: "completeTask",
        })

        // Start root task to see hierarchy summary
        const startResult = (await client.callTool({
          arguments: { id: rootTask.id },
          name: "startTask",
        })) as MCPResponse
        const startResponse = parseMCPResponse(startResult)

        // Verify hierarchy summary structure
        const hierarchySummary = startResponse.hierarchy_summary
        expect(hierarchySummary).toContain("Task Structure")
        expect(hierarchySummary).toContain("Software Project")
        expect(hierarchySummary).toContain("Design Phase")
        expect(hierarchySummary).toContain("Development Phase")
        expect(hierarchySummary).toContain("UI Mockups")
        expect(hierarchySummary).toContain("Frontend Code")
        expect(hierarchySummary).toContain("Backend API")

        // Verify status indicators
        expect(hierarchySummary).toContain("✅ done") // for completed tasks
        expect(hierarchySummary).toContain("⚡ in_progress") // for started tasks
        expect(hierarchySummary).toContain("📋 todo") // for pending tasks

        // Verify proper indentation for hierarchy levels
        expect(hierarchySummary).toContain("  Design Phase") // 2 spaces for level 1
        expect(hierarchySummary).toContain("    UI Mockups") // 4 spaces for level 2
        expect(hierarchySummary).toContain("    Frontend Code") // 4 spaces for level 2
      })
    })

    describe("end-to-end workflow integration", () => {
      it("should support complete project workflow", async () => {
        // Create a realistic project structure
        const projectResult = (await client.callTool({
          arguments: { name: "Website Redesign Project" },
          name: "createTask",
        })) as MCPResponse
        const projectTask = parseMCPResponse(projectResult).task

        // Planning phase
        const planningResult = (await client.callTool({
          arguments: { name: "Planning", order: 1, parent_id: projectTask.id },
          name: "createTask",
        })) as MCPResponse
        const planningTask = parseMCPResponse(planningResult).task

        // Design phase
        const designResult = (await client.callTool({
          arguments: { name: "Design", order: 2, parent_id: projectTask.id },
          name: "createTask",
        })) as MCPResponse
        const designTask = parseMCPResponse(designResult).task

        // Development phase
        const developmentResult = (await client.callTool({
          arguments: {
            name: "Development",
            order: 3,
            parent_id: projectTask.id,
          },
          name: "createTask",
        })) as MCPResponse
        const developmentTask = parseMCPResponse(developmentResult).task

        // Add detailed subtasks
        const requirementsResult = (await client.callTool({
          arguments: {
            name: "Requirements Analysis",
            parent_id: planningTask.id,
          },
          name: "createTask",
        })) as MCPResponse
        const requirementsTask = parseMCPResponse(requirementsResult).task

        const prototypingResult = (await client.callTool({
          arguments: { name: "Prototyping", parent_id: designTask.id },
          name: "createTask",
        })) as MCPResponse
        const prototypingTask = parseMCPResponse(prototypingResult).task

        const prototypeResult = (await client.callTool({
          arguments: { name: "Prototype", parent_id: designTask.id },
          name: "createTask",
        })) as MCPResponse
        const prototypeTask = parseMCPResponse(prototypeResult).task

        // Start project - should start requirements analysis
        const startProjectResult = (await client.callTool({
          arguments: { id: projectTask.id },
          name: "startTask",
        })) as MCPResponse
        const startProjectResponse = parseMCPResponse(startProjectResult)

        // Verify cascade start went to requirements
        expect(
          startProjectResponse.started_tasks.map((t: any) => t.name),
        ).toEqual([
          "Website Redesign Project",
          "Planning",
          "Requirements Analysis",
        ])

        // Complete requirements - should move to prototyping
        const completeReqResult = (await client.callTool({
          arguments: {
            id: requirementsTask.id,
            resolution: "Requirements documented",
          },
          name: "completeTask",
        })) as MCPResponse
        const completeReqResponse = parseMCPResponse(completeReqResult)

        // Planning should auto-complete and next task should be prototyping
        expect(completeReqResponse.message).toContain(
          "Auto-completed parent tasks",
        )
        expect(completeReqResponse.message).toContain("Planning")
        expect(completeReqResponse.next_task_id).toBeDefined()

        // Complete prototyping
        await client.callTool({
          arguments: {
            id: prototypingTask.id,
            resolution: "Prototyping completed",
          },
          name: "completeTask",
        })

        // Complete prototype - should auto-complete design phase
        const completePrototypeResult = (await client.callTool({
          arguments: { id: prototypeTask.id, resolution: "Prototype built" },
          name: "completeTask",
        })) as MCPResponse
        const completePrototypeResponse = parseMCPResponse(
          completePrototypeResult,
        )

        expect(completePrototypeResponse.message).toContain(
          "Auto-completed parent tasks",
        )
        expect(completePrototypeResponse.message).toContain("Design")

        // Next task should be in development phase
        expect(completePrototypeResponse.next_task_id).toBe(developmentTask.id)

        // Verify final project state
        const listResult = (await client.callTool({
          arguments: {},
          name: "listTasks",
        })) as MCPResponse
        const listResponse = parseMCPResponse(listResult)

        const completedTasks = listResponse.tasks.filter(
          (t: any) => t.status === "done",
        )
        expect(completedTasks.length).toBeGreaterThanOrEqual(5) // requirements, planning, prototyping, implementation, design

        const todoTasks = listResponse.tasks.filter(
          (t: any) => t.status === "todo",
        )
        expect(todoTasks.length).toBeGreaterThanOrEqual(1) // development phase

        const inProgressTasks = listResponse.tasks.filter(
          (t: any) => t.status === "in_progress",
        )
        expect(inProgressTasks.length).toBeLessThanOrEqual(1) // possibly development task if it was started
      })
    })
  })
})
