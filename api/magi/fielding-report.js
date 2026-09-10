import { rateLimit, readBody, requirePost, requireSameOrigin, sendJson } from './_gemini.js';
import { requireApprovedMember } from '../drive/_access.js';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { runFieldingCsvAudit } from './_fielding-csv-audit.js';

const SEASONS={
 current:{key:'current',label:'2026-2027',token:'2026-2027_CURRENT_現チーム'},
 old:{key:'old',label:'2025-2026',token:'2025-2026_ARCHIVE_旧チーム'}
};
const FIELDS=[
 ['CHANCES',['守備機会']],['ASSISTS',['補殺']],['PUTOUTS',['刺殺']],['ERRORS',['失策']],['DP',['併殺']],['TP',['三重殺']],
 ['C_INN',['回数','捕手回数']],['PB',['捕逸']],['SB_ALLOWED',['許盗塁']],['SB_ATT',['盗塁企図']],['CS',['盗塁阻止']],['PK',['牽制刺']],['CI',['捕妨害']]
];

const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const num=v=>{const x=Number(String(v??'').replace(/,/g,'').trim());return Number.isFinite(x)?x:0};
function inningOuts(v){const s=String(v??'').trim();if(!s)return 0;const m=s.match(/^(\d+)(?:\.(\d))?$/);if(!m)return 0;const r=Number(m[2]||0);return r<=2?Number(m[1])*3+r:0}
const outsToInning=o=>`${Math.floor(Math.max(0,o)/3)}.${Math.max(0,o)%3}`;
function col(cols,aliases){const want=aliases.map(norm);for(let i=0;i<cols.length;i++)if(want.includes(norm(cols[i])))return i;for(let i=0;i<cols.length;i++){const c=norm(cols[i]);if(want.some(x=>x.length>=2&&c.includes(x)))return i}return-1}
function decode(buffer){for(const enc of ['utf-8','shift_jis']){try{const t=new TextDecoder(enc).decode(buffer).replace(/^\uFEFF/,'');if(/選手名/.test(t)&&/守備機会/.test(t))return t}catch(_){}}throw new Error('守備詳細CSVの文字コードを判定できませんでした')}
function parseCsv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;continue}if(ch==='"'){q=false;continue}cell+=ch;continue}if(ch==='"'){q=true;continue}if(ch===','){row.push(cell.trim());cell='';continue}if(ch==='\n'){row.push(cell.replace(/\r$/,'').trim());if(row.some(x=>String(x).trim()))rows.push(row);row=[];cell='';continue}cell+=ch}row.push(cell.replace(/\r$/,'').trim());if(row.some(x=>String(x).trim()))rows.push(row);return rows}
function period(q){q=String(q||'');if(/旧チーム|昨季|前年|昨年|2025\s*[-–—_. /]?\s*2026/i.test(q))return'old';if(/今期|今季|今年|今シーズン|現チーム|新チーム|2026\s*[-–—_. /]?\s*2027/i.test(q))return'current';return'career'}
function findPlayer(q,audits){const nq=norm(q),names=[...new Set(audits.flatMap(a=>(a.players||[]).map(p=>p.name).filter(Boolean)))];const direct=names.filter(n=>nq.includes(norm(n))).sort((a,b)=>norm(b).length-norm(a).length);if(direct.length)return direct[0];const partial=names.filter(n=>{const parts=String(n).trim().split(/[\s　]+/).filter(Boolean);return parts.some(p=>norm(p).length>=2&&nq.includes(norm(p)))});return partial.length===1?partial[0]:''}
function derived(v){const po=num(v.PUTOUTS),a=num(v.ASSISTS),e=num(v.ERRORS),den=po+a+e,att=num(v.SB_ATT),cs=num(v.CS);return{...v,FIELD_PCT:den?(po+a)/den:'',CS_PCT:att?cs/att:''}}
function sumMasters(records){const t={C_INN_OUTS:0};for(const rec of records){const v=rec.values||{};for(const [k] of FIELDS){if(k==='C_INN')t.C_INN_OUTS+=inningOuts(v[k]);else t[k]=(t[k]||0)+num(v[k])}}t.C_INN=outsToInning(t.C_INN_OUTS);delete t.C_INN_OUTS;return derived(t)}
function detailFile(tree,s,audit){const exact=tree.find(f=>f?.id&&f.name===audit?.detailSource?.name&&f.path===audit?.detailSource?.path);if(exact)return exact;return tree.find(f=>f?.id&&/^守備詳細.*\.csv$/i.test(String(f.name||''))&&String(f.path||'').includes(s.token)&&String(f.path||'').includes('FIELDING_守備'))||null}
function aggregateOpponent(rows,target){if(!rows.length)return[];const h=rows[0]||[],pi=col(h,['選手名','氏名','名前','選手']),oi=col(h,['相手校','対戦相手','対戦校','相手']);if(pi<0||oi<0)return[];const ix=Object.fromEntries(FIELDS.map(([k,a])=>[k,col(h,a)]));const groups=new Map();for(const r of rows.slice(1)){if(norm(r[pi])!==norm(target))continue;const label=String(r[oi]??'').trim();if(!label)continue;if(!groups.has(label))groups.set(label,{C_INN_OUTS:0});const g=groups.get(label);for(const [k] of FIELDS){const ci=ix[k];if(ci<0)continue;if(k==='C_INN')g.C_INN_OUTS+=inningOuts(r[ci]);else g[k]=(g[k]||0)+num(r[ci])}}const out=[];for(const [label,g] of groups){g.C_INN=outsToInning(g.C_INN_OUTS);delete g.C_INN_OUTS;out.push({label,values:derived(g)})}return out.sort((a,b)=>num(b.values.CHANCES)-num(a.values.CHANCES)||a.label.localeCompare(b.label,'ja'))}

async function buildSeason(key,audit,target,tree){const s=SEASONS[key],p=(audit.players||[]).find(x=>norm(x.name)===norm(target));if(!p?.master)return null;let opponentRows=[],breakdownAllowed=Boolean(p.allowed);if(breakdownAllowed){const f=detailFile(tree,s,audit);if(f){try{const x=await fetchDriveFileContent(f);opponentRows=aggregateOpponent(parseCsv(decode(x.buffer)),target)}catch(e){console.warn('[MAGI fielding opponent]',s.label,e?.message||e);breakdownAllowed=false}}else breakdownAllowed=false}
 return{label:s.label,season:key,isCareer:false,values:derived({...p.master}),opponentRows,breakdownAllowed,source:{master:audit.authoritativeSource,detail:audit.detailSource},auditIssues:p.issues||[]};}

export default async function handler(req,res){
 if(!requirePost(req,res)||!requireSameOrigin(req,res)||!rateLimit(req,res))return;
 try{
  const member=await requireApprovedMember(req,res);if(!member)return;
  const body=await readBody(req),question=String(body?.question||'').trim();if(!question)return sendJson(res,400,{ok:false,error:'question is required'});
  const mode=period(question),keys=mode==='career'?['old','current']:[mode];
  const audits=await Promise.all(keys.map(k=>runFieldingCsvAudit({season:k})));
  const target=findPlayer(question,audits);if(!target)return sendJson(res,422,{ok:false,error:'対象選手を守備データから一意に特定できませんでした。選手名をフルネームで入力してください。'});
  const tree=await listMagiDriveTree();const seasonRecords=[];for(let i=0;i<keys.length;i++){const r=await buildSeason(keys[i],audits[i],target,tree);if(r)seasonRecords.push(r)}
  if(!seasonRecords.length)return sendJson(res,404,{ok:false,error:`${target}の守備成績はありません。`});
  let records=seasonRecords;
  if(mode==='career'&&seasonRecords.length){const allVerified=seasonRecords.every(r=>r.breakdownAllowed);const map=new Map();if(allVerified){for(const r of seasonRecords)for(const row of r.opponentRows||[]){if(!map.has(row.label))map.set(row.label,[]);map.get(row.label).push(row.values)}}const opponentRows=allVerified?[...map].map(([label,vals])=>({label,values:sumMasters(vals.map(values=>({values})))})).sort((a,b)=>num(b.values.CHANCES)-num(a.values.CHANCES)||a.label.localeCompare(b.label,'ja')):[];records=[{label:'全年度通算',season:'career',isCareer:true,values:sumMasters(seasonRecords),opponentRows,breakdownAllowed:allVerified,source:{master:{name:'各年度XLSM正本の合算'},detail:{name:'各年度守備詳細CSV（照合済み）'}}},...seasonRecords]}
  return sendJson(res,200,{ok:true,route:'FIELDING_REPORT',target,mode:mode==='career'?'career':'season',wanted:mode==='career'?'全年度':SEASONS[mode].label,records,reportVersion:'fielding-report-v327',note:'総合値はXLSM正本内の守備詳細から再集計した正本値。相手校別は、その選手について正本と一致した守備詳細CSVだけを使用。'});
 }catch(error){console.error('[MAGI fielding report]',error?.message||error);return sendJson(res,502,{ok:false,error:error?.message||'守備成績を取得できませんでした'});}
}
