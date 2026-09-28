import { getDriveFileMetadata, googleDriveFetch } from '../drive/_service.js';
import { assertStaffEvidenceAccess } from './_staff-evidence-access.js';

const GOOGLE_SHEET_MIME='application/vnd.google-apps.spreadsheet';
const text=v=>String(v??'').trim();

function parseCsv(raw){
  const rows=[];let row=[],cell='',quoted=false;
  const s=String(raw||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(quoted){if(ch==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
    else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=(rows.shift()||[]).map(text);
  return rows.filter(r=>r.some(x=>text(x))).map((r,index)=>({sourceRow:index+2,row:Object.fromEntries(headers.map((h,i)=>[h,text(r[i])]))}));
}
async function exportCsv(meta){
  if(text(meta.mimeType)!==GOOGLE_SHEET_MIME)throw new Error('observation_source_not_google_sheet');
  const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}/export?mimeType=${encodeURIComponent('text/csv')}&supportsAllDrives=true`;
  const response=await googleDriveFetch(url);
  if(!response.ok){const e=new Error('observation_export_failed');e.status=response.status;throw e;}
  return response.text();
}
function key(parts){return parts.map(text).join('|').normalize('NFKC');}

const SOURCE_ID=process.env.MAGI_NORMALIZED_OBSERVATIONS_FILE_ID||'1Cs5cQUJYEC1Ta7OQXi5hUWnKkQHVOHByRiWtwKsC0uE';
const SOURCE_NAME='《MAGI》指導者・保護者 観察情報統合台帳';

export async function buildNormalizedObservationEvidence({players=[],accessContext={},metadataProvider=getDriveFileMetadata,sheetCsvProvider=null}={}){
  const access=assertStaffEvidenceAccess({...accessContext,sourceType:'NORMALIZED_OBSERVATION'});
  const meta=await metadataProvider(SOURCE_ID);
  if(text(meta.name)!==SOURCE_NAME)throw new Error(`観察統合台帳の正本名が想定と異なります: ${text(meta.name)}`);
  const raw=sheetCsvProvider?await sheetCsvProvider(meta):await exportCsv(meta);
  const wanted=new Set(players.map(text).filter(Boolean));
  const observations=parseCsv(raw).map(({row:r,sourceRow})=>({
    recordedAt:text(r['記録日時']),sourceType:text(r['情報源']),provider:text(r['情報提供者']),role:text(r['立場']),
    player:text(r['対象']),period:text(r['時期']),scene:text(r['場面・種別']),statement:text(r['原文・観察内容']),
    growth:text(r['成長・評価観点']),tag:text(r['一言タグ']),note:text(r['補足']),handling:text(r['MAGI取扱区分']),sourceRow
  })).filter(x=>x.player&&x.statement&&(!wanted.size||wanted.has(x.player)||x.player==='チーム全体'||x.player==='ベンチ')
    ).map(x=>({...x,evidenceType:'NORMALIZED_OBSERVATION',observationKey:key([x.recordedAt,x.sourceType,x.player,x.statement]),
      lineage:{sourceId:meta.id,sourceRow:x.sourceRow,derivedFrom:x.sourceType==='保護者'?'PARENT_OBSERVATION':x.sourceType==='指導者'?'COACH_OBSERVATION':'UNKNOWN',independentVote:false}}));
  return {status:'COMPLETE',access,source:{id:meta.id,name:meta.name,mimeType:meta.mimeType,modifiedTime:meta.modifiedTime,priority:'NORMALIZED_OBSERVATION'},observations,
    rule:'統合台帳は原本観察の正規化ビュー。derivedFromを持つ行は原本とは独立票にせず、同一観察を二重加点しない。'};
}
