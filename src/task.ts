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
  parentId?: string
}): { message?: string; task: Task } {
  const { description = "", name, parentId } = params
  let { order } = params

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Task name is required and must be a non-empty string")
  }

  const tasks = readTasks()

  // Validate parentId exists if provided
  if (parentId) {
    const parentExists = tasks.some((task) => task.id === parentId)
    if (!parentExists) {
      throw new Error(`Parent task with id '${parentId}' does not exist`)
    }
  }

  const siblings = tasks.filter((task) => task.parentId === parentId)

  if (!order) {
    // If order is not specified, assign the max order + 1
    order =
      siblings.length > 0 ? Math.max(...siblings.map((t) => t.order)) + 1 : 1
  } else {
    // If order is specified and conflicts, shift existing tasks
    const conflict = siblings.some((t) => t.order === order)
    if (conflict) {
      tasks.forEach((t) => {
        if (t.parentId === parentId && t.order >= (order as number)) {
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
    parentId,
    status: "todo",
    updatedAt: now,
  }

  tasks.push(task)
  writeTasks(tasks)

  // Generate recommendation message for root tasks
  let message: string | undefined
  if (!parentId) {
    message = `Root task '${task.name}' created successfully. Consider breaking this down into smaller subtasks using createTask with parentId='${task.id}' to better organize your workflow and track progress.`
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
 * List tasks, optionally filtered by parentId
 * @param params Optional filtering parameters
 * @returns Array of tasks
 */
export function listTasks(params?: { parentId?: string }): Task[] {
  const tasks = readTasks()

  if (!params?.parentId) {
    return tasks
  }

  return tasks.filter((task) => task.parentId === params.parentId)
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
  parentId?: string
  resolution?: string
  status?: string
}): Task {
  const { description, id, name, order, parentId, resolution, status } = params

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

  // Validate parentId exists if provided and different from current
  if (parentId !== undefined && parentId !== currentTask.parentId) {
    if (parentId) {
      const parentExists = tasks.some((task) => task.id === parentId)
      if (!parentExists) {
        throw new Error(`Parent task with id '${parentId}' does not exist`)
      }
      // Check for circular reference
      if (parentId === id) {
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

  if (parentId !== undefined) {
    updatedTask.parentId = parentId || undefined
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
  const hasChildren = tasks.some((task) => task.parentId === id)
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
    .filter((task) => task.parentId === taskId && task.status === "todo")
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
 * Helper function to find all leaf nodes (tasks without children)
 */
function findLeafNodes(tasks: Task[]): Task[] {
  return tasks.filter((task) => !tasks.some((t) => t.parentId === task.id))
}

/**
 * Helper function to reset all in_progress leaf nodes to todo
 */
function resetInProgressLeafNodes(tasks: Task[]): Task[] {
  const leafNodes = findLeafNodes(tasks)
  const inProgressLeafNodes = leafNodes.filter(
    (task) => task.status === "in_progress",
  )

  if (inProgressLeafNodes.length === 0) {
    return []
  }

  const updatedTasks: Task[] = []
  const now = new Date()

  for (const leafTask of inProgressLeafNodes) {
    const taskIndex = tasks.findIndex((t) => t.id === leafTask.id)
    if (taskIndex !== -1) {
      const updatedTask: Task = {
        ...leafTask,
        status: "todo",
        updatedAt: now,
      }
      tasks[taskIndex] = updatedTask
      updatedTasks.push(updatedTask)
    }
  }

  // After resetting leaf nodes, update parent statuses
  updateParentStatusesAfterReset(tasks, now, updatedTasks)

  return updatedTasks
}

/**
 * Helper function to update parent statuses after leaf nodes are reset
 */
function updateParentStatusesAfterReset(
  tasks: Task[],
  now: Date,
  updatedTasks: Task[],
): void {
  // Get all parent nodes that might need status updates
  const allParents = tasks.filter((task) =>
    tasks.some((t) => t.parentId === task.id),
  )

  for (const parent of allParents) {
    const childTasks = tasks.filter((t) => t.parentId === parent.id)
    const hasInProgressChild = childTasks.some(
      (child) => child.status === "in_progress",
    )

    // If parent has no in_progress children and is currently in_progress, reset to todo
    if (!hasInProgressChild && parent.status === "in_progress") {
      const parentIndex = tasks.findIndex((t) => t.id === parent.id)
      if (parentIndex !== -1) {
        const updatedParent: Task = {
          ...parent,
          status: "todo",
          updatedAt: now,
        }
        tasks[parentIndex] = updatedParent
        updatedTasks.push(updatedParent)
      }
    }
  }
}

/**
 * Helper function to update parent node statuses based on child status
 */
function updateParentStatuses(taskId: string, tasks: Task[]): Task[] {
  const updatedParents: Task[] = []
  const now = new Date()

  const task = tasks.find((t) => t.id === taskId)
  if (!task?.parentId) {
    return updatedParents
  }

  const parent = tasks.find((t) => t.id === task.parentId)
  if (!parent) {
    return updatedParents
  }

  // Check if this parent should be in_progress
  const childTasks = tasks.filter((t) => t.parentId === parent.id)
  const hasInProgressChild = childTasks.some(
    (child) => child.status === "in_progress",
  )

  if (
    hasInProgressChild &&
    parent.status !== "in_progress" &&
    parent.status !== "done"
  ) {
    const parentIndex = tasks.findIndex((t) => t.id === parent.id)
    if (parentIndex !== -1) {
      const updatedParent: Task = {
        ...parent,
        status: "in_progress",
        updatedAt: now,
      }
      tasks[parentIndex] = updatedParent
      updatedParents.push(updatedParent)

      // Recursively update ancestors
      const ancestorUpdates = updateParentStatuses(parent.id, tasks)
      updatedParents.push(...ancestorUpdates)
    }
  }

  return updatedParents
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

  // Validate execution order - check if all preceding sibling tasks are completed
  validateExecutionOrder(task, tasks)

  // Check if the task to be started is a leaf node
  const isLeafNode = !tasks.some((t) => t.parentId === task.id)

  // If starting a leaf node, reset any existing in_progress leaf nodes
  let resetLeafTasks: Task[] = []
  if (isLeafNode) {
    resetLeafTasks = resetInProgressLeafNodes(tasks)
  }

  // Start the main task
  const updatedTask: Task = {
    ...task,
    status: "in_progress",
    updatedAt: new Date(),
  }

  tasks[taskIndex] = updatedTask
  const startedTasks: Task[] = [updatedTask]

  // Update parent statuses based on the new in_progress task
  const updatedParents = updateParentStatuses(task.id, tasks)
  startedTasks.push(...updatedParents)

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

        // Update parent statuses for each task in the execution path
        const pathParentUpdates = updateParentStatuses(pathTask.id, tasks)
        for (const parentUpdate of pathParentUpdates) {
          // Only add if not already in startedTasks
          if (!startedTasks.some((st) => st.id === parentUpdate.id)) {
            startedTasks.push(parentUpdate)
          }
        }
      }
    }

    const depth = executionPath.length
    if (depth === 1) {
      message = `Task '${task.name}' started. Direct subtask '${executionPath[0]?.name}' also started automatically.`
    } else {
      message = `Task '${task.name}' started. Auto-started ${depth} nested tasks down to deepest incomplete subtask '${executionPath[depth - 1]?.name}'.`
    }

    if (resetLeafTasks.length > 0) {
      message += ` Previously in-progress leaf tasks were reset to todo status.`
    }
  } else {
    message = `Task '${task.name}' started. No incomplete subtasks found.`
    if (resetLeafTasks.length > 0) {
      message += ` Previously in-progress leaf tasks were reset to todo status.`
    }
  }

  writeTasks(tasks)

  // Generate hierarchy summary with changed task IDs
  const changedTaskIds = new Set<string>(startedTasks.map((t) => t.id))
  const hierarchySummary = generateHierarchySummary(tasks, changedTaskIds)

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
 * @param changedTaskIds Set of task IDs that had their status changed in this operation
 * @returns Array of progress rows for parent tasks
 */
function generateProgressRows(
  tasks: Task[],
  changedTaskIds: Set<string> = new Set<string>(),
): TaskProgressRow[] {
  // Sort tasks to maintain consistent display order (by parent hierarchy and order)
  const sortedTasks = [...tasks].sort((a, b) => {
    // First, sort by parentId (root tasks first)
    if (!a.parentId && b.parentId) return -1
    if (a.parentId && !b.parentId) return 1
    if (a.parentId !== b.parentId)
      return (a.parentId || "").localeCompare(b.parentId || "")
    // Then sort by order within same parent
    return a.order - b.order
  })

  // Include all tasks instead of just parent tasks
  return sortedTasks.map((task) => {
    const subtasks = tasks.filter((t) => t.parentId === task.id)
    const completed_subtasks = subtasks.filter(
      (t) => t.status === "done",
    ).length
    const total_subtasks = subtasks.length
    const progress_percentage =
      total_subtasks > 0
        ? Math.round((completed_subtasks / total_subtasks) * 100)
        : 100 // Individual tasks without subtasks are 100% when done, 0% otherwise

    // Find parent task name
    const parentInfo = task.parentId
      ? tasks.find((t) => t.id === task.parentId)
      : undefined

    return {
      completed_subtasks,
      parent_name: parentInfo?.name,
      progress_percentage:
        task.status === "done" && total_subtasks === 0
          ? 100
          : progress_percentage,
      status: task.status,
      status_changed: changedTaskIds.has(task.id),
      task_name: task.name,
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
    return "No tasks found."
  }

  const header =
    "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |"
  const separator =
    "|-----------|-------------|--------|----------------|----------|----------|"

  const tableRows = rows.map((row) => {
    const statusDisplay =
      row.status === "todo"
        ? "📋 todo"
        : row.status === "in_progress"
          ? "⚡ in_progress"
          : "✅ done"
    const parentDisplay = row.parent_name || "-"
    const statusChangedDisplay = row.status_changed ? "✓" : "-"
    const subtasksDisplay =
      row.total_subtasks > 0
        ? `${row.completed_subtasks}/${row.total_subtasks}`
        : "-"
    const progressDisplay =
      row.total_subtasks > 0
        ? `${row.progress_percentage}%`
        : row.status === "done"
          ? "100%"
          : "0%"

    return `| ${row.task_name} | ${parentDisplay} | ${statusDisplay} | ${statusChangedDisplay} | ${subtasksDisplay} | ${progressDisplay} |`
  })

  return [header, separator, ...tableRows].join("\n")
}

/**
 * Generate complete progress summary
 * @param tasks All tasks
 * @param changedTaskIds Set of task IDs that had their status changed in this operation
 * @returns Complete progress summary
 */
function generateProgressSummary(
  tasks: Task[],
  changedTaskIds: Set<string> = new Set<string>(),
): ProgressSummary {
  const overallProgress = calculateOverallProgress(tasks)
  const progressRows = generateProgressRows(tasks, changedTaskIds)
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
 * Calculate subtask information for a task
 * @param tasks All tasks
 * @param taskId Target task ID
 * @returns Object with subtasks string and progress string
 */
function calculateSubtaskInfo(
  tasks: Task[],
  taskId: string,
): { progress: string; subtasks: string } {
  const subtasks = tasks.filter((task) => task.parentId === taskId)

  if (subtasks.length === 0) {
    // No subtasks - progress based on task status
    const task = tasks.find((t) => t.id === taskId)
    const progress = task?.status === "done" ? "100%" : "0%"
    return { progress, subtasks: "-" }
  }

  // Has subtasks - calculate completion
  const completedSubtasks = subtasks.filter(
    (task) => task.status === "done",
  ).length
  const progressPercentage = Math.round(
    (completedSubtasks / subtasks.length) * 100,
  )

  return {
    progress: `${progressPercentage}%`,
    subtasks: `${completedSubtasks}/${subtasks.length}`,
  }
}

/**
 * Generate hierarchy summary rows recursively
 * @param tasks All tasks
 * @param changedTaskIds Set of task IDs that had their status changed in this operation
 * @param parentId Parent task ID (undefined for root tasks)
 * @returns Array of hierarchy summary rows
 */
function generateHierarchySummaryRows(
  tasks: Task[],
  changedTaskIds: Set<string> = new Set<string>(),
  parentId: string | undefined = undefined,
): HierarchySummaryRow[] {
  const childTasks = tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.order - b.order)

  const rows: HierarchySummaryRow[] = []

  for (const task of childTasks) {
    // Find parent task name
    const parentInfo = task.parentId
      ? tasks.find((t) => t.id === task.parentId)
      : undefined

    // Calculate subtask information
    const { progress, subtasks } = calculateSubtaskInfo(tasks, task.id)

    rows.push({
      name: task.name,
      parent_name: parentInfo?.name,
      progress,
      status: task.status,
      status_changed: changedTaskIds.has(task.id),
      subtasks,
      task_id: task.id,
    })

    // Recursively add child tasks
    const childRows = generateHierarchySummaryRows(
      tasks,
      changedTaskIds,
      task.id,
    )
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

  const header =
    "| Task Name | Parent Task | Status | Status Changed | Subtasks | Progress |"
  const separator =
    "|-----------|-------------|--------|----------------|----------|----------|"

  const tableRows = rows.map((row) => {
    const taskDisplay = row.name // Remove indent to match completeTask table format
    const statusDisplay =
      row.status === "todo"
        ? "📋 todo"
        : row.status === "in_progress"
          ? "⚡ in_progress"
          : "✅ done"
    const parentDisplay = row.parent_name || "-"
    const statusChangedDisplay = row.status_changed ? "✓" : "-"
    return `| ${taskDisplay} | ${parentDisplay} | ${statusDisplay} | ${statusChangedDisplay} | ${row.subtasks} | ${row.progress} |`
  })

  return [header, separator, ...tableRows].join("\n")
}

/**
 * Generate complete hierarchy summary
 * @param tasks All tasks
 * @param changedTaskIds Set of task IDs that had their status changed in this operation
 * @returns Complete hierarchy summary
 */
function generateHierarchySummary(
  tasks: Task[],
  changedTaskIds: Set<string> = new Set<string>(),
): HierarchySummary {
  const rows = generateHierarchySummaryRows(tasks, changedTaskIds)
  const table = generateHierarchyMarkdownTable(rows)

  return {
    table,
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

  if (!completedTask.parentId) {
    // No parent to check
    return autoCompletedParents
  }

  const parent = tasks.find((t) => t.id === completedTask.parentId)
  if (!parent || parent.status === "done") {
    // Parent doesn't exist or is already completed
    return autoCompletedParents
  }

  // Check if all siblings (including the completed task) are done
  const siblings = tasks.filter((t) => t.parentId === completedTask.parentId)
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
  const subtasks = tasks.filter((t) => t.parentId === id)
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

  // Generate progress summary with updated tasks and changed task IDs
  const changedTaskIds = new Set<string>([
    updatedTask.id,
    ...autoCompletedParents.map((p) => p.id),
  ])
  const progress_summary = generateProgressSummary(tasks, changedTaskIds)

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
      task.parentId === completedTask.parentId &&
      task.status === "todo" &&
      task.order > completedTask.order,
  )

  if (siblings.length > 0) {
    // Return the sibling with the lowest order
    return siblings.sort((a, b) => a.order - b.order)[0]
  }

  // If no sibling tasks, look for child tasks of the completed task
  const children = tasks.filter(
    (task) => task.parentId === completedTask.id && task.status === "todo",
  )

  if (children.length > 0) {
    // Return the child with the lowest order
    return children.sort((a, b) => a.order - b.order)[0]
  }

  // If no children, look up the hierarchy for the next task
  if (completedTask.parentId) {
    const parent = tasks.find((task) => task.id === completedTask.parentId)
    if (parent) {
      // Check if all siblings of the completed task are done
      const allSiblings = tasks.filter(
        (task) => task.parentId === completedTask.parentId,
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
    (task) => !task.parentId && task.status === "todo",
  )

  if (rootTasks.length > 0) {
    return rootTasks.sort((a, b) => a.order - b.order)[0]
  }

  return undefined
}

/**
 * Validate execution order for starting a task
 * Checks if all sibling tasks with smaller order values are completed
 * @param taskToStart Task that is being started
 * @param allTasks All tasks in the system
 * @throws Error if execution order is violated
 */
function validateExecutionOrder(taskToStart: Task, allTasks: Task[]): void {
  // Get all sibling tasks (tasks with the same parentId)
  const siblings = allTasks.filter(
    (task) =>
      task.parentId === taskToStart.parentId && task.id !== taskToStart.id,
  )

  // Find incomplete siblings with smaller order values
  const incompletePrecedingTasks = siblings.filter(
    (sibling) => sibling.order < taskToStart.order && sibling.status !== "done",
  )

  if (incompletePrecedingTasks.length > 0) {
    throw new Error(
      generateExecutionOrderErrorMessage(
        taskToStart,
        incompletePrecedingTasks,
        allTasks,
      ),
    )
  }
}

/**
 * Generate detailed error message for execution order violations
 * @param taskToStart Task that is being started
 * @param incompletePrecedingTasks Tasks that must be completed first
 * @param allTasks All tasks in the system (for parent task info)
 * @returns Detailed error message with task information table
 */
function generateExecutionOrderErrorMessage(
  taskToStart: Task,
  incompletePrecedingTasks: Task[],
  allTasks: Task[],
): string {
  // Sort incomplete tasks by order for better error message
  const sortedIncompleteTasks = incompletePrecedingTasks.sort(
    (a, b) => a.order - b.order,
  )

  // Get parent task name if exists
  const parentTask = taskToStart.parentId
    ? allTasks.find((task) => task.id === taskToStart.parentId)
    : null

  const parentInfo = parentTask
    ? ` within parent task "${parentTask.name}"`
    : ` at the root level`

  // Generate summary line
  const taskNames = sortedIncompleteTasks
    .map((task) => `"${task.name}" (order: ${task.order})`)
    .join(", ")

  // Generate markdown table for incomplete tasks
  const tableHeader =
    "| Order | Task Name | Status | Description |\n|-------|-----------|--------|-------------|"
  const tableRows = sortedIncompleteTasks
    .map(
      (task) =>
        `| ${task.order} | ${task.name} | ${task.status} | ${task.description || "No description"} |`,
    )
    .join("\n")

  const incompleteTasksTable = `${tableHeader}\n${tableRows}`

  const errorMessage =
    `Execution order violation: Cannot start task "${taskToStart.name}" (order: ${taskToStart.order})${parentInfo}.\n\n` +
    `The following ${sortedIncompleteTasks.length} task(s) with smaller order values must be completed first: ${taskNames}.\n\n` +
    `Incomplete preceding tasks:\n${incompleteTasksTable}\n\n` +
    `Please complete these tasks in order before starting the requested task.`

  return errorMessage
}
