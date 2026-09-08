# MAGI-WEB Conversation Regression — Run D

- 実行日時: 2026-09-08 21:21 JST
- テスト: MAGI Conversation Router Test
- シナリオ数: 30
- 結果: **27 PASS / 3 FAIL / API ERROR 0**
- FAIL: **M13 / M19 / M30**
- 実行画面: `/router-conversation-test.html`

## 最重要事項

1. あらゆる質問をできる限り正確に理解する
2. 理解した質問に対して的確に回答する

このRunは1の質問理解・会話文脈保持の回帰テスト。ルート正解だけでMAGI-WEB全体品質が完成したとは扱わない。

## M13 — 領域確定後に期間訂正

会話:
1. 「竜暉の成績見たい」 → CLARIFY
2. 「投手」 → PITCHING_LOOKUP
3. 「今季じゃなくて通算で」

期待:
- `PITCHING_LOOKUP / CAREER`

実際:
- `DELIBERATION / HIGH / safe=true`

## M19 — 確認後に期間追加

会話:
1. 「陽翔の成績」 → CLARIFY
2. 「投手で」 → PITCHING_LOOKUP
3. 「それの通算」

期待:
- `PITCHING_LOOKUP / CAREER`

実際:
- `DELIBERATION / HIGH / safe=true`

## M30 — 6ターン複合訂正

会話途中:
1. 「陽翔どう？」 → CLARIFY
2. 「成績」 → CLARIFY
3. 「投手」 → PITCHING_LOOKUP
4. 「いや打撃」 → BATTING_LOOKUP
5. 「今季」
6. 「やっぱ投手の通算」

期待（5ターン目）:
- `BATTING_LOOKUP / CURRENT_SEASON`

実際（5ターン目）:
- `DELIBERATION / HIGH / safe=true`

6ターン目は `PITCHING_LOOKUP / CAREER` へ復帰。

## v10で直らなかった原因

`v10-context-scope-guard` の期間継承処理は、期間だけの短い返答を検出していても、基礎ルーターの返却値 `base.players` が1名であることを事実上前提としていた。

しかし「今季」「それの通算」「今季じゃなくて通算で」のような現在発言だけでは選手名が省略されるため、基礎ルーターの構造化 `players` が常に1名保証とは限らない。会話上は対象が確定していてもガードが発火しない穴が残った。

さらに「今季」のような短い期間語は一般の短文選択返答にも見えるため、期間継承は一般のselection-only判定より先に、直前の**解決済み照会状態**を確認する必要がある。

## 修正 — v11

正式入口を `v11-resolved-state-period-guard` へ更新。

一般原則:
- 期間だけの追加入力では、現在発言に選手名がなくても、直前の解決済みLOOKUP会話状態から選手と領域を復元する。
- 復元元は、CLARIFY質問ではなく、直前に成功した照会のassistant側 `understoodRequest` を優先する。
- 選手1名・領域1つが一意に確定した場合だけ補完する。
- 複数選手・領域不明なら推測して実行しない。
- `今季 / 通算 / 前シーズン / 最近 / 直近6試合 / YYYY-YYYY` だけではDELIBERATIONへ変更しない。
- 期間継承処理をselection-onlyガードより先に実行する。

修正コミット:
- `713c1a02630b48ac17d6a5714e1cee2d50196edf`

次回は全30シナリオを再実行し、M13/M19/M30だけでなく全件回帰を確認する。
