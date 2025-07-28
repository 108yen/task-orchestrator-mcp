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
  tasks: Task[] // サブタスクの配列（ネストした階層構造、配列の順序が実行順序）
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
  parent_name?: string // 親タスク名（親がある場合）
  status_changed: boolean // ステータスが変更されたかどうか
  completed_subtasks: number // 完了済みサブタスク数
  total_subtasks: number // 総サブタスク数
  progress_percentage: number // 進捗率（0-100）
}

interface HierarchySummary {
  table: string // マークダウン形式の階層テーブル文字列
  total_levels: number // 階層の深さ
}

interface HierarchySummaryRow {
  depth: number // ネストレベル（0が最上位）
  indent: string // 階層表示用のインデント文字列
  name: string // タスク名
  parent_name?: string // 親タスク名（親がある場合）
  status: string // ステータス
  status_changed: boolean // ステータスが変更されたかどうか
  task_id: string // タスクID
}
```

### MCPツールインターフェース

| 機能           | ツール名       | 入力パラメータ                                                                                    | 出力                                                                                                              |
| :------------- | :------------- | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| **タスク作成** | `createTask`   | `{ name: string, description?: string, tasks?: Task[], parentId?: string, insertIndex?: number }` | `{ task: Task, message?: string }`                                                                                |
| **タスク取得** | `getTask`      | `{ id: string }`                                                                                  | `{ task: Task }`                                                                                                  |
| **タスク一覧** | `listTasks`    | `{ parentId?: string }`                                                                           | `{ tasks: Task[] }`                                                                                               |
| **タスク更新** | `updateTask`   | `{ id: string, name?: string, description?: string, status?: string, ... }`                       | `{ task: Task }`                                                                                                  |
| **タスク削除** | `deleteTask`   | `{ id: string }`                                                                                  | `{ id: string }`                                                                                                  |
| **タスク開始** | `startTask`    | `{ id: string }`                                                                                  | `{ task: Task, started_tasks: Task[], message?: string, hierarchy_summary?: string }`                             |
| **タスク完了** | `completeTask` | `{ id: string, resolution: string }`                                                              | `{ next_task_id?: string, message: string, progress_summary?: ProgressSummary, auto_completed_parents?: Task[] }` |

#### タスク作成時の配列挿入ロジック

- **挿入位置未指定時**: 親タスクの `tasks` 配列の末尾に新しいタスクを追加
- **挿入位置指定時**: 指定されたインデックス位置に新しいタスクを挿入し、後続のタスクを後方にシフト

#### タスク作成時のサブタスク推奨メッセージ

- **ルートタスク作成時**: 親タスクIDが未指定（ルートタスク）の場合、作成されたタスクと合わせて、そのタスクを達成するためのサブタスクの作成を推奨するメッセージを返す

#### タスク作成ロジック

- **親タスク作成**: `name`パラメータ（必須）を使用してメインタスクを作成
- **サブタスク追加**: `tasks`配列が指定された場合、作成した親タスクのサブタスクとして一緒に作成
- **階層構造処理**: 各サブタスクの`tasks`プロパティに含まれるサブタスクを再帰的に作成
- **ID処理**: 入力されたタスクのIDが存在する場合は保持し、存在しない場合は新しいUUIDを生成
- **配置処理**: 作成された親タスクを指定された親タスクまたはルートレベルに配置
- **統一戻り値**: 作成された親タスク（サブタスクを含む完全な構造）を返却

#### タスク開始時のネストサブタスク自動開始ロジック

- **親タスク開始時**: 指定されたタスクのステータスを'in_progress'に変更
- **実行順序検証**: タスク開始前に、同一親タスクの `tasks` 配列内で開始しようとしたタスクより前に位置するタスクの中に完了ステータス（'done'）になっていないタスクがある場合、エラーメッセージを返し処理を中断
- **親ノードステータス更新**: タスク開始時、そのタスクの全ての親ノード（タスク階層をルートまで遡って）のステータスを'in_progress'に更新
- **ネストサブタスク自動開始**: そのタスクの `tasks` 配列にサブタスクがある場合、再帰的に最も深いネストレベルにある完了していない最初のサブタスク（配列の先頭から順序）を特定し、そのタスクまでの中間階層のステータスもすべて'in_progress'に変更
- **階層管理**: 途中の階層のタスクも含めて、実行パス上のすべてのタスクのステータスを更新
- **レスポンス拡張**: 開始されたサブタスクがある場合、メインタスクと最深サブタスクの両方の情報、自動開始されたことを示すメッセージ、および現在のタスク階層構造サマリーを返す
- **階層構造表示**: エージェントがタスクの階層構造と現在の実行状況を把握できるよう、すべてのタスクのデータを含む階層構造をテーブル形式で表示。テーブルには「Status Changed」列を追加し、その操作でステータスが変更されたタスクを明示的に示す。また「Parent Task」列を追加し、各タスクの親タスク名を表示する
- **in_progressステータス制約**: システム全体で、末端ノード（サブタスクを持たないタスク、すなわち `tasks` 配列が空のタスク）のうち一つだけが'in_progress'ステータスを持つことを許可。親ノードは子ノードが'in_progress'の場合に限り'in_progress'ステータスになる

#### 実行順序検証ロジック詳細

タスク開始時（`startTask`）に以下の検証を実行：

1. **兄弟タスクの特定**: 開始対象タスクと同じ親タスクの `tasks` 配列内のタスクを兄弟タスクとして特定
2. **順序検証**: 兄弟タスクの中で、開始対象タスクより前の位置（配列インデックスが小さい）にあるタスクを抽出
3. **完了状況確認**: 抽出されたタスクの中に、ステータスが'done'以外のタスクが存在するかチェック
4. **エラー処理**: 未完了のより前の位置のタスクが存在する場合：
   - エラーメッセージ: `"Cannot start task '${taskName}' (position: ${taskIndex}). The following tasks at earlier positions must be completed first: ${incompleteTasks.map(t => `'${t.name}' (position: ${t.index}, status: ${t.status})`).join(', ')}"`
   - 処理を中断し、タスクの状態変更は実行しない

#### タスク完了時の階層管理および検証ロジック

`completeTask`実行時に、以下のロジックを適用します：

**サブタスク完了状況の検証**

- タスク完了前に、そのタスクの `tasks` 配列内のすべてのサブタスクが完了しているかを確認
- 未完了のサブタスクが存在する場合、エラーを発生させてタスクの完了操作を拒否
- `tasks` 配列内のすべてのサブタスクが完了している場合のみ、タスクの完了処理を実行

**親タスクの自動完了処理**

- タスクが完了した際、その親タスクの `tasks` 配列内のすべてのサブタスクが完了しているかを確認
- 親タスクのすべてのサブタスクが完了している場合、親タスクのステータスを自動的に'done'に変更
- この処理は再帰的に実行され、階層の上位に向かって連鎖的に親タスクを完了させる

#### タスク完了時の進捗サマリー生成ロジック

`completeTask`実行時に、以下の情報を含む進捗サマリーを生成します：

**全体統計**

- 総タスク数、完了済み数、進行中数、未着手数
- 全体完了率（完了済み数 / 総タスク数 × 100）

**階層別進捗テーブル**

- すべてのタスクの進捗状況をマークダウンテーブル形式で表示
- 各行には以下の情報を含む：
  - タスク名
  - ステータス（todo/in_progress/done）
  - 親タスク名（親がある場合）
  - ステータス変更の有無（その操作でステータスが変更されたかどうか）
  - 完了済みサブタスク数 / 総サブタスク数
  - 進捗率（完了済みサブタスク数 / 総サブタスク数 × 100）

**テーブル形式例**

```markdown
| Task Name     | Status      | Parent Task  | Status Changed | Subtasks | Progress |
| ------------- | ----------- | ------------ | -------------- | -------- | -------- |
| Main Feature  | in_progress | -            | ✓              | 3/5      | 60%      |
| Sub Feature A | done        | Main Feature | -              | 2/2      | 100%     |
```

このテーブル形式は、タスクの開始時（`startTask`）と完了時（`completeTask`）の両方で統一して使用され、すべてのタスクのデータを含みます。「Status Changed」列は、その操作でステータスが変更されたタスクに「✓」マークを表示し、「Parent Task」列は各タスクの親タスク名を表示します（トップレベルタスクの場合は「-」）。これにより、どのタスクのステータスが変更されたかが一目でわかり、タスクの階層関係も明確になります。

### ストレージインターフェース

```typescript
// storage.ts で提供される関数
export function readTasks(): Task[] // ルートレベルのタスク配列を返却（各タスクは自身のサブタスクを tasks 配列に含む）
export function writeTasks(tasks: Task[]): void // ルートレベルのタスク配列を保存
```

## Data Models

### タスクデータ構造

タスクは階層構造で管理され、以下の特徴を持ちます：

- **階層関係**: 各タスクは自身の `tasks` 配列にサブタスクを直接格納し、親子関係を表現
- **実行順序**: 同一親の `tasks` 配列内で配列の順序により実行順序を制御
  - 挿入位置未指定時: 親の `tasks` 配列の末尾に新しいタスクを追加
  - 挿入位置指定時: 指定されたインデックス位置に新しいタスクを挿入し、後続のタスクを後方にシフト
- **ステータス管理**: `todo` → `in_progress` → `done`の状態遷移
- **ネスト構造**: 各タスクは `tasks: Task[]` 配列を持ち、任意の深さのネストをサポート

### データ永続化戦略

#### ファイル永続化モード（`FILE_PATH`環境変数あり）

- 起動時に指定パスのJSONファイルを読み込み
- データ更新の都度、全データをファイルに書き込み
- ファイル形式: ルートレベルの `Task[]` のJSON配列（各タスクは自身の `tasks` 配列にサブタスクを含むネスト構造）

#### インメモリモード（`FILE_PATH`環境変数なし）

- データはメモリ上のルートタスク配列で管理
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

3. **実行順序エラー**
   - タスク開始時に、同じ階層でより小さいorderの未完了タスクが存在
   - 対応: 操作を拒否し、完了すべきタスクの詳細リストを提示

4. **ファイルI/Oエラー**
   - ファイル読み書き失敗
   - 権限不足
   - 対応: エラーログ出力とフォールバック処理

5. **システムエラー**
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
