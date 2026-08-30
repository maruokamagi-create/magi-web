/* MAGI ENGINE v1.0 — independent deliberation client
 * Three primary judgments remain fully independent.
 * The browser never receives a Gemini API key.
 */
(function (global) {
  'use strict';

  const ENGINE_VERSION = '1.0.2';
  const PERSONAS = ['melchior', 'balthasar', 'casper'];

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const emit = (options, name, payload) => {
    const fn = options && options[name];
    if (typeof fn === 'function') {
      try { fn(clone(payload)); } catch (_) {}
    }
  };

  function normalizeCase(input) {
    const question = String(input?.question || '').trim();
    if (!question) throw new Error('CASE question is required.');
    return deepFreeze({
      id: input?.id || `MAGI-${Date.now()}`,
      question,
      mode: String(input?.mode || 'proposal').toLowerCase(),
      objective: String(input?.objective || '').trim(),
      options: Array.isArray(input?.options) ? clone(input.options) : [],
      urgency: input?.urgency || 'normal',
      evidence: clone(input?.evidence || null),
      createdAt: new Date().toISOString()
    });
  }

  async function postJSON(url, payload, options = {}) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) {
        const wait = 900 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 350);
        emit(options, 'onRetry', { url, attempt: attempt + 1, waitMs: wait });
        await sleep(wait);
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return body;
        const err = new Error(body?.error || `MAGI API error ${res.status}`);
        err.status = res.status;
        lastError = err;
        if (!(res.status === 408 || res.status === 429 || res.status >= 500)) throw err;
      } catch (error) {
        lastError = error;
        if (error?.status && !(error.status === 408 || error.status === 429 || error.status >= 500)) throw error;
      }
    }
    throw lastError || new Error('MAGI API request failed');
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

  async function runPrimary(caseData, options) {
    const jobs = PERSONAS.map((persona) => postJSON('/api/magi/persona', {
      phase: 'PRIMARY', persona, case: caseData
    }, options).then((result) => [persona, result]));
    const entries = await Promise.all(jobs);
    return Object.fromEntries(entries);
  }

  async function runCrossExamination(caseData, primaryLocked, options) {
    return postJSON('/api/magi/orchestrate', {
      phase: 'CROSS_EXAMINATION', case: caseData, primary: reveal(primaryLocked)
    }, options);
  }

  async function runSecond(caseData, primaryLocked, cross, options) {
    const revealed = reveal(primaryLocked);
    const jobs = PERSONAS.map((persona) => postJSON('/api/magi/persona', {
      phase: 'SECOND', persona, case: caseData,
      primarySelf: revealed[persona], crossExamination: cross
    }, options).then((result) => [persona, result]));
    const entries = await Promise.all(jobs);
    return Object.fromEntries(entries);
  }

  async function finalize(caseData, primaryLocked, cross, second, options) {
    return postJSON('/api/magi/orchestrate', {
      phase: 'FINAL', case: caseData, primary: reveal(primaryLocked),
      crossExamination: cross, second: clone(second)
    }, options);
  }

  async function deliberate(input, options = {}) {
    const caseData = normalizeCase(input);
    emit(options, 'onStage', { stage: 'PRIMARY', message: caseData.mode === 'selection' ? '一次候補抽出を開始' : '一次独立判定を開始' });
    const primary = await runPrimary(caseData, options);
    const primaryLocked = lockPrimary(primary);
    emit(options, 'onPrimaryLocked', reveal(primaryLocked));

    emit(options, 'onStage', { stage: 'CROSS', message: '相互検証を開始' });
    const cross = await runCrossExamination(caseData, primaryLocked, options);
    emit(options, 'onCrossComplete', cross);

    emit(options, 'onStage', { stage: 'SECOND', message: caseData.mode === 'selection' ? '二次候補選定を開始' : '二次判定を開始' });
    const second = await runSecond(caseData, primaryLocked, cross, options);
    emit(options, 'onSecondComplete', second);

    emit(options, 'onStage', { stage: 'FINAL', message: caseData.mode === 'selection' ? '選択結果を集約' : '最終決定を開始' });
    const final = await finalize(caseData, primaryLocked, cross, second, options);
    emit(options, 'onFinalComplete', final);

    return deepFreeze({
      engineVersion: ENGINE_VERSION,
      case: clone(caseData), primary: reveal(primaryLocked),
      crossExamination: clone(cross), second: clone(second), final: clone(final)
    });
  }

  global.MAGI_ENGINE_V1 = deepFreeze({ version: ENGINE_VERSION, personas: PERSONAS.slice(), deliberate });
})(window);
