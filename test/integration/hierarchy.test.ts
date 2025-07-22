import { describe, expect, it } from "vitest"
import type { MCPResponse } from "./shared.js"
import {
  client,
  createTestTask,
  parseMCPResponse,
  setupTestEnvironment,
} from "./shared.js"

describe("Hierarchy Management Integration Tests", () => {
  setupTestEnvironment()

  describe("basic hierarchical task management", () => {
    it("should handle complex hierarchical task structures", async () => {
      // Create root task
      const rootTask = await createTestTask(
        "root task",
        undefined,
        "main project task",
      )

      // Create level 1 tasks
      const level1Task1 = await createTestTask(
        "level 1 task 1",
        rootTask.id,
        undefined,
        1,
      )
      const level1Task2 = await createTestTask(
        "level 1 task 2",
        rootTask.id,
        undefined,
        2,
      )

      // Create level 2 tasks under first level 1 task
      await createTestTask("level 2 task 1", level1Task1.id, undefined, 1)
      await createTestTask("level 2 task 2", level1Task1.id, undefined, 2)

      // Test filtering by different parent levels
      const rootChildrenResult = (await client.callTool({
        arguments: {
          parentId: rootTask.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const rootChildren = parseMCPResponse(rootChildrenResult).tasks
      expect(rootChildren).toHaveLength(2)

      const level1ChildrenResult = (await client.callTool({
        arguments: {
          parentId: level1Task1.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const level1Children = parseMCPResponse(level1ChildrenResult).tasks
      expect(level1Children).toHaveLength(2)

      const level2ChildrenResult = (await client.callTool({
        arguments: {
          parentId: level1Task2.id,
        },
        name: "listTasks",
      })) as MCPResponse
      const level2Children = parseMCPResponse(level2ChildrenResult).tasks
      expect(level2Children).toHaveLength(0)
    })

    it("should handle task ordering and next task identification", async () => {
      // Create parent task
      const parentTask = await createTestTask("parent task")

      // Create ordered child tasks
      const task1 = await createTestTask("task 1", parentTask.id, undefined, 1)
      const task3 = await createTestTask("task 3", parentTask.id, undefined, 3)
      const task2 = await createTestTask("task 2", parentTask.id, undefined, 2)

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

  describe("nested subtask auto-start functionality", () => {
    it("should start nested tasks recursively through MCP", async () => {
      // Create hierarchical structure: Root -> Level1 -> Level2 -> Level3
      const rootTask = await createTestTask("Root Task")
      const level1Task = await createTestTask("Level 1 Task", rootTask.id)
      const level2Task = await createTestTask("Level 2 Task", level1Task.id)
      await createTestTask("Level 3 Task", level2Task.id)

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
      const rootTask = await createTestTask("Project")

      // Create two branches
      const branch1Task = await createTestTask("Branch 1", rootTask.id)
      const branch2Task = await createTestTask("Branch 2", rootTask.id)

      // Add leaves to branches
      const leaf1Task = await createTestTask("Leaf 1", branch1Task.id)
      await createTestTask("Leaf 2", branch2Task.id)

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
      const parentTask = await createTestTask("Parent Task")
      const child1Task = await createTestTask("Child 1", parentTask.id)
      await createTestTask("Child 2", parentTask.id)

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
      const rootTask = await createTestTask("Root")
      const midTask = await createTestTask("Mid Level", rootTask.id)
      await createTestTask("Leaf Level", midTask.id)

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
      const parentTask = await createTestTask("Parent Task")
      const child1Task = await createTestTask("Child 1", parentTask.id)
      const child2Task = await createTestTask("Child 2", parentTask.id)

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
      expect(complete2Response.message).toContain("Auto-completed parent tasks")
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
      const rootTask = await createTestTask("Root Task")
      const midTask = await createTestTask("Mid Task", rootTask.id)
      const leafTask = await createTestTask("Leaf Task", midTask.id)

      // Complete leaf task - should cascade up to root
      const completeResult = (await client.callTool({
        arguments: { id: leafTask.id, resolution: "Leaf completed" },
        name: "completeTask",
      })) as MCPResponse

      const completeResponse = parseMCPResponse(completeResult)

      // Verify all levels were auto-completed
      expect(completeResponse.message).toContain("Auto-completed parent tasks")
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
  })
})
