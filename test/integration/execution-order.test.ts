import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { MCPResponse } from "./shared.js"
import { clearAllTasks, client, setupMCPConnection } from "./shared.js"

describe("Execution Order Validation - Integration Tests", () => {
  beforeAll(async () => {
    await setupMCPConnection()
  })

  beforeEach(() => {
    clearAllTasks()
  })

  describe("Basic Execution Order Validation", () => {
    it("should enforce execution order for sibling tasks", async () => {
      // Create tasks with specific order
      const task1Response = (await client.callTool({
        arguments: {
          description: "Must be completed first",
          name: "First Task",
          order: 1,
        },
        name: "createTask",
      })) as MCPResponse
      expect(task1Response.isError).toBeUndefined()
      const task1 = JSON.parse((task1Response.content![0] as any).text).task

      const task2Response = (await client.callTool({
        arguments: {
          description: "Must be completed second",
          name: "Second Task",
          order: 2,
        },
        name: "createTask",
      })) as MCPResponse
      expect(task2Response.isError).toBeUndefined()
      const task2 = JSON.parse((task2Response.content![0] as any).text).task

      // Try to start second task without completing first - should fail
      const startTask2Response = (await client.callTool({
        arguments: {
          id: task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask2Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startTask2Response.content![0] as any).text,
      )
      expect(errorContent.error.code).toBe("EXECUTION_ORDER_VIOLATION")
      expect(errorContent.error.message).toContain("Execution order violation")
      expect(errorContent.error.message).toContain(
        'Cannot start task "Second Task"',
      )
      expect(errorContent.error.message).toContain("First Task")
      expect(errorContent.error.message).toContain(
        "| Order | Task Name | Status | Description |",
      )

      // Start first task - should succeed
      const startTask1Response = (await client.callTool({
        arguments: {
          id: task1.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask1Response.isError).toBeUndefined()

      // Complete first task
      const completeTask1Response = (await client.callTool({
        arguments: {
          id: task1.id,
          resolution: "First task completed",
        },
        name: "completeTask",
      })) as MCPResponse
      expect(completeTask1Response.isError).toBeUndefined()

      // Now start second task - should succeed
      const startTask2AgainResponse = (await client.callTool({
        arguments: {
          id: task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask2AgainResponse.isError).toBeUndefined()
    })

    it("should allow starting tasks in correct order", async () => {
      // Create three sequential tasks
      const task1Response = (await client.callTool({
        arguments: {
          name: "Setup",
          order: 1,
        },
        name: "createTask",
      })) as MCPResponse
      const task1 = JSON.parse((task1Response.content![0] as any).text).task

      const task2Response = (await client.callTool({
        arguments: {
          name: "Implementation",
          order: 2,
        },
        name: "createTask",
      })) as MCPResponse
      const task2 = JSON.parse((task2Response.content![0] as any).text).task

      const task3Response = (await client.callTool({
        arguments: {
          name: "Testing",
          order: 3,
        },
        name: "createTask",
      })) as MCPResponse
      const task3 = JSON.parse((task3Response.content![0] as any).text).task

      // Start tasks in correct order
      await client.callTool({
        arguments: { id: task1.id },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: task1.id,
          resolution: "Setup done",
        },
        name: "completeTask",
      })

      await client.callTool({
        arguments: { id: task2.id },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: task2.id,
          resolution: "Implementation done",
        },
        name: "completeTask",
      })

      const startTask3Response = (await client.callTool({
        arguments: { id: task3.id },
        name: "startTask",
      })) as MCPResponse
      expect(startTask3Response.isError).toBeUndefined()
    })
  })

  describe("Hierarchical Execution Order Validation", () => {
    it("should validate order including parent sibling scope", async () => {
      // Create two parent tasks
      const parent1Response = (await client.callTool({
        arguments: {
          name: "Feature A",
          order: 1,
        },
        name: "createTask",
      })) as MCPResponse
      const parent1 = JSON.parse((parent1Response.content![0] as any).text).task

      const parent2Response = (await client.callTool({
        arguments: {
          name: "Feature B",
          order: 2,
        },
        name: "createTask",
      })) as MCPResponse
      const parent2 = JSON.parse((parent2Response.content![0] as any).text).task

      // Create children under parent1
      await client.callTool({
        arguments: {
          name: "Feature A - Task 1",
          order: 1,
          parentId: parent1.id,
        },
        name: "createTask",
      })

      const child2P1Response = (await client.callTool({
        arguments: {
          name: "Feature A - Task 2",
          order: 2,
          parentId: parent1.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(child2P1Response.isError).toBeUndefined()

      // Create children under parent2
      const child1P2Response = (await client.callTool({
        arguments: {
          name: "Feature B - Task 1",
          order: 1,
          parentId: parent2.id,
        },
        name: "createTask",
      })) as MCPResponse
      const child1P2 = JSON.parse(
        (child1P2Response.content![0] as any).text,
      ).task

      // Should NOT be able to start first child of parent2
      // because parent1 (preceding sibling of parent2) is not completed
      const startChild1P2Response = (await client.callTool({
        arguments: {
          id: child1P2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startChild1P2Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startChild1P2Response.content![0] as any).text,
      )
      expect(errorContent.error.message).toContain("Feature A")

      // Complete parent1 first - need to complete its subtasks first
      const featureATask1Response = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const allTasks = JSON.parse(
        (featureATask1Response.content![0] as any).text,
      ).tasks
      const featureA = allTasks.find((t: any) => t.name === "Feature A")
      const featureATask1 = featureA.tasks.find(
        (t: any) => t.name === "Feature A - Task 1",
      )
      const featureATask2 = featureA.tasks.find(
        (t: any) => t.name === "Feature A - Task 2",
      )

      // Complete Feature A's subtasks
      await client.callTool({
        arguments: {
          id: featureATask1.id,
          resolution: "Feature A Task 1 completed",
        },
        name: "completeTask",
      })

      await client.callTool({
        arguments: {
          id: featureATask2.id,
        },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: featureATask2.id,
          resolution: "Feature A Task 2 completed",
        },
        name: "completeTask",
      })

      // Now complete Feature A itself
      await client.callTool({
        arguments: {
          id: parent1.id,
          resolution: "Feature A completed",
        },
        name: "completeTask",
      })

      // Now should be able to start first child of parent2
      const startChild1P2RetryResponse = (await client.callTool({
        arguments: {
          id: child1P2.id,
        },
        name: "startTask",
      })) as MCPResponse

      expect(startChild1P2RetryResponse.isError).toBeUndefined()

      // Create a new test case for sibling order within the same parent
      // Add another child under Feature B to test sibling order
      const child2P2Response = (await client.callTool({
        arguments: {
          name: "Feature B - Task 2",
          order: 2,
          parentId: parent2.id,
        },
        name: "createTask",
      })) as MCPResponse
      const child2P2 = JSON.parse(
        (child2P2Response.content![0] as any).text,
      ).task

      // Should not be able to start second child of Feature B
      // without completing first child
      const startChild2P2Response = (await client.callTool({
        arguments: {
          id: child2P2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startChild2P2Response.isError).toBe(true)

      const errorContent2 = JSON.parse(
        (startChild2P2Response.content![0] as any).text,
      )
      expect(errorContent2.error.code).toBe("EXECUTION_ORDER_VIOLATION")
      expect(errorContent2.error.message).toContain(
        'within parent task "Feature B"',
      )
    })

    it("should handle complex nested hierarchy order validation", async () => {
      // Create root task
      const rootResponse = (await client.callTool({
        arguments: {
          name: "Project Alpha",
          order: 1,
        },
        name: "createTask",
      })) as MCPResponse
      const root = JSON.parse((rootResponse.content![0] as any).text).task

      // Create level 1 tasks
      const level1Task1Response = (await client.callTool({
        arguments: {
          name: "Phase 1",
          order: 1,
          parentId: root.id,
        },
        name: "createTask",
      })) as MCPResponse
      const level1Task1 = JSON.parse(
        (level1Task1Response.content![0] as any).text,
      ).task

      const level1Task2Response = (await client.callTool({
        arguments: {
          name: "Phase 2",
          order: 2,
          parentId: root.id,
        },
        name: "createTask",
      })) as MCPResponse
      const level1Task2 = JSON.parse(
        (level1Task2Response.content![0] as any).text,
      ).task

      // Create level 2 tasks under Phase 2
      await client.callTool({
        arguments: {
          name: "Phase 2 - Step 1",
          order: 1,
          parentId: level1Task2.id,
        },
        name: "createTask",
      })

      const level2Task2Response = (await client.callTool({
        arguments: {
          name: "Phase 2 - Step 2",
          order: 2,
          parentId: level1Task2.id,
        },
        name: "createTask",
      })) as MCPResponse
      const level2Task2 = JSON.parse(
        (level2Task2Response.content![0] as any).text,
      ).task

      // Try to start Phase 2 without completing Phase 1 - should fail
      const startLevel1Task2Response = (await client.callTool({
        arguments: {
          id: level1Task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startLevel1Task2Response.isError).toBe(true)

      // Start and complete Phase 1
      await client.callTool({
        arguments: { id: level1Task1.id },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: level1Task1.id,
          resolution: "Phase 1 complete",
        },
        name: "completeTask",
      })

      // Now Phase 2 should start successfully
      const startLevel1Task2AgainResponse = (await client.callTool({
        arguments: {
          id: level1Task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startLevel1Task2AgainResponse.isError).toBeUndefined()

      // Within Phase 2, Step 2 should not start before Step 1
      const startLevel2Task2Response = (await client.callTool({
        arguments: {
          id: level2Task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startLevel2Task2Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startLevel2Task2Response.content![0] as any).text,
      )
      expect(errorContent.error.message).toContain(
        'within parent task "Phase 2"',
      )
    })
  })

  describe("Edge Cases and Error Handling", () => {
    it("should provide detailed error messages with task table", async () => {
      // Create tasks with descriptions
      await client.callTool({
        arguments: {
          description: "Initialize database schema and seed data",
          name: "Database Setup",
          order: 1,
        },
        name: "createTask",
      })

      await client.callTool({
        arguments: {
          description: "Build REST API endpoints",
          name: "API Development",
          order: 2,
        },
        name: "createTask",
      })

      const task3Response = (await client.callTool({
        arguments: {
          description: "Connect frontend to API",
          name: "Frontend Integration",
          order: 3,
        },
        name: "createTask",
      })) as MCPResponse
      const task3 = JSON.parse((task3Response.content![0] as any).text).task

      // Try to start third task - should get detailed error
      const startTask3Response = (await client.callTool({
        arguments: {
          id: task3.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask3Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startTask3Response.content![0] as any).text,
      )
      const errorMessage = errorContent.error.message

      // Check for detailed table format
      expect(errorMessage).toContain(
        "| Order | Task Name | Status | Description |",
      )
      expect(errorMessage).toContain(
        "| 1 | Database Setup | todo | Initialize database schema and seed data |",
      )
      expect(errorMessage).toContain(
        "| 2 | API Development | todo | Build REST API endpoints |",
      )
      expect(errorMessage).toContain(
        "The following 2 task(s) with smaller order values must be completed first",
      )
      expect(errorMessage).toContain("Please complete these tasks in order")
    })

    it("should handle tasks with no descriptions in error table", async () => {
      await client.callTool({
        arguments: {
          name: "Task Without Description",
          order: 1,
        },
        name: "createTask",
      })

      const task2Response = (await client.callTool({
        arguments: {
          name: "Second Task",
          order: 2,
        },
        name: "createTask",
      })) as MCPResponse
      const task2 = JSON.parse((task2Response.content![0] as any).text).task

      // Try to start second task
      const startTask2Response = (await client.callTool({
        arguments: {
          id: task2.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask2Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startTask2Response.content![0] as any).text,
      )
      const errorMessage = errorContent.error.message

      // Should handle missing description gracefully
      expect(errorMessage).toContain(
        "| 1 | Task Without Description | todo | No description |",
      )
    })

    it("should work correctly with mixed completion states", async () => {
      // Create a series of tasks
      const task1Response = (await client.callTool({
        arguments: {
          name: "Task 1",
          order: 1,
        },
        name: "createTask",
      })) as MCPResponse
      const task1 = JSON.parse((task1Response.content![0] as any).text).task

      const task2Response = (await client.callTool({
        arguments: {
          name: "Task 2",
          order: 2,
        },
        name: "createTask",
      })) as MCPResponse
      const task2 = JSON.parse((task2Response.content![0] as any).text).task

      const task3Response = (await client.callTool({
        arguments: {
          name: "Task 3",
          order: 3,
        },
        name: "createTask",
      })) as MCPResponse
      const task3 = JSON.parse((task3Response.content![0] as any).text).task

      const task4Response = (await client.callTool({
        arguments: {
          name: "Task 4",
          order: 4,
        },
        name: "createTask",
      })) as MCPResponse
      const task4 = JSON.parse((task4Response.content![0] as any).text).task

      // Complete tasks 1 and 2
      await client.callTool({
        arguments: { id: task1.id },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: task1.id,
          resolution: "Done",
        },
        name: "completeTask",
      })

      await client.callTool({
        arguments: { id: task2.id },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: task2.id,
          resolution: "Done",
        },
        name: "completeTask",
      })

      // Try to start task 4 (should fail because task 3 is not done)
      const startTask4Response = (await client.callTool({
        arguments: {
          id: task4.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask4Response.isError).toBe(true)

      const errorContent = JSON.parse(
        (startTask4Response.content![0] as any).text,
      )
      const errorMessage = errorContent.error.message

      // Should only show task 3 as incomplete
      expect(errorMessage).toContain(
        "The following 1 task(s) with smaller order values must be completed first",
      )
      expect(errorMessage).toContain("| 3 | Task 3 | todo |")
      expect(errorMessage).not.toContain("Task 1")
      expect(errorMessage).not.toContain("Task 2")

      // Start task 3 - should succeed
      const startTask3Response = (await client.callTool({
        arguments: {
          id: task3.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask3Response.isError).toBeUndefined()

      // Complete task 3
      await client.callTool({
        arguments: {
          id: task3.id,
          resolution: "Done",
        },
        name: "completeTask",
      })

      // Now start task 4 - should succeed
      const startTask4AgainResponse = (await client.callTool({
        arguments: {
          id: task4.id,
        },
        name: "startTask",
      })) as MCPResponse
      expect(startTask4AgainResponse.isError).toBeUndefined()
    })
  })

  describe("Nested Hierarchy Execution Order Bug", () => {
    it("should prevent starting level 2 task 1 when level 1 task 1 is not completed", async () => {
      // Create the exact structure from the prompt
      const rootTaskResponse = (await client.callTool({
        arguments: {
          description: "main project task",
          name: "root task",
        },
        name: "createTask",
      })) as MCPResponse
      expect(rootTaskResponse.isError).toBeUndefined()
      const rootTask = JSON.parse(
        (rootTaskResponse.content![0] as any).text,
      ).task

      // Create level 1 task 1
      const level1Task1Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 1 task 1",
          parentId: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level1Task1Response.isError).toBeUndefined()

      // Create level 1 task 2
      const level1Task2Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 1 task 2",
          parentId: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level1Task2Response.isError).toBeUndefined()
      const level1Task2 = JSON.parse(
        (level1Task2Response.content![0] as any).text,
      ).task

      // Create level 2 task 1 under level 1 task 2
      const level2Task1Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 2 task 1",
          parentId: level1Task2.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level2Task1Response.isError).toBeUndefined()
      const level2Task1 = JSON.parse(
        (level2Task1Response.content![0] as any).text,
      ).task

      // Create level 2 task 2 under level 1 task 2
      const level2Task2Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 2 task 2",
          parentId: level1Task2.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level2Task2Response.isError).toBeUndefined()

      // Try to start level 2 task 1 while level 1 task 1 is still todo
      // This should fail because level 1 task 1 must be completed first
      const startLevel2Task1Response = (await client.callTool({
        arguments: {
          id: level2Task1.id,
        },
        name: "startTask",
      })) as MCPResponse

      // This should fail, but currently it might succeed (the bug)
      expect(startLevel2Task1Response.isError).toBe(true)

      if (startLevel2Task1Response.isError) {
        const errorContent = JSON.parse(
          (startLevel2Task1Response.content![0] as any).text,
        )
        expect(errorContent.error.message).toContain("level 1 task 1")
      }
    })

    it("should allow starting level 2 task 1 after level 1 task 1 is completed", async () => {
      // Create the same structure as above
      const rootTaskResponse = (await client.callTool({
        arguments: {
          description: "main project task",
          name: "root task",
        },
        name: "createTask",
      })) as MCPResponse
      expect(rootTaskResponse.isError).toBeUndefined()
      const rootTask = JSON.parse(
        (rootTaskResponse.content![0] as any).text,
      ).task

      const level1Task1Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 1 task 1",
          parentId: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level1Task1Response.isError).toBeUndefined()
      const level1Task1 = JSON.parse(
        (level1Task1Response.content![0] as any).text,
      ).task

      const level1Task2Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 1 task 2",
          parentId: rootTask.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level1Task2Response.isError).toBeUndefined()
      const level1Task2 = JSON.parse(
        (level1Task2Response.content![0] as any).text,
      ).task

      const level2Task1Response = (await client.callTool({
        arguments: {
          description: "",
          name: "level 2 task 1",
          parentId: level1Task2.id,
        },
        name: "createTask",
      })) as MCPResponse
      expect(level2Task1Response.isError).toBeUndefined()
      const level2Task1 = JSON.parse(
        (level2Task1Response.content![0] as any).text,
      ).task

      // First complete level 1 task 1
      await client.callTool({
        arguments: {
          id: level1Task1.id,
        },
        name: "startTask",
      })
      await client.callTool({
        arguments: {
          id: level1Task1.id,
          resolution: "Completed",
        },
        name: "completeTask",
      })

      // Now try to start level 2 task 1 - this should succeed
      const startLevel2Task1Response = (await client.callTool({
        arguments: {
          id: level2Task1.id,
        },
        name: "startTask",
      })) as MCPResponse

      expect(startLevel2Task1Response.isError).toBeUndefined()
    })
  })
})
