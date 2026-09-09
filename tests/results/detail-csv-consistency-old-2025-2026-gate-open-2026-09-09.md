# MAGI Detail CSV Consistency — Old Team

Date: 2026-09-09
Season: 2025-2026
Page: `/detail-csv-consistency-test.html`

## Result
- Overall gate: OPEN
- Batting XLSM ↔ CSV: PASS
- Batting CSV rows: 562
- Players: 23
- Date range: 2025-07-19 to 2026-06-20
- Exact duplicate rows: 0
- Missing required columns: none
- Reconciliation NG players: 0
- Fielding CSV structural audit: PASS
- Fielding CSV rows: 565
- Fielding players: 23
- Fielding exact duplicate rows: 0
- Period consistency: OK

## Policy
XLSM in `00_MASTER_正本` remains authoritative. CSV may proceed to detail analysis only after reconciliation.

## Evidence
User-provided screenshot showed `2025-2026 — GATE OPEN`, `打撃 XLSM ↔ CSV — PASS`, and `守備 CSV 構造監査 — PASS`.
