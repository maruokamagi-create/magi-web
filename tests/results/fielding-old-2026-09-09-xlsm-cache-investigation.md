# Old-team fielding reconciliation investigation

Date: 2026-09-09

## Finding
The apparent fielding mismatch for 鰐渕 将太 was not caused by the CSV.

Inside the authoritative `丸岡中軟式野球部_通算成績一覧2025-2026.xlsm`:
- `守備一覧` contains SUMIFS formulas that aggregate `守備詳細` by player name.
- The stored/cached results for 鰐渕 将太 were 0 for 守備機会, 補殺, 刺殺, 失策.
- The same XLSM workbook's own `守備詳細` contains 6 rows for 鰐渕 将太. Re-aggregating those rows yields 守備機会=6, 補殺=2, 刺殺=3, 失策=1.
- `守備詳細2025-2026.csv` contains the same six rows and the same totals.

## Cause
The server-side XLSX reader does not execute Excel formulas. It was reading the saved formula cache from `守備一覧`, and that cache was stale for this player. Therefore 0 was incorrectly treated as the XLSM authoritative result.

## Fix
Fielding reconciliation now keeps the XLSM master authoritative but reconstructs formula totals from the same XLSM's internal `守備詳細` sheet (SUMIFS-equivalent aggregation). CSV remains secondary and can never overwrite the XLSM master.

Expected result after fix: 鰐渕 将太 should reconcile as 6 / 2 / 3 / 1 and the old-team fielding audit should no longer report this false mismatch.
