import { randomUUID } from "crypto"
import type {
  HierarchySummary,
  HierarchySummaryRow,
  ProgressSummary,
  Task,
  TaskProgressRow,
} from "./storage.js"
import { readTasks, writeTasks } from "./storage.js"

// ============================================
// Helper functions for nested task operations
// ============================================

/**
 * Recursively find a task by ID in nested task structure
 * @param tasks Array of tasks to search in
 * @param id Task ID to find
 * @returns Found task or undefined
 */
export function findTaskById(tasks: Task[], id: string): Task | undefined {
  for (const task of tasks) {
    if (task.id === id) {
      return task
    }
    const found = findTaskById(task.tasks, id)
    if (found) {
      return found
    }
  }
  return undefined
}

/**
 * Find the parent task of a given task ID
 * @param tasks Array of tasks to search in
 * @param targetId Task ID whose parent to find
 * @returns Parent task or undefined if not found or is root task
 */
export function findParentTask(
  tasks: Task[],
  targetId: string,
): Task | undefined {
  for (const task of tasks) {
    // Check if target is direct child
    if (task.tasks.some((child) => child.id === targetId)) {
      return task
    }
    // Recursively search in subtasks
    const parentFound = findParentTask(task.tasks, targetId)
    if (parentFound) {
      return parentFound
    }
  }
  return undefined
}

/**
 * Flatten nested task structure into a single array
 * @param tasks Array of tasks to flatten
 * @returns Flat array of all tasks
 */
export function flattenTasks(tasks: Task[]): Task[] {
  const result: Task[] = []
  for (const task of tasks) {
    result.push(task)
    result.push(...flattenTasks(task.tasks))
  }
  return result
}

/**
 * Get the hierarchical path from root to a specific task
 * @param tasks Array of tasks to search in
 * @param id Task ID to find path for
 * @returns Array of task names representing the path from root to target task
 */
export function getTaskPath(tasks: Task[], id: string): string[] {
  function findPath(
    currentTasks: Task[],
    currentPath: string[],
  ): null | string[] {
    for (const task of currentTasks) {
      const newPath = [...currentPath, task.name]
      if (task.id === id) {
        return newPath
      }
      const found = findPath(task.tasks, newPath)
      if (found) {
        return found
      }
    }
    return null
  }

  const path = findPath(tasks, [])
  return path || []
}

/**
 * Find and update a task in place in the nested structure
 * @param tasks Array of tasks to search and update in
 * @param id Task ID to find and update
 * @param updateFn Function to update the found task
 * @returns Updated task or undefined if not found
 */
export function updateTaskInPlace(
  tasks: Task[],
  id: string,
  updateFn: (task: Task) => Task,
): Task | undefined {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (task && task.id === id) {
      tasks[i] = updateFn(task)
      return tasks[i]
    }
    if (task?.tasks) {
      const updated = updateTaskInPlace(task.tasks, id, updateFn)
      if (updated) {
        return updated
      }
    }
  }
  return undefined
}

export interface TaskInput {
  description?: string
  name: string
  tasks?: TaskInput[]
}

/**
 * Create a new task
 * @param params Task creation parameters
 * @returns Created task with optional recommendation message
 */
export function createTask(params: {
  description?: string
  insertIndex?: number
  name: string
  parentId?: string
  tasks?: TaskInput[]
}): { message?: string; task: Task } {
  const {
    description = "",
    insertIndex,
    name,
    parentId,
    tasks: subtasks,
  } = params

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Task name is required and must be a non-empty string")
  }

  // Validate subtasks if provided
  if (subtasks && !Array.isArray(subtasks)) {
    throw new Error("Tasks parameter must be an array")
  }

  // Validate each subtask's required fields recursively
  if (subtasks) {
    const validateTaskInput = (
      taskInput: unknown,
      path: string,
      depth = 0,
    ): void => {
      // Prevent excessive nesting
      if (depth > 10) {
        throw new Error(`Task hierarchy too deep`)
      }

      if (
        taskInput === null ||
        typeof taskInput !== "object" ||
        Array.isArray(taskInput)
      ) {
        throw new Error(`Task at ${path} must be an object`)
      }

      const task = taskInput as TaskInput

      if (
        !task.name ||
        typeof task.name !== "string" ||
        task.name.trim() === ""
      ) {
        throw new Error(`Task at ${path} must have a non-empty name`)
      }

      // Validate description if provided
      if (
        task.description !== undefined &&
        typeof task.description !== "string"
      ) {
        throw new Error(`Task description at ${path} must be a string`)
      }

      // Validate subtasks recursively
      if (task.tasks) {
        if (!Array.isArray(task.tasks)) {
          throw new Error(`Tasks property at ${path} must be an array`)
        }
        for (let i = 0; i < task.tasks.length; i++) {
          const childTask = task.tasks[i]
          validateTaskInput(childTask, `${path}.tasks[${i}]`, depth + 1)
        }
      }
    }

    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i]
      validateTaskInput(subtask, `tasks[${i}]`, 1)
    }
  }
  // Validate insertIndex if provided
  if (insertIndex !== undefined && typeof insertIndex !== "number") {
    throw new Error("Insert index must be a number")
  }

  const allTasks = readTasks()

  // Validate parentId exists if provided
  let parentTask: Task | undefined
  if (parentId) {
    // Validate parentId format (should be UUID)
    if (typeof parentId !== "string" || parentId.trim() === "") {
      throw new Error("Parent ID must be a non-empty string")
    }

    parentTask = findTaskById(allTasks, parentId)
    if (!parentTask) {
      throw new Error(`Parent task with id '${parentId}' not found`)
    }
  }

  // Helper function to process subtasks recursively
  const processSubtasks = (inputTasks: TaskInput[]): Task[] => {
    return inputTasks.map((inputTask) => {
      const processedTask: Task = {
        description: inputTask.description || "",
        id: randomUUID(),
        name: inputTask.name,
        resolution: undefined,
        status: "todo",
        tasks: inputTask.tasks ? processSubtasks(inputTask.tasks) : [],
      }
      return processedTask
    })
  }

  const newTask: Task = {
    description: description.trim(),
    id: randomUUID(),
    name: name.trim(),
    resolution: undefined,
    status: "todo",
    tasks: subtasks ? processSubtasks(subtasks) : [],
  }

  if (parentTask) {
    // Insert into parent's tasks array
    if (insertIndex !== undefined) {
      // Handle special values for insertIndex
      let normalizedIndex = insertIndex

      // Handle infinite values by treating them as end-of-array
      if (!Number.isFinite(insertIndex)) {
        normalizedIndex = parentTask.tasks.length
      }

      // Handle negative values by treating them as end-of-array
      if (insertIndex < 0) {
        normalizedIndex = parentTask.tasks.length
      }

      // Handle extremely large values by treating them as end-of-array
      if (insertIndex > parentTask.tasks.length) {
        normalizedIndex = parentTask.tasks.length
      }

      parentTask.tasks.splice(normalizedIndex, 0, newTask)
    } else {
      // Insert at end
      parentTask.tasks.push(newTask)
    }
  } else {
    // Add as root task
    if (insertIndex !== undefined) {
      // Handle special values for insertIndex
      let normalizedIndex = insertIndex

      // Handle infinite values by treating them as end-of-array
      if (!Number.isFinite(insertIndex)) {
        normalizedIndex = allTasks.length
      }

      // Handle negative values by treating them as end-of-array
      if (insertIndex < 0) {
        normalizedIndex = allTasks.length
      }

      // Handle extremely large values by treating them as end-of-array
      if (insertIndex > allTasks.length) {
        normalizedIndex = allTasks.length
      }

      allTasks.splice(normalizedIndex, 0, newTask)
    } else {
      // Insert at end
      allTasks.push(newTask)
    }
  }

  writeTasks(allTasks)

  // Generate recommendation message for root tasks
  let message: string | undefined
  if (!parentId) {
    message = `Root task '${newTask.name}' created successfully. Consider breaking this down into smaller subtasks using createTask with parentId='${newTask.id}' to better organize your workflow and track progress.`
  }

  return { message, task: newTask }
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
  const task = findTaskById(tasks, id)

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
    // Return root level tasks
    return tasks
  }

  // Find the parent task and return its direct children
  const parentTask = findTaskById(tasks, params.parentId)
  if (!parentTask) {
    // Return empty array for non-existent parent (graceful handling)
    return []
  }

  return parentTask.tasks
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
  resolution?: string
  status?: string
}): Task {
  const { description, id, name, resolution, status } = params

  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

  const tasks = readTasks()
  const currentTask = findTaskById(tasks, id)

  if (!currentTask) {
    throw new Error(`Task with id '${id}' not found`)
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

  // Update fields if provided
  if (name !== undefined) {
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Task name must be a non-empty string")
    }
    currentTask.name = name.trim()
  }

  if (description !== undefined) {
    currentTask.description =
      typeof description === "string" ? description.trim() : ""
  }

  if (status !== undefined) {
    currentTask.status = status
  }

  if (resolution !== undefined) {
    currentTask.resolution =
      typeof resolution === "string" ? resolution.trim() : undefined
  }

  writeTasks(tasks)

  return currentTask
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
  const taskToDelete = findTaskById(tasks, id)

  if (!taskToDelete) {
    throw new Error(`Task with id '${id}' not found`)
  }

  // Check if task has child tasks
  if (taskToDelete.tasks.length > 0) {
    throw new Error(
      `Cannot delete task '${id}' because it has child tasks. Please delete all child tasks first.`,
    )
  }

  // Find and remove task from parent's tasks array or root level
  const parentTask = findParentTask(tasks, id)

  if (parentTask) {
    // Remove from parent's tasks array
    const index = parentTask.tasks.findIndex((t) => t.id === id)
    if (index !== -1) {
      parentTask.tasks.splice(index, 1)
    }
  } else {
    // Remove from root level
    const index = tasks.findIndex((t) => t.id === id)
    if (index !== -1) {
      tasks.splice(index, 1)
    }
  }

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
  // Find the task and get its children
  const parentTask = findTaskById(tasks, taskId)
  if (!parentTask) {
    return null
  }

  const childTasks = parentTask.tasks.filter((task) => task.status === "todo")

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
  const flatTasks = flattenTasks(tasks)
  return flatTasks.filter((task) => task.tasks.length === 0)
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
  for (const leafTask of inProgressLeafNodes) {
    const updatedTask = updateTaskInPlace(tasks, leafTask.id, (task) => ({
      ...task,
      status: "todo",
    }))

    if (updatedTask) {
      updatedTasks.push(updatedTask)
    }
  }

  // After resetting leaf nodes, update parent statuses
  updateParentStatusesAfterReset(tasks, updatedTasks)

  return updatedTasks
}

/**
 * Helper function to update parent statuses after leaf nodes are reset
 */
function updateParentStatusesAfterReset(
  tasks: Task[],
  updatedTasks: Task[],
): void {
  // Get all parent nodes that might need status updates
  const flatTasks = flattenTasks(tasks)
  const allParents = flatTasks.filter((task) => task.tasks.length > 0)

  for (const parent of allParents) {
    const childTasks = parent.tasks
    const hasInProgressChild = childTasks.some(
      (child) => child.status === "in_progress",
    )

    // If parent has no in_progress children and is currently in_progress, reset to todo
    if (!hasInProgressChild && parent.status === "in_progress") {
      const updatedParent = updateTaskInPlace(tasks, parent.id, (task) => ({
        ...task,
        status: "todo",
      }))

      if (updatedParent) {
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

  const task = findTaskById(tasks, taskId)
  const parent = task ? findParentTask(tasks, task.id) : null
  if (!parent) {
    return updatedParents
  }

  // Check if this parent should be in_progress
  const childTasks = parent.tasks
  const hasInProgressChild = childTasks.some(
    (child) => child.status === "in_progress",
  )

  if (
    hasInProgressChild &&
    parent.status !== "in_progress" &&
    parent.status !== "done"
  ) {
    const updatedParent = updateTaskInPlace(tasks, parent.id, (task) => ({
      ...task,
      status: "in_progress",
    }))

    if (updatedParent) {
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
  const task = findTaskById(tasks, id)

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
  const isLeafNode = task.tasks.length === 0

  // If starting a leaf node, reset any existing in_progress leaf nodes
  let resetLeafTasks: Task[] = []
  if (isLeafNode) {
    resetLeafTasks = resetInProgressLeafNodes(tasks)
  }

  // Start the main task
  const updatedTask = updateTaskInPlace(tasks, id, (task) => ({
    ...task,
    status: "in_progress",
  }))

  if (!updatedTask) {
    throw new Error(`Failed to update task with id '${id}'`)
  }

  const startedTasks: Task[] = [updatedTask]

  // Update parent statuses based on the new in_progress task
  const updatedParents = updateParentStatuses(task.id, tasks)
  startedTasks.push(...updatedParents)

  // Find the deepest incomplete subtask and start all tasks in the execution path
  const deepestResult = findDeepestIncompleteSubtask(id, tasks)
  let message: string

  if (deepestResult) {
    const { executionPath } = deepestResult

    // Start all tasks in the execution path (excluding the main task which is already started)
    for (const pathTask of executionPath) {
      // Use updateTaskInPlace instead of findIndex for nested structure
      const updatedPathTask = updateTaskInPlace(tasks, pathTask.id, (task) => {
        if (task.status === "todo") {
          return {
            ...task,
            status: "in_progress",
          }
        }
        return task
      })

      if (updatedPathTask && updatedPathTask.status === "in_progress") {
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

  message += `\nWhen the task is finished, please run 'completeTask' to complete it.`

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
  // Use flattened tasks to get all tasks in the hierarchy
  const flatTasks = flattenTasks(tasks)
  const total_tasks = flatTasks.length
  const completed_tasks = flatTasks.filter(
    (task) => task.status === "done",
  ).length
  const in_progress_tasks = flatTasks.filter(
    (task) => task.status === "in_progress",
  ).length
  const todo_tasks = flatTasks.filter((task) => task.status === "todo").length
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
  // Get all tasks flattened for processing
  const flatTasks = flattenTasks(tasks)

  // Include all tasks in the progress display
  return flatTasks.map((task) => {
    const subtasks = task.tasks
    const completed_subtasks = subtasks.filter(
      (t) => t.status === "done",
    ).length
    const total_subtasks = subtasks.length
    const progress_percentage =
      total_subtasks > 0
        ? Math.round((completed_subtasks / total_subtasks) * 100)
        : 100 // Individual tasks without subtasks are 100% when done, 0% otherwise

    // Find parent task name
    const parentTask = findParentTask(tasks, task.id)

    return {
      completed_subtasks,
      parent_name: parentTask?.name,
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
  const task = findTaskById(tasks, taskId)
  const subtasks = task?.tasks || []

  if (subtasks.length === 0) {
    // No subtasks - progress based on task status
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
  // Get child tasks based on parentId
  const childTasks = parentId
    ? findTaskById(tasks, parentId)?.tasks || []
    : tasks // If no parentId, use root tasks

  const rows: HierarchySummaryRow[] = []

  for (const task of childTasks) {
    // Find parent task name
    const parentTask = findParentTask(tasks, task.id)

    // Calculate subtask information
    const { progress, subtasks } = calculateSubtaskInfo(tasks, task.id)

    rows.push({
      name: task.name,
      parent_name: parentTask?.name,
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

  const parent = findParentTask(tasks, completedTask.id)
  if (!parent || parent.status === "done") {
    // Parent doesn't exist or is already completed
    return autoCompletedParents
  }

  // Check if all children are done
  const allChildrenComplete = parent.tasks.every((t) => t.status === "done")

  if (allChildrenComplete) {
    // Auto-complete the parent
    const updatedParent = updateTaskInPlace(tasks, parent.id, (task) => ({
      ...task,
      resolution: `Auto-completed: All subtasks completed`,
      status: "done",
    }))

    if (updatedParent) {
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

  // Find the task using the recursive helper function
  const taskToComplete = findTaskById(tasks, id)
  if (!taskToComplete) {
    throw new Error(`Task with id '${id}' not found`)
  }

  if (taskToComplete.status === "done") {
    throw new Error(`Task '${id}' is already completed`)
  }

  // Check if the task has incomplete subtasks
  if (taskToComplete.tasks.length > 0) {
    const incompleteSubtasks = taskToComplete.tasks.filter(
      (t) => t.status !== "done",
    )
    if (incompleteSubtasks.length > 0) {
      const incompleteNames = incompleteSubtasks
        .map((t) => `'${t.name}'`)
        .join(", ")
      throw new Error(
        `Cannot complete task '${taskToComplete.name}' because it has incomplete subtasks: ${incompleteNames}. Please complete all subtasks first.`,
      )
    }
  }

  // Update task to completed using in-place update
  const updatedTask = updateTaskInPlace(tasks, id, (task) => ({
    ...task,
    resolution: resolution.trim(),
    status: "done" as const,
  }))

  if (!updatedTask) {
    throw new Error(`Failed to update task with id '${id}'`)
  }

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
      message = `Task '${taskToComplete.name}' completed. Auto-completed parent tasks: ${parentNames}. Next task: '${nextTask.name}'`
    } else {
      message = `Task '${taskToComplete.name}' completed. Auto-completed parent tasks: ${parentNames}. No more tasks to execute.`
    }
  } else {
    if (nextTask) {
      message = `Task '${taskToComplete.name}' completed. Next task: '${nextTask.name}'`
    } else {
      message = `Task '${taskToComplete.name}' completed. No more tasks to execute.`
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
  const parent = findParentTask(tasks, completedTask.id)

  if (parent) {
    // First, look for sibling tasks after this one in the parent's tasks array
    const siblings = parent.tasks
    const completedIndex = siblings.findIndex((t) => t.id === completedTask.id)

    if (completedIndex !== -1 && completedIndex < siblings.length - 1) {
      // Look for next todo sibling
      for (let i = completedIndex + 1; i < siblings.length; i++) {
        const sibling = siblings[i]
        if (sibling && sibling.status === "todo") {
          return sibling
        }
      }
    }
  }

  // If no sibling tasks, look for child tasks of the completed task
  const todoChildren = completedTask.tasks.filter((t) => t.status === "todo")
  if (todoChildren.length > 0) {
    // Return the first todo child
    return todoChildren[0]
  }

  // If no children, look up the hierarchy for the next task
  if (parent) {
    // Check if all siblings of the completed task are done
    const allSiblingsDone = parent.tasks.every((task) => task.status === "done")

    if (allSiblingsDone) {
      // All siblings are done, look for next task at parent level
      return findNextTask(tasks, parent)
    }
  }

  // Look for any remaining todo tasks at the root level
  const rootTodoTasks = tasks.filter((task) => task.status === "todo")

  if (rootTodoTasks.length > 0) {
    return rootTodoTasks[0]
  }

  return undefined
}

/**
 * Validate execution order for starting a task
 * Checks if all preceding sibling tasks in the array are completed
 * Also validates that all preceding sibling tasks of parent tasks are completed
 * @param taskToStart Task that is being started
 * @param allTasks All tasks in the system
 * @throws Error if execution order is violated
 */
function validateExecutionOrder(taskToStart: Task, allTasks: Task[]): void {
  // First check direct sibling order
  validateDirectSiblingOrder(taskToStart, allTasks)

  // Then check parent hierarchy order
  validateParentHierarchyOrder(taskToStart, allTasks)
}

/**
 * Validate order among direct sibling tasks
 * @param taskToStart Task that is being started
 * @param allTasks All tasks in the system
 * @throws Error if execution order is violated
 */
function validateDirectSiblingOrder(taskToStart: Task, allTasks: Task[]): void {
  // Find the parent task or use root tasks array
  const parentTask = findParentTask(allTasks, taskToStart.id)
  const siblingTasks = parentTask ? parentTask.tasks : allTasks

  // Find the index of the task to start within its siblings
  const taskIndex = siblingTasks.findIndex((task) => task.id === taskToStart.id)

  if (taskIndex === -1) {
    throw new Error(
      `Task "${taskToStart.name}" not found in parent tasks array`,
    )
  }

  // Check all tasks before this one in the array
  const incompletePrecedingTasks = siblingTasks
    .slice(0, taskIndex)
    .filter((task) => task.status !== "done")

  if (incompletePrecedingTasks.length > 0) {
    throw new Error(
      generateExecutionOrderErrorMessage(
        taskToStart,
        incompletePrecedingTasks,
        taskIndex,
        parentTask,
        allTasks,
      ),
    )
  }
}

/**
 * Validate order within parent hierarchy
 * Checks if all preceding sibling tasks of the direct parent are completed
 * @param taskToStart Task that is being started
 * @param allTasks All tasks in the system
 * @throws Error if execution order is violated
 */
function validateParentHierarchyOrder(
  taskToStart: Task,
  allTasks: Task[],
): void {
  // Find the direct parent task
  const parentTask = findParentTask(allTasks, taskToStart.id)

  // If no parent (root level task), no hierarchy order to check
  if (!parentTask) {
    return
  }

  // Find the grandparent of current task (parent of parentTask)
  const grandParentTask = findParentTask(allTasks, parentTask.id)
  const parentSiblingTasks = grandParentTask ? grandParentTask.tasks : allTasks

  // Find the index of the parent task within its siblings
  const parentIndex = parentSiblingTasks.findIndex(
    (task) => task.id === parentTask.id,
  )

  if (parentIndex === -1) {
    throw new Error(
      `Parent task "${parentTask.name}" not found in grandparent tasks array`,
    )
  }

  // Check all tasks before the parent in the array
  const incompletePrecedingParentTasks = parentSiblingTasks
    .slice(0, parentIndex)
    .filter((task) => task.status !== "done")

  if (incompletePrecedingParentTasks.length > 0) {
    throw new Error(
      generateParentHierarchyErrorMessage(
        taskToStart,
        parentTask,
        incompletePrecedingParentTasks,
        parentIndex,
        grandParentTask,
        allTasks,
      ),
    )
  }
}

/**
 * Generate detailed error message for execution order violations
 * @param taskToStart Task that is being started
 * @param incompletePrecedingTasks Tasks that must be completed first
 * @param taskIndex Index position of the task to start
 * @param parentTask Parent task (null if root level)
 * @returns Detailed error message with task information table
 */
function generateExecutionOrderErrorMessage(
  taskToStart: Task,
  incompletePrecedingTasks: Task[],
  taskIndex: number,
  parentTask: null | Task | undefined,
  allTasks: Task[],
): string {
  // Get parent context info
  const parentInfo = parentTask
    ? ` within parent task "${parentTask.name}"`
    : ` at the root level`

  // Generate summary line with position information
  const taskPositions = incompletePrecedingTasks
    .map((task) => {
      // Find the actual position of this task in its siblings array
      const parentTask = findParentTask(allTasks, task.id)
      const siblingTasks = parentTask ? parentTask.tasks : allTasks
      const actualPosition = siblingTasks.findIndex(
        (t: Task) => t.id === task.id,
      )
      return `"${task.name}" (position: ${actualPosition + 1}, status: ${task.status})`
    })
    .join(", ")

  // Generate markdown table for incomplete tasks
  const tableHeader =
    "| Order | Task Name | Status | Description |\n|-------|-----------|--------|-------------|"
  const tableRows = incompletePrecedingTasks
    .map((task) => {
      // Find the actual position of this task in its siblings array
      const parentTask = findParentTask(allTasks, task.id)
      const siblingTasks = parentTask ? parentTask.tasks : allTasks
      const actualPosition = siblingTasks.findIndex(
        (t: Task) => t.id === task.id,
      )
      return `| ${actualPosition + 1} | ${task.name} | ${task.status} | ${task.description || "No description"} |`
    })
    .join("\n")

  const incompleteTasksTable = `${tableHeader}\n${tableRows}`

  const errorMessage =
    `Execution order violation: Cannot start task "${taskToStart.name}" (position: ${taskIndex})${parentInfo}. ` +
    `The following ${incompletePrecedingTasks.length} task(s) in preceding positions must be completed first: ${taskPositions}.\n\n` +
    `Incomplete preceding tasks:\n${incompleteTasksTable}\n\n` +
    `Please complete these tasks in order before starting the requested task.`

  return errorMessage
}

/**
 * Generate detailed error message for parent hierarchy execution order violations
 * @param taskToStart Task that is being started
 * @param parentTask Parent task of taskToStart
 * @param incompletePrecedingParentTasks Parent's sibling tasks that must be completed first
 * @param parentIndex Index position of the parent task
 * @param grandParentTask Grandparent task (null if parent is at root level)
 * @param allTasks All tasks in the system
 * @returns Detailed error message with task information table
 */
function generateParentHierarchyErrorMessage(
  taskToStart: Task,
  parentTask: Task,
  incompletePrecedingParentTasks: Task[],
  parentIndex: number,
  grandParentTask: null | Task | undefined,
  allTasks: Task[],
): string {
  // Get grandparent context info
  const grandParentInfo = grandParentTask
    ? ` within grandparent task "${grandParentTask.name}"`
    : ` at the root level`

  // Generate summary line with position information
  const parentTaskPositions = incompletePrecedingParentTasks
    .map((task) => {
      // Find the actual position of this task in its siblings array
      const parentOfTask = findParentTask(allTasks, task.id)
      const siblingTasks = parentOfTask ? parentOfTask.tasks : allTasks
      const actualPosition = siblingTasks.findIndex(
        (t: Task) => t.id === task.id,
      )
      return `"${task.name}" (position: ${actualPosition + 1}, status: ${task.status})`
    })
    .join(", ")

  // Generate markdown table for incomplete parent tasks
  const tableHeader =
    "| Order | Task Name | Status | Description |\n|-------|-----------|--------|-------------|"
  const tableRows = incompletePrecedingParentTasks
    .map((task) => {
      // Find the actual position of this task in its siblings array
      const parentOfTask = findParentTask(allTasks, task.id)
      const siblingTasks = parentOfTask ? parentOfTask.tasks : allTasks
      const actualPosition = siblingTasks.findIndex(
        (t: Task) => t.id === task.id,
      )
      return `| ${actualPosition + 1} | ${task.name} | ${task.status} | ${task.description || "No description"} |`
    })
    .join("\n")

  const incompleteParentTasksTable = `${tableHeader}\n${tableRows}`

  const errorMessage =
    `Hierarchy order violation: Cannot start task "${taskToStart.name}" because its parent task "${parentTask.name}" (position: ${parentIndex + 1})${grandParentInfo} has preceding sibling tasks that are not completed. ` +
    `The following ${incompletePrecedingParentTasks.length} parent sibling task(s) must be completed first: ${parentTaskPositions}.\n\n` +
    `Incomplete preceding parent sibling tasks:\n${incompleteParentTasksTable}\n\n` +
    `Please complete these parent tasks in order before starting subtasks of "${parentTask.name}".`

  return errorMessage
}
