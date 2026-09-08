# MAGI-WEB Test History

このファイルは、質問理解・回答品質テストの実行履歴と、発見した不具合を残すための記録である。

## 2026-09-08 時点の基準

最重要事項:

1. あらゆる質問をできる限り正確に理解する
2. 理解した質問に対して的確に回答する

ルート判定の正解率だけを最終品質としない。

---

## 既知の実行履歴

### 単発質問テスト

- 結果: **89 / 89 PASS**
- 状態: 合格済み
- 注意: これは質問理解の単発テストであり、最終回答品質まで保証するものではない。
- 次段階: 150〜200問以上へ拡張予定。

### 複数ターン会話テスト — Run A

- シナリオ数: 30
- 結果: **29 PASS / 1 FAIL / API ERROR 0**
- FAIL: **M27 数値照会から判断へ**

M27:

1. 「陽翔のOPS教えて」
2. 「それ見て4番にするか判断して」

期待:
- 1ターン目: `BATTING_LOOKUP`
- 2ターン目: `DELIBERATION`

実際:
- 2ターン目が `CLARIFY`

発見事項:
- 直前の数値照会を判断材料として引き継ぐ会話遷移が弱かった。
- 「判断材料が十分かどうか」と「質問意図が明確かどうか」をルーターが混同しやすい問題があった。

### 複数ターン会話テスト — Run B

- シナリオ数: 30
- 結果: **28 PASS / 2 FAIL / API ERROR 0**
- FAIL: **M11 / M14**

M11 曖昧対象:

1. 「大久保の成績見せて」
2. 「陽翔の方」
3. 「打撃」

期待:
- 1ターン目: `CLARIFY`
- 2ターン目: `CLARIFY` 継続
- 3ターン目: `BATTING_LOOKUP`

問題:
- 「陽翔の方」で対象選手だけ確定したのに、打撃か投手か未確定のまま `DELIBERATION` へ進んだ。

M14 比較軸を途中変更:

1. 「陽翔と竜暉どっちがいい？」
2. 「打撃成績で比べて」
3. 「やっぱ投手成績で」

期待:
- 1ターン目: `CLARIFY`
- 2ターン目: `PLAYER_COMPARISON / BATTING`
- 3ターン目: `PLAYER_COMPARISON / PITCHING`

問題:
- 1ターン目の「どっちがいい？」を、比較軸が不明なのに `DELIBERATION` と判定した。

---

## 2026-09-08 再設計対応

最重要事項を正式に二本柱として固定した。

- QUESTION UNDERSTANDING — あらゆる質問を理解する
- ANSWER QUALITY — 質問に対して的確に回答する

追加した正式テスト資産:

- `tests/TEST_STRATEGY.md`
- `tests/ANSWER_QUALITY_PLAN.md`
- `tests/question-router-conversation-cases-v1.json`
- `tests/README.md`

30会話シナリオはブラウザHTMLだけでなく、JSONの回帰テスト資産として保存した。

---

## ルーター経路整理

M27対応中、一時的に `api/magi/_question-router-v2.js` を修正したが、実際のブラウザテスト経路は別だった。

この事故を再発させないため、正式入口を新設した。

2026-09-08 現在:

- 正式入口: **`api/magi/_question-router-current.js`**
- 基礎ルーター: `api/magi/_question-router.js`
- 会話補助: `api/magi/_conversation-recovery.js`
- `api/magi/health.js` は正式入口 `_question-router-current.js` を使用
- test routerVersion: **`v9-understanding-guard`**

`api/magi/_question-router-v2.js` は現在のブラウザテスト経路の正本ではない。

### v9-understanding-guard で追加した一般ガード

M11専用・M14専用の固有文言ベタ書きではなく、次の一般原則を追加した。

1. **比較軸のない「AとBどっちがいい？」**
   - 打撃・投手・守備・起用目的等が明示されていなければCLARIFY
   - 「どっちを4番」「どっちが先発向き」のように目的が明確なら判断へ進める

2. **曖昧な「成績」質問で人物だけを選び直した場合**
   - 人物が確定しても、打撃/投手が未確定ならCLARIFY継続
   - 人物を選んだだけでDELIBERATIONへ飛ばさない

---

## 現在の実装状態

### 質問理解ルーター

- ブラウザ上の独立テスト経路あり
- 正式テスト入口を `v9-understanding-guard` に一本化
- MAGI-WEB本体の標準実行経路にはまだ正式接続していない

### 回答品質テスト

- 評価設計を `tests/ANSWER_QUALITY_PLAN.md` として作成済み
- 実データに対する正式回答テストはこれから

### End-to-End

- 未実施
- 質問理解 → データ取得 → 処理 → 最終回答までを本体相当経路で検証する必要あり

---

## 次の実行順

1. **v9-understanding-guard で30会話テストを再実行**
2. 結果と routerVersion をこの履歴へ追加
3. 30会話の回帰が安定したら単発を150〜200問以上へ拡張
4. 回答品質テスト用の基準データスナップショットを作る
5. 回答品質テストを実行
6. End-to-Endテスト
7. 本体接続判断

---

## 履歴記録ルール

今後の各テスト実行ごとに最低限、以下を残す。

- 実行日時
- テスト種別
- ケース数
- PASS数
- FAIL数
- API ERROR数
- routerVersion
- FAILしたケースID
- FAIL内容
- 修正内容
- 修正後の全回帰結果

一度見つかった不具合ケースは削除せず、回帰テストとして残す。
