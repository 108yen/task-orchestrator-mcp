# 概要

以下のようなタスク構造となっている場合、level 2 task 1はlevel 1 task 1が完了状態(cancel,complete)であるときに開始でき、そうでない場合はエラーを出す必要がありますが、現状の実装では開始できてしまいます。
このバグを修正してください。

```json
{
  "tasks": [
    {
      "createdAt": "2025-07-24T14:46:49.910Z",
      "description": "main project task",
      "id": "28de4f37-4e89-4618-adfb-d3d64c5c693b",
      "name": "root task",
      "status": "todo",
      "tasks": [
        {
          "createdAt": "2025-07-24T14:48:02.992Z",
          "description": "",
          "id": "9f56c322-10ab-43d6-91aa-b509719ed08e",
          "name": "level 1 task 1",
          "status": "todo",
          "tasks": [],
          "updatedAt": "2025-07-24T14:48:02.992Z"
        },
        {
          "createdAt": "2025-07-24T14:48:08.419Z",
          "description": "",
          "id": "f55d99f4-66b6-480e-bde4-5e87dcf009df",
          "name": "level 1 task 2",
          "status": "todo",
          "tasks": [
            {
              "createdAt": "2025-07-24T14:48:55.005Z",
              "description": "",
              "id": "f4b57684-a08a-47ff-b52b-e124e27fa4a2",
              "name": "level 2 task 1",
              "status": "todo",
              "tasks": [],
              "updatedAt": "2025-07-24T14:48:55.005Z"
            },
            {
              "createdAt": "2025-07-24T14:48:58.451Z",
              "description": "",
              "id": "32ffabb0-7680-4899-8884-9c261de05b0c",
              "name": "level 2 task 2",
              "status": "todo",
              "tasks": [],
              "updatedAt": "2025-07-24T14:48:58.451Z"
            }
          ],
          "updatedAt": "2025-07-24T14:48:08.419Z"
        }
      ],
      "updatedAt": "2025-07-24T14:46:49.910Z"
    }
  ]
}
```

# 実装方針

まず、インテグレーションテストを作成し、TDDで進めてください。
実装タスクは登録して実装を進めてください。
