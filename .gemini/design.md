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

## 5. テスト戦略

プロジェクトのテストフレームワークとして **Vitest** を使用します。

### 5.1. テストファイルの構成

各ソースファイルに対応するテストファイルを `src` ディレクトリ内に作成します。

- `src/task.ts` → `src/task.test.ts`
- `src/storage.ts` → `src/storage.test.ts`
- `src/tools.ts` → `src/tools.test.ts`

### 5.2. テストの種類と方針

#### a. ユニットテスト

各モジュールが単体で正しく動作することを検証します。依存関係はモックします。

- **`storage.ts` のテスト (`storage.test.ts`)**:
  - **目的**: ファイル永続化とインメモリ管理のロジックを検証します。
  - **方法**: `fs` モジュールを `vi.mock` でモック化し、`FILE_PATH` 環境変数の有無に応じた `readTasks` と `writeTasks` の動作を検証します。

- **`task.ts` のテスト (`task.test.ts`)**:
  - **目的**: 各ツールのビジネスロジックを検証します。
  - **方法**: `storage.ts` をモック化し、各ツール関数がロジック通りにデータを処理し、`writeTasks` を正しく呼び出すことを確認します。

- **`tools.ts` と `server.ts` のテスト (`tools.test.ts`)**:
  - **目的**: サーバーにすべてのツールが正しく登録されることを検証します。
  - **方法**: `McpServer` の `registerTool` メソッドをスパイし、`registerTools` 実行後に期待通りに呼び出されるかを確認します。

#### b. 統合テスト

複数のモジュールを連携させ、全体のデータフローを検証します。

- **目的**: `tools` → `task` → `storage` の一連の流れを検証します。
- **方法**: `storage.ts` のファイル書き込み部分のみをモックし、インメモリでの動作をシミュレートします。`createTask` 実行後に `listTasks` で結果を確認するなど、一連の操作が正しく連携することを検証します。
