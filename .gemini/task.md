# 実装計画

このドキュメントは `design.md` に基づいた実装タスクの一覧です。
各タスクは以下のループで進めます。

1. 実装
2. テスト実装および実行
3. リファクタリング
4. テスト実行（成功確認）
5. ドキュメント更新（`.gemini/task.md` の更新、必要に応じて `design.md` や `requirements.md` も更新）

## フェーズ1: 基盤の実装

- [ ] **1. データ永続化層の実装 (`src/storage.ts`)**
      詳細: タスクデータの読み書きを行う基本的なロジックを実装します。`Task` 型を定義し、`readTasks()` と `writeTasks(tasks: Task[])` の2つの関数を実装します。`readTasks` は `FILE_PATH` 環境変数に応じてファイルまたは空の配列を返し、`writeTasks` は `FILE_PATH` がある場合のみファイルに書き込みます。
  - [ ] 1.1. `src/storage.ts` の作成と初期実装
  - [ ] 1.2. `src/storage.test.ts` の作成とテスト実装
  - [ ] 1.3. テスト実行とリファクタリング
  - [ ] 1.4. ドキュメント更新

## フェーズ2: コアロジックとサーバー設定

- [ ] **2. コアロジックの実装 (`src/task.ts`)**
      詳細: CRUD操作やタスク実行管理など、ツールの中心的なビジネスロジックを実装します。`storage.ts` を利用し、`createTask`, `listTasks`, `getTask`, `updateTask`, `deleteTask`, `startTask`, `completeTask` の各関数を実装します。
  - [ ] 2.1. `src/task.ts` の作成と初期実装
  - [ ] 2.2. `src/task.test.ts` の作成とテスト実装
  - [ ] 2.3. テスト実行とリファクタリング
  - [ ] 2.4. ドキュメント更新

- [ ] **3. MCPサーバーとツール登録の実装 (`src/server.ts`, `src/tools.ts`)**
      詳細: `src/server.ts` で `McpServer` のインスタンスを作成し、`src/tools.ts` で `registerTools` 関数を実装して `task.ts` の関数をツールとして登録します。
  - [ ] 3.1. `src/server.ts` と `src/tools.ts` の作成と初期実装
  - [ ] 3.2. `src/tools.test.ts` の作成とテスト実装
  - [ ] 3.3. テスト実行とリファクタリング
  - [ ] 3.4. ドキュメント更新

## フェーズ3: 統合と最終化

- [ ] **4. エントリーポイントの実装 (`src/index.ts`)**
      詳細: アプリケーションを起動するための `run()` 関数を実装します。ツール登録、`StdioServerTransport` でのサーバー接続などを行います。
  - [ ] 4.1. `src/index.ts` の作成と初期実装
  - [ ] 4.2. テスト実行とリファクタリング
  - [ ] 4.3. ドキュメント更新

- [ ] **5. 統合テストと手動確認**
      詳細: 全体を結合して動作を確認します。Vitestでの統合テストと、`npm run dev` での起動後の手動でのJSONリクエスト送信による動作確認を行います。
  - [ ] 5.1. 統合テストの記述と実行
  - [ ] 5.2. 手動確認
  - [ ] 5.3. ドキュメント更新
