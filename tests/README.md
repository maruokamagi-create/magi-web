# MAGI-WEB Tests

このディレクトリは、MAGI-WEBの最重要品質である

1. 質問を正確に理解する
2. 質問に対して的確に回答する

ための正式テスト資産を保存する。

## 現在の正本

- `TEST_STRATEGY.md` — 全体方針・合格条件・工程
- `TEST_HISTORY.md` — 実行結果・FAIL・修正履歴
- `question-router-cases-v1.json` — 初期単発質問ケース
- `question-router-conversation-cases-v1.json` — 30会話シナリオの保存用正本
- `ANSWER_QUALITY_PLAN.md` — 回答品質テスト計画

## ブラウザ実行ページ

- `/router-stress-test.html` — 質問理解ストレステスト
- `/router-conversation-test.html` — 30シナリオ複数ターン会話テスト

## 現在の質問ルーター基準

`/api/magi/health` の `ROUTE_QUESTION` モードから実際に呼ばれるルーターを基準とする。

2026-09-08 時点:

- `api/magi/_question-router.js`
- 補助: `api/magi/_conversation-recovery.js`

`api/magi/_question-router-v2.js` は現在のブラウザテスト経路の正本ではない。

## 回帰ルール

- 一度見つかったFAILケースは削除しない
- 修正後は全既存ケースを再実行する
- 1ケース専用のベタ書き修正を避ける
- 実際にテストした `routerVersion` を履歴に残す
- ルーターPASSだけで本体完成扱いにしない
- 最終的には実回答までEnd-to-Endで評価する
