# MAGI CONSISTENCY POLICY

Status: CORE / CANONICAL

## Principle
MAGIは質問者によって判断を変えない。

同じ質問、同じ参照データ、同じMAGI仕様、同じモデル条件であれば、同じ判断を返すことを原則とする。

**人によって答えを変えない。証拠が変われば答えは変わり得る。**

## Why this matters
MAGIは相談相手に迎合するチャットではなく、同じ資料を同じ基準で扱う判断支援システムである。
近藤先生、選手、保護者、管理者の誰が聞いても、質問者の立場そのものを理由に判定を変えてはならない。

## Current implementation — Consistency Lock v2
- Gemini sampling temperature = 0
- topP = 1
- 同一審議中は同じ主モデルを使用する
- strict modeでは主モデル障害時に別モデルへ自動切替しない。モデル変更による判定ドリフトを避けるため、失敗として返す
- FINAL DECISIONはAIに再判断させず、二次判定からコードで決定する
- プロンプト上の `WHO ASKED DOES NOT MATTER` を維持する
- Vercel Runtime Cacheを使う canonical result cache を実装する
- Geminiを呼ぶ各段階ごとに、model + system prompt + user payload + response schema + cache version からSHA-256キーを生成する
- 同一キーの結果が存在すればGeminiを再実行せず、確定済み結果を返す
- キャッシュTTLは60日。仕様やキャッシュバージョンが変われば自動的に別キーになる
- キャッシュキーには質問文や選手名を平文で入れず、SHA-256ハッシュを使用する

## Canonical result behavior
最初に成功した同一条件の結果を、その条件のcanonical resultとして再利用する。

同じ質問 + 同じ証拠 + 同じプロンプト + 同じモデル + 同じMAGI cache version
= 同じcanonical key
= 同じ保存済み結果

これにより、別の利用者が同じ条件で問い合わせても、キャッシュが有効な間は同じ一次判定・相互検証・二次判定を再利用できる。
最終判定はそれらの二次判定から決定論的コードで算出するため、同一条件では同じ結果になる。

## Evidence change rule
証拠が変われば別案件として再計算できる。
例えば最新試合の追加、成績表の更新、誤記録の修正などでpayloadが変わればcanonical keyも変わる。

MAGIの原則は、
**「人によって答えを変えない。証拠が変われば答えは変わり得る。」**
である。

## Operational note
Vercel Runtime Cacheが一時的に利用できない場合でもMAGI本体を停止させないため、キャッシュ読み書きはfail-openとする。その場合はConsistency Lock v1相当（temperature 0 + strict single model + deterministic FINAL）で動作する。

そのため、厳密な意味での100%保証は「canonical cache HIT時」に成立する。初回同時実行やRuntime Cache障害時には生成AI由来の揺れが残る可能性がある。

## Canonical key concept
canonical keyには少なくとも以下を含める。
- normalized question / user payload
- evidence/data payload
- MAGI rules/prompt contents
- response schema
- Gemini model
- canonical cache version

## Product rule
仕様書に保存しただけで「全利用者へ反映済み」と表現しない。
今後は重要仕様について、
- SPEC SAVED
- CODE IMPLEMENTED
- PRODUCTION VERIFIED
を区別して管理する。
