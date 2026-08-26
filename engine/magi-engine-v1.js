/* MAGI ENGINE v1.0 — independent deliberation client skeleton
 * Development branch only. Does not replace FREE CORE.
 * The browser never receives a Gemini API key.
 */
(function (global) {
  'use strict';

  const ENGINE_VERSION = '1.0.0-dev';
  const PERSONAS = ['melchior', 'balthasar', 'casper'];

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  };

  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

  function normalizeCase(input) {
    const question = String(input?.question || '').trim();
    if (!question) throw new Error('CASE question is required.');
    return deepFreeze({
      id: input?.id || `MAGI-${Date.now()}`,
      question,
      objective: String(input?.objective || '').trim(),
      options: Array.isArray(input?.options) ? clone(input.options) : [],
      urgency: input?.urgency || 'normal',
      evidence: clone(input?.evidence || null),
      createdAt: new Date().toISOString()
    });
  }

  async function postJSON(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `MAGI API error ${res.status}`);
    return body;
  }

  function lockPrimary(primary) {
    const locked = {};
    for (const name of PERSONAS) locked[name] = deepFreeze(clone(primary[name]));
    return deepFreeze(locked);
  }

  function reveal(primaryLocked) {
    return deepFreeze({
      melchior: clone(primaryLocked.melchior),
      balthasar: clone(primaryLocked.balthasar),
      casper: clone(primaryLocked.casper)
    });
  }

  async function runPrimary(caseData) {
    // Three separate requests are intentional: no persona sees another primary judgment.
    const jobs = PERSONAS.map((persona) => postJSON('/api/magi/persona', {
      phase: 'PRIMARY',
      persona,
      case: caseData
    }).then((result) => [persona, result]));
    const entries = await Promise.all(jobs);
    return Object.fromEntries(entries);
  }

  async function runCrossExamination(caseData, primaryLocked) {
    return postJSON('/api/magi/orchestrate', {
      phase: 'CROSS_EXAMINATION',
      case: caseData,
      primary: reveal(primaryLocked)
    });
  }

  async function runSecond(caseData, primaryLocked, cross) {
    const revealed = reveal(primaryLocked);
    const jobs = PERSONAS.map((persona) => postJSON('/api/magi/persona', {
      phase: 'SECOND',
      persona,
      case: caseData,
      primarySelf: revealed[persona],
      crossExamination: cross
    }).then((result) => [persona, result]));
    const entries = await Promise.all(jobs);
    return Object.fromEntries(entries);
  }

  async function finalize(caseData, primaryLocked, cross, second) {
    return postJSON('/api/magi/orchestrate', {
      phase: 'FINAL',
      case: caseData,
      primary: reveal(primaryLocked),
      crossExamination: cross,
      second: clone(second)
    });
  }

  async function deliberate(input, options = {}) {
    const caseData = normalizeCase(input);
    const primary = await runPrimary(caseData);
    const primaryLocked = lockPrimary(primary);

    if (typeof options.onPrimaryLocked === 'function') {
      options.onPrimaryLocked(reveal(primaryLocked));
    }

    const cross = await runCrossExamination(caseData, primaryLocked);
    const second = await runSecond(caseData, primaryLocked, cross);
    const final = await finalize(caseData, primaryLocked, cross, second);

    return deepFreeze({
      engineVersion: ENGINE_VERSION,
      case: clone(caseData),
      primary: reveal(primaryLocked),
      crossExamination: clone(cross),
      second: clone(second),
      final: clone(final)
    });
  }

  global.MAGI_ENGINE_V1 = deepFreeze({
    version: ENGINE_VERSION,
    personas: PERSONAS.slice(),
    deliberate
  });
})(window);
