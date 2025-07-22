---
"task-orchestrator-mcp": minor
---

Change `parent_id` field name to `parentId`.
Change so that only one task in the in_progress state can exist at the end node. Existing `in_progress` task is updated to `todo` status automatically.
Set parent task to `in_progress` when executing `startTask`.
