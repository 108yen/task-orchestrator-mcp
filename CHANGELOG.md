# task-orchestrator-mcp

## 0.1.0

### Minor Changes

- [#9](https://github.com/108yen/task-orchestrator-mcp/pull/9) [`c93b6a7`](https://github.com/108yen/task-orchestrator-mcp/commit/c93b6a70d0c6be23c9887d8835e0b28e178c2a57) Thanks [@108yen](https://github.com/108yen)! - Change `parent_id` field name to `parentId`.
  Change so that only one task in the in_progress state can exist at the end node. Existing `in_progress` task is updated to `todo` status automatically.
  Set parent task to `in_progress` when executing `startTask`.

- [`e18b731`](https://github.com/108yen/task-orchestrator-mcp/commit/e18b73199fbc5c511c0d1fa95c8d1831dc739d45) Thanks [@108yen](https://github.com/108yen)! - Development of basic functions.
