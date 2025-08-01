# プロジェクト概要

エージェントに対してタスクを管理するためのツール群を提供するMCPサーバーです。
タスクのCRUD操作および、進捗管理等の機能を提供します。

- **要件**: `.kiro/specs/task-management-mcp-server/requirements.md`
- **設計**: `.kiro/specs/task-management-mcp-server/design.md`
- **実装計画**: `.kiro/specs/task-management-mcp-server/task.md`

## 実装に関する情報

実装にあたり、使用するコマンドやフォルダ構成、技術選定に関する情報は`.kiro/steering`フォルダ配下のドキュメントを参照してください。

- **技術選定**: `.kiro/steering/tech.md`
- **フォルダ構成**: `.kiro/steering/structure.md`
- **プロダクト要件**: `.kiro/steering/product.md`

## 実装ステップ

依頼された実装は以下のステップで実施する必要があります。

1. ドキュメントやコードファイル等、必要な情報を収集し、する。
2. sequential-thinkingツールを使用し、実装タスクを検討する。
3. 実装タスクをタスク管理ツールに登録する
4. 実装タスクの最後に、以下の3ステップを追加する。

- 単体テストおよび統合テストを修正/追加する
- `pnpm quality`を実行し、コードの品質を確認する
- 変更した箇所を検査し、不要なコードやコメント、冗長な実装がないか確認する
