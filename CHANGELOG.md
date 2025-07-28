# task-orchestrator-mcp

## 1.0.0

### Major Changes

- [#20](https://github.com/108yen/task-orchestrator-mcp/pull/20) [`d0b256a`](https://github.com/108yen/task-orchestrator-mcp/commit/d0b256a3e832c55695f75d837c80216cbf8a5b47) Thanks [@108yen](https://github.com/108yen)! - Release v1.

### Minor Changes

- [#16](https://github.com/108yen/task-orchestrator-mcp/pull/16) [`318bb54`](https://github.com/108yen/task-orchestrator-mcp/commit/318bb54247b71fb5ff92068181e36458b3d1cbbe) Thanks [@108yen](https://github.com/108yen)! - Change data structure.

## 0.1.1

### Minor Changes

- [#9](https://github.com/108yen/task-orchestrator-mcp/pull/9) [`c93b6a7`](https://github.com/108yen/task-orchestrator-mcp/commit/c93b6a70d0c6be23c9887d8835e0b28e178c2a57) Thanks [@108yen](https://github.com/108yen)! - Change `parent_id` field name to `parentId`.
  Change so that only one task in the in_progress state can exist at the end node. Existing `in_progress` task is updated to `todo` status automatically.
  Set parent task to `in_progress` when executing `startTask`.

- [`e18b731`](https://github.com/108yen/task-orchestrator-mcp/commit/e18b73199fbc5c511c0d1fa95c8d1831dc739d45) Thanks [@108yen](https://github.com/108yen)! - Development of basic functions.
