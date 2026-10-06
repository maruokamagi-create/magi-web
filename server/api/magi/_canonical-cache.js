import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

const CACHE_VERSION = 'magi-canonical-v4';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days
const VOLATILE_KEYS = new Set([
  'createdAt','currentDateTime','generatedAt','fetchedAt','resolvedAt','requestedAt',
  'completedAt','modifiedAt','updatedAt','requestId','traceId','timestamp'
]);
const SET_LIKE_ARRAY_KEYS = new Set(['files']);

function normalizeString(value) {
  const s = String(value).normalize('NFKC').replace(/\r\n/g, '\n').trim();
  if (/^MAGI-\d{10,}$/.test(s)) return 'MAGI-CANONICAL';
  return s;
}

function stableValue(value, keyName = '') {
  if (VOLATILE_KEYS.has(keyName)) return null;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return normalizeString(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const rows = value.map(v => stableValue(v, ''));
    if (SET_LIKE_ARRAY_KEYS.has(keyName)) {
      return rows.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'ja'));
    }
    return rows;
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (VOLATILE_KEYS.has(key)) continue;
    out[key] = stableValue(value[key], key);
  }
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

// Canonical identity is defined by MAGI rules + question + substantive Evidence.
// Runtime timestamps, generated case IDs and fetch-time metadata are excluded so
// an unchanged Evidence snapshot produces the exact same cached deliberation input.
// The runtime model name is intentionally excluded: the first successful canonical
// result becomes the stable result for later runs under the same conditions.
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


const PROVIDER_QUOTA_CACHE_VERSION='magi-provider-quota-v1';

function providerQuotaKey(scope){
  return `magi:${PROVIDER_QUOTA_CACHE_VERSION}:${String(scope||'').trim()}`;
}

export function parseProviderRetryDelaySeconds(value,{quotaWindow='UNKNOWN'}={}){
  const raw=String(value||'').trim().toLowerCase();
  const m=raw.match(/^([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)?$/);
  let seconds=0;
  if(m){
    const n=Number(m[1]);
    const unit=m[2]||'s';
    seconds=unit==='ms'?Math.ceil(n/1000):unit==='m'?Math.ceil(n*60):unit==='h'?Math.ceil(n*3600):Math.ceil(n);
  }
  if(!Number.isFinite(seconds)||seconds<=0){
    const w=String(quotaWindow||'').toUpperCase();
    seconds=w==='DAY'?3600:w==='MINUTE'?60:w==='SECOND'?5:30;
  }
  return Math.max(1,Math.min(86400,seconds));
}

export async function readProviderQuotaCooldown(scope){
  const key=providerQuotaKey(scope);
  try{
    const cache=getCache();
    const value=await cache.get(key);
    if(!value||typeof value!=='object')return null;
    const until=Number(value.until||0);
    if(!Number.isFinite(until)||until<=Date.now())return null;
    return value;
  }catch(error){
    console.warn(`[MAGI PROVIDER QUOTA] read unavailable: ${error?.message||error}`);
    return null;
  }
}

export async function writeProviderQuotaCooldown(scope,diagnostic={}){
  const key=providerQuotaKey(scope);
  const seconds=parseProviderRetryDelaySeconds(diagnostic?.retryDelay,{quotaWindow:diagnostic?.quotaWindow});
  const value={
    providerStatus:String(diagnostic?.providerStatus||''),
    quotaMetric:String(diagnostic?.quotaMetric||''),
    quotaId:String(diagnostic?.quotaId||''),
    model:String(diagnostic?.model||''),
    location:String(diagnostic?.location||''),
    retryDelay:String(diagnostic?.retryDelay||''),
    quotaWindow:String(diagnostic?.quotaWindow||''),
    quotaScope:String(diagnostic?.quotaScope||''),
    until:Date.now()+seconds*1000
  };
  try{
    const cache=getCache();
    await cache.set(key,value,{ttl:seconds,tags:['magi-provider-quota',PROVIDER_QUOTA_CACHE_VERSION]});
    return value;
  }catch(error){
    console.warn(`[MAGI PROVIDER QUOTA] write unavailable: ${error?.message||error}`);
    return null;
  }
}

export async function clearProviderQuotaCooldown(scope){
  try{
    const cache=getCache();
    if(typeof cache.delete==='function')await cache.delete(providerQuotaKey(scope));
  }catch{}
}

export const CANONICAL_CACHE_VERSION = CACHE_VERSION;
