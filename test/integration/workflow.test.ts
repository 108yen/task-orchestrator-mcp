import { describe, expect, it } from "vitest"
import type { MCPResponse } from "./shared.js"
import {
  client,
  createTestTask,
  parseMCPResponse,
  setupTestEnvironment,
} from "./shared.js"

describe("Workflow Integration Tests", () => {
  setupTestEnvironment()

  describe("complex hierarchy auto-completion workflows", () => {
    it("should handle partial auto-completion in complex hierarchy", async () => {
      // Create root with two branches, one branch completes
      const rootTask = await createTestTask("Project")

      const frontendTask = await createTestTask("Frontend", rootTask.id)
      const backendTask = await createTestTask("Backend", rootTask.id)

      // Add tasks to frontend branch
      const uiTask = await createTestTask("UI Components", frontendTask.id)
      const stylingTask = await createTestTask("Styling", frontendTask.id)

      // Add task to backend branch
      const apiTask = await createTestTask("API", backendTask.id)

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
      const rootTask = await createTestTask("Main Project")
      const phase1Task = await createTestTask("Phase 1", rootTask.id)
      await createTestTask("Phase 2", rootTask.id)

      // Add subtasks to phase1
      const task1 = await createTestTask("Task 1", phase1Task.id)
      const task2 = await createTestTask("Task 2", phase1Task.id)

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
      const rootTask = await createTestTask("Software Project")

      const designTask = await createTestTask(
        "Design Phase",
        rootTask.id,
        undefined,
        1,
      )
      const devTask = await createTestTask(
        "Development Phase",
        rootTask.id,
        undefined,
        2,
      )

      // Add nested tasks
      const mockupsTask = await createTestTask("UI Mockups", designTask.id)
      await createTestTask("Frontend Code", devTask.id)
      await createTestTask("Backend API", devTask.id)

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
      expect(hierarchySummary).toContain("Task Name")
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

      // Verify tasks appear in the hierarchy (new flat format without indentation)
      expect(hierarchySummary).toContain("Design Phase") // Flat format
      expect(hierarchySummary).toContain("UI Mockups") // Flat format
      expect(hierarchySummary).toContain("Frontend Code") // Flat format
    })
  })

  describe("end-to-end workflow integration", () => {
    it("should support complete project workflow", async () => {
      // Create a realistic project structure
      const projectTask = await createTestTask("Website Redesign Project")

      // Planning phase
      const planningTask = await createTestTask(
        "Planning",
        projectTask.id,
        undefined,
        1,
      )

      // Design phase
      const designTask = await createTestTask(
        "Design",
        projectTask.id,
        undefined,
        2,
      )

      // Development phase
      const developmentTask = await createTestTask(
        "Development",
        projectTask.id,
        undefined,
        3,
      )

      // Add detailed subtasks
      const requirementsTask = await createTestTask(
        "Requirements Analysis",
        planningTask.id,
      )
      const prototypingTask = await createTestTask("Prototyping", designTask.id)
      const prototypeTask = await createTestTask("Prototype", designTask.id)

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

      // Start prototyping
      await client.callTool({
        arguments: { id: prototypingTask.id },
        name: "startTask",
      })

      // Complete prototyping
      await client.callTool({
        arguments: {
          id: prototypingTask.id,
          resolution: "Prototyping completed",
        },
        name: "completeTask",
      })

      // Start prototype
      await client.callTool({
        arguments: { id: prototypeTask.id },
        name: "startTask",
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

      // Verify final project state - collect all tasks recursively
      const listResult = (await client.callTool({
        arguments: {},
        name: "listTasks",
      })) as MCPResponse
      const listResponse = parseMCPResponse(listResult)

      // Collect all tasks from all levels
      const allTasks: any[] = []

      const collectTasksFromLevel = async (tasks: any[]) => {
        for (const task of tasks) {
          allTasks.push(task)
          if (task.id) {
            // Get children of this task
            const childResult = (await client.callTool({
              arguments: { parentId: task.id },
              name: "listTasks",
            })) as MCPResponse
            const childResponse = parseMCPResponse(childResult)
            if (childResponse.tasks?.length > 0) {
              await collectTasksFromLevel(childResponse.tasks)
            }
          }
        }
      }

      await collectTasksFromLevel(listResponse.tasks)

      const completedTasks = allTasks.filter((t: any) => t.status === "done")
      expect(completedTasks.length).toBeGreaterThanOrEqual(5) // requirements, planning, prototyping, implementation, design

      const todoTasks = allTasks.filter((t: any) => t.status === "todo")
      expect(todoTasks.length).toBeGreaterThanOrEqual(1) // development phase

      const inProgressTasks = allTasks.filter(
        (t: any) => t.status === "in_progress",
      )
      expect(inProgressTasks.length).toBeLessThanOrEqual(1) // possibly development task if it was started
    })
  })
})
