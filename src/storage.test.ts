import * as fs from "fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Task } from "./storage"
import { readTasks, writeTasks } from "./storage"

// Mock the fs module
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

const mockFs = vi.mocked(fs)

describe("Storage", () => {
  const mockTask: Task = {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    description: "Test Description",
    id: "test-id-1",
    name: "Test Task",
    status: "todo",
    tasks: [], // New nested structure
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  }

  const mockTaskWithResolution: Task = {
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    description: "Completed Description",
    id: "test-id-2",
    name: "Completed Task",
    resolution: "Task completed successfully",
    status: "done",
    tasks: [], // New nested structure
    updatedAt: new Date("2024-01-01T01:00:00.000Z"),
  }

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    // Reset environment variables
    delete process.env.FILE_PATH
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.FILE_PATH
  })

  describe("File-based storage mode (FILE_PATH set)", () => {
    beforeEach(() => {
      process.env.FILE_PATH = "/test/path/tasks.json"
    })

    describe("readTasks", () => {
      it("should read tasks from file when file exists", () => {
        const fileContent = JSON.stringify([mockTask, mockTaskWithResolution])
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue(fileContent)

        const result = readTasks()

        expect(mockFs.existsSync).toHaveBeenCalledWith("/test/path/tasks.json")
        expect(mockFs.readFileSync).toHaveBeenCalledWith(
          "/test/path/tasks.json",
          "utf-8",
        )
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(mockTask)
        expect(result[1]).toEqual(mockTaskWithResolution)
        // Verify dates are properly converted back to Date objects
        expect(result[0]?.createdAt).toBeInstanceOf(Date)
        expect(result[0]?.updatedAt).toBeInstanceOf(Date)
      })

      it("should return empty array when file does not exist", () => {
        mockFs.existsSync.mockReturnValue(false)

        const result = readTasks()

        expect(mockFs.existsSync).toHaveBeenCalledWith("/test/path/tasks.json")
        expect(mockFs.readFileSync).not.toHaveBeenCalled()
        expect(result).toEqual([])
      })

      it("should return empty array and log error when file read fails", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
          // Mock implementation
        })
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockImplementation(() => {
          throw new Error("File read error")
        })

        const result = readTasks()

        expect(result).toEqual([])
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error reading tasks from file:",
          expect.any(Error),
        )

        consoleSpy.mockRestore()
      })

      it("should return empty array when JSON parsing fails", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
          // Mock implementation
        })
        mockFs.existsSync.mockReturnValue(true)
        mockFs.readFileSync.mockReturnValue("invalid json")

        const result = readTasks()

        expect(result).toEqual([])
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error reading tasks from file:",
          expect.any(Error),
        )

        consoleSpy.mockRestore()
      })
    })

    describe("writeTasks", () => {
      it("should write tasks to file successfully", () => {
        const tasks = [mockTask, mockTaskWithResolution]

        writeTasks(tasks)

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          "/test/path/tasks.json",
          JSON.stringify(tasks, null, 2),
          "utf-8",
        )
      })

      it("should throw error when file write fails", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
          // Mock implementation
        })
        const writeError = new Error("File write error")
        mockFs.writeFileSync.mockImplementation(() => {
          throw writeError
        })

        expect(() => writeTasks([mockTask])).toThrow("File write error")
        expect(consoleSpy).toHaveBeenCalledWith(
          "Error writing tasks to file:",
          writeError,
        )

        consoleSpy.mockRestore()
      })

      it("should handle empty task array", () => {
        writeTasks([])

        expect(mockFs.writeFileSync).toHaveBeenCalledWith(
          "/test/path/tasks.json",
          JSON.stringify([], null, 2),
          "utf-8",
        )
      })
    })
  })

  describe("In-memory storage mode (FILE_PATH not set)", () => {
    beforeEach(() => {
      // Ensure FILE_PATH is not set
      delete process.env.FILE_PATH
    })

    describe("readTasks", () => {
      it("should return empty array initially", () => {
        const result = readTasks()

        expect(result).toEqual([])
        expect(mockFs.existsSync).not.toHaveBeenCalled()
        expect(mockFs.readFileSync).not.toHaveBeenCalled()
      })

      it("should return tasks from memory after writing", () => {
        const tasks = [mockTask, mockTaskWithResolution]

        writeTasks(tasks)
        const result = readTasks()

        expect(result).toEqual(tasks)
        expect(mockFs.writeFileSync).not.toHaveBeenCalled()
        expect(mockFs.readFileSync).not.toHaveBeenCalled()
      })
    })

    describe("writeTasks", () => {
      it("should store tasks in memory", () => {
        const tasks = [mockTask]

        writeTasks(tasks)
        const result = readTasks()

        expect(result).toEqual(tasks)
        expect(mockFs.writeFileSync).not.toHaveBeenCalled()
      })

      it("should replace existing tasks in memory", () => {
        const initialTasks = [mockTask]
        const newTasks = [mockTaskWithResolution]

        writeTasks(initialTasks)
        expect(readTasks()).toEqual(initialTasks)

        writeTasks(newTasks)
        expect(readTasks()).toEqual(newTasks)
      })

      it("should handle empty task array in memory mode", () => {
        writeTasks([mockTask])
        expect(readTasks()).toEqual([mockTask])

        writeTasks([])
        expect(readTasks()).toEqual([])
      })

      it("should create a copy of tasks array to avoid mutation", () => {
        const tasks = [mockTask]

        writeTasks(tasks)
        tasks.push(mockTaskWithResolution) // Mutate original array

        const result = readTasks()
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(mockTask)
      })
    })
  })

  describe("Environment variable switching", () => {
    it("should switch from memory to file mode when FILE_PATH is set", () => {
      // Start in memory mode
      const memoryTasks = [mockTask]
      writeTasks(memoryTasks)
      expect(readTasks()).toEqual(memoryTasks)

      // Switch to file mode
      process.env.FILE_PATH = "/test/path/tasks.json"
      mockFs.existsSync.mockReturnValue(false)

      const result = readTasks()
      expect(result).toEqual([]) // File mode returns empty array when file doesn't exist
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/path/tasks.json")
    })

    it("should switch from file to memory mode when FILE_PATH is unset", () => {
      // Start in file mode
      process.env.FILE_PATH = "/test/path/tasks.json"
      const fileTasks = [mockTaskWithResolution]
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(JSON.stringify(fileTasks))

      expect(readTasks()).toEqual(fileTasks)

      // Switch to memory mode and clear memory storage
      delete process.env.FILE_PATH
      writeTasks([]) // Clear memory storage

      const result = readTasks()
      expect(result).toEqual([]) // Memory mode starts empty after clearing
    })
  })

  describe("Date handling", () => {
    it("should properly serialize and deserialize dates in file mode", () => {
      process.env.FILE_PATH = "/test/path/tasks.json"
      const taskWithDates = {
        ...mockTask,
        createdAt: new Date("2024-01-15T10:30:00.000Z"),
        updatedAt: new Date("2024-01-15T11:45:00.000Z"),
      }

      // Write task
      writeTasks([taskWithDates])

      // Verify the JSON written to file contains date strings
      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string
      const parsedContent = JSON.parse(writtenContent)
      expect(typeof parsedContent[0]?.createdAt).toBe("string")
      expect(typeof parsedContent[0]?.updatedAt).toBe("string")

      // Mock reading the file back
      mockFs.existsSync.mockReturnValue(true)
      mockFs.readFileSync.mockReturnValue(writtenContent)

      // Read task back
      const readTasksResult = readTasks()

      // Verify dates are converted back to Date objects
      expect(readTasksResult[0]?.createdAt).toBeInstanceOf(Date)
      expect(readTasksResult[0]?.updatedAt).toBeInstanceOf(Date)
      expect(readTasksResult[0]?.createdAt.toISOString()).toBe(
        "2024-01-15T10:30:00.000Z",
      )
      expect(readTasksResult[0]?.updatedAt.toISOString()).toBe(
        "2024-01-15T11:45:00.000Z",
      )
    })
  })
})
