# MAGI Answer Fixture — Factual Accuracy Correction

Date: 2026-09-08 JST

## Correction

The earlier 8/8 PASS on `answer-quality-smoke-test.html` used synthetic fixture values. It validated answer-generation mechanics only and must NOT be treated as a factual-accuracy pass for real team statistics.

Examples of synthetic values used in that test included:
- 大久保 陽翔 今季 OPS = .812
- 大久保 陽翔 通算 OPS = .745

These were not taken from the authoritative team-statistics files.

## Authoritative Drive snapshot checked after the issue was raised

Source: `丸岡中軟式野球部_通算成績一覧2026-2027.pdf` (R8.8.2–R8.8.11)
- 大久保 陽翔: AVG .286 / OPS .912
- 大野 竜暉: AVG .278 / OPS .924
- 中嶋 玲月: AVG .588 / OPS 1.376
- Team record: 6 games / 3 wins / 1 draw / 2 losses
- Team OPS: .738

Source: `丸岡中軟式野球部_通算成績一覧2025-2026.pdf`
- 大久保 陽翔: AVG .304 / OPS .969
- 大野 竜暉: pitching ERA 1.69 / 54.0 innings / 50 strikeouts (relevant pitching line)

## Policy change

1. Synthetic fixture tests are now explicitly labeled as synthetic control tests.
2. Synthetic control PASS does not count as factual accuracy.
3. Real-number answer tests must use traceable values copied from an authoritative Drive source snapshot and display the source/scope.
4. A separate `answer-quality-authoritative-test.html` now performs source-grounded answer checks.
5. Live Drive retrieval accuracy remains a separate later test; the authoritative snapshot test verifies the answer layer with correct source values.
