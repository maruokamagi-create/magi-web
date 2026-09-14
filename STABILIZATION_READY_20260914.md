# MAGI stabilization 2026-09-14

This branch replaces the fragile client Evidence monkeypatch with an explicit server Evidence handoff to the formal three-wise-men runner.

Promotion rules:
- Gemini semantic understanding stays first.
- Full-lineup and pitching-plan deliberation fail closed unless authoritative current-team Evidence is present.
- Full-lineup requires all 14 current players and batting data for all 14 before deliberation starts.
- LOCAL fallback remains disabled.
- Production verification is performed by `MAGI Production Browser Bootstrap Smoke` after merge to `main` against `https://magi-web.vercel.app`.
