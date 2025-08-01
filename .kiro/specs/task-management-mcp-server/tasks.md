## 新規実装：完了条件と制約

- [ ] 17. 完了条件と制約の追加
  - `createTask` に `completion_criteria` と `constraints` を追加
  - `startTask` の戻り値に `completion_criteria` と `constraints` を追加
  - _Requirements: Requirement 2, 3_

- [ ] 17.1 `Task` 型定義の更新
  - `completion_criteria` と `constraints` を `Task` 型に追加
  - _対象ファイル: src/storage.ts_

- [ ] 17.2 `createTask` 関数の更新
  - `completion_criteria` と `constraints` を受け取れるようにする
  - _対象ファイル: src/task.ts_

- [ ] 17.3 `startTask` 関数の更新
  - `completion_criteria` と `constraints` を、自身およびすべての親タスクから集約して返すようにする
  - _対象ファイル: src/task.ts_

- [ ] 17.4 MCPツールスキーマの更新
  - `createTask` ツールのスキーマに `completion_criteria` と `constraints` を追加
  - _対象ファイル: src/tools.ts_

- [ ] 17.5 ユニットテストの更新
  - `createTask` と `startTask` のユニットテストを更新
  - _対象ファイル: src/task.test.ts_

- [ ] 17.6 統合テストの更新
  - `createTask` と `startTask` の統合テストを更新
  - _対象ファイル: test/integration/basic-operations.test.ts_

- [ ] 17.7 ドキュメント更新と品質チェック
  - `pnpm quality` による全体的な品質チェック

- [ ] 17.8 クリーンナップ
  - 更新したコードを検査し、不要なコメントの削除や冗長なコードのリファクタリングを実施
  - `pnpm quality` による全体的な品質チェック
