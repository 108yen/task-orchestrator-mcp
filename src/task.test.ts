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
        order: 1,
        status: "todo",
      })
      expect(result.task.id).toBeDefined()
      expect(result.task.createdAt).toBeInstanceOf(Date)
      expect(result.task.updatedAt).toBeInstanceOf(Date)
      expect(writeTasks).toHaveBeenCalledWith([result.task])
    })

    it("should create a root task with recommendation message", () => {
      const result = createTask({ name: "Root Task" })

      expect(result.task).toMatchObject({
        description: "",
        name: "Root Task",
        order: 1,
        status: "todo",
      })
      expect(result.message).toBeDefined()
      expect(result.message).toContain(
        "Root task 'Root Task' created successfully",
      )
      expect(result.message).toContain(
        "Consider breaking this down into smaller subtasks",
      )
      expect(result.message).toContain(`parent_id='${result.task.id}'`)
    })

    it("should create a subtask without recommendation message", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const result = createTask({
        name: "Child Task",
        parent_id: parentResult.task.id,
      })

      expect(result.task).toMatchObject({
        description: "",
        name: "Child Task",
        parent_id: parentResult.task.id,
        status: "todo",
      })
      expect(result.message).toBeUndefined()
    })

    it("should create a task with all optional fields", () => {
      // First create a parent task
      const parentResult = createTask({ name: "Parent Task" })

      const result = createTask({
        description: "Test description",
        name: "Child Task",
        order: 5,
        parent_id: parentResult.task.id,
      })

      expect(result.task).toMatchObject({
        description: "Test description",
        name: "Child Task",
        order: 5,
        parent_id: parentResult.task.id,
        status: "todo",
      })
    })

    it("should throw error for empty name", () => {
      expect(() => createTask({ name: "" })).toThrow("Task name is required")
      expect(() => createTask({ name: "   " })).toThrow("Task name is required")
    })

    it("should throw error for invalid name type", () => {
      expect(() => createTask({ name: null as any })).toThrow(
        "Task name is required",
      )
      expect(() => createTask({ name: 123 as any })).toThrow(
        "Task name is required",
      )
    })

    it("should throw error for non-existent parent", () => {
      expect(() =>
        createTask({ name: "Test", parent_id: "non-existent" }),
      ).toThrow("Parent task with id 'non-existent' does not exist")
    })

    it("should trim name and description", () => {
      const result = createTask({
        description: "  Test description  ",
        name: "  Test Task  ",
      })

      expect(result.task.name).toBe("Test Task")
      expect(result.task.description).toBe("Test description")
    })

    it("should assign order = 1 if not specified and no siblings", () => {
      const result = createTask({ name: "Test Task" })
      expect(result.task.order).toBe(1)
    })

    it("should assign max order + 1 if not specified", () => {
      createTask({ name: "Task 1", order: 5 })
      const result2 = createTask({ name: "Task 2" })
      expect(result2.task.order).toBe(6)
    })

    it("should shift existing orders if specified order conflicts", () => {
      const result1 = createTask({ name: "Task 1", order: 1 })
      const result2 = createTask({ name: "Task 2", order: 2 })
      const result3 = createTask({ name: "Task 3", order: 1 }) // Conflict with task1

      const tasks = listTasks()
      const updatedTask1 = tasks.find((t) => t.id === result1.task.id)
      const updatedTask2 = tasks.find((t) => t.id === result2.task.id)

      expect(result3.task.order).toBe(1)
      expect(updatedTask1?.order).toBe(2)
      expect(updatedTask2?.order).toBe(3)
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

    it("should filter by parent_id", () => {
      const parentResult = createTask({ name: "Parent" })
      const childResult = createTask({
        name: "Child",
        parent_id: parentResult.task.id,
      })
      createTask({ name: "Other Task" })

      const childTasks = listTasks({ parent_id: parentResult.task.id })
      expect(childTasks).toHaveLength(1)
      expect(childTasks[0]).toEqual(childResult.task)
    })

    it("should return empty array for non-existent parent", () => {
      createTask({ name: "Task" })
      const tasks = listTasks({ parent_id: "non-existent" })
      expect(tasks).toHaveLength(0)
    })
  })

  describe("updateTask", () => {
    it("should update task fields", () => {
      const result = createTask({ name: "Original" })
      const originalUpdatedAt = result.task.updatedAt

      // Wait a bit to ensure different timestamp
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      const updatedTask = updateTask({
        description: "New description",
        id: result.task.id,
        name: "Updated",
        order: 10,
        resolution: "Some resolution",
        status: "in_progress",
      })

      expect(updatedTask).toMatchObject({
        description: "New description",
        id: result.task.id,
        name: "Updated",
        order: 10,
        resolution: "Some resolution",
        status: "in_progress",
      })
      expect(updatedTask.updatedAt).not.toEqual(originalUpdatedAt)

      vi.useRealTimers()
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

    it("should throw error for empty name", () => {
      const result = createTask({ name: "Test" })
      expect(() => updateTask({ id: result.task.id, name: "" })).toThrow(
        "Task name must be a non-empty string",
      )
    })

    it("should throw error for negative order", () => {
      const result = createTask({ name: "Test" })
      expect(() => updateTask({ id: result.task.id, order: -1 })).toThrow(
        "Order must be a non-negative number",
      )
    })

    it("should throw error for circular parent reference", () => {
      const result = createTask({ name: "Test" })
      expect(() =>
        updateTask({ id: result.task.id, parent_id: result.task.id }),
      ).toThrow("Task cannot be its own parent")
    })

    it("should update parent_id to valid parent", () => {
      const parentResult = createTask({ name: "Parent" })
      const childResult = createTask({ name: "Child" })

      const updatedTask = updateTask({
        id: childResult.task.id,
        parent_id: parentResult.task.id,
      })

      expect(updatedTask.parent_id).toBe(parentResult.task.id)
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
      createTask({ name: "Child", parent_id: parentResult.task.id })

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

      // Wait a bit to ensure different timestamp
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      const startResult = startTask(result.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.task.updatedAt.getTime()).toBeGreaterThan(
        result.task.updatedAt.getTime(),
      )
      expect(startResult.message).toBe("Task 'Test' started.")
      expect(startResult.subtask).toBeUndefined()

      vi.useRealTimers()
    })

    it("should start a task and its first incomplete subtask", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const childResult1 = createTask({
        name: "Child 1",
        order: 1,
        parent_id: parentResult.task.id,
      })
      const childResult2 = createTask({
        name: "Child 2",
        order: 2,
        parent_id: parentResult.task.id,
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.subtask).toBeDefined()
      expect(startResult.subtask?.id).toBe(childResult1.task.id)
      expect(startResult.subtask?.status).toBe("in_progress")
      expect(startResult.message).toContain(
        "First incomplete subtask 'Child 1' also started automatically",
      )

      // Verify child 2 is still todo
      const child2 = getTask(childResult2.task.id)
      expect(child2.status).toBe("todo")
    })

    it("should not start subtask if no incomplete subtasks exist", () => {
      const parentResult = createTask({ name: "Parent Task" })
      const childResult = createTask({
        name: "Child",
        parent_id: parentResult.task.id,
      })

      // Complete the child task first
      updateTask({
        id: childResult.task.id,
        resolution: "Completed",
        status: "done",
      })

      const startResult = startTask(parentResult.task.id)

      expect(startResult.task.status).toBe("in_progress")
      expect(startResult.subtask).toBeUndefined()
      expect(startResult.message).toBe("Task 'Parent Task' started.")
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

    it("should throw error for empty resolution", () => {
      const result = createTask({ name: "Test" })
      expect(() =>
        completeTask({ id: result.task.id, resolution: "" }),
      ).toThrow("Resolution is required")
    })

    it("should find next sibling task", () => {
      const result1 = createTask({ name: "Task 1", order: 1 })
      const result2 = createTask({ name: "Task 2", order: 2 })

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
        parent_id: parentResult.task.id,
      })

      const completeResult = completeTask({
        id: parentResult.task.id,
        resolution: "Done",
      })

      expect(completeResult.next_task_id).toBe(childResult.task.id)
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
      expect(completeResult.progress_summary.table).toBe(
        "No hierarchical tasks found.",
      )
    })

    it("should calculate correct progress statistics for multiple tasks", () => {
      // Create a mix of tasks with different statuses
      const result1 = createTask({ name: "Task 1" })
      const result2 = createTask({ name: "Task 2" })
      createTask({ name: "Task 3" }) // Create a third task without storing the reference

      // Set task2 to in_progress
      startTask(result2.task.id)

      // Complete task1
      const completeResult = completeTask({
        id: result1.task.id,
        resolution: "Done",
      })

      // Verify progress summary statistics
      expect(completeResult.progress_summary.total_tasks).toBe(3)
      expect(completeResult.progress_summary.completed_tasks).toBe(1)
      expect(completeResult.progress_summary.in_progress_tasks).toBe(1)
      expect(completeResult.progress_summary.todo_tasks).toBe(1)
      expect(completeResult.progress_summary.completion_percentage).toBe(33) // 1/3 = 33%
    })

    it("should generate correct hierarchical progress table", () => {
      // Create parent task with children
      const parentResult = createTask({ name: "Parent Task" })
      const childResult1 = createTask({
        name: "Child 1",
        parent_id: parentResult.task.id,
      })
      createTask({ name: "Child 2", parent_id: parentResult.task.id }) // Create second child without storing reference

      // Complete one child task
      completeTask({ id: childResult1.task.id, resolution: "Done" })

      // Complete parent and check progress summary
      const completeResult = completeTask({
        id: parentResult.task.id,
        resolution: "Done",
      })

      // Verify table format and content
      expect(completeResult.progress_summary.table).toContain(
        "| Task Name | Status | Subtasks | Progress |",
      )
      expect(completeResult.progress_summary.table).toContain(
        "| Parent Task | done | 1/2 | 50% |",
      )

      // Verify overall statistics
      expect(completeResult.progress_summary.total_tasks).toBe(3)
      expect(completeResult.progress_summary.completed_tasks).toBe(2)
      expect(completeResult.progress_summary.completion_percentage).toBe(67) // 2/3 = ~67%
    })

    it("should handle complex hierarchical task structures", () => {
      // Create a more complex hierarchy
      const mainResult = createTask({ name: "Main Task" })

      const subResult1 = createTask({
        name: "Sub Task 1",
        parent_id: mainResult.task.id,
      })
      const subResult2 = createTask({
        name: "Sub Task 2",
        parent_id: mainResult.task.id,
      })

      const childResult1 = createTask({
        name: "Child 1",
        parent_id: subResult1.task.id,
      })
      const childResult2 = createTask({
        name: "Child 2",
        parent_id: subResult1.task.id,
      })

      // Complete some tasks
      completeTask({ id: childResult1.task.id, resolution: "Done" })
      completeTask({ id: subResult2.task.id, resolution: "Done" })

      // Start childTask2 to test mixed status
      startTask(childResult2.task.id)

      // Complete subTask1 and check progress
      const completeResult = completeTask({
        id: subResult1.task.id,
        resolution: "Done",
      })

      // Verify table includes both parent tasks with correct progress
      const table = completeResult.progress_summary.table
      expect(table).toContain("| Main Task | todo | 2/2 | 100% |")
      expect(table).toContain("| Sub Task 1 | done | 1/2 | 50% |")

      // Verify childTask2 is in progress
      const updatedChildTask2 = getTask(childResult2.task.id)
      expect(updatedChildTask2.status).toBe("in_progress")

      // Verify overall statistics
      expect(completeResult.progress_summary.total_tasks).toBe(5)
      expect(completeResult.progress_summary.completed_tasks).toBe(3)
      expect(completeResult.progress_summary.completion_percentage).toBe(60) // 3/5 = 60%
    })
  })
})
