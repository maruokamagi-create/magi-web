import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

const CACHE_VERSION = 'magi-canonical-v3';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function normalizeString(value) {
  return String(value).normalize('NFKC').replace(/\r\n/g, '\n').trim();
}

function stableValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return normalizeString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableValue);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

// Canonical identity intentionally does NOT include the runtime model that happened
// to answer. The requested CASE/EVIDENCE + MAGI rules define the canonical result.
// This lets MAGI recover through a fallback model on the first successful run, then
// return that exact stored result to every later user under the same conditions.
export function buildCanonicalKey({ systemInstruction, userPayload, responseSchema }) {
  const material = stableStringify({
    cacheVersion: CACHE_VERSION,
    systemInstruction,
    userPayload,
    responseSchema
  });
  const digest = createHash('sha256').update(material, 'utf8').digest('hex');
  return `magi:${CACHE_VERSION}:${digest}`;
}

export function canonicalFingerprint(key) {
  return String(key || '').split(':').pop()?.slice(0, 12) || '';
}

export async function readCanonicalResult(key) {
  try {
    const cache = getCache();
    const value = await cache.get(key);
    return value ?? null;
  } catch (error) {
    console.warn(`[MAGI CANONICAL CACHE] read unavailable: ${error?.message || error}`);
    return null;
  }
}

export async function writeCanonicalResult(key, value) {
  try {
    const cache = getCache();
    await cache.set(key, value, {
      ttl: CACHE_TTL_SECONDS,
      tags: ['magi-canonical-results', CACHE_VERSION]
    });
    return true;
  } catch (error) {
    console.warn(`[MAGI CANONICAL CACHE] write unavailable: ${error?.message || error}`);
    return false;
  }
}

export const CANONICAL_CACHE_VERSION = CACHE_VERSION;
