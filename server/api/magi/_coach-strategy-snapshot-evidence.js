import { getDriveFileMetadata } from '../drive/_service.js';
import { evidenceSource } from './_evidence-source-map.js';
import { assertStaffEvidenceAccess } from './_staff-evidence-access.js';

export const COACH_STRATEGY_SNAPSHOT_VERSION='coach-strategy-snapshot-v2-metadata-only';
const SOURCE=evidenceSource('COACH_STRATEGY_SNAPSHOT_20260802');
const EXPECTED_NAME='現段階でのポジション起用案_20260802.pdf';

function normalizeName(v){return String(v||'').normalize('NFKC').replace(/\s+/g,'');}

export async function buildCoachStrategySnapshotEvidence({accessContext=null}={}){
  assertStaffEvidenceAccess({...(accessContext||{}),sourceType:'COACH_STRATEGY_SNAPSHOT'});
  const id=process.env.MAGI_COACH_STRATEGY_20260802_FILE_ID||SOURCE.id;
  const meta=await getDriveFileMetadata(id);
  if(!/\.pdf$/i.test(String(meta?.name||'')) || !normalizeName(meta?.name).includes('ポジション起用案_20260802')){
    throw new Error(`coach_strategy_snapshot_source_mismatch:${String(meta?.name||'')}`);
  }
  // Deliberately metadata-only. The generic Drive content path is restricted to\n  // canonical XLSM/CSV Evidence and must not be widened for this dated PDF.\n  // The PDF remains a registered reference source; its body is never guessed here.\n  return {
    status:'REFERENCE_ONLY',
    version:COACH_STRATEGY_SNAPSHOT_VERSION,
    effectiveAt:SOURCE.effectiveAt,
    currentPolicy:false,
    independentVote:false,
    source:{id,name:meta.name||EXPECTED_NAME,type:SOURCE.type,authority:SOURCE.authority},
    textExtractable:false,\n    text:'',
    rule:'2026-08-02時点の指導者起用案。現在の固定方針ではない。最新の実起用・数値Evidence・日付の新しい指導者観察より優先しない。'
  };
}
