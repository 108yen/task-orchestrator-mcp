import { randomUUID } from "crypto"
import type { Task } from "./storage.js"
import { readTasks, writeTasks } from "./storage.js"

/**
 * Create a new task
 * @param params Task creation parameters
 * @returns Created task
 */
export function createTask(params: {
  description?: string
  name: string
  order?: number
  parent_id?: string
}): Task {
  const { description = "", name, parent_id } = params
  let { order } = params

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Task name is required and must be a non-empty string")
  }

  const tasks = readTasks()

  // Validate parent_id exists if provided
  if (parent_id) {
    const parentExists = tasks.some((task) => task.id === parent_id)
    if (!parentExists) {
      throw new Error(`Parent task with id '${parent_id}' does not exist`)
    }
  }

  const siblings = tasks.filter((task) => task.parent_id === parent_id)

  if (order === undefined) {
    // If order is not specified, assign the max order + 1
    order =
      siblings.length > 0 ? Math.max(...siblings.map((t) => t.order)) + 1 : 1
  } else {
    // If order is specified and conflicts, shift existing tasks
    const conflict = siblings.some((t) => t.order === order)
    if (conflict) {
      tasks.forEach((t) => {
        if (t.parent_id === parent_id && t.order >= (order as number)) {
          t.order += 1
        }
      })
    }
  }

  const now = new Date()
  const task: Task = {
    createdAt: now,
    description: description.trim(),
    id: randomUUID(),
    name: name.trim(),
    order,
    parent_id,
    status: "todo",
    updatedAt: now,
  }

  tasks.push(task)
  writeTasks(tasks)

  return task
}

/**
 * Get a task by ID
 * @param id Task ID
 * @returns Task if found
 */
export function getTask(id: string): Task {
  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  const tasks = readTasks()
  const task = tasks.find((t) => t.id === id)

  if (!task) {
    throw new Error(`Task with id '${id}' not found`)
  }

  return task
}

/**
 * List tasks, optionally filtered by parent_id
 * @param params Optional filtering parameters
 * @returns Array of tasks
 */
export function listTasks(params?: { parent_id?: string }): Task[] {
  const tasks = readTasks()

  if (!params?.parent_id) {
    return tasks
  }

  return tasks.filter((task) => task.parent_id === params.parent_id)
}

/**
 * Update a task
 * @param params Update parameters
 * @returns Updated task
 */
export function updateTask(params: {
  description?: string
  id: string
  name?: string
  order?: number
  parent_id?: string
  resolution?: string
  status?: string
}): Task {
  const { description, id, name, order, parent_id, resolution, status } = params

  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  const tasks = readTasks()
  const taskIndex = tasks.findIndex((t) => t.id === id)

  if (taskIndex === -1) {
    throw new Error(`Task with id '${id}' not found`)
  }

  const currentTask = tasks[taskIndex]
  if (!currentTask) {
    throw new Error(`Task with id '${id}' not found`)
  }

  // Validate parent_id exists if provided and different from current
  if (parent_id !== undefined && parent_id !== currentTask.parent_id) {
    if (parent_id) {
      const parentExists = tasks.some((task) => task.id === parent_id)
      if (!parentExists) {
        throw new Error(`Parent task with id '${parent_id}' does not exist`)
      }
      // Check for circular reference
      if (parent_id === id) {
        throw new Error("Task cannot be its own parent")
      }
    }
  }

  // Validate status if provided
  if (status !== undefined) {
    const validStatuses = ["todo", "in_progress", "done"]
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Invalid status '${status}'. Must be one of: ${validStatuses.join(", ")}`,
      )
    }
  }

  const updatedTask: Task = {
    ...currentTask,
    updatedAt: new Date(),
  }

  // Update fields if provided
  if (name !== undefined) {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Task name must be a non-empty string")
    }
    updatedTask.name = name.trim()
  }

  if (description !== undefined) {
    updatedTask.description =
      typeof description === "string" ? description.trim() : ""
  }

  if (status !== undefined) {
    updatedTask.status = status
  }

  if (resolution !== undefined) {
    updatedTask.resolution =
      typeof resolution === "string" ? resolution.trim() : undefined
  }

  if (parent_id !== undefined) {
    updatedTask.parent_id = parent_id || undefined
  }

  if (order !== undefined) {
    if (typeof order !== "number" || order < 0 || !Number.isFinite(order)) {
      throw new Error("Order must be a non-negative number")
    }
    updatedTask.order = order
  }

  tasks[taskIndex] = updatedTask
  writeTasks(tasks)

  return updatedTask
}

/**
 * Delete a task
 * @param id Task ID
 * @returns Deleted task ID
 */
export function deleteTask(id: string): { id: string } {
  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  const tasks = readTasks()
  const taskIndex = tasks.findIndex((t) => t.id === id)

  if (taskIndex === -1) {
    throw new Error(`Task with id '${id}' not found`)
  }

  // Check if task has children
  const hasChildren = tasks.some((task) => task.parent_id === id)
  if (hasChildren) {
    throw new Error(`Cannot delete task '${id}' because it has child tasks`)
  }

  tasks.splice(taskIndex, 1)
  writeTasks(tasks)

  return { id }
}

/**
 * Start a task (change status to 'in_progress')
 * @param id Task ID
 * @returns Updated task
 */
export function startTask(id: string): Task {
  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  const tasks = readTasks()
  const taskIndex = tasks.findIndex((t) => t.id === id)

  if (taskIndex === -1) {
    throw new Error(`Task with id '${id}' not found`)
  }

  const task = tasks[taskIndex]
  if (!task) {
    throw new Error(`Task with id '${id}' not found`)
  }

  if (task.status === "done") {
    throw new Error(`Task '${id}' is already completed`)
  }

  if (task.status === "in_progress") {
    throw new Error(`Task '${id}' is already in progress`)
  }

  const updatedTask: Task = {
    ...task,
    status: "in_progress",
    updatedAt: new Date(),
  }

  tasks[taskIndex] = updatedTask
  writeTasks(tasks)

  return updatedTask
}

/**
 * Complete a task and find the next task to execute
 * @param params Completion parameters
 * @returns Next task information
 */
export function completeTask(params: { id: string; resolution: string }): {
  message: string
  next_task_id?: string
} {
  const { id, resolution } = params

  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  if (
    !resolution ||
    typeof resolution !== "string" ||
    resolution.trim() === ""
  ) {
    throw new Error("Resolution is required and must be a non-empty string")
  }

  const tasks = readTasks()
  const taskIndex = tasks.findIndex((t) => t.id === id)

  if (taskIndex === -1) {
    throw new Error(`Task with id '${id}' not found`)
  }

  const task = tasks[taskIndex]
  if (!task) {
    throw new Error(`Task with id '${id}' not found`)
  }

  if (task.status === "done") {
    throw new Error(`Task '${id}' is already completed`)
  }

  // Update task to completed
  const updatedTask: Task = {
    ...task,
    resolution: resolution.trim(),
    status: "done",
    updatedAt: new Date(),
  }

  tasks[taskIndex] = updatedTask
  writeTasks(tasks)

  // Find next task to execute
  const nextTask = findNextTask(tasks, updatedTask)

  if (nextTask) {
    return {
      message: `Task '${task.name}' completed. Next task: '${nextTask.name}'`,
      next_task_id: nextTask.id,
    }
  } else {
    return {
      message: `Task '${task.name}' completed. No more tasks to execute.`,
    }
  }
}

/**
 * Find the next task to execute based on hierarchy and order
 * @param tasks All tasks
 * @param completedTask The task that was just completed
 * @returns Next task to execute or undefined
 */
function findNextTask(tasks: Task[], completedTask: Task): Task | undefined {
  // First, look for sibling tasks with higher order in the same parent
  const siblings = tasks.filter(
    (task) =>
      task.parent_id === completedTask.parent_id &&
      task.status === "todo" &&
      task.order > completedTask.order,
  )

  if (siblings.length > 0) {
    // Return the sibling with the lowest order
    return siblings.sort((a, b) => a.order - b.order)[0]
  }

  // If no sibling tasks, look for child tasks of the completed task
  const children = tasks.filter(
    (task) => task.parent_id === completedTask.id && task.status === "todo",
  )

  if (children.length > 0) {
    // Return the child with the lowest order
    return children.sort((a, b) => a.order - b.order)[0]
  }

  // If no children, look up the hierarchy for the next task
  if (completedTask.parent_id) {
    const parent = tasks.find((task) => task.id === completedTask.parent_id)
    if (parent) {
      // Check if all siblings of the completed task are done
      const allSiblings = tasks.filter(
        (task) => task.parent_id === completedTask.parent_id,
      )
      const allSiblingsDone = allSiblings.every(
        (task) => task.status === "done",
      )

      if (allSiblingsDone) {
        // All siblings are done, look for next task at parent level
        return findNextTask(tasks, parent)
      }
    }
  }

  // Look for any remaining todo tasks at the root level
  const rootTasks = tasks.filter(
    (task) => !task.parent_id && task.status === "todo",
  )

  if (rootTasks.length > 0) {
    return rootTasks.sort((a, b) => a.order - b.order)[0]
  }

  return undefined
}
