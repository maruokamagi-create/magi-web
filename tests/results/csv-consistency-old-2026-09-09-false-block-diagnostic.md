# 2025-2026 XLSM / CSV consistency audit — false block diagnostic

Date: 2026-09-09

Initial UI result: `GATE BLOCKED`, batting blocked player count = 1; fielding structural audit passed.

## Root cause
This was not a true XLSM-vs-CSV contradiction. The generic XLSM player reader selected the combined `個人成績データ` sheet for 宮嵜 翔. In that combined table, duplicate/adjacent labels caused batting `三振/四球/死球` to be read from pitching-side columns (92/43/11) instead of the authoritative batting summary values (16/10/1).

The authoritative `打撃一覧` summary values and the aggregated `打撃詳細2025-2026.csv` counts were independently checked and matched for all 23 players.

## Fix
Added `api/magi/_strict-batting-master.js` and changed `_detail-csv-audit.js` to reconcile CSV against a strict authoritative batting summary table reader. The reader prioritizes the exact `打撃一覧` sheet, requires a batting header with `選手名` plus batting core fields, rejects duplicate-sensitive header ambiguity, and only then reads player totals.

XLSM remains authoritative. CSV never overwrites XLSM.

Status: fix deployed/awaiting UI retest at time of this record.
