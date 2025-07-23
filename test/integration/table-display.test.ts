import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { MCPResponse } from "./shared.js"
import {
  clearAllTasks,
  client,
  parseMCPResponse,
  setupMCPConnection,
} from "./shared.js"

describe("Table Display Integration Tests", () => {
  beforeAll(async () => {
    await setupMCPConnection()
  })

  beforeEach(async () => {
    await clearAllTasks()
  })

  afterAll(async () => {
    await clearAllTasks()
  })

  describe("Progress Table Display", () => {
    it("should display parent task name and status changed in progress table", async () => {
      // Create parent task
      const parentResult = await client.callTool({
        arguments: { name: "Integration Parent Task" },
        name: "createTask",
      })
      const parentTask = parseMCPResponse(parentResult as MCPResponse).task

      // Create child task
      const childResult = await client.callTool({
        arguments: {
          name: "Integration Child Task",
          parentId: parentTask.id,
        },
        name: "createTask",
      })
      const childTask = parseMCPResponse(childResult as MCPResponse).task

      // Start parent task
      await client.callTool({
        arguments: { id: parentTask.id },
        name: "startTask",
      })

      // Complete child task to trigger progress summary
      const completeResult = await client.callTool({
        arguments: {
          id: childTask.id,
          resolution: "Integration test completed",
        },
        name: "completeTask",
      })

      const response = parseMCPResponse(completeResult as MCPResponse)
      const progressTable = response.progress_summary.table

      // Verify new table format with additional columns
      expect(progressTable).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )

      // Verify parent task shows no parent (-)
      expect(progressTable).toMatch(
        /\| Integration Parent Task \| - \| ✅ done \| ✓ \|/,
      )

      // Verify status changed column exists and shows check mark
      expect(progressTable).toMatch(/✓/)

      // Verify subtasks and progress columns are present
      expect(progressTable).toContain("| 1/1 | 100% |")
    })

    it("should handle hierarchical parent relationships in progress table", async () => {
      // Create multi-level hierarchy: Root -> Mid -> Leaf
      const rootResult = await client.callTool({
        arguments: { name: "Root Level Task" },
        name: "createTask",
      })
      const rootTask = parseMCPResponse(rootResult as MCPResponse).task

      const midResult = await client.callTool({
        arguments: {
          name: "Mid Level Task",
          parentId: rootTask.id,
        },
        name: "createTask",
      })
      const midTask = parseMCPResponse(midResult as MCPResponse).task

      const leafResult = await client.callTool({
        arguments: {
          name: "Leaf Level Task",
          parentId: midTask.id,
        },
        name: "createTask",
      })
      const leafTask = parseMCPResponse(leafResult as MCPResponse).task

      // Start root task
      await client.callTool({
        arguments: { id: rootTask.id },
        name: "startTask",
      })

      // Complete leaf task to trigger auto-completion of hierarchy
      const completeResult = await client.callTool({
        arguments: {
          id: leafTask.id,
          resolution: "Leaf task completed",
        },
        name: "completeTask",
      })

      const response = parseMCPResponse(completeResult as MCPResponse)
      const progressTable = response.progress_summary.table

      // Verify both parent tasks show correct parent relationships
      expect(progressTable).toMatch(
        /\| Root Level Task \| - \| ✅ done \| ✓ \|/,
      )
      expect(progressTable).toMatch(
        /\| Mid Level Task \| Root Level Task \| ✅ done \| ✓ \|/,
      )

      // Both should show 100% completion
      expect(progressTable).toMatch(/\| 1\/1 \| 100% \|.*\| 1\/1 \| 100% \|/s)
    })

    it("should handle multiple siblings with same parent in progress table", async () => {
      // Create parent with multiple children
      const parentResult = await client.callTool({
        arguments: { name: "Multi-Child Parent" },
        name: "createTask",
      })
      const parentTask = parseMCPResponse(parentResult as MCPResponse).task

      // Create multiple children
      const child1Result = await client.callTool({
        arguments: {
          name: "First Child",
          parentId: parentTask.id,
        },
        name: "createTask",
      })
      const child1Task = parseMCPResponse(child1Result as MCPResponse).task

      const child2Result = await client.callTool({
        arguments: {
          name: "Second Child",
          parentId: parentTask.id,
        },
        name: "createTask",
      })
      const child2Task = parseMCPResponse(child2Result as MCPResponse).task

      // Start parent task
      await client.callTool({
        arguments: { id: parentTask.id },
        name: "startTask",
      })

      // Complete first child
      await client.callTool({
        arguments: {
          id: child1Task.id,
          resolution: "First child done",
        },
        name: "completeTask",
      })

      // Complete second child
      const completeResult = await client.callTool({
        arguments: {
          id: child2Task.id,
          resolution: "Second child done",
        },
        name: "completeTask",
      })

      const response = parseMCPResponse(completeResult as MCPResponse)
      const progressTable = response.progress_summary.table

      // Verify parent shows correct count of completed subtasks
      expect(progressTable).toContain(
        "| Multi-Child Parent | - | ✅ done | ✓ | 2/2 | 100% |",
      )
    })
  })

  describe("Hierarchy Table Display", () => {
    it("should display parent task name and status changed in hierarchy summary", async () => {
      // Create hierarchical structure
      const rootResult = await client.callTool({
        arguments: { name: "Hierarchy Root" },
        name: "createTask",
      })
      const rootTask = parseMCPResponse(rootResult as MCPResponse).task

      const branchResult = await client.callTool({
        arguments: {
          name: "Hierarchy Branch",
          parentId: rootTask.id,
        },
        name: "createTask",
      })
      const branchTask = parseMCPResponse(branchResult as MCPResponse).task

      await client.callTool({
        arguments: {
          name: "Hierarchy Leaf",
          parentId: branchTask.id,
        },
        name: "createTask",
      })

      // Start root task to get hierarchy summary
      const startResult = await client.callTool({
        arguments: { id: rootTask.id },
        name: "startTask",
      })

      const response = parseMCPResponse(startResult as MCPResponse)
      const hierarchySummary = response.hierarchy_summary

      // Verify new table format with additional columns
      expect(hierarchySummary).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )

      // Verify root task shows no parent
      expect(hierarchySummary).toMatch(/Hierarchy Root.*\| - \|.*in_progress/)

      // Verify branch shows root as parent
      expect(hierarchySummary).toMatch(
        /Hierarchy Branch.*\| Hierarchy Root \|.*in_progress/,
      )

      // Verify leaf shows branch as parent
      expect(hierarchySummary).toMatch(
        /Hierarchy Leaf.*\| Hierarchy Branch \|.*in_progress/,
      )

      // Verify all entries have status change indicators
      expect(hierarchySummary).toMatch(/✓/)
    })

    it("should display task names without indentation but with parent names", async () => {
      // Create deep hierarchy: L1 -> L2 -> L3 -> L4
      const level1Result = await client.callTool({
        arguments: { name: "Level 1" },
        name: "createTask",
      })
      const level1Task = parseMCPResponse(level1Result as MCPResponse).task

      const level2Result = await client.callTool({
        arguments: {
          name: "Level 2",
          parentId: level1Task.id,
        },
        name: "createTask",
      })
      const level2Task = parseMCPResponse(level2Result as MCPResponse).task

      const level3Result = await client.callTool({
        arguments: {
          name: "Level 3",
          parentId: level2Task.id,
        },
        name: "createTask",
      })
      const level3Task = parseMCPResponse(level3Result as MCPResponse).task

      await client.callTool({
        arguments: {
          name: "Level 4",
          parentId: level3Task.id,
        },
        name: "createTask",
      })

      // Start level 1 task
      const startResult = await client.callTool({
        arguments: { id: level1Task.id },
        name: "startTask",
      })

      const response = parseMCPResponse(startResult as MCPResponse)
      const hierarchySummary = response.hierarchy_summary

      // Verify task names are displayed without indentation (like completeTask format)
      expect(hierarchySummary).toMatch(/\| Level 1 \| - \|/) // No indentation
      expect(hierarchySummary).toMatch(/\| Level 2 \| Level 1 \|/) // No indentation
      expect(hierarchySummary).toMatch(/\| Level 3 \| Level 2 \|/) // No indentation
      expect(hierarchySummary).toMatch(/\| Level 4 \| Level 3 \|/) // No indentation
    })

    it("should handle complex branching hierarchy with flat task names", async () => {
      // Create branching structure: Main -> (Branch A, Branch B) -> (Leaf A1, Leaf A2, Leaf B1)
      const mainResult = await client.callTool({
        arguments: { name: "Main Branch" },
        name: "createTask",
      })
      const mainTask = parseMCPResponse(mainResult as MCPResponse).task

      const branchAResult = await client.callTool({
        arguments: {
          name: "Branch A",
          parentId: mainTask.id,
        },
        name: "createTask",
      })
      const branchATask = parseMCPResponse(branchAResult as MCPResponse).task

      const branchBResult = await client.callTool({
        arguments: {
          name: "Branch B",
          parentId: mainTask.id,
        },
        name: "createTask",
      })
      const branchBTask = parseMCPResponse(branchBResult as MCPResponse).task

      // Create leaves for Branch A
      await client.callTool({
        arguments: {
          name: "Leaf A1",
          parentId: branchATask.id,
        },
        name: "createTask",
      })

      await client.callTool({
        arguments: {
          name: "Leaf A2",
          parentId: branchATask.id,
        },
        name: "createTask",
      })

      // Create leaf for Branch B
      await client.callTool({
        arguments: {
          name: "Leaf B1",
          parentId: branchBTask.id,
        },
        name: "createTask",
      })

      // Start main task
      const startResult = await client.callTool({
        arguments: { id: mainTask.id },
        name: "startTask",
      })

      const response = parseMCPResponse(startResult as MCPResponse)
      const hierarchySummary = response.hierarchy_summary

      // Verify all parent relationships are correct
      expect(hierarchySummary).toMatch(/Main Branch.*\| - \|/)
      expect(hierarchySummary).toMatch(/Branch A.*\| Main Branch \|/)
      expect(hierarchySummary).toMatch(/Branch B.*\| Main Branch \|/)
      expect(hierarchySummary).toMatch(/Leaf A1.*\| Branch A \|/)
      expect(hierarchySummary).toMatch(/Leaf A2.*\| Branch A \|/)
      expect(hierarchySummary).toMatch(/Leaf B1.*\| Branch B \|/)

      // Verify task names are displayed without indentation (like completeTask format)
      expect(hierarchySummary).toMatch(/\| Main Branch \| - \|/) // Level 0
      expect(hierarchySummary).toMatch(/\| Branch A \| Main Branch \|/) // Level 1 - no indentation
      expect(hierarchySummary).toMatch(/\| Branch B \| Main Branch \|/) // Level 1 - no indentation
      expect(hierarchySummary).toMatch(/\| Leaf A1 \| Branch A \|/) // Level 2 - no indentation
      expect(hierarchySummary).toMatch(/\| Leaf A2 \| Branch A \|/) // Level 2 - no indentation
      expect(hierarchySummary).toMatch(/\| Leaf B1 \| Branch B \|/) // Level 2 - no indentation
    })
  })

  describe("Status Changed Column Accuracy", () => {
    it("should update status changed indicator when task status changes", async () => {
      // Create a task
      const taskResult = await client.callTool({
        arguments: { name: "Timestamp Test Task" },
        name: "createTask",
      })
      const task = parseMCPResponse(taskResult as MCPResponse).task

      // Create child task
      const childResult = await client.callTool({
        arguments: {
          name: "Timestamp Child Task",
          parentId: task.id,
        },
        name: "createTask",
      })
      const childTask = parseMCPResponse(childResult as MCPResponse).task

      // Start task (changes status from todo to in_progress)
      const startResult = await client.callTool({
        arguments: { id: task.id },
        name: "startTask",
      })

      const startResponse = parseMCPResponse(startResult as MCPResponse)
      const startHierarchy = startResponse.hierarchy_summary

      // Extract status change indicator from the table
      const statusChangeMatch = startHierarchy.match(
        /Timestamp Test Task.*?\| - \| ⚡ in_progress \| ✓ \|/,
      )
      expect(statusChangeMatch).toBeTruthy()

      // Verify the task shows as status changed since it was started
      expect(startHierarchy).toContain("✓")

      // Complete child task to trigger status change for parent
      await new Promise((resolve) => setTimeout(resolve, 100))

      const completeResult = await client.callTool({
        arguments: {
          id: childTask.id,
          resolution: "Status timestamp test",
        },
        name: "completeTask",
      })

      const completeResponse = parseMCPResponse(completeResult as MCPResponse)
      const progressTable = completeResponse.progress_summary.table

      // Extract completion status change indicator
      const completeStatusChangeMatch = progressTable.match(
        /\| Timestamp Test Task \| - \| ✅ done \| ✓ \|/,
      )
      expect(completeStatusChangeMatch).toBeTruthy()

      // Verify both status changes are indicated with check marks
      expect(startHierarchy).toContain("✓")
      expect(progressTable).toContain("✓")
    })
  })
})
