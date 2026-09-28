import { getDriveFileMetadata, googleDriveFetch } from '../drive/_service.js';
import { assertStaffEvidenceAccess } from './_staff-evidence-access.js';
import { evidenceSource } from './_evidence-source-map.js';

const GOOGLE_SHEET_MIME='application/vnd.google-apps.spreadsheet';
const COACH_SOURCE_ID=process.env.MAGI_COACH_OBSERVATIONS_FILE_ID||evidenceSource('COACH_OBSERVATIONS').id;
const COACH_SOURCE_NAME='《MAGI》指導者向け情報提供フォーム（回答）';
const text=v=>String(v??'').trim();

function parseCsv(raw){
  const rows=[];let row=[],cell='',quoted=false;
  const s=String(raw||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(quoted){
      if(ch==='"'&&s[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    }else if(ch==='"')quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
    else if(ch!=='\r')cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  const headers=(rows.shift()||[]).map(text);
  return rows.map((r,index)=>({sourceRow:index+2,row:r})).filter(x=>x.row.some(v=>text(v))).map(x=>({...Object.fromEntries(headers.map((h,i)=>[h,text(x.row[i])])),__sourceRow:x.sourceRow}));
}

async function exportGoogleSheetCsv(meta,gid=0){
  if(text(meta.mimeType)!==GOOGLE_SHEET_MIME)throw new Error('coach_observation_source_not_google_sheet');
  // Use the authenticated Drive export endpoint rather than docs.google.com/export.
  // The latter can return HTTP 400 for service-account bearer-token requests even
  // when Drive metadata access succeeds.
  const url=`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(meta.id)}/export?mimeType=${encodeURIComponent('text/csv')}&supportsAllDrives=true`;
  const response=await googleDriveFetch(url);
  if(!response.ok){const e=new Error('coach_observation_export_failed');e.status=response.status;throw e;}
  return response.text();
}

function classifyStatement(category,body){
  const joined=`${text(category)} ${text(body)}`;
  const proposal=/方がいい|ほうがいい|必要|検討|専念|起用|任せ|有力|と思う|気がする/.test(joined);
  const observation=/安定|増した|改善|できて|タイム|送球|声|処理|投球|練習|試合/.test(joined);
  return proposal&&observation?'OBSERVATION_WITH_OPINION':proposal?'OPINION_OR_PROPOSAL':'OBSERVATION';
}

export async function buildCoachObservationEvidence({players=[],gid=0,accessContext={},metadataProvider=getDriveFileMetadata,sheetCsvProvider=null}={}){
  const access=assertStaffEvidenceAccess({...accessContext,sourceType:'COACH_OBSERVATION'});
  const meta=await metadataProvider(COACH_SOURCE_ID);
  if(text(meta.name)!==COACH_SOURCE_NAME)throw new Error(`指導者観察の正本名が想定と異なります: ${text(meta.name)}`);
  const raw=sheetCsvProvider?await sheetCsvProvider(meta,gid):await exportGoogleSheetCsv(meta,gid);
  const rows=parseCsv(raw);
  const wanted=new Set((players||[]).map(text).filter(Boolean));
  const observations=rows.map((r,index)=>({
    recordedAt:text(r['タイムスタンプ']),
    provider:text(r['情報提供者']),
    player:text(r['選手名']),
    category:text(r['「何を伝えたいですか？」']),
    statement:text(r['「何がありましたか？」']),
    note:text(r['さらに残しておきたいことがあればお願いします']),
    sourceRow:Number(r.__sourceRow)||index+2
  })).filter(x=>x.player&&x.statement&&(!wanted.size||wanted.has(x.player))).map(x=>({
    ...x,
    evidenceType:'COACH_OBSERVATION',
    observationKey:[x.recordedAt,'指導者',x.player,x.statement].map(text).join('|').normalize('NFKC'),
    statementClass:classifyStatement(x.category,x.statement),
    lineage:{sourceId:meta.id,sourceRow:x.sourceRow,derivedFrom:null,independentVote:true}
  }));
  return {
    status:'COMPLETE',
    access,
    source:{id:meta.id,name:meta.name,mimeType:meta.mimeType,modifiedTime:meta.modifiedTime,priority:'COACH_OBSERVATION'},
    observations,
    rule:'指導者回答の原本のみをCOACH OBSERVATIONとして読む。観察事実と意見・起用提案をstatementClassで区別し、統合台帳の同一内容を別票として加算しない。'
  };
}
