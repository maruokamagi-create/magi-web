import zlib from 'node:zlib';
import * as XLSX from 'xlsx';
import { requireApprovedMember } from '../drive/_access.js';
import { canAccessDrivePath } from '../drive/_permissions.js';

const SUPABASE_URL=(process.env.SUPABASE_URL||'https://stqekbjijufefrykksji.supabase.co').replace(/\/$/,'');
const SERVICE_KEY=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const TABLE='magi_drive_file_cache';

const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
function headers(){const h={apikey:SERVICE_KEY};if(!String(SERVICE_KEY).startsWith('sb_secret_'))h.Authorization=`Bearer ${SERVICE_KEY}`;return h;}
function seasonOf(s){const m=String(s||'').match(/(20\d{2})\s*[-–—_. /]\s*(20\d{2})/);return m?`${m[1]}-${m[2]}`:'';}
function explicitSeason(q){const y=seasonOf(q);if(y)return y;if(/旧チーム|昨季|前年|昨年/i.test(q))return'2025-2026';if(/新チーム|現チーム/i.test(q))return'2026-2027';return'';}
function decode(row){const packed=Buffer.from(String(row.payload_base64||''),'base64');return row.encoding==='gzip-base64'?zlib.gunzipSync(packed):packed;}
function scoreHeader(row){if(!Array.isArray(row))return 0;const vals=row.map(norm);let s=0;if(vals.some(v=>['選手名','氏名','選手','名前'].map(norm).includes(v)))s+=5;if(vals.some(v=>['得点圏','得点圏打率'].map(norm).includes(v)))s+=5;if(vals.includes(norm('打率')))s++;if(vals.includes(norm('OPS')))s++;return s;}
function findHeader(rows){let best=-1,bestScore=0;for(let i=0;i<Math.min(rows.length,50);i++){const s=scoreHeader(rows[i]);if(s>bestScore){best=i;bestScore=s;}}return bestScore>=8?best:-1;}
function colIndex(cols,aliases){const wants=aliases.map(norm);for(let i=0;i<cols.length;i++)if(wants.includes(norm(cols[i])))return i;return-1;}
function findSheet(book){const names=book.SheetNames||[];return names.find(n=>/^打撃一覧$/i.test(String(n).trim()))||names.find(n=>/打撃.*一覧|打者.*成績|通算.*打撃/i.test(String(n)))||'';}
function parseOne(row,q){
  const book=XLSX.read(decode(row),{type:'buffer',cellDates:false,cellFormula:false});
  const sheetName=findSheet(book);if(!sheetName)return null;
  const rows=XLSX.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:'',raw:true,blankrows:false});
  const hi=findHeader(rows);if(hi<0)return null;
  const cols=(rows[hi]||[]).map(v=>String(v??'').trim());
  const pi=colIndex(cols,['選手名','氏名','選手','名前']);
  const ri=colIndex(cols,['得点圏打率','得点圏']);
  if(pi<0||ri<0)return null;
  const nq=norm(q),matches=[];
  for(let i=hi+1;i<rows.length;i++){
    const r=rows[i]||[],p=String(r[pi]??'').trim(),k=norm(p);if(!p||k.length<2||!nq.includes(k))continue;
    const v=String(r[ri]??'').trim();if(!v)continue;matches.push({target:p,rispAvg:v,rowNumber:i+1});
  }
  matches.sort((a,b)=>norm(b.target).length-norm(a.target).length);
  const hit=matches[0];if(!hit)return null;
  return {season:seasonOf(`${row.name||''} ${row.path||''}`),target:hit.target,rispAvg:hit.rispAvg,fileName:String(row.name||''),sheetName,rowNumber:hit.rowNumber};
}
async function cachedMasters(){
  if(!SERVICE_KEY)throw new Error('stats_cache_not_configured');
  const params=new URLSearchParams();
  params.set('select','file_id,name,path,encoding,payload_base64');
  params.set('name','ilike.*通算成績一覧*');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}`,{headers:headers()});
  const body=await r.json().catch(()=>[]);if(!r.ok)throw new Error(`stats_cache_${r.status}`);return Array.isArray(body)?body:[];
}

export default async function handler(req,res){
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end('Method not allowed');}
  try{
    const member=await requireApprovedMember(req,res);if(!member)return;
    const q=String(req.query?.q||'').trim();if(!q)return res.status(400).json({ok:false,error:'query_required'});
    const wanted=explicitSeason(q);
    let rows=(await cachedMasters()).filter(r=>/\.(xlsm|xlsx|xls)$/i.test(String(r.name||''))&&canAccessDrivePath(member.role,String(r.path||'')));
    if(wanted)rows=rows.filter(r=>seasonOf(`${r.name||''} ${r.path||''}`)===wanted);
    const records=[];
    for(const row of rows){try{const x=parseOne(row,q);if(x)records.push(x);}catch(e){console.warn('[MAGI RISP]',row.name,e?.message||e);}}
    records.sort((a,b)=>String(a.season).localeCompare(String(b.season)));
    if(!records.length)return res.status(404).json({ok:false,error:'risp_not_found'});
    const target=records.map(x=>x.target).sort((a,b)=>norm(b).length-norm(a).length)[0]||'';
    res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json({ok:true,target,records});
  }catch(e){console.error('[MAGI RISP]',e?.message||e);if(!res.headersSent)res.statusCode=500;return res.end(JSON.stringify({ok:false,error:'risp_server_failed'}));}
}
