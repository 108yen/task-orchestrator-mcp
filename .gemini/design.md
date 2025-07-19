# 設計

## 1. アーキテクチャ

`@modelcontextprotocol/sdk` を利用したMCPサーバーとして構築します。責務に応じてファイルを分割し、シンプルな構成を採用します。

### 1.1. ファイル構成

```
src/
├── task.ts          # ツールの具体的なロジックを実装
├── storage.ts       # データ永続化ロジック
├── server.ts        # McpServerインスタンスの定義
├── tools.ts         # サーバーへのツール登録ロジック
└── index.ts         # アプリケーションのメインエントリーポイント
```

### 1.2. 各ファイルの責務

- **`src/index.ts`**: アプリケーションの起動を担当するエントリーポイント。`server` インスタンスと `registerTools` 関数をインポートし、サーバーの起動とトランスポートへの接続を行う `run` 関数を定義・実行します。
- **`src/server.ts`**: `McpServer` のインスタンスを生成し、プロジェクト名やバージョン情報と共にエクスポートします。
- **`src/tools.ts`**: `registerTools` 関数を定義します。`src/task.ts` からツール関数をインポートし、`server.registerTool()` を使って一括でサーバーに登録します。
- **`src/task.ts`**: `createTask`, `getTask` など、MCPツールとして登録される各関数の具体的な処理を実装します。内部で `storage.ts` を利用してデータを操作します。
- **`src/storage.ts`**: 環境変数 `FILE_PATH` に基づいて、ファイルまたはインメモリでのデータ永続化を担います。

## 2. データモデル

`Task` オブジェクトは以下の情報を持つ。

| フィールド名  | 型                    | 説明                                                         |
| :------------ | :-------------------- | :----------------------------------------------------------- |
| `id`          | `string`              | タスクを一意に識別するためのID。UUIDを想定。                 |
| `name`        | `string`              | タスクの名称。                                               |
| `description` | `string`              | タスクの詳細な説明。                                         |
| `status`      | `string`              | タスクの進捗状況。例: `'todo'`, `'in_progress'`, `'done'`    |
| `resolution`  | `string \| undefined` | タスク完了時の状態や結果を記載する。未完了時は `undefined`。 |
| `parent_id`   | `string \| undefined` | 親タスクのID。トップレベルのタスクの場合は`undefined`。      |
| `order`       | `number`              | 兄弟タスク内での実行順序を示す数値。小さい方から実行される。 |
| `createdAt`   | `Date`                | タスクの作成日時。                                           |
| `updatedAt`   | `Date`                | タスクの最終更新日時。                                       |

## 3. ツールインターフェース

サーバーに登録される各ツールの仕様です。

| 機能           | ツール名       | `payload` (入力)                                                             | `Promise<T>` の `T` (出力)                   |
| :------------- | :------------- | :--------------------------------------------------------------------------- | :------------------------------------------- |
| **タスク作成** | `createTask`   | `{ name: string, description?: string, parent_id?: string, order?: number }` | `{ task: Task }`                             |
| **タスク取得** | `getTask`      | `{ id: string }`                                                             | `{ task: Task }`                             |
| **タスク一覧** | `listTasks`    | `{ parent_id?: string }`                                                     | `{ tasks: Task[] }`                          |
| **タスク更新** | `updateTask`   | `{ id: string, name?: string, ... }`                                         | `{ task: Task }`                             |
| **タスク削除** | `deleteTask`   | `{ id: string }`                                                             | `{ id: string }`                             |
| **タスク開始** | `startTask`    | `{ id: string }`                                                             | `{ task: Task }`                             |
| **タスク完了** | `completeTask` | `{ id: string, resolution: string }`                                         | `{ next_task_id?: string, message: string }` |

## 4. データ永続化

- **永続化モードの決定**: 起動時に環境変数 `FILE_PATH` を確認します。
- **ファイル永続化モード (`FILE_PATH` あり)**:
  - 起動時、指定されたパスのJSONファイルを読み込みます。
  - データ更新の都度、全データをファイルに書き込みます。
- **インメモリモード (`FILE_PATH` なし)**:
  - データはメモリ上の配列で管理します。
