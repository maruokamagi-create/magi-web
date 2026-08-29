# MAGI CONSISTENCY POLICY

Status: CORE / CANONICAL

## Principle
MAGIは質問者によって判断を変えない。

同じ質問、同じ参照データ、同じMAGI仕様、同じモデル条件であれば、同じ判断を返すことを原則とする。

**人によって答えを変えない。証拠が変われば答えは変わり得る。**

## Why this matters
MAGIは相談相手に迎合するチャットではなく、同じ資料を同じ基準で扱う判断支援システムである。
近藤先生、選手、保護者、管理者の誰が聞いても、質問者の立場そのものを理由に判定を変えてはならない。

## Current implementation — Consistency Lock v1
- Gemini sampling temperature = 0
- topP = 1
- 同一審議中は同じ主モデルを使用する
- strict modeでは主モデル障害時に別モデルへ自動切替しない。モデル変更による判定ドリフトを避けるため、失敗として返す
- FINAL DECISIONはAIに再判断させず、二次判定からコードで決定する
- プロンプト上の `WHO ASKED DOES NOT MATTER` を維持する

## Important limitation
生成AI自体は完全な決定論的計算機ではないため、Consistency Lock v1だけで文章や中間判定の100%完全一致を数学的に保証するものではない。

完全一致を保証する最終形は、次のいずれかを追加したときに成立する。
1. 同じ質問 + 同じデータバージョン + 同じMAGIバージョンの正式審議結果を共有永続ストレージへ保存し、全利用者へ同じ確定結果を返す canonical result cache。
2. 判定そのものを完全なルールエンジンで決定し、生成AIを説明文だけに限定する。

MAGIでは将来的に canonical result cache を第一候補とする。

## Canonical key concept
正式審議結果を保存する場合、少なくとも以下から一意キーを作る。
- normalized question
- evidence/data version or evidence fingerprint
- MAGI rules/prompt version
- Gemini model version

同じキーが存在する場合は再審議せず、確定済み結果を返す。
証拠またはMAGI仕様が変わった場合のみ新しい審議として扱う。

## Product rule
仕様書に保存しただけで「全利用者へ反映済み」と表現しない。
今後は重要仕様について、
- SPEC SAVED
- CODE IMPLEMENTED
- PRODUCTION VERIFIED
を区別して管理する。
