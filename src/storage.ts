import { existsSync, readFileSync, writeFileSync } from "fs"

/**
 * Hierarchy summary interface for task structure reporting
 */
export interface HierarchySummary {
  table: string // Hierarchical table string in markdown format
}

/**
 * Hierarchy summary row interface for task structure display
 */
export interface HierarchySummaryRow {
  name: string // Task name
  parent_name?: string // Parent task name (undefined for top-level tasks)
  progress: string // Progress rate (e.g., "20%", "100%", "-")
  status: string // Status
  status_changed: boolean // Whether the status was changed by the operation
  subtasks: string // Subtask information (e.g., "2/5", "-")
  task_id: string // Task ID
}

/**
 * Progress summary interface for task completion reporting
 */
export interface ProgressSummary {
  completed_tasks: number // Number of completed tasks
  completion_percentage: number // Completion rate (0-100)
  in_progress_tasks: number // Number of in-progress tasks
  table: string // Table string in markdown format
  todo_tasks: number // Number of todo tasks
  total_tasks: number // Total number of tasks
}

/**
 * Task interface representing a task in the system
 */
export interface Task {
  completion_criteria?: string[] // Array of conditions for task completion
  constraints?: string[] // Array of constraints for task execution
  description: string // Detailed description of the task
  id: string // Unique identifier for the task (UUID)
  name: string // Task name
  resolution?: string // State or result when task is completed (undefined when incomplete)
  status: string // Task progress status ('todo', 'in_progress', 'done')
  tasks: Task[] // Array of subtasks (nested hierarchical structure, array order is execution order)
}

/**
 * Task progress row interface for hierarchical progress display
 */
export interface TaskProgressRow {
  completed_subtasks: number // Number of completed subtasks
  parent_name?: string // Parent task name (undefined for top-level tasks)
  progress_percentage: number // Progress rate (0-100)
  status: string // Status
  status_changed: boolean // Whether the status was changed by the operation
  task_name: string // Task name
  total_subtasks: number // Total number of subtasks
}

// In-memory storage for when FILE_PATH is not set
let memoryTasks: Task[] = []

/**
 * Read tasks from storage (file or memory based on FILE_PATH environment variable)
 * @returns Array of tasks
 */
export function readTasks(): Task[] {
  const filePath = process.env.FILE_PATH

  if (filePath) {
    // File-based storage mode
    try {
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, "utf-8")
        const tasks = JSON.parse(fileContent) as any[]

        return tasks
      } else {
        // File doesn't exist, return empty array
        return []
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error reading tasks from file:", error)
      return []
    }
  } else {
    // In-memory storage mode
    return memoryTasks
  }
}

/**
 * Write tasks to storage (file or memory based on FILE_PATH environment variable)
 * @param tasks Array of tasks to write
 */
export function writeTasks(tasks: Task[]): void {
  const filePath = process.env.FILE_PATH

  if (filePath) {
    // File-based storage mode
    try {
      const jsonContent = JSON.stringify(tasks, null, 2)
      writeFileSync(filePath, jsonContent, "utf-8")
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error writing tasks to file:", error)
      throw error
    }
  } else {
    // In-memory storage mode
    memoryTasks = [...tasks]
  }
}

/**
 * Clear all tasks from storage (for testing purposes)
 */
export function clearTasks(): void {
  const filePath = process.env.FILE_PATH

  if (filePath) {
    // File-based storage mode
    try {
      if (existsSync(filePath)) {
        writeFileSync(filePath, JSON.stringify([]), "utf-8")
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error clearing tasks file:", error)
    }
  } else {
    // In-memory storage mode
    memoryTasks = []
  }
}
