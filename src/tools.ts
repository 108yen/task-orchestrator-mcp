import { z } from "zod"
import type { TaskInput } from "./task.js"
import { server } from "./server.js"
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  startTask,
  updateTask,
} from "./task.js"

/**
 * Register all task management tools with the MCP server
 */
export function registerTools(): void {
  // Define recursive TaskInput schema
  const TaskInputSchema: z.ZodType<TaskInput> = z.lazy(() =>
    z.object({
      completion_criteria: z.array(z.string()).optional(),
      constraints: z.array(z.string()).optional(),
      description: z.string().optional(),
      name: z.string(),
      tasks: z.array(TaskInputSchema).optional(),
    }),
  )

  // Register createTask tool
  server.registerTool(
    "createTask",
    {
      description:
        "Create a new task with optional parent and index positioning.\n\n" +
        "This tool initiates a new workflow for handling user requests. To manage tasks, you MUST always run this tool first. The workflow is as follows:\n" +
        "1. Create tasks with the provided name and optional description. Tasks are organized in a hierarchical structure where subtasks can be created by specifying parentId.\n" +
        "2. Tasks are ordered by their position in the parent's tasks array. Use insertIndex to specify position (defaults to end).\n" +
        "3. After task creation, you MUST call the `startTask` tool to begin processing the task.\n" +
        "4. When the task is completed, call the `completeTask` tool with the task ID and resolution details.\n" +
        "5. If the following task is assigned, execute it by calling the `startTask` tool again.\n" +
        "6. Repeat this cycle until all tasks are completed.",
      inputSchema: {
        completion_criteria: z
          .array(z.string())
          .describe("Completion criteria for the task (optional)")
          .optional(),
        constraints: z
          .array(z.string())
          .describe("Constraints for task execution (optional)")
          .optional(),
        description: z
          .string()
          .describe("Task description (optional)")
          .optional(),
        insertIndex: z
          .number()
          .describe(
            "Index position within parent's tasks array (optional, defaults to end of array)",
          )
          .optional(),
        name: z.string().describe("Task name (required)"),
        parentId: z
          .string()
          .describe("Parent task ID for hierarchical organization (optional)")
          .optional(),
        tasks: z
          .array(TaskInputSchema)
          .describe("Array of subtasks to create simultaneously (optional)")
          .optional(),
      },
    },
    (args) => {
      try {
        const result = createTask(
          args as {
            completion_criteria?: string[]
            constraints?: string[]
            description?: string
            insertIndex?: number
            name: string
            parentId?: string
            tasks?: TaskInput[]
          },
        )
        return {
          content: [
            {
              text: JSON.stringify(result, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_CREATION_ERROR",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register getTask tool
  server.registerTool(
    "getTask",
    {
      description: "Get a task by its ID",
      inputSchema: {
        id: z.string().describe("Task ID"),
      },
    },
    (args) => {
      try {
        const task = getTask(args.id)
        return {
          content: [
            {
              text: JSON.stringify({ task }, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_NOT_FOUND",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register listTasks tool
  server.registerTool(
    "listTasks",
    {
      description:
        "List tasks from hierarchical structure, optionally filtered by parentId. Returns root tasks if no parentId specified, or direct children of specified parent task.",
      inputSchema: {
        parentId: z
          .string()
          .describe(
            "Filter tasks by parent ID to get direct children (optional, returns root tasks if not specified)",
          )
          .optional(),
      },
    },
    (args) => {
      try {
        const tasks = listTasks(args)
        return {
          content: [
            {
              text: JSON.stringify({ tasks }, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_LIST_ERROR",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register updateTask tool
  server.registerTool(
    "updateTask",
    {
      description: "Update an existing task",
      inputSchema: {
        description: z
          .string()
          .describe("Updated task description (optional)")
          .optional(),
        id: z.string().describe("Task ID"),
        name: z.string().describe("Updated task name (optional)").optional(),
        resolution: z
          .string()
          .describe("Task resolution details (optional)")
          .optional(),
        status: z
          .enum(["todo", "in_progress", "done"])
          .describe("Updated task status (optional)")
          .optional(),
      },
    },
    (args) => {
      try {
        const task = updateTask(
          args as {
            description?: string
            id: string
            name?: string
            resolution?: string
            status?: string
          },
        )
        return {
          content: [
            {
              text: JSON.stringify({ task }, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_UPDATE_ERROR",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register deleteTask tool
  server.registerTool(
    "deleteTask",
    {
      description: "Delete a task by its ID",
      inputSchema: {
        id: z.string().describe("Task ID"),
      },
    },
    (args) => {
      try {
        const result = deleteTask(args.id)
        return {
          content: [
            {
              text: JSON.stringify(result, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_DELETE_ERROR",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register startTask tool
  server.registerTool(
    "startTask",
    {
      description:
        "Start a task (change status to in_progress)\n\n" +
        "1. Run this tool to start the task. \n" +
        "2. When the task is complete, call the `completeTask` tool to complete the task.",
      inputSchema: {
        id: z.string().describe("Task ID"),
      },
    },
    (args) => {
      try {
        const result = startTask(args.id)
        return {
          content: [
            {
              text: JSON.stringify(result, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        const isExecutionOrderError = errorMessage.includes(
          "Execution order violation",
        )

        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: isExecutionOrderError
                      ? "EXECUTION_ORDER_VIOLATION"
                      : "TASK_START_ERROR",
                    message: errorMessage,
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register completeTask tool
  server.registerTool(
    "completeTask",
    {
      description:
        "Complete a task and get the next task to execute.\n" +
        "To start the next task, execute `startTask`.",
      inputSchema: {
        id: z.string().describe("Task ID"),
        resolution: z.string().describe("Task completion resolution/details"),
      },
    },
    (args) => {
      try {
        const result = completeTask(args as { id: string; resolution: string })
        return {
          content: [
            {
              text: JSON.stringify(result, null, 2),
              type: "text",
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_COMPLETE_ERROR",
                    message:
                      error instanceof Error ? error.message : "Unknown error",
                  },
                },
                null,
                2,
              ),
              type: "text",
            },
          ],
          isError: true,
        }
      }
    },
  )
}
