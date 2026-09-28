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
  return rows.map((r,index)=>({sourceRow:index+2,row:r})).filter(x=>x.row.some(v=>text(v))).map(x=>({sourceRow:x.sourceRow,row:Object.fromEntries(headers.map((h,i)=>[h,text(x.row[i])]))}));
}
async function exportCsv(meta){
  if(text(meta.mimeType)!==GOOGLE_SHEET_MIME)throw new Error('observation_source_not_google_sheet');
  const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}/export?mimeType=${encodeURIComponent('text/csv')}&supportsAllDrives=true`;
  const response=await googleDriveFetch(url);
  if(!response.ok){const e=new Error('observation_export_failed');e.status=response.status;throw e;}
  return response.text();
}
function key(parts){return parts.map(text).join('|').normalize('NFKC');}

const SOURCE_ID=process.env.MAGI_PARENT_OBSERVATIONS_FILE_ID||'1HlLRLrq17nav68Ko-WcULHJ1pxu98imtJLbhwrz723g';
const SOURCE_NAME='《MAGI》保護者向け情報提供フォーム（回答）';

export async function buildParentObservationEvidence({players=[],accessContext={},metadataProvider=getDriveFileMetadata,sheetCsvProvider=null}={}){
  const access=assertStaffEvidenceAccess({...accessContext,sourceType:'PARENT_OBSERVATION'});
  const meta=await metadataProvider(SOURCE_ID);
  if(text(meta.name)!==SOURCE_NAME)throw new Error(`保護者観察の正本名が想定と異なります: ${text(meta.name)}`);
  const raw=sheetCsvProvider?await sheetCsvProvider(meta):await exportCsv(meta);
  const wanted=new Set(players.map(text).filter(Boolean));
  const observations=parseCsv(raw).map(({row:r,sourceRow})=>({
    recordedAt:text(r['タイムスタンプ']),provider:text(r['お名前(任意)']),role:text(r['あなたの立場']),
    player:text(r['気づいた選手を選んでください']),period:text(r['いつ頃のことですか？']),scene:text(r['どんな場面でしたか？']),
    statement:text(r['実際にどんなことがありましたか？']),growth:text(r['どんな部分に成長や良さを感じましたか？']),
    tag:text(r['この出来事を一言で表すとしたら？（任意）']),note:text(r['《MAGI》に補足しておきたいこと']),sourceRow
  })).filter(x=>x.player&&x.statement&&(!wanted.size||wanted.has(x.player)||x.player==='チーム全体'||x.player==='ベンチ'))
    .map(x=>({...x,evidenceType:'PARENT_OBSERVATION',observationKey:key([x.recordedAt,'保護者',x.player,x.statement]),lineage:{sourceId:meta.id,sourceRow:x.sourceRow,derivedFrom:null,independentVote:true}}));
  return {status:'COMPLETE',access,source:{id:meta.id,name:meta.name,mimeType:meta.mimeType,modifiedTime:meta.modifiedTime,priority:'PARENT_OBSERVATION'},observations,
    rule:'保護者回答の正本のみをPARENT OBSERVATIONとして読む。同一内容が統合台帳にある場合は別票として加算しない。'};
}
