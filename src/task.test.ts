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

// Mock the storage module
vi.mock("./storage.js", () => {
  let mockTasks: Task[] = []

  return {
    __getMockTasks: () => mockTasks,
    // Reset function for tests
    __resetMockTasks: () => {
      mockTasks = []
    },
    __setMockTasks: (tasks: Task[]) => {
      mockTasks = [...tasks]
    },
    readTasks: vi.fn(() => mockTasks),
    writeTasks: vi.fn((tasks: Task[]) => {
      mockTasks = [...tasks]
    }),
  }
})

// Import mocked functions
const { __getMockTasks, __resetMockTasks, writeTasks } = (await import(
  "./storage.js"
)) as any

describe("Task Management", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetMockTasks()
  })

  describe("createTask", () => {
    it("should create a task with required fields", () => {
      const result = createTask({ name: "Test Task" })

      expect(result.task).toMatchObject({
        description: "",
        name: "Test Task",
        status: "todo",
      })
      expect(result.task.id).toBeDefined()
      expect(writeTasks).toHaveBeenCalledWith([result.task])
    })

    it("should create a root task with recommendation message", () => {
      const result = createTask({ name: "Root Task" })

      expect(result.task).toMatchObject({
        description: "",
        name: "Root Task",
        status: "todo",
      })
      expect(result.message).toBeDefined()
      expect(result.message).toContain(
        "Root task 'Root Task' created successfully",
      )
      expect(result.message).toContain(
        "Consider breaking this down into smaller subtasks",
      )
      expect(result.message).toContain(`parentId='${result.task.id}'`)
    })

    it("should create a subtask without recommendation message", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const result = createTask({
        name: "Child Task",
        parentId: parentResult.task.id,
      })

      expect(result.task).toMatchObject({
        description: "",
        name: "Child Task",
        status: "todo",
      })
      // Verify the child task is in the parent's tasks array
      const parentTask = getTask(parentResult.task.id)
      expect(parentTask.tasks).toHaveLength(1)
      expect(parentTask.tasks[0]?.id).toBe(result.task.id)
      expect(result.message).toBeUndefined()
    })

    it("should create a task with all optional fields", () => {
      // First create a parent task
      const parentResult = createTask({ name: "Parent Task" })

      const result = createTask({
        description: "Test description",
        insertIndex: 0,
        name: "Child Task",
        parentId: parentResult.task.id,
      })

      expect(result.task).toMatchObject({
        description: "Test description",
        name: "Child Task",
        status: "todo",
      })
      // Verify the child task is in the parent's tasks array at the specified index
      const parentTask = getTask(parentResult.task.id)
      expect(parentTask.tasks).toHaveLength(1)
      expect(parentTask.tasks[0]?.id).toBe(result.task.id)
    })

    it("should throw error for non-existent parent", () => {
      expect(() =>
        createTask({ name: "Test", parentId: "non-existent" }),
      ).toThrow("Parent task with id 'non-existent' not found")
    })

    it("should trim name and description", () => {
      const result = createTask({
        description: "  Test description  ",
        name: "  Test Task  ",
      })

      expect(result.task.name).toBe("Test Task")
      expect(result.task.description).toBe("Test description")
    })

    it("should create tasks in default order (at end of array) when insertIndex not specified", () => {
      const result1 = createTask({ name: "Task 1" })
      const result2 = createTask({ name: "Task 2" })

      const tasks = listTasks()
      expect(tasks).toHaveLength(2)
      expect(tasks[0]?.id).toBe(result1.task.id)
      expect(tasks[1]?.id).toBe(result2.task.id)
    })

    it("should insert task at specified insertIndex", () => {
      createTask({ name: "Task 1" })
      createTask({ name: "Task 3" })
      const result2 = createTask({ insertIndex: 1, name: "Task 2" }) // Insert between Task 1 and Task 3

      const tasks = listTasks()
      expect(tasks).toHaveLength(3)
      expect(tasks[0]?.name).toBe("Task 1")
      expect(tasks[1]?.id).toBe(result2.task.id)
      expect(tasks[1]?.name).toBe("Task 2")
      expect(tasks[2]?.name).toBe("Task 3")
    })

    it("should handle insertIndex at beginning of array", () => {
      createTask({ name: "Task 2" })
      createTask({ name: "Task 3" })
      const result1 = createTask({ insertIndex: 0, name: "Task 1" }) // Insert at beginning

      const tasks = listTasks()
      expect(tasks).toHaveLength(3)
      expect(tasks[0]?.id).toBe(result1.task.id)
      expect(tasks[0]?.name).toBe("Task 1")
      expect(tasks[1]?.name).toBe("Task 2")
      expect(tasks[2]?.name).toBe("Task 3")
    })

    it("should handle hierarchical insertIndex with parent-child relationships", () => {
      // Create parent task
      const parent = createTask({ name: "Parent Task" })

      // Create child tasks
      const child1 = createTask({
        name: "Child 1",
        parentId: parent.task.id,
      })
      const child3 = createTask({
        name: "Child 3",
        parentId: parent.task.id,
      })

      // Insert child 2 between child 1 and child 3
      const child2 = createTask({
        insertIndex: 1,
        name: "Child 2",
        parentId: parent.task.id,
      })

      const parentTask = getTask(parent.task.id)
      expect(parentTask.tasks).toHaveLength(3)
      expect(parentTask.tasks[0]?.id).toBe(child1.task.id)
      expect(parentTask.tasks[1]?.id).toBe(child2.task.id)
      expect(parentTask.tasks[2]?.id).toBe(child3.task.id)
    })
  })

  describe("getTask", () => {
    it("should return existing task", () => {
      const createdResult = createTask({ name: "Test Task" })
      const retrievedTask = getTask(createdResult.task.id)

      expect(retrievedTask).toEqual(createdResult.task)
    })

    it("should throw error for non-existent task", () => {
      expect(() => getTask("non-existent")).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error for invalid ID", () => {
      expect(() => getTask("")).toThrow("Task ID is required")
      expect(() => getTask(null as any)).toThrow("Task ID is required")
    })
  })

  describe("listTasks", () => {
    it("should return all tasks when no filter", () => {
      const result1 = createTask({ name: "Task 1" })
      const result2 = createTask({ name: "Task 2" })

      const tasks = listTasks()
      expect(tasks).toHaveLength(2)
      expect(tasks).toContain(result1.task)
      expect(tasks).toContain(result2.task)
    })

    it("should filter by parentId", () => {
      const parentResult = createTask({ name: "Parent" })
      const childResult = createTask({
        name: "Child",
        parentId: parentResult.task.id,
      })
      createTask({ name: "Other Task" })

      const childTasks = listTasks({ parentId: parentResult.task.id })
      expect(childTasks).toHaveLength(1)
      expect(childTasks[0]).toEqual(childResult.task)
    })

    it("should return empty array for non-existent parent", () => {
      createTask({ name: "Task" })
      const tasks = listTasks({ parentId: "non-existent" })
      expect(tasks).toHaveLength(0)
    })
  })

  describe("updateTask", () => {
    it("should update task fields", () => {
      const result = createTask({ name: "Original" })

      const updatedTask = updateTask({
        description: "New description",
        id: result.task.id,
        name: "Updated",
        resolution: "Some resolution",
        status: "in_progress",
      })

      expect(updatedTask).toMatchObject({
        description: "New description",
        id: result.task.id,
        name: "Updated",
        resolution: "Some resolution",
        status: "in_progress",
      })
    })

    it("should throw error for non-existent task", () => {
      expect(() => updateTask({ id: "non-existent", name: "Test" })).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error for invalid status", () => {
      const result = createTask({ name: "Test" })
      expect(() =>
        updateTask({ id: result.task.id, status: "invalid" }),
      ).toThrow("Invalid status 'invalid'")
    })
  })

  describe("deleteTask", () => {
    it("should delete existing task", () => {
      const result = createTask({ name: "Test" })
      const deleteResult = deleteTask(result.task.id)

      expect(deleteResult).toEqual({ id: result.task.id })
      expect(__getMockTasks()).toHaveLength(0)
    })

    it("should throw error for non-existent task", () => {
      expect(() => deleteTask("non-existent")).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error when task has children", () => {
      const parentResult = createTask({ name: "Parent" })
      createTask({ name: "Child", parentId: parentResult.task.id })

      expect(() => deleteTask(parentResult.task.id)).toThrow(
        "Cannot delete task",
      )
    })

    it("should throw error for invalid ID", () => {
      expect(() => deleteTask("")).toThrow("Task ID is required")
    })
  })

  describe("startTask", () => {
    it("should start a todo task", () => {
      const result = createTask({ name: "Test" })

      const startResult = startTask(result.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.message).toBe(
        "Task 'Test' started. No incomplete subtasks found.",
      )
      expect(startResult.started_tasks).toHaveLength(1)
      expect(startResult.started_tasks[0]?.id).toBe(result.task.id)
      expect(startResult.hierarchy_summary).toBeDefined()
    })

    it("should start a task and its first incomplete subtask", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const childResult1 = createTask({
        name: "Child 1",
        parentId: parentResult.task.id,
      })
      const childResult2 = createTask({
        name: "Child 2",
        parentId: parentResult.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.started_tasks).toHaveLength(2) // Parent + first child
      expect(
        startResult.started_tasks.find((t) => t.id === childResult1.task.id)
          ?.status,
      ).toBe("in_progress")
      expect(startResult.message).toContain(
        "Direct subtask 'Child 1' also started automatically",
      )

      // Verify child 2 is still todo
      const child2 = getTask(childResult2.task.id)
      expect(child2.status).toBe("todo")
    })

    it("should not start subtask if no incomplete subtasks exist", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const childResult = createTask({
        name: "Child",
        parentId: parentResult.task.id,
      })

      // Complete the child task first
      updateTask({
        id: childResult.task.id,
        resolution: "Completed",
        status: "done",
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.started_tasks).toHaveLength(1) // Only parent task
      expect(startResult.message).toBe(
        "Task 'Parent Task' started. No incomplete subtasks found.",
      )
    })

    it("should throw error for non-existent task", () => {
      expect(() => startTask("non-existent")).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error for already completed task", () => {
      const result = createTask({ name: "Test" })
      updateTask({ id: result.task.id, status: "done" })

      expect(() => startTask(result.task.id)).toThrow(
        /Task .* is already completed/,
      )
    })

    it("should throw error for already in-progress task", () => {
      const result = createTask({ name: "Test" })
      startTask(result.task.id)

      expect(() => startTask(result.task.id)).toThrow(
        /Task .* is already in progress/,
      )
    })

    it("should start nested tasks recursively to deepest incomplete subtask", () => {
      // Create a 3-level hierarchy: Parent -> Child -> Grandchild
      const parentResult = createTask({ name: "Parent Task" })
      const childResult = createTask({
        name: "Child Task",
        parentId: parentResult.task.id,
      })
      const grandchildResult = createTask({
        name: "Grandchild Task",
        parentId: childResult.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      // All 3 tasks should be started (parent, child, grandchild)
      expect(startResult.started_tasks).toHaveLength(3)
      expect(startResult.task.status).toBe("in_progress")

      // Verify all tasks in the path are started
      const startedIds = startResult.started_tasks.map((t) => t.id)
      expect(startedIds).toContain(parentResult.task.id)
      expect(startedIds).toContain(childResult.task.id)
      expect(startedIds).toContain(grandchildResult.task.id)

      expect(startResult.message).toContain("Auto-started 2 nested tasks")
      expect(startResult.message).toContain("Grandchild Task")
    })

    it("should handle mixed depth hierarchy correctly", () => {
      // Create mixed hierarchy: Parent has 2 children, first child has grandchild
      const parentResult = createTask({ name: "Parent Task" })
      const child1Result = createTask({
        name: "Child 1",
        parentId: parentResult.task.id,
      })
      const child2Result = createTask({
        name: "Child 2",
        parentId: parentResult.task.id,
      })
      const grandchild1Result = createTask({
        name: "Grandchild 1",
        parentId: child1Result.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      // Should start parent, child1, and grandchild1 (following first path)
      expect(startResult.started_tasks).toHaveLength(3)

      const startedIds = startResult.started_tasks.map((t) => t.id)
      expect(startedIds).toContain(parentResult.task.id)
      expect(startedIds).toContain(child1Result.task.id)
      expect(startedIds).toContain(grandchild1Result.task.id)

      // Child 2 should remain todo
      const child2 = getTask(child2Result.task.id)
      expect(child2.status).toBe("todo")
    })

    it("should skip completed tasks and find deepest incomplete", () => {
      // Create 3-level hierarchy and complete the middle task
      const parentResult = createTask({ name: "Parent Task" })
      const child1Result = createTask({
        name: "Child 1",
        parentId: parentResult.task.id,
      })
      const child2Result = createTask({
        name: "Child 2",
        parentId: parentResult.task.id,
      })
      const grandchild2Result = createTask({
        name: "Grandchild 2",
        parentId: child2Result.task.id,
      })

      // Complete child 1
      updateTask({
        id: child1Result.task.id,
        resolution: "Completed",
        status: "done",
      })

      const startResult = startTask(parentResult.task.id)

      // Should start parent, child2, and grandchild2 (skipping completed child1)
      expect(startResult.started_tasks).toHaveLength(3)

      const startedIds = startResult.started_tasks.map((t) => t.id)
      expect(startedIds).toContain(parentResult.task.id)
      expect(startedIds).toContain(child2Result.task.id)
      expect(startedIds).toContain(grandchild2Result.task.id)

      // Child 1 should remain done
      const child1 = getTask(child1Result.task.id)
      expect(child1.status).toBe("done")
    })

    it("should generate hierarchy summary", () => {
      const parentResult = createTask({ name: "Parent Task" })
      createTask({
        name: "Child Task",
        parentId: parentResult.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.hierarchy_summary).toBeDefined()
      expect(startResult.hierarchy_summary).toContain("Parent Task")
      expect(startResult.hierarchy_summary).toContain("Child Task")
      expect(startResult.hierarchy_summary).toContain("in_progress")
    })

    it("should generate detailed hierarchy summary with flat task names (no indentation)", () => {
      // Create 3-level hierarchy
      const parentResult = createTask({ name: "Root Task" })
      const child1Result = createTask({
        name: "Level 1 Task",
        parentId: parentResult.task.id,
      })
      createTask({
        name: "Level 2 Task",
        parentId: child1Result.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.hierarchy_summary).toBeDefined()
      const summary = startResult.hierarchy_summary!

      // Check that all tasks are included
      expect(summary).toContain("Root Task")
      expect(summary).toContain("Level 1 Task")
      expect(summary).toContain("Level 2 Task")

      // Check that task names are displayed without indentation (like completeTask format)
      const lines = summary.split("\n")
      const taskLines = lines.filter((line) => line.includes("Task"))

      // Root task should be displayed without indentation
      const rootLine = taskLines.find((line) => line.includes("Root Task"))
      expect(rootLine).toBeDefined()

      // Level 1 should be displayed without indentation (Task Structure column contains just the task name)
      const level1Line = taskLines.find((line) => line.includes("Level 1 Task"))
      expect(level1Line).toBeDefined()
      expect(level1Line).toContain("| Level 1 Task |")

      // Level 2 should be displayed without indentation (Task Structure column contains just the task name)
      const level2Line = taskLines.find((line) => line.includes("Level 2 Task"))
      expect(level2Line).toBeDefined()
      expect(level2Line).toContain("| Level 2 Task |")
    })

    it("should show correct status indicators in hierarchy summary", () => {
      const parentResult = createTask({ name: "Parent Task" })
      createTask({
        name: "Active Child",
        parentId: parentResult.task.id,
      })
      const child2Result = createTask({
        name: "Completed Child",
        parentId: parentResult.task.id,
      })
      createTask({
        name: "Todo Child",
        parentId: parentResult.task.id,
      })

      // Complete child2 first
      updateTask({
        id: child2Result.task.id,
        resolution: "Done",
        status: "done",
      })

      const startResult = startTask(parentResult.task.id)
      const summary = startResult.hierarchy_summary!

      // Parent and active child should show in_progress status
      expect(summary).toContain("⚡ in_progress")

      // Completed child should show done status
      expect(summary).toContain("✅ done")

      // Todo child should show todo status
      expect(summary).toContain("📋 todo")
    })

    it("should handle complex mixed hierarchy in summary", () => {
      // Create complex structure:
      // Root
      // ├── Branch A
      // │   ├── Leaf A1
      // │   └── Leaf A2
      // └── Branch B
      //     └── Leaf B1
      const rootResult = createTask({ name: "Root Project" })
      const branchAResult = createTask({
        name: "Branch A",
        parentId: rootResult.task.id,
      })
      const branchBResult = createTask({
        name: "Branch B",
        parentId: rootResult.task.id,
      })
      createTask({
        name: "Leaf A1",
        parentId: branchAResult.task.id,
      })
      createTask({
        name: "Leaf A2",
        parentId: branchAResult.task.id,
      })
      createTask({
        name: "Leaf B1",
        parentId: branchBResult.task.id,
      })

      const startResult = startTask(rootResult.task.id)
      const summary = startResult.hierarchy_summary!

      // Verify all nodes are present
      expect(summary).toContain("Root Project")
      expect(summary).toContain("Branch A")
      expect(summary).toContain("Branch B")
      expect(summary).toContain("Leaf A1")
      expect(summary).toContain("Leaf A2")
      expect(summary).toContain("Leaf B1")

      // Check proper hierarchical structure
      const lines = summary.split("\n")
      const rootIndex = lines.findIndex((line) => line.includes("Root Project"))
      const branchAIndex = lines.findIndex((line) => line.includes("Branch A"))
      const leafA1Index = lines.findIndex((line) => line.includes("Leaf A1"))

      // Hierarchy should be in order
      expect(rootIndex).toBeLessThan(branchAIndex)
      expect(branchAIndex).toBeLessThan(leafA1Index)
    })
  })

  describe("completeTask", () => {
    it("should complete a task with resolution", () => {
      const result = createTask({ name: "Test" })
      const completeResult = completeTask({
        id: result.task.id,
        resolution: "Completed successfully",
      })

      expect(completeResult.message).toContain("Task 'Test' completed")

      const completedTask = getTask(result.task.id)
      expect(completedTask.status).toBe("done")
      expect(completedTask.resolution).toBe("Completed successfully")
    })

    it("should throw error for non-existent task", () => {
      expect(() =>
        completeTask({ id: "non-existent", resolution: "Done" }),
      ).toThrow("Task with id 'non-existent' not found")
    })

    it("should throw error for already completed task", () => {
      const result = createTask({ name: "Test" })
      completeTask({ id: result.task.id, resolution: "Done" })

      expect(() =>
        completeTask({ id: result.task.id, resolution: "Done again" }),
      ).toThrow(/Task .* is already completed/)
    })

    it("should find next sibling task", () => {
      const result1 = createTask({ name: "Task 1" })
      const result2 = createTask({ name: "Task 2" })

      const completeResult = completeTask({
        id: result1.task.id,
        resolution: "Done",
      })

      expect(completeResult.next_task_id).toBe(result2.task.id)
      expect(completeResult.message).toContain("Next task: 'Task 2'")
    })

    it("should find child task when no siblings", () => {
      const parentResult = createTask({ name: "Parent" })
      const childResult = createTask({
        name: "Child",
        parentId: parentResult.task.id,
      })

      // Complete the child task - this should auto-complete the parent too
      const completeResult = completeTask({
        id: childResult.task.id,
        resolution: "Child completed",
      })

      // Verify that the parent was automatically completed
      const parentTask = getTask(parentResult.task.id)
      expect(parentTask.status).toBe("done")

      // Since there are no more tasks, next_task_id should be undefined
      expect(completeResult.next_task_id).toBeUndefined()
      expect(completeResult.message).toContain("No more tasks to execute")
    })

    it("should return no next task when all done", () => {
      const result = createTask({ name: "Only Task" })
      const completeResult = completeTask({
        id: result.task.id,
        resolution: "Done",
      })

      expect(completeResult.next_task_id).toBeUndefined()
      expect(completeResult.message).toContain("No more tasks to execute")
    })

    it("should include progress summary in the response", () => {
      const result = createTask({ name: "Test Task" })
      const completeResult = completeTask({
        id: result.task.id,
        resolution: "Done",
      })

      expect(completeResult.progress_summary).toBeDefined()
      expect(completeResult.progress_summary.total_tasks).toBe(1)
      expect(completeResult.progress_summary.completed_tasks).toBe(1)
      expect(completeResult.progress_summary.in_progress_tasks).toBe(0)
      expect(completeResult.progress_summary.todo_tasks).toBe(0)
      expect(completeResult.progress_summary.completion_percentage).toBe(100)
      expect(completeResult.progress_summary.table).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )
      expect(completeResult.progress_summary.table).toContain(
        "| Test Task | - | ✅ done | ✓ | - | 100% |",
      )
    })

    it("should calculate correct progress statistics for multiple tasks", () => {
      // Create a mix of tasks with different statuses
      const result1 = createTask({ name: "Task 1" })
      createTask({ name: "Task 2" })
      createTask({ name: "Task 3" }) // Create a third task without storing the reference

      // Complete task1
      startTask(result1.task.id)
      const completeResult = completeTask({
        id: result1.task.id,
        resolution: "Done",
      })

      // Verify progress summary statistics
      expect(completeResult.progress_summary.total_tasks).toBe(3)
      expect(completeResult.progress_summary.completed_tasks).toBe(1)
      expect(completeResult.progress_summary.in_progress_tasks).toBe(0)
      expect(completeResult.progress_summary.todo_tasks).toBe(2)
      expect(completeResult.progress_summary.completion_percentage).toBe(33) // 1/3 = 33%
    })

    it("should generate correct hierarchical progress table", () => {
      // Create parent task with children
      const parentResult = createTask({ name: "Parent Task" })
      const childResult1 = createTask({
        name: "Child 1",
        parentId: parentResult.task.id,
      })
      const childResult2 = createTask({
        name: "Child 2",
        parentId: parentResult.task.id,
      })

      // Complete first child task
      completeTask({ id: childResult1.task.id, resolution: "Done" })

      // Complete second child task - this should auto-complete the parent too
      const completeResult = completeTask({
        id: childResult2.task.id,
        resolution: "Done",
      })

      // Verify that the parent was automatically completed
      const parentTask = getTask(parentResult.task.id)
      expect(parentTask.status).toBe("done")

      // Verify table format and content - since both children are done, parent shows 100%
      expect(completeResult.progress_summary.table).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )
      expect(completeResult.progress_summary.table).toContain(
        "| Parent Task | - | ✅ done | ✓ | 2/2 | 100% |",
      )
      expect(completeResult.progress_summary.table).toContain(
        "| Child 2 | Parent Task | ✅ done | ✓ | - | 100% |",
      )

      // Verify overall statistics
      expect(completeResult.progress_summary.total_tasks).toBe(3)
      expect(completeResult.progress_summary.completed_tasks).toBe(3) // All tasks completed
      expect(completeResult.progress_summary.completion_percentage).toBe(100) // 3/3 = 100%
    })

    it("should handle complex hierarchical task structures", () => {
      // Create a more complex hierarchy
      const mainResult = createTask({ name: "Main Task" })

      const subResult1 = createTask({
        name: "Sub Task 1",
        parentId: mainResult.task.id,
      })
      const subResult2 = createTask({
        name: "Sub Task 2",
        parentId: mainResult.task.id,
      })

      const childResult1 = createTask({
        name: "Child 1",
        parentId: subResult1.task.id,
      })
      const childResult2 = createTask({
        name: "Child 2",
        parentId: subResult1.task.id,
      })

      // Complete some tasks
      completeTask({ id: childResult1.task.id, resolution: "Done" })
      completeTask({ id: subResult2.task.id, resolution: "Done" })

      // Start and complete childTask2 - this will auto-complete subTask1 and mainTask
      startTask(childResult2.task.id)
      const completeResult = completeTask({
        id: childResult2.task.id,
        resolution: "Done",
      })

      // Verify that all parent tasks were automatically completed
      const updatedSubTask1 = getTask(subResult1.task.id)
      const updatedMainTask = getTask(mainResult.task.id)
      expect(updatedSubTask1.status).toBe("done")
      expect(updatedMainTask.status).toBe("done")

      // Verify table includes both parent tasks with correct progress
      const table = completeResult.progress_summary.table
      expect(table).toContain("| Main Task | - | ✅ done | ✓ | 2/2 | 100% |")
      expect(table).toContain(
        "| Sub Task 1 | Main Task | ✅ done | ✓ | 2/2 | 100% |",
      )
      expect(table).toContain(
        "| Child 2 | Sub Task 1 | ✅ done | ✓ | - | 100% |",
      )

      // Verify childTask2 is completed
      const updatedChildTask2 = getTask(childResult2.task.id)
      expect(updatedChildTask2.status).toBe("done")

      // Verify overall statistics - all tasks completed
      expect(completeResult.progress_summary.total_tasks).toBe(5)
      expect(completeResult.progress_summary.completed_tasks).toBe(5)
      expect(completeResult.progress_summary.completion_percentage).toBe(100) // 5/5 = 100%
    })

    describe("hierarchy management functionality", () => {
      it("should prevent completing parent task with incomplete subtasks", () => {
        // Create parent with children
        const parentResult = createTask({ name: "Parent Task" })
        const child1Result = createTask({
          name: "Child 1",
          parentId: parentResult.task.id,
        })
        createTask({
          name: "Child 2",
          parentId: parentResult.task.id,
        })

        // Complete only one child
        completeTask({ id: child1Result.task.id, resolution: "Done" })

        // Attempting to complete parent should fail
        expect(() => {
          completeTask({ id: parentResult.task.id, resolution: "Parent done" })
        }).toThrow(
          "Cannot complete task 'Parent Task' because it has incomplete subtasks: 'Child 2'. Please complete all subtasks first.",
        )
      })

      it("should allow completing parent task when all subtasks are complete", () => {
        // Create parent with children
        const parentResult = createTask({ name: "Parent Task" })
        const child1Result = createTask({
          name: "Child 1",
          parentId: parentResult.task.id,
        })
        const child2Result = createTask({
          name: "Child 2",
          parentId: parentResult.task.id,
        })

        // Complete both children first
        completeTask({ id: child1Result.task.id, resolution: "Done" })

        // Completing second child should auto-complete the parent
        completeTask({ id: child2Result.task.id, resolution: "Done" })

        // Verify parent was auto-completed
        const parentTask = getTask(parentResult.task.id)
        expect(parentTask.status).toBe("done")
        expect(parentTask.resolution).toBe(
          "Auto-completed: All subtasks completed",
        )
      })

      it("should handle multi-level hierarchy completion validation", () => {
        // Create 3-level hierarchy: Main -> Sub -> Child
        const mainResult = createTask({ name: "Main Task" })
        const subResult = createTask({
          name: "Sub Task",
          parentId: mainResult.task.id,
        })
        const childResult = createTask({
          name: "Child Task",
          parentId: subResult.task.id,
        })

        // Try to complete main task (should fail - has incomplete descendants)
        expect(() => {
          completeTask({ id: mainResult.task.id, resolution: "Main done" })
        }).toThrow(
          "Cannot complete task 'Main Task' because it has incomplete subtasks: 'Sub Task'. Please complete all subtasks first.",
        )

        // Try to complete sub task (should fail - has incomplete child)
        expect(() => {
          completeTask({ id: subResult.task.id, resolution: "Sub done" })
        }).toThrow(
          "Cannot complete task 'Sub Task' because it has incomplete subtasks: 'Child Task'. Please complete all subtasks first.",
        )

        // Complete child task - should cascade up the hierarchy
        completeTask({ id: childResult.task.id, resolution: "Child done" })

        // Verify all levels were completed
        const updatedChild = getTask(childResult.task.id)
        const updatedSub = getTask(subResult.task.id)
        const updatedMain = getTask(mainResult.task.id)

        expect(updatedChild.status).toBe("done")
        expect(updatedChild.resolution).toBe("Child done")

        expect(updatedSub.status).toBe("done")
        expect(updatedSub.resolution).toBe(
          "Auto-completed: All subtasks completed",
        )

        expect(updatedMain.status).toBe("done")
        expect(updatedMain.resolution).toBe(
          "Auto-completed: All subtasks completed",
        )
      })

      it("should handle partial completion in complex hierarchy", () => {
        // Create complex hierarchy with mixed completion states
        const rootResult = createTask({ name: "Root Task" })

        const branch1Result = createTask({
          name: "Branch 1",
          parentId: rootResult.task.id,
        })
        const branch2Result = createTask({
          name: "Branch 2",
          parentId: rootResult.task.id,
        })

        const leaf1Result = createTask({
          name: "Leaf 1",
          parentId: branch1Result.task.id,
        })
        const leaf2Result = createTask({
          name: "Leaf 2",
          parentId: branch1Result.task.id,
        })
        const leaf3Result = createTask({
          name: "Leaf 3",
          parentId: branch2Result.task.id,
        })

        // Complete all leaves of branch1
        completeTask({ id: leaf1Result.task.id, resolution: "Done" })
        completeTask({ id: leaf2Result.task.id, resolution: "Done" })

        // Branch1 should be auto-completed, but root should not (branch2 incomplete)
        const branch1Task = getTask(branch1Result.task.id)
        const rootTask = getTask(rootResult.task.id)

        expect(branch1Task.status).toBe("done")
        expect(rootTask.status).toBe("todo") // Still incomplete

        // Try to complete root (should fail)
        expect(() => {
          completeTask({ id: rootResult.task.id, resolution: "Root done" })
        }).toThrow(
          "Cannot complete task 'Root Task' because it has incomplete subtasks: 'Branch 2'. Please complete all subtasks first.",
        )

        // Complete remaining leaf - should cascade to root
        completeTask({ id: leaf3Result.task.id, resolution: "Done" })

        const finalRootTask = getTask(rootResult.task.id)
        const finalBranch2Task = getTask(branch2Result.task.id)

        expect(finalBranch2Task.status).toBe("done")
        expect(finalRootTask.status).toBe("done")
      })

      it("should include auto-completed parents in progress summary", () => {
        // Create hierarchy
        const parentResult = createTask({ name: "Parent Task" })
        const childResult = createTask({
          name: "Child Task",
          parentId: parentResult.task.id,
        })

        // Complete child - should trigger parent auto-completion
        const completeResult = completeTask({
          id: childResult.task.id,
          resolution: "Child completed",
        })

        // Verify progress summary includes both tasks as completed
        expect(completeResult.progress_summary.total_tasks).toBe(2)
        expect(completeResult.progress_summary.completed_tasks).toBe(2)
        expect(completeResult.progress_summary.completion_percentage).toBe(100)

        // Verify table shows parent as completed
        expect(completeResult.progress_summary.table).toContain(
          "| Parent Task | - | ✅ done | ✓ | 1/1 | 100% |",
        )
        expect(completeResult.progress_summary.table).toContain(
          "| Child Task | Parent Task | ✅ done | ✓ | - | 100% |",
        )
        expect(completeResult.progress_summary.table).toContain(
          "| 1/1 | 100% |",
        )
      })

      it("should provide informative error messages for subtask validation failures", () => {
        // Create parent with multiple children
        const parentResult = createTask({ name: "Project" })
        const child1Result = createTask({
          name: "Design Phase",
          parentId: parentResult.task.id,
        })
        const child2Result = createTask({
          name: "Development Phase",
          parentId: parentResult.task.id,
        })
        createTask({
          name: "Testing Phase",
          parentId: parentResult.task.id,
        })

        // Complete only first child
        completeTask({ id: child1Result.task.id, resolution: "Design done" })

        // Try to complete parent - should get clear error message
        expect(() => {
          completeTask({ id: parentResult.task.id, resolution: "Project done" })
        }).toThrow(
          "Cannot complete task 'Project' because it has incomplete subtasks: 'Development Phase', 'Testing Phase'. Please complete all subtasks first.",
        )

        // Complete second child
        completeTask({
          id: child2Result.task.id,
          resolution: "Development done",
        })

        // Try again - should get different incomplete subtask in error
        expect(() => {
          completeTask({ id: parentResult.task.id, resolution: "Project done" })
        }).toThrow(
          "Cannot complete task 'Project' because it has incomplete subtasks: 'Testing Phase'. Please complete all subtasks first.",
        )
      })
    })
  })

  describe("In-Progress Status Constraints", () => {
    it("should allow parent nodes to be in_progress when children are in_progress", () => {
      // Create parent-child hierarchy
      const parent = createTask({ name: "Parent Task" })
      const child1 = createTask({
        name: "Child Task 1",
        parentId: parent.task.id,
      })
      const child2 = createTask({
        name: "Child Task 2",
        parentId: parent.task.id,
      })
      const grandchild = createTask({
        name: "Grandchild Task",
        parentId: child1.task.id,
      })

      // Start grandchild task
      const result = startTask(grandchild.task.id)

      // Check that parent hierarchy is updated correctly
      expect(result.started_tasks).toHaveLength(3) // grandchild, child1, parent

      const parentUpdated = getTask(parent.task.id)
      const child1Updated = getTask(child1.task.id)
      const child2Updated = getTask(child2.task.id)
      const grandchildUpdated = getTask(grandchild.task.id)

      expect(parentUpdated.status).toBe("in_progress")
      expect(child1Updated.status).toBe("in_progress")
      expect(child2Updated.status).toBe("todo")
      expect(grandchildUpdated.status).toBe("in_progress")
    })

    it("should not reset in_progress leaf when starting a parent task", () => {
      // Create parent-child hierarchy
      const parent = createTask({ name: "Parent Task" })
      const child = createTask({ name: "Child Task", parentId: parent.task.id })

      // Start child (leaf) task first
      startTask(child.task.id)

      const childAfter = getTask(child.task.id)
      const parentAfter = getTask(parent.task.id)
      expect(childAfter.status).toBe("in_progress")
      expect(parentAfter.status).toBe("in_progress")

      // Parent is already in_progress due to child, so starting it again should throw error
      expect(() => {
        startTask(parent.task.id)
      }).toThrow("is already in progress")
    })
  })

  describe("Parent Node Status Management", () => {
    it("should update all parent statuses when starting a deep nested task", () => {
      // Create 4-level hierarchy
      const level1 = createTask({ name: "Level 1" })
      const level2 = createTask({ name: "Level 2", parentId: level1.task.id })
      const level3 = createTask({ name: "Level 3", parentId: level2.task.id })
      const level4 = createTask({ name: "Level 4", parentId: level3.task.id })

      // Start the deepest task
      const result = startTask(level4.task.id)

      // All parents should be updated to in_progress
      expect(result.started_tasks).toHaveLength(4)

      const updatedTaskIds = result.started_tasks.map((t: Task) => t.id)
      expect(updatedTaskIds).toContain(level1.task.id)
      expect(updatedTaskIds).toContain(level2.task.id)
      expect(updatedTaskIds).toContain(level3.task.id)
      expect(updatedTaskIds).toContain(level4.task.id)

      // Verify all are in_progress
      const level1After = getTask(level1.task.id)
      const level2After = getTask(level2.task.id)
      const level3After = getTask(level3.task.id)
      const level4After = getTask(level4.task.id)
      expect(level1After.status).toBe("in_progress")
      expect(level2After.status).toBe("in_progress")
      expect(level3After.status).toBe("in_progress")
      expect(level4After.status).toBe("in_progress")
    })

    it("should not duplicate parent updates in started_tasks", () => {
      // Create hierarchy with subtasks
      const parent = createTask({ name: "Parent" })
      const child1 = createTask({ name: "Child 1", parentId: parent.task.id })
      createTask({ name: "Child 2", parentId: parent.task.id })
      createTask({ name: "Grandchild 1", parentId: child1.task.id })
      createTask({ name: "Grandchild 2", parentId: child1.task.id })

      // Start parent which should auto-start the deepest subtask
      const result = startTask(parent.task.id)

      // Should not have duplicate entries for the same task
      const taskIds = result.started_tasks.map((t: Task) => t.id)
      const uniqueTaskIds = [...new Set(taskIds)]
      expect(taskIds.length).toBe(uniqueTaskIds.length)

      // Verify parent is only listed once
      const parentEntries = result.started_tasks.filter(
        (t: Task) => t.id === parent.task.id,
      )
      expect(parentEntries).toHaveLength(1)
    })

    it("should maintain parent status consistency with execution order validation", () => {
      // Create complex hierarchy
      const root = createTask({ name: "Root" })
      const branch1 = createTask({ name: "Branch 1", parentId: root.task.id })
      const branch2 = createTask({ name: "Branch 2", parentId: root.task.id })
      const leaf1 = createTask({ name: "Leaf 1", parentId: branch1.task.id })
      const leaf1b = createTask({ name: "Leaf 1b", parentId: branch1.task.id })
      const leaf2 = createTask({ name: "Leaf 2", parentId: branch2.task.id })

      // Start first leaf
      startTask(leaf1.task.id)
      let rootAfter1 = getTask(root.task.id)
      let branch1After1 = getTask(branch1.task.id)
      let branch2After1 = getTask(branch2.task.id)
      expect(rootAfter1.status).toBe("in_progress")
      expect(branch1After1.status).toBe("in_progress")
      expect(branch2After1.status).toBe("todo")

      // Should NOT be able to start second leaf because Branch 1 is not completed
      expect(() => startTask(leaf2.task.id)).toThrow(
        "Hierarchy order violation",
      )

      // Complete Branch 1 (need to complete all its children first)
      completeTask({ id: leaf1.task.id, resolution: "Leaf 1 completed" })
      completeTask({ id: leaf1b.task.id, resolution: "Leaf 1b completed" })
      // Branch 1 should auto-complete when all children are done

      // Now should be able to start second leaf
      startTask(leaf2.task.id)
      const rootAfter2 = getTask(root.task.id)
      const branch1After2 = getTask(branch1.task.id)
      const branch2After2 = getTask(branch2.task.id)
      const leaf1After2 = getTask(leaf1.task.id)
      const leaf2After2 = getTask(leaf2.task.id)
      expect(rootAfter2.status).toBe("in_progress")
      expect(branch1After2.status).toBe("done")
      expect(branch2After2.status).toBe("in_progress")
      expect(leaf1After2.status).toBe("done")
      expect(leaf2After2.status).toBe("in_progress")
    })
  })

  describe("Table Display Extensions", () => {
    it("should include parent task name and status changed in progress table", () => {
      // Create parent and child tasks
      const parentResult = createTask({ name: "Parent Task" })
      const childResult = createTask({
        name: "Child Task",
        parentId: parentResult.task.id,
      })
      startTask(parentResult.task.id) // This will start both parent and child

      // Complete child task
      const completeResult = completeTask({
        id: childResult.task.id,
        resolution: "Completed",
      })

      // Verify table includes parent name and status changed fields
      const table = completeResult.progress_summary.table
      expect(table).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )
      expect(table).toContain("| Parent Task | - | ✅ done | ✓ | 1/1 | 100% |")
      expect(table).toContain(
        "| Child Task | Parent Task | ✅ done | ✓ | - | 100% |",
      )
    })

    it("should include parent task name and status changed in hierarchy summary", () => {
      // Create hierarchical tasks
      const rootResult = createTask({ name: "Root Task" })
      const childResult = createTask({
        name: "Child Task",
        parentId: rootResult.task.id,
      })
      createTask({
        name: "Grandchild Task",
        parentId: childResult.task.id,
      })

      // Start the root task to get hierarchy summary
      const startResult = startTask(rootResult.task.id)

      // Verify hierarchy summary includes parent names and status changed
      const hierarchy = startResult.hierarchy_summary
      expect(hierarchy).toContain(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )

      // Check that parent names are correctly displayed
      // Root should have no parent (-)
      expect(hierarchy).toMatch(/Root Task.*\| - \|.*in_progress/)

      // Child should have Root as parent
      expect(hierarchy).toMatch(/Child Task.*\| Root Task \|.*in_progress/)

      // Grandchild should have Child as parent
      expect(hierarchy).toMatch(
        /Grandchild Task.*\| Child Task \|.*in_progress/,
      )

      // All entries should have status changed indicators
      expect(hierarchy).toMatch(/✓/)
      expect(hierarchy).toMatch(/-/)
    })

    it("should handle complex hierarchy with correct parent names", () => {
      // Create complex hierarchy: Main -> (Branch1, Branch2) -> (Leaf1, Leaf2)
      const mainResult = createTask({ name: "Main Project" })
      const branch1Result = createTask({
        name: "Branch 1",
        parentId: mainResult.task.id,
      })
      const branch2Result = createTask({
        name: "Branch 2",
        parentId: mainResult.task.id,
      })
      createTask({
        name: "Leaf 1",
        parentId: branch1Result.task.id,
      })
      createTask({
        name: "Leaf 2",
        parentId: branch2Result.task.id,
      })

      // Start from main task
      const startResult = startTask(mainResult.task.id)
      const hierarchy = startResult.hierarchy_summary

      // Verify parent relationships in hierarchy display
      expect(hierarchy).toMatch(/Main Project.*\| - \|/)
      expect(hierarchy).toMatch(/Branch 1.*\| Main Project \|/)
      expect(hierarchy).toMatch(/Branch 2.*\| Main Project \|/)
      expect(hierarchy).toMatch(/Leaf 1.*\| Branch 1 \|/)
      expect(hierarchy).toMatch(/Leaf 2.*\| Branch 2 \|/)
    })
  })

  describe("Enhanced Table Format Verification", () => {
    it("should display correct Subtasks and Progress columns in startTask hierarchy summary", () => {
      // Create parent with 2 subtasks
      const parentResult = createTask({ name: "Parent Task" })
      const child1Result = createTask({
        name: "Child 1",
        parentId: parentResult.task.id,
      })
      createTask({
        name: "Child 2",
        parentId: parentResult.task.id,
      })

      // Complete first child
      completeTask({
        id: child1Result.task.id,
        resolution: "Child 1 completed",
      })

      // Start parent task
      const startResult = startTask(parentResult.task.id)
      const hierarchy = startResult.hierarchy_summary!

      // Verify Subtasks column shows correct counts
      expect(hierarchy).toMatch(/Parent Task.*\| 1\/2 \|/)
      expect(hierarchy).toMatch(/Child 1.*\| - \|/)
      expect(hierarchy).toMatch(/Child 2.*\| - \|/)

      // Verify Progress column shows correct percentages
      expect(hierarchy).toMatch(/Parent Task.*\| 50% \|/)
      expect(hierarchy).toMatch(/Child 1.*\| 100% \|/)
      expect(hierarchy).toMatch(/Child 2.*\| 0% \|/)
    })

    it("should display correct table headers for both startTask and completeTask", () => {
      const taskResult = createTask({ name: "Test Task" })

      // Check startTask header
      const startResult = startTask(taskResult.task.id)
      const startHeader = startResult.hierarchy_summary!.split("\n")[0]
      expect(startHeader).toBe(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )

      // Complete task and check completeTask header
      const completeResult = completeTask({
        id: taskResult.task.id,
        resolution: "Task completed",
      })
      const completeHeader =
        completeResult.progress_summary!.table.split("\n")[0]
      expect(completeHeader).toBe(
        "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |",
      )

      // Verify headers are identical
      expect(startHeader).toBe(completeHeader)
    })

    it("should calculate progress correctly for nested hierarchies", () => {
      // Create 3-level hierarchy
      const l1Result = createTask({ name: "Level 1" })
      const l2Result = createTask({
        name: "Level 2",
        parentId: l1Result.task.id,
      })
      const l3aResult = createTask({
        name: "Level 3A",
        parentId: l2Result.task.id,
      })
      createTask({ name: "Level 3B", parentId: l2Result.task.id })

      // Complete one leaf task
      completeTask({ id: l3aResult.task.id, resolution: "3A completed" })

      // Start from root
      const startResult = startTask(l1Result.task.id)
      const hierarchy = startResult.hierarchy_summary!

      // Level 1: has 1 subtask (Level 2), but Level 2 is not completed -> Level 1 is 0%
      // Note: Level 1's progress is based on completed direct children, not on grandchildren
      expect(hierarchy).toContain(
        "| Level 1 | - | ⚡ in_progress | ✓ | 0/1 | 0% |",
      )

      // Level 2: has 2 subtasks, 1 completed -> 50%
      expect(hierarchy).toContain(
        "| Level 2 | Level 1 | ⚡ in_progress | ✓ | 1/2 | 50% |",
      ) // Level 3A: completed -> 100%
      expect(hierarchy).toContain(
        "| Level 3A | Level 2 | ✅ done | - | - | 100% |",
      )

      // Level 3B: not completed -> 0%
      expect(hierarchy).toContain(
        "| Level 3B | Level 2 | ⚡ in_progress | ✓ | - | 0% |",
      )
    })

    it("should handle tasks with no subtasks correctly", () => {
      // Create standalone task
      const taskResult = createTask({ name: "Standalone Task" })

      // Start task
      const startResult = startTask(taskResult.task.id)
      const hierarchy = startResult.hierarchy_summary!

      // Should show "-" for subtasks and "0%" for progress (since not completed)
      expect(hierarchy).toMatch(/Standalone Task.*\| - \|.*\| 0% \|/)

      // Complete task
      const completeResult = completeTask({
        id: taskResult.task.id,
        resolution: "Task completed",
      })
      const progressTable = completeResult.progress_summary!.table

      // Should show "-" for subtasks and "100%" for progress (since completed)
      expect(progressTable).toMatch(/Standalone Task.*\| - \|.*\| 100% \|/)
    })

    it("should maintain consistent formatting between startTask and completeTask tables", () => {
      // Create tasks with different names to avoid order conflicts
      const task1Result = createTask({
        description: "Test task for format consistency A",
        name: "Format Test A",
      })
      const task2Result = createTask({
        description: "Test task for format consistency B",
        name: "Format Test B",
      })

      // Complete the first task first to avoid order conflicts
      startTask(task1Result.task.id)
      completeTask({
        id: task1Result.task.id,
        resolution: "Completed first task",
      })

      // Now start the second task and get its hierarchy table
      const startResult = startTask(task2Result.task.id)
      const startTable = startResult.hierarchy_summary!

      // Complete the second task and get its hierarchy table
      const completeResult = completeTask({
        id: task2Result.task.id,
        resolution: "Completed for format test",
      })
      const completeTable = completeResult.progress_summary!.table

      // Extract headers from both tables
      const startHeaders = startTable.split("\n")[0]
      const completeHeaders = completeTable.split("\n")[0]

      // Headers should be identical
      expect(startHeaders).toBe(completeHeaders)

      // Both should have the same column structure (6 columns)
      expect(startHeaders?.split("|")).toHaveLength(8) // 6 columns + 2 empty from start/end
      expect(completeHeaders?.split("|")).toHaveLength(8) // 6 columns + 2 empty from start/end

      // Both should contain the expected column names
      expect(startHeaders).toContain("Task Name")
      expect(startHeaders).toContain("Parent Task")
      expect(startHeaders).toContain("Status")
      expect(startHeaders).toContain("Status Changed")
      expect(startHeaders).toContain("Subtasks")
      expect(startHeaders).toContain("Progress")

      expect(completeHeaders).toContain("Task Name")
      expect(completeHeaders).toContain("Parent Task")
      expect(completeHeaders).toContain("Status")
      expect(completeHeaders).toContain("Status Changed")
      expect(completeHeaders).toContain("Subtasks")
      expect(completeHeaders).toContain("Progress")
    })
  })
})
