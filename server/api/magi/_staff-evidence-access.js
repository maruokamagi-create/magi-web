export const STAFF_EVIDENCE_ACCESS_VERSION='staff-evidence-access-v3-strategy-snapshot';

const ALLOWED_ROLES=new Set(['ADMIN','COACH']);
const ROLE_ALIASES=new Map([['ADMIN','ADMIN'],['COACH','COACH'],['MEMBER','MEMBER'],['PLAYER','PLAYER']]);
const ALLOWED_PURPOSES=new Set(['DELIBERATION','COACHING_ANALYSIS','INTERNAL_EVIDENCE']);

function text(v){return String(v??'').trim().toUpperCase();}

export function staffEvidenceAccessDecision({role='',purpose='',sourceType=''}={}){
  const rawRole=text(role),r=ROLE_ALIASES.get(rawRole)||rawRole,p=text(purpose),s=text(sourceType);
  if(!new Set(['COACH_OBSERVATION','PARENT_OBSERVATION','NORMALIZED_OBSERVATION','COACH_STRATEGY_SNAPSHOT']).has(s)) return {allowed:false,reason:'UNSUPPORTED_STAFF_SOURCE',version:STAFF_EVIDENCE_ACCESS_VERSION};
  if(!r) return {allowed:false,reason:'ROLE_REQUIRED',version:STAFF_EVIDENCE_ACCESS_VERSION};
  if(!p) return {allowed:false,reason:'PURPOSE_REQUIRED',version:STAFF_EVIDENCE_ACCESS_VERSION};
  if(!ALLOWED_ROLES.has(r)) return {allowed:false,reason:'ROLE_NOT_ALLOWED',version:STAFF_EVIDENCE_ACCESS_VERSION};
  if(!ALLOWED_PURPOSES.has(p)) return {allowed:false,reason:'PURPOSE_NOT_ALLOWED',version:STAFF_EVIDENCE_ACCESS_VERSION};
  return {allowed:true,reason:'EXPLICIT_INTERNAL_ALLOW',version:STAFF_EVIDENCE_ACCESS_VERSION};
}

export function assertStaffEvidenceAccess(input={}){
  const decision=staffEvidenceAccessDecision(input);
  if(decision.allowed)return decision;
  const error=new Error(`staff_evidence_access_denied:${decision.reason}`);
  error.code='STAFF_EVIDENCE_ACCESS_DENIED';
  error.status=403;
  error.accessDecision=decision;
  throw error;
}
