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
      const task = createTask({ name: "Test Task" })

      expect(task).toMatchObject({
        description: "",
        name: "Test Task",
        order: 1,
        status: "todo",
      })
      expect(task.id).toBeDefined()
      expect(task.createdAt).toBeInstanceOf(Date)
      expect(task.updatedAt).toBeInstanceOf(Date)
      expect(writeTasks).toHaveBeenCalledWith([task])
    })

    it("should create a task with all optional fields", () => {
      // First create a parent task
      const parentTask = createTask({ name: "Parent Task" })

      const task = createTask({
        description: "Test description",
        name: "Child Task",
        order: 5,
        parent_id: parentTask.id,
      })

      expect(task).toMatchObject({
        description: "Test description",
        name: "Child Task",
        order: 5,
        parent_id: parentTask.id,
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
      const task = createTask({
        description: "  Test description  ",
        name: "  Test Task  ",
      })

      expect(task.name).toBe("Test Task")
      expect(task.description).toBe("Test description")
    })

    it("should assign order = 1 if not specified and no siblings", () => {
      const task = createTask({ name: "Test Task" })
      expect(task.order).toBe(1)
    })

    it("should assign max order + 1 if not specified", () => {
      createTask({ name: "Task 1", order: 5 })
      const task2 = createTask({ name: "Task 2" })
      expect(task2.order).toBe(6)
    })

    it("should shift existing orders if specified order conflicts", () => {
      const task1 = createTask({ name: "Task 1", order: 1 })
      const task2 = createTask({ name: "Task 2", order: 2 })
      const task3 = createTask({ name: "Task 3", order: 1 }) // Conflict with task1

      const tasks = listTasks()
      const updatedTask1 = tasks.find((t) => t.id === task1.id)
      const updatedTask2 = tasks.find((t) => t.id === task2.id)

      expect(task3.order).toBe(1)
      expect(updatedTask1?.order).toBe(2)
      expect(updatedTask2?.order).toBe(3)
    })
  })

  describe("getTask", () => {
    it("should return existing task", () => {
      const createdTask = createTask({ name: "Test Task" })
      const retrievedTask = getTask(createdTask.id)

      expect(retrievedTask).toEqual(createdTask)
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
      const task1 = createTask({ name: "Task 1" })
      const task2 = createTask({ name: "Task 2" })

      const tasks = listTasks()
      expect(tasks).toHaveLength(2)
      expect(tasks).toContain(task1)
      expect(tasks).toContain(task2)
    })

    it("should filter by parent_id", () => {
      const parentTask = createTask({ name: "Parent" })
      const childTask = createTask({ name: "Child", parent_id: parentTask.id })
      createTask({ name: "Other Task" })

      const childTasks = listTasks({ parent_id: parentTask.id })
      expect(childTasks).toHaveLength(1)
      expect(childTasks[0]).toEqual(childTask)
    })

    it("should return empty array for non-existent parent", () => {
      createTask({ name: "Task" })
      const tasks = listTasks({ parent_id: "non-existent" })
      expect(tasks).toHaveLength(0)
    })
  })

  describe("updateTask", () => {
    it("should update task fields", () => {
      const task = createTask({ name: "Original" })
      const originalUpdatedAt = task.updatedAt

      // Wait a bit to ensure different timestamp
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      const updatedTask = updateTask({
        description: "New description",
        id: task.id,
        name: "Updated",
        order: 10,
        resolution: "Some resolution",
        status: "in_progress",
      })

      expect(updatedTask).toMatchObject({
        description: "New description",
        id: task.id,
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
      const task = createTask({ name: "Test" })
      expect(() => updateTask({ id: task.id, status: "invalid" })).toThrow(
        "Invalid status 'invalid'",
      )
    })

    it("should throw error for empty name", () => {
      const task = createTask({ name: "Test" })
      expect(() => updateTask({ id: task.id, name: "" })).toThrow(
        "Task name must be a non-empty string",
      )
    })

    it("should throw error for negative order", () => {
      const task = createTask({ name: "Test" })
      expect(() => updateTask({ id: task.id, order: -1 })).toThrow(
        "Order must be a non-negative number",
      )
    })

    it("should throw error for circular parent reference", () => {
      const task = createTask({ name: "Test" })
      expect(() => updateTask({ id: task.id, parent_id: task.id })).toThrow(
        "Task cannot be its own parent",
      )
    })

    it("should update parent_id to valid parent", () => {
      const parentTask = createTask({ name: "Parent" })
      const childTask = createTask({ name: "Child" })

      const updatedTask = updateTask({
        id: childTask.id,
        parent_id: parentTask.id,
      })

      expect(updatedTask.parent_id).toBe(parentTask.id)
    })
  })

  describe("deleteTask", () => {
    it("should delete existing task", () => {
      const task = createTask({ name: "Test" })
      const result = deleteTask(task.id)

      expect(result).toEqual({ id: task.id })
      expect(__getMockTasks()).toHaveLength(0)
    })

    it("should throw error for non-existent task", () => {
      expect(() => deleteTask("non-existent")).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error when task has children", () => {
      const parentTask = createTask({ name: "Parent" })
      createTask({ name: "Child", parent_id: parentTask.id })

      expect(() => deleteTask(parentTask.id)).toThrow("Cannot delete task")
    })

    it("should throw error for invalid ID", () => {
      expect(() => deleteTask("")).toThrow("Task ID is required")
    })
  })

  describe("startTask", () => {
    it("should start a todo task", () => {
      const task = createTask({ name: "Test" })

      // Wait a bit to ensure different timestamp
      vi.useFakeTimers()
      vi.advanceTimersByTime(1000)

      const startedTask = startTask(task.id)

      expect(startedTask.status).toBe("in_progress")
      expect(startedTask.updatedAt.getTime()).toBeGreaterThan(
        task.updatedAt.getTime(),
      )

      vi.useRealTimers()
    })

    it("should throw error for non-existent task", () => {
      expect(() => startTask("non-existent")).toThrow(
        "Task with id 'non-existent' not found",
      )
    })

    it("should throw error for already completed task", () => {
      const task = createTask({ name: "Test" })
      updateTask({ id: task.id, status: "done" })

      expect(() => startTask(task.id)).toThrow(/Task .* is already completed/)
    })

    it("should throw error for already in-progress task", () => {
      const task = createTask({ name: "Test" })
      startTask(task.id)

      expect(() => startTask(task.id)).toThrow(/Task .* is already in progress/)
    })
  })

  describe("completeTask", () => {
    it("should complete a task with resolution", () => {
      const task = createTask({ name: "Test" })
      const result = completeTask({
        id: task.id,
        resolution: "Completed successfully",
      })

      expect(result.message).toContain("Task 'Test' completed")

      const completedTask = getTask(task.id)
      expect(completedTask.status).toBe("done")
      expect(completedTask.resolution).toBe("Completed successfully")
    })

    it("should throw error for non-existent task", () => {
      expect(() =>
        completeTask({ id: "non-existent", resolution: "Done" }),
      ).toThrow("Task with id 'non-existent' not found")
    })

    it("should throw error for already completed task", () => {
      const task = createTask({ name: "Test" })
      completeTask({ id: task.id, resolution: "Done" })

      expect(() =>
        completeTask({ id: task.id, resolution: "Done again" }),
      ).toThrow(/Task .* is already completed/)
    })

    it("should throw error for empty resolution", () => {
      const task = createTask({ name: "Test" })
      expect(() => completeTask({ id: task.id, resolution: "" })).toThrow(
        "Resolution is required",
      )
    })

    it("should find next sibling task", () => {
      const task1 = createTask({ name: "Task 1", order: 1 })
      const task2 = createTask({ name: "Task 2", order: 2 })

      const result = completeTask({ id: task1.id, resolution: "Done" })

      expect(result.next_task_id).toBe(task2.id)
      expect(result.message).toContain("Next task: 'Task 2'")
    })

    it("should find child task when no siblings", () => {
      const parentTask = createTask({ name: "Parent" })
      const childTask = createTask({ name: "Child", parent_id: parentTask.id })

      const result = completeTask({ id: parentTask.id, resolution: "Done" })

      expect(result.next_task_id).toBe(childTask.id)
    })

    it("should return no next task when all done", () => {
      const task = createTask({ name: "Only Task" })
      const result = completeTask({ id: task.id, resolution: "Done" })

      expect(result.next_task_id).toBeUndefined()
      expect(result.message).toContain("No more tasks to execute")
    })
  })
})
