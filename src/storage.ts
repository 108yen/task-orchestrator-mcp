import { existsSync, readFileSync, writeFileSync } from "fs"

/**
 * Hierarchy summary interface for task structure reporting
 */
export interface HierarchySummary {
  table: string // マークダウン形式の階層テーブル文字列
  total_levels: number // 階層の深さ
}

/**
 * Hierarchy summary row interface for task structure display
 */
export interface HierarchySummaryRow {
  depth: number // ネストレベル（0が最上位）
  indent: string // 階層表示用のインデント文字列
  name: string // タスク名
  parent_name?: string // 親タスクの名前（トップレベルタスクの場合はundefined）
  progress: string // 進捗率（例: "20%", "100%", "-"）
  status: string // ステータス
  status_changed: boolean // その操作でステータスが変更されたかどうか
  subtasks: string // サブタスク情報（例: "2/5", "-"）
  task_id: string // タスクID
}

/**
 * Progress summary interface for task completion reporting
 */
export interface ProgressSummary {
  completed_tasks: number // 完了済みタスク数
  completion_percentage: number // 完了率（0-100）
  in_progress_tasks: number // 進行中タスク数
  table: string // マークダウン形式のテーブル文字列
  todo_tasks: number // 未着手タスク数
  total_tasks: number // 全タスク数
}

/**
 * Task interface representing a task in the system
 */
export interface Task {
  createdAt: Date // タスクの作成日時
  description: string // タスクの詳細な説明
  id: string // タスクを一意に識別するためのID（UUID）
  name: string // タスクの名称
  order: number // 兄弟タスク内での実行順序を示す数値
  parentId?: string // 親タスクのID（トップレベルの場合はundefined）
  resolution?: string // タスク完了時の状態や結果（未完了時はundefined）
  status: string // タスクの進捗状況（'todo', 'in_progress', 'done'）
  updatedAt: Date // タスクの最終更新日時
}

/**
 * Task progress row interface for hierarchical progress display
 */
export interface TaskProgressRow {
  completed_subtasks: number // 完了済みサブタスク数
  parent_name?: string // 親タスクの名前（トップレベルタスクの場合はundefined）
  progress_percentage: number // 進捗率（0-100）
  status: string // ステータス
  status_changed: boolean // その操作でステータスが変更されたかどうか
  task_name: string // タスク名
  total_subtasks: number // 総サブタスク数
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
        const tasks = JSON.parse(fileContent) as Task[]

        // Convert date strings back to Date objects
        return tasks.map((task) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
        }))
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
