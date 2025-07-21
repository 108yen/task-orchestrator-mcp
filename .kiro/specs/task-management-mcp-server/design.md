# 設計書

## Overview

エージェント向けタスク管理MCPサーバーは、`@modelcontextprotocol/sdk`を利用してタスクのCRUD操作と進捗管理機能を提供します。階層構造でのタスク管理、実行順序の制御、設定可能なデータ永続化を特徴とするシンプルで拡張性の高いアーキテクチャを採用します。

## Architecture

### システム構成

```
src/
├── task.ts          # ツールの具体的なロジックを実装
├── storage.ts       # データ永続化ロジック
├── server.ts        # McpServerインスタンスの定義
├── tools.ts         # サーバーへのツール登録ロジック
└── index.ts         # アプリケーションのメインエントリーポイント
```

### 責務分離

- **`src/index.ts`**: アプリケーションの起動を担当するエントリーポイント。`server`インスタンスと`registerTools`関数をインポートし、サーバーの起動とトランスポートへの接続を行う`run`関数を定義・実行
- **`src/server.ts`**: `McpServer`のインスタンスを生成し、プロジェクト名やバージョン情報と共にエクスポート
- **`src/tools.ts`**: `registerTools`関数を定義。`src/task.ts`からツール関数をインポートし、`server.registerTool()`を使って一括でサーバーに登録
- **`src/task.ts`**: `createTask`, `getTask`など、MCPツールとして登録される各関数の具体的な処理を実装。内部で`storage.ts`を利用してデータを操作
- **`src/storage.ts`**: 環境変数`FILE_PATH`に基づいて、ファイルまたはインメモリでのデータ永続化を担当

## Components and Interfaces

### Task型定義

```typescript
interface Task {
  id: string // タスクを一意に識別するためのID（UUID）
  name: string // タスクの名称
  description: string // タスクの詳細な説明
  status: string // タスクの進捗状況（'todo', 'in_progress', 'done'）
  resolution?: string // タスク完了時の状態や結果（未完了時はundefined）
  parent_id?: string // 親タスクのID（トップレベルの場合はundefined）
  order: number // 兄弟タスク内での実行順序を示す数値
  createdAt: Date // タスクの作成日時
  updatedAt: Date // タスクの最終更新日時
}

interface ProgressSummary {
  table: string // マークダウン形式のテーブル文字列
  total_tasks: number // 全タスク数
  completed_tasks: number // 完了済みタスク数
  in_progress_tasks: number // 進行中タスク数
  todo_tasks: number // 未着手タスク数
  completion_percentage: number // 完了率（0-100）
}

interface TaskProgressRow {
  task_name: string // タスク名
  status: string // ステータス
  completed_subtasks: number // 完了済みサブタスク数
  total_subtasks: number // 総サブタスク数
  progress_percentage: number // 進捗率（0-100）
}
```

### MCPツールインターフェース

| 機能           | ツール名       | 入力パラメータ                                                               | 出力                                                                                                              |
| :------------- | :------------- | :--------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **タスク作成** | `createTask`   | `{ name: string, description?: string, parent_id?: string, order?: number }` | `{ task: Task, message?: string }`                                                                                |
| **タスク取得** | `getTask`      | `{ id: string }`                                                             | `{ task: Task }`                                                                                                  |
| **タスク一覧** | `listTasks`    | `{ parent_id?: string }`                                                     | `{ tasks: Task[] }`                                                                                               |
| **タスク更新** | `updateTask`   | `{ id: string, name?: string, description?: string, status?: string, ... }`  | `{ task: Task }`                                                                                                  |
| **タスク削除** | `deleteTask`   | `{ id: string }`                                                             | `{ id: string }`                                                                                                  |
| **タスク開始** | `startTask`    | `{ id: string }`                                                             | `{ task: Task, subtask?: Task, message?: string, hierarchy_summary?: string }`                                    |
| **タスク完了** | `completeTask` | `{ id: string, resolution: string }`                                         | `{ next_task_id?: string, message: string, progress_summary?: ProgressSummary, auto_completed_parents?: Task[] }` |

#### タスク作成時のorder処理ロジック

- **order未指定時**: 同一parent_id内の兄弟タスクの最大order値+1を自動割り当て（兄弟がいない場合は1）
- **order指定時**: 指定されたorder値が既存タスクと重複する場合、既存の同一parent_id内のタスクでorder値が指定値以上のものを1ずつ増加させて挿入処理を実行

#### タスク作成時のサブタスク推奨メッセージ

- **ルートタスク作成時**: parent_idが未指定（ルートタスク）の場合、作成されたタスクと合わせて、そのタスクを達成するためのサブタスクの作成を推奨するメッセージを返す

#### タスク開始時のネストサブタスク自動開始ロジック

- **親タスク開始時**: 指定されたタスクのステータスを'in_progress'に変更
- **ネストサブタスク自動開始**: そのタスクにサブタスクがある場合、再帰的に最も深いネストレベルにある完了していない最初のサブタスク（order順）を特定し、そのタスクまでの中間階層のステータスもすべて'in_progress'に変更
- **階層管理**: 途中の階層のタスクも含めて、実行パス上のすべてのタスクのステータスを更新
- **レスポンス拡張**: 開始されたサブタスクがある場合、メインタスクと最深サブタスクの両方の情報、自動開始されたことを示すメッセージ、および現在のタスク階層構造サマリーを返す
- **階層構造表示**: エージェントがタスクの階層構造と現在の実行状況を把握できるよう、階層構造をテーブル形式で表示

#### タスク完了時の階層管理および検証ロジック

`completeTask`実行時に、以下のロジックを適用します：

**サブタスク完了状況の検証**

- タスク完了前に、そのタスクのサブタスクがすべて完了しているかを確認
- 未完了のサブタスクが存在する場合、エラーを発生させてタスクの完了操作を拒否
- すべてのサブタスクが完了している場合のみ、タスクの完了処理を実行

**親タスクの自動完了処理**

- タスクが完了した際、その親タスクの全サブタスクが完了しているかを確認
- 親タスクのすべてのサブタスクが完了している場合、親タスクのステータスを自動的に'done'に変更
- この処理は再帰的に実行され、階層の上位に向かって連鎖的に親タスクを完了させる

#### タスク完了時の進捗サマリー生成ロジック

`completeTask`実行時に、以下の情報を含む進捗サマリーを生成します：

**全体統計**

- 総タスク数、完了済み数、進行中数、未着手数
- 全体完了率（完了済み数 / 総タスク数 × 100）

**階層別進捗テーブル**

- 各親タスク（サブタスクを持つタスク）の進捗状況をマークダウンテーブル形式で表示
- 各行には以下の情報を含む：
  - タスク名
  - ステータス（todo/in_progress/done）
  - 完了済みサブタスク数 / 総サブタスク数
  - 進捗率（完了済みサブタスク数 / 総サブタスク数 × 100）

**テーブル形式例**

```markdown
| Task Name     | Status      | Subtasks | Progress |
| ------------- | ----------- | -------- | -------- |
| Main Feature  | in_progress | 3/5      | 60%      |
| Sub Feature A | done        | 2/2      | 100%     |
```

### ストレージインターフェース

```typescript
// storage.ts で提供される関数
export function readTasks(): Task[]
export function writeTasks(tasks: Task[]): void
```

## Data Models

### タスクデータ構造

タスクは階層構造で管理され、以下の特徴を持ちます：

- **階層関係**: `parent_id`により親子関係を表現
- **実行順序**: 同一親の下で`order`フィールドにより順序制御
  - order未指定時: 兄弟タスクの最大order+1を自動割り当て
  - order指定時: 重複する場合は既存タスクを1ずつシフトして挿入
- **ステータス管理**: `todo` → `in_progress` → `done`の状態遷移
- **タイムスタンプ**: 作成・更新時刻の自動記録

### データ永続化戦略

#### ファイル永続化モード（`FILE_PATH`環境変数あり）

- 起動時に指定パスのJSONファイルを読み込み
- データ更新の都度、全データをファイルに書き込み
- ファイル形式: `Task[]`のJSON配列

#### インメモリモード（`FILE_PATH`環境変数なし）

- データはメモリ上の配列で管理
- プロセス終了時にデータは失われる

## Error Handling

### エラー分類と対応

1. **バリデーションエラー**
   - 必須パラメータの欠如
   - 不正な型や値の範囲
   - 対応: 詳細なエラーメッセージを返却

2. **データ整合性エラー**
   - 存在しないタスクIDの参照
   - 循環参照の発生
   - 対応: 操作を拒否し、理由を明示

3. **ファイルI/Oエラー**
   - ファイル読み書き失敗
   - 権限不足
   - 対応: エラーログ出力とフォールバック処理

4. **システムエラー**
   - 予期しない例外
   - 対応: 汎用エラーメッセージと内部ログ記録

### エラーレスポンス形式

```typescript
{
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

## Testing Strategy

### テストフレームワーク

**Vitest**を使用し、以下の構成でテストを実装：

- `src/task.test.ts` - ビジネスロジックのユニットテスト
- `src/storage.test.ts` - データ永続化のユニットテスト
- `src/tools.test.ts` - ツール登録のユニットテスト

### テスト方針

#### ユニットテスト

- **storage.ts**: `fs`モジュールをモック化し、ファイル永続化とインメモリ管理の動作を検証
- **task.ts**: `storage.ts`をモック化し、各ツール関数のビジネスロジックを検証
- **tools.ts**: `McpServer`の`registerTool`メソッドをスパイし、ツール登録を検証

#### 統合テスト

- 複数モジュール連携での全体データフローを検証
- `tools` → `task` → `storage`の一連の処理を確認
- インメモリモードでの動作をシミュレート

### テストカバレッジ目標

- 各モジュール90%以上のコードカバレッジ
- 全エラーハンドリングパスの検証
- 境界値テストの実装
