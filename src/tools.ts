import { z } from "zod"
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
  // Register createTask tool
  server.registerTool(
    "createTask",
    {
      description:
        "Create a new task with optional parent and ordering.\n\n" +
        "This tool initiates a new workflow for handling user requests. The workflow is as follows:\n" +
        "1. Create a task with the provided name and optional description. It is structured as a root task and subtasks to achieve it.\n" +
        "2. After task creation, you MUST call the `startTask` tool to begin processing the task.\n" +
        "3. When the task is completed, call the `completeTask` tool with the task ID and resolution details.\n" +
        "4. If the following task is assigned, execute it by calling the `startTask` tool again.\n" +
        "5. Repeat this cycle until all tasks are completed.",
      inputSchema: {
        description: z
          .string()
          .describe("Task description (optional)")
          .optional(),
        name: z.string().describe("Task name (required)"),
        order: z
          .number()
          .describe(
            "Order within siblings (optional, if not specified, it will be added to the end by default.)",
          )
          .optional(),
        parentId: z
          .string()
          .describe("Parent task ID for hierarchical organization (optional)")
          .optional(),
      },
    },
    (args) => {
      try {
        const result = createTask(args)
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
      description: "List tasks, optionally filtered by parentId",
      inputSchema: {
        parentId: z
          .string()
          .describe("Filter tasks by parent ID (optional)")
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
        order: z
          .number()
          .describe("Updated order within siblings (optional)")
          .optional(),
        parentId: z
          .string()
          .describe("Updated parent task ID (optional)")
          .optional(),
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
        const task = updateTask(args)
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
        return {
          content: [
            {
              text: JSON.stringify(
                {
                  error: {
                    code: "TASK_START_ERROR",
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
        const result = completeTask(args)
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
