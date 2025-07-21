import { randomUUID } from "crypto"
import type {
  HierarchySummary,
  HierarchySummaryRow,
  ProgressSummary,
  Task,
  TaskProgressRow,
} from "./storage.js"
import { readTasks, writeTasks } from "./storage.js"

/**
 * Create a new task
 * @param params Task creation parameters
 * @returns Created task with optional recommendation message
 */
export function createTask(params: {
  description?: string
  name: string
  order?: number
  parent_id?: string
}): { message?: string; task: Task } {
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

  // Generate recommendation message for root tasks
  let message: string | undefined
  if (!parent_id) {
    message = `Root task '${task.name}' created successfully. Consider breaking this down into smaller subtasks using createTask with parent_id='${task.id}' to better organize your workflow and track progress.`
  }

  return { message, task }
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
 * Find the deepest incomplete subtask recursively
 * @param taskId Starting task ID
 * @param tasks All tasks
 * @param depth Current depth (for tracking)
 * @returns The deepest incomplete task and the execution path
 */
function findDeepestIncompleteSubtask(
  taskId: string,
  tasks: Task[],
  depth = 0,
): null | { deepestTask: Task; executionPath: Task[] } {
  const childTasks = tasks
    .filter((task) => task.parent_id === taskId && task.status === "todo")
    .sort((a, b) => a.order - b.order)

  if (childTasks.length === 0) {
    // No incomplete children, return null since we don't include the starting task
    return null
  }

  // Recursively search for the deepest incomplete task in the first child
  const firstChild = childTasks[0]
  if (firstChild) {
    const result = findDeepestIncompleteSubtask(firstChild.id, tasks, depth + 1)
    if (result) {
      // Include the first child in the execution path
      return {
        deepestTask: result.deepestTask,
        executionPath: [firstChild, ...result.executionPath],
      }
    } else {
      // First child is the deepest task
      return {
        deepestTask: firstChild,
        executionPath: [firstChild],
      }
    }
  }

  return null
}

/**
 * Start a task (change status to 'in_progress')
 * @param id Task ID
 * @returns Updated task with optional subtask information and hierarchy summary
 */
export function startTask(id: string): {
  hierarchy_summary?: string
  message?: string
  started_tasks: Task[]
  task: Task
} {
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

  // Start the main task
  const updatedTask: Task = {
    ...task,
    status: "in_progress",
    updatedAt: new Date(),
  }

  tasks[taskIndex] = updatedTask
  const startedTasks: Task[] = [updatedTask]

  // Find the deepest incomplete subtask and start all tasks in the execution path
  const deepestResult = findDeepestIncompleteSubtask(id, tasks)
  let message: string

  if (deepestResult) {
    const { executionPath } = deepestResult
    const now = new Date()

    // Start all tasks in the execution path (excluding the main task which is already started)
    for (const pathTask of executionPath) {
      const pathTaskIndex = tasks.findIndex((t) => t.id === pathTask.id)
      if (pathTaskIndex !== -1 && tasks[pathTaskIndex]?.status === "todo") {
        const updatedPathTask: Task = {
          ...pathTask,
          status: "in_progress",
          updatedAt: now,
        }
        tasks[pathTaskIndex] = updatedPathTask
        startedTasks.push(updatedPathTask)
      }
    }

    const depth = executionPath.length
    if (depth === 1) {
      message = `Task '${task.name}' started. Direct subtask '${executionPath[0]?.name}' also started automatically.`
    } else {
      message = `Task '${task.name}' started. Auto-started ${depth} nested tasks down to deepest incomplete subtask '${executionPath[depth - 1]?.name}'.`
    }
  } else {
    message = `Task '${task.name}' started. No incomplete subtasks found.`
  }

  writeTasks(tasks)

  // Generate hierarchy summary
  const hierarchySummary = generateHierarchySummary(tasks)

  return {
    hierarchy_summary: hierarchySummary.table,
    message,
    started_tasks: startedTasks,
    task: updatedTask,
  }
}

/**
 * Calculate overall progress statistics
 * @param tasks All tasks
 * @returns Overall progress statistics
 */
function calculateOverallProgress(tasks: Task[]): {
  completed_tasks: number
  completion_percentage: number
  in_progress_tasks: number
  todo_tasks: number
  total_tasks: number
} {
  const total_tasks = tasks.length
  const completed_tasks = tasks.filter((task) => task.status === "done").length
  const in_progress_tasks = tasks.filter(
    (task) => task.status === "in_progress",
  ).length
  const todo_tasks = tasks.filter((task) => task.status === "todo").length
  const completion_percentage =
    total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0

  return {
    completed_tasks,
    completion_percentage,
    in_progress_tasks,
    todo_tasks,
    total_tasks,
  }
}

/**
 * Generate hierarchical progress table rows
 * @param tasks All tasks
 * @returns Array of progress rows for parent tasks
 */
function generateProgressRows(tasks: Task[]): TaskProgressRow[] {
  const parentTasks = tasks.filter((task) =>
    tasks.some((t) => t.parent_id === task.id),
  )

  return parentTasks.map((parentTask) => {
    const subtasks = tasks.filter((task) => task.parent_id === parentTask.id)
    const completed_subtasks = subtasks.filter(
      (task) => task.status === "done",
    ).length
    const total_subtasks = subtasks.length
    const progress_percentage =
      total_subtasks > 0
        ? Math.round((completed_subtasks / total_subtasks) * 100)
        : 0

    return {
      completed_subtasks,
      progress_percentage,
      status: parentTask.status,
      task_name: parentTask.name,
      total_subtasks,
    }
  })
}

/**
 * Generate markdown table from progress rows
 * @param rows Progress rows
 * @returns Markdown table string
 */
function generateMarkdownTable(rows: TaskProgressRow[]): string {
  if (rows.length === 0) {
    return "No hierarchical tasks found."
  }

  const header = "| Task Name | Status | Subtasks | Progress |"
  const separator = "|-----------|--------|----------|----------|"

  const tableRows = rows.map((row) => {
    const statusDisplay =
      row.status === "todo"
        ? "todo"
        : row.status === "in_progress"
          ? "in_progress"
          : "done"
    return `| ${row.task_name} | ${statusDisplay} | ${row.completed_subtasks}/${row.total_subtasks} | ${row.progress_percentage}% |`
  })

  return [header, separator, ...tableRows].join("\n")
}

/**
 * Generate complete progress summary
 * @param tasks All tasks
 * @returns Complete progress summary
 */
function generateProgressSummary(tasks: Task[]): ProgressSummary {
  const overallProgress = calculateOverallProgress(tasks)
  const progressRows = generateProgressRows(tasks)
  const table = generateMarkdownTable(progressRows)

  return {
    completed_tasks: overallProgress.completed_tasks,
    completion_percentage: overallProgress.completion_percentage,
    in_progress_tasks: overallProgress.in_progress_tasks,
    table,
    todo_tasks: overallProgress.todo_tasks,
    total_tasks: overallProgress.total_tasks,
  }
}

/**
 * Generate hierarchy summary rows recursively
 * @param tasks All tasks
 * @param parentId Parent task ID (undefined for root tasks)
 * @param depth Current depth level
 * @returns Array of hierarchy summary rows
 */
function generateHierarchySummaryRows(
  tasks: Task[],
  parentId: string | undefined = undefined,
  depth = 0,
): HierarchySummaryRow[] {
  const childTasks = tasks
    .filter((task) => task.parent_id === parentId)
    .sort((a, b) => a.order - b.order)

  const rows: HierarchySummaryRow[] = []

  for (const task of childTasks) {
    const indent = "  ".repeat(depth) // 2 spaces per depth level
    rows.push({
      depth,
      indent,
      name: task.name,
      status: task.status,
      task_id: task.id,
    })

    // Recursively add child tasks
    const childRows = generateHierarchySummaryRows(tasks, task.id, depth + 1)
    rows.push(...childRows)
  }

  return rows
}

/**
 * Generate hierarchy summary table
 * @param rows Hierarchy summary rows
 * @returns Markdown table string
 */
function generateHierarchyMarkdownTable(rows: HierarchySummaryRow[]): string {
  if (rows.length === 0) {
    return "No tasks found."
  }

  const header = "| Task Structure | Status |"
  const separator = "|----------------|--------|"

  const tableRows = rows.map((row) => {
    const taskDisplay = `${row.indent}${row.name}`
    const statusDisplay =
      row.status === "todo"
        ? "📋 todo"
        : row.status === "in_progress"
          ? "⚡ in_progress"
          : "✅ done"
    return `| ${taskDisplay} | ${statusDisplay} |`
  })

  return [header, separator, ...tableRows].join("\n")
}

/**
 * Generate complete hierarchy summary
 * @param tasks All tasks
 * @returns Complete hierarchy summary
 */
function generateHierarchySummary(tasks: Task[]): HierarchySummary {
  const rows = generateHierarchySummaryRows(tasks)
  const table = generateHierarchyMarkdownTable(rows)
  const total_levels =
    rows.length > 0 ? Math.max(...rows.map((row) => row.depth)) + 1 : 0

  return {
    table,
    total_levels,
  }
}

/**
 * Automatically complete parent tasks if all their subtasks are completed
 * @param tasks All tasks
 * @param completedTask The task that was just completed
 * @returns Array of parent tasks that were auto-completed
 */
function autoCompleteParentTasks(tasks: Task[], completedTask: Task): Task[] {
  const autoCompletedParents: Task[] = []

  if (!completedTask.parent_id) {
    // No parent to check
    return autoCompletedParents
  }

  const parent = tasks.find((t) => t.id === completedTask.parent_id)
  if (!parent || parent.status === "done") {
    // Parent doesn't exist or is already completed
    return autoCompletedParents
  }

  // Check if all siblings (including the completed task) are done
  const siblings = tasks.filter((t) => t.parent_id === completedTask.parent_id)
  const allSiblingsComplete = siblings.every((t) => t.status === "done")

  if (allSiblingsComplete) {
    // Auto-complete the parent
    const parentIndex = tasks.findIndex((t) => t.id === parent.id)
    if (parentIndex !== -1) {
      const updatedParent: Task = {
        ...parent,
        resolution: `Auto-completed: All subtasks completed`,
        status: "done",
        updatedAt: new Date(),
      }
      tasks[parentIndex] = updatedParent
      autoCompletedParents.push(updatedParent)

      // Recursively check if the parent's parent can also be completed
      const grandparentCompletions = autoCompleteParentTasks(
        tasks,
        updatedParent,
      )
      autoCompletedParents.push(...grandparentCompletions)
    }
  }

  return autoCompletedParents
}

/**
 * Complete a task and find the next task to execute
 * @param params Completion parameters
 * @returns Next task information with progress summary
 */
export function completeTask(params: { id: string; resolution: string }): {
  message: string
  next_task_id?: string
  progress_summary: ProgressSummary
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

  // Check if the task has incomplete subtasks
  const subtasks = tasks.filter((t) => t.parent_id === id)
  if (subtasks.length > 0) {
    const incompleteSubtasks = subtasks.filter((t) => t.status !== "done")
    if (incompleteSubtasks.length > 0) {
      const incompleteNames = incompleteSubtasks
        .map((t) => `'${t.name}'`)
        .join(", ")
      throw new Error(
        `Cannot complete task '${task.name}' because it has incomplete subtasks: ${incompleteNames}. Please complete all subtasks first.`,
      )
    }
  }

  // Update task to completed
  const updatedTask: Task = {
    ...task,
    resolution: resolution.trim(),
    status: "done",
    updatedAt: new Date(),
  }

  tasks[taskIndex] = updatedTask

  // Auto-complete parent tasks if all their subtasks are complete
  const autoCompletedParents = autoCompleteParentTasks(tasks, updatedTask)

  writeTasks(tasks)

  // Generate progress summary with updated tasks
  const progress_summary = generateProgressSummary(tasks)

  // Find next task to execute
  const nextTask = findNextTask(tasks, updatedTask)

  let message: string
  if (autoCompletedParents.length > 0) {
    const parentNames = autoCompletedParents
      .map((p: Task) => `'${p.name}'`)
      .join(", ")
    if (nextTask) {
      message = `Task '${task.name}' completed. Auto-completed parent tasks: ${parentNames}. Next task: '${nextTask.name}'`
    } else {
      message = `Task '${task.name}' completed. Auto-completed parent tasks: ${parentNames}. No more tasks to execute.`
    }
  } else {
    if (nextTask) {
      message = `Task '${task.name}' completed. Next task: '${nextTask.name}'`
    } else {
      message = `Task '${task.name}' completed. No more tasks to execute.`
    }
  }

  return {
    message,
    next_task_id: nextTask?.id,
    progress_summary,
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
