# MAGI-WEB main LIVE speed verification — 2026-09-09

## Result
- Production main screen: `https://magi-web.vercel.app/`
- Query: `陽翔の今期OPS教えて`
- Answer: `大久保 陽翔の今期OPSは.912です。`
- Route: `BATTING_LOOKUP`
- UI route badge: `FAST LIVE`
- Fast route description: player + metric uniquely resolved, AI router bypassed
- Observed response time: **1.3 seconds**

## Interpretation
Main production button now reaches the deterministic fast lookup path and verified live data answer within the target 1–2 second range for an obvious single-player stat lookup.

## Integrity conditions retained
- Official value still comes from the authoritative XLSM-derived verified data path.
- No fabricated number.
- Ambiguous, comparison, deliberation, and other non-obvious questions do not use this shortcut and remain on the normal understanding/deliberation path.

## Status
**PASS — main LIVE speed target achieved for obvious single-player stat lookup.**
