import type { Task } from "./storage.js"

export interface TaskInput {
  completion_criteria?: string[]
  constraints?: string[]
  description?: string
  name: string
  tasks?: TaskInput[]
}

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
 * Validate basic task creation parameters
 * @param params Task creation parameters
 */
export function validateCreateTaskBasicParams(params: {
  completion_criteria?: string[]
  constraints?: string[]
  insertIndex?: number
  name: string
}): void {
  const { completion_criteria, constraints, insertIndex, name } = params

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new Error("Task name is required and must be a non-empty string")
  }

  // Validate completion_criteria if provided
  if (completion_criteria !== undefined) {
    if (!Array.isArray(completion_criteria)) {
      throw new Error("Completion criteria must be an array")
    }
    if (completion_criteria.some((criteria) => typeof criteria !== "string")) {
      throw new Error("All completion criteria must be strings")
    }
  }

  // Validate constraints if provided
  if (constraints !== undefined) {
    if (!Array.isArray(constraints)) {
      throw new Error("Constraints must be an array")
    }
    if (constraints.some((constraint) => typeof constraint !== "string")) {
      throw new Error("All constraints must be strings")
    }
  }

  // Validate insertIndex if provided
  if (insertIndex !== undefined && typeof insertIndex !== "number") {
    throw new Error("Insert index must be a number")
  }
}

/**
 * Validate a single TaskInput object recursively
 * @param taskInput Task input to validate
 * @param path Path for error reporting
 * @param depth Current nesting depth
 */
export function validateTaskInput(
  taskInput: unknown,
  path: string,
  depth = 0,
): void {
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

  if (!task.name || typeof task.name !== "string" || task.name.trim() === "") {
    throw new Error(`Task at ${path} must have a non-empty name`)
  }

  // Validate description if provided
  if (task.description !== undefined && typeof task.description !== "string") {
    throw new Error(`Task description at ${path} must be a string`)
  }

  // Validate completion_criteria if provided
  if (task.completion_criteria !== undefined) {
    if (!Array.isArray(task.completion_criteria)) {
      throw new Error(`Completion criteria at ${path} must be an array`)
    }
    if (
      task.completion_criteria.some((criteria) => typeof criteria !== "string")
    ) {
      throw new Error(`All completion criteria at ${path} must be strings`)
    }
  }

  // Validate constraints if provided
  if (task.constraints !== undefined) {
    if (!Array.isArray(task.constraints)) {
      throw new Error(`Constraints at ${path} must be an array`)
    }
    if (task.constraints.some((constraint) => typeof constraint !== "string")) {
      throw new Error(`All constraints at ${path} must be strings`)
    }
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

/**
 * Validate subtasks array if provided
 * @param subtasks Subtasks to validate
 */
export function validateSubtasks(subtasks?: TaskInput[]): void {
  // Validate subtasks if provided
  if (subtasks && !Array.isArray(subtasks)) {
    throw new Error("Tasks parameter must be an array")
  }

  // Validate each subtask's required fields recursively
  if (subtasks) {
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i]
      validateTaskInput(subtask, `tasks[${i}]`, 1)
    }
  }
}

/**
 * Validate and find parent task if parentId is provided
 * @param parentId Parent task ID
 * @param allTasks All tasks to search in
 * @returns Parent task if found, undefined otherwise
 */
export function validateAndFindParentTask(
  parentId: string | undefined,
  allTasks: Task[],
): Task | undefined {
  if (!parentId) {
    return undefined
  }

  // Validate parentId format (should be UUID)
  if (typeof parentId !== "string" || parentId.trim() === "") {
    throw new Error("Parent ID must be a non-empty string")
  }

  const parentTask = findTaskById(allTasks, parentId)
  if (!parentTask) {
    throw new Error(`Parent task with id '${parentId}' not found`)
  }

  return parentTask
}

/**
 * Validate parameters for starting a task
 * @param id Task ID
 * @param tasks All tasks
 * @returns The task to start
 */
export function validateStartTaskParams(id: string, tasks: Task[]): Task {
  if (!id || typeof id !== "string") {
    throw new Error("Task ID is required and must be a string")
  }

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

  return task
}

/**
 * Validate parameters for completing a task
 * @param id Task ID
 * @param resolution Task resolution
 */
export function validateCompleteTaskParams(
  id: string,
  resolution: string,
): void {
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
}

/**
 * Find and validate task to complete
 * @param id Task ID
 * @param tasks All tasks
 * @returns Task to complete
 */
export function findAndValidateTaskToComplete(id: string, tasks: Task[]): Task {
  // Find the task using the recursive helper function
  const taskToComplete = findTaskById(tasks, id)
  if (!taskToComplete) {
    throw new Error(`Task with id '${id}' not found`)
  }

  if (taskToComplete.status === "done") {
    throw new Error(`Task '${id}' is already completed`)
  }

  return taskToComplete
}

/**
 * Validate that task has no incomplete subtasks
 * @param task Task to validate
 */
export function validateNoIncompleteSubtasks(task: Task): void {
  // Check if the task has incomplete subtasks
  if (task.tasks.length > 0) {
    const incompleteSubtasks = task.tasks.filter((t) => t.status !== "done")
    if (incompleteSubtasks.length > 0) {
      const incompleteNames = incompleteSubtasks
        .map((t) => `'${t.name}'`)
        .join(", ")
      throw new Error(
        `Cannot complete task '${task.name}' because it has incomplete subtasks: ${incompleteNames}. Please complete all subtasks first.`,
      )
    }
  }
}
