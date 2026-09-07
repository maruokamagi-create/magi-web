import zlib from 'node:zlib';
import * as XLSX from 'xlsx';
import { requireApprovedMember } from '../drive/_access.js';
import { canAccessDrivePath } from '../drive/_permissions.js';

const SUPABASE_URL=(process.env.SUPABASE_URL||'https://stqekbjijufefrykksji.supabase.co').replace(/\/$/,'');
const SERVICE_KEY=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const TABLE='magi_drive_file_cache';

const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const headerKeys=new Set(['背番号','選手名','選手','氏名','打率','出場数','出場試合数','打席','打席数','打数','打点','得点','安打','単打','二塁打','三塁打','本塁打','三振','四球','死球','出塁率','長打率','ops','得点圏','得点圏打率','盗塁','盗塁刺','盗塁率','犠打','犠飛'].map(norm));

function sendJson(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store');
  return res.end(JSON.stringify(body));
}
function headers(){
  const h={apikey:SERVICE_KEY};
  if(!String(SERVICE_KEY).startsWith('sb_secret_'))h.Authorization=`Bearer ${SERVICE_KEY}`;
  return h;
}
function seasonOf(s){
  const x=String(s||'');
  if(/2025\s*[-–—_. /]?\s*2026/.test(x))return'2025-2026';
  if(/2026\s*[-–—_. /]?\s*2027/.test(x))return'2026-2027';
  return'';
}
function wantedSeason(q){
  if(/2025\s*[-–—_. /]?\s*2026|旧チーム|昨季|前年|昨年/.test(q))return'2025-2026';
  if(/2026\s*[-–—_. /]?\s*2027|新チーム|現チーム/.test(q))return'2026-2027';
  return'';
}
function decode(row){
  const packed=Buffer.from(String(row.payload_base64||''),'base64');
  return row.encoding==='gzip-base64'?zlib.gunzipSync(packed):packed;
}
function headerScore(row){
  if(!Array.isArray(row))return 0;
  const vals=row.map(norm).filter(Boolean);
  let score=0;
  for(const v of vals)if(headerKeys.has(v))score++;
  if(vals.some(v=>v==='選手名'||v==='選手'||v==='氏名'))score+=4;
  return score;
}
function sheetRows(ws){
  return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
}
function findHeader(rows){
  let best=-1,score=0;
  for(let i=0;i<Math.min(rows.length,40);i++){
    const s=headerScore(rows[i]);
    if(s>score){score=s;best=i;}
  }
  return score>=4?best:-1;
}
function playerColumn(columns){
  const wants=new Set(['選手名','選手','氏名'].map(norm));
  return columns.findIndex(v=>wants.has(norm(v)));
}
function candidatesFromWorkbook(book){
  const ws=book.Sheets['打撃一覧'];
  if(!ws)return[];
  const rows=sheetRows(ws),hi=findHeader(rows);
  if(hi<0)return[];
  const cols=rows[hi],pi=playerColumn(cols);
  if(pi<0)return[];
  return rows.slice(hi+1).map(r=>String(r?.[pi]??'').trim()).filter(Boolean);
}
function recordFromSheet(book,rowMeta,sheetName,target){
  const ws=book.Sheets[sheetName];
  if(!ws)return null;
  const rows=sheetRows(ws),hi=findHeader(rows);
  if(hi<0)return null;
  const columns=rows[hi].map(v=>String(v??'').trim()),pi=playerColumn(columns);
  if(pi<0)return null;
  const nt=norm(target);
  for(let i=hi+1;i<rows.length;i++){
    const values=rows[i]||[];
    if(norm(values[pi])!==nt)continue;
    return {
      source:'drive',
      fileId:String(rowMeta.file_id||''),
      fileName:String(rowMeta.name||''),
      sheetName,
      rowNumber:i+1,
      columns,
      values:values.map(v=>v==null?'':v)
    };
  }
  return null;
}
async function cachedMasters(){
  if(!SERVICE_KEY)throw new Error('stats_cache_not_configured');
  const params=new URLSearchParams();
  params.set('select','file_id,name,path,mime_type,modified_time,encoding,payload_base64,cached_at');
  params.set('name','ilike.*通算成績一覧*');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}`,{headers:headers()});
  const body=await r.json().catch(()=>[]);
  if(!r.ok)throw new Error(`stats_cache_${r.status}`);
  return Array.isArray(body)?body:[];
}

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.statusCode=405;res.setHeader('Allow','GET');return res.end('Method not allowed');
  }
  try{
    const member=await requireApprovedMember(req,res);
    if(!member)return;
    const q=String(req.query?.q||'').trim();
    if(!q)return sendJson(res,400,{ok:false,error:'query_required'});
    const wanted=wantedSeason(q);
    let rows=(await cachedMasters()).filter(r=>/\.(xlsm|xlsx|xls)$/i.test(String(r.name||''))&&canAccessDrivePath(member.role,String(r.path||'')));
    if(wanted)rows=rows.filter(r=>seasonOf(`${r.name||''} ${r.path||''}`)===wanted);
    rows.sort((a,b)=>seasonOf(`${a.name} ${a.path}`).localeCompare(seasonOf(`${b.name} ${b.path}`)));
    if(!rows.length)return sendJson(res,503,{ok:false,error:'master_cache_not_ready'});

    const parsed=[];
    const names=[];
    for(const row of rows){
      try{
        const book=XLSX.read(decode(row),{type:'buffer',cellDates:false,cellFormula:false});
        parsed.push({row,book});
        names.push(...candidatesFromWorkbook(book));
      }catch(e){console.warn('[MAGI stats server] workbook parse',row.name,e?.message||e);}
    }
    const nq=norm(q);
    const target=[...new Set(names)].filter(n=>norm(n).length>=2&&nq.includes(norm(n))).sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
    if(!target)return sendJson(res,404,{ok:false,error:'player_not_found'});

    const records=[];
    for(const {row,book} of parsed){
      for(const sheetName of ['打撃一覧','得点圏打率一覧']){
        const rec=recordFromSheet(book,row,sheetName,target);
        if(rec)records.push(rec);
      }
    }
    if(!records.length)return sendJson(res,404,{ok:false,error:'stats_not_found',target});
    return sendJson(res,200,{ok:true,target,records,seasons:[...new Set(records.map(r=>seasonOf(r.fileName)).filter(Boolean))]});
  }catch(e){
    console.error('[MAGI stats server]',e?.message||e);
    if(res.headersSent)return;
    return sendJson(res,500,{ok:false,error:'stats_server_failed'});
  }
}
