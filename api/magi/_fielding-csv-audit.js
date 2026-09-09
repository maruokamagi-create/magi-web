import * as XLSX from 'xlsx';
import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';

const SEASONS = {
  current:{ key:'current', label:'2026-2027', token:'2026-2027_CURRENT_現チーム' },
  old:{ key:'old', label:'2025-2026', token:'2025-2026_ARCHIVE_旧チーム' }
};

const FIELDS = [
  ['CHANCES','守備機会'],['ASSISTS','補殺'],['PUTOUTS','刺殺'],['ERRORS','失策'],['DP','併殺'],['TP','三重殺'],
  ['C_INN','回数'],['PB','捕逸'],['SB_ALLOWED','許盗塁'],['SB_ATT','盗塁企図'],['CS','盗塁阻止'],['PK','牽制刺'],['CI','捕妨害']
];

function seasonOf(value){ const v=String(value||'current').toLowerCase(); return v==='old'||v==='2025-2026'?SEASONS.old:SEASONS.current; }
function norm(v){ return String(v??'').replace(/[\s　]+/g,'').trim(); }
function num(v){ const n=Number(String(v??'').replace(/,/g,'').trim()); return Number.isFinite(n)?n:0; }
function inningOuts(v){ const s=String(v??'').trim(); if(!s) return 0; const n=Number(s); if(!Number.isFinite(n)) return 0; const whole=Math.trunc(n); const frac=Math.round((n-whole)*10); if(frac===0||frac===1||frac===2) return whole*3+frac; return Math.round(n*3); }
function outsToInning(outs){ const o=Math.max(0,Math.round(outs)); return `${Math.floor(o/3)}.${o%3}`; }
function sameValue(k,a,b){ if(k==='C_INN') return inningOuts(a)===inningOuts(b); return Math.abs(num(a)-num(b))<1e-9; }

function findOne(tree, pred, label){ const list=tree.filter(pred); if(list.length!==1) throw new Error(`${label}を一意に特定できませんでした (${list.length})`); return list[0]; }
function masterFile(tree,s){ return findOne(tree,f=>/\.xlsm$/i.test(String(f?.name||''))&&String(f?.path||'').includes(s.token)&&String(f?.path||'').includes('03_STATS_成績データ')&&String(f?.path||'').includes('00_MASTER_正本'),`${s.label} XLSM正本`); }
function csvFile(tree,s){ return findOne(tree,f=>/^守備詳細.*\.csv$/i.test(String(f?.name||''))&&String(f?.path||'').includes(s.token)&&String(f?.path||'').includes('03_STATS_成績データ')&&String(f?.path||'').includes('10_DETAIL_詳細データ')&&String(f?.path||'').includes('FIELDING_守備'),`${s.label} 守備CSV`); }

function decodeCsv(buffer){ for(const enc of ['utf-8','shift_jis']){ try{ const text=new TextDecoder(enc).decode(buffer).replace(/^\uFEFF/,''); if(/選手名/.test(text)&&/守備機会/.test(text)) return {text,encoding:enc}; }catch(_){} } throw new Error('守備CSV文字コードを判定できませんでした'); }
function parseCsv(text){ const rows=[]; let row=[],cell='',q=false; for(let i=0;i<text.length;i++){ const ch=text[i]; if(q){ if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;continue;} if(ch==='"'){q=false;continue;} cell+=ch; continue; } if(ch==='"'){q=true;continue;} if(ch===','){row.push(cell.trim());cell='';continue;} if(ch==='\n'){row.push(cell.replace(/\r$/,'').trim()); if(row.some(x=>String(x).trim()!=='')) rows.push(row); row=[];cell='';continue;} cell+=ch; } if(cell||row.length){row.push(cell.replace(/\r$/,'').trim()); if(row.some(x=>String(x).trim()!=='')) rows.push(row);} return rows; }
function col(header,label){ return header.findIndex(x=>norm(x)===norm(label)); }

function aggregateRows(rows, { catcherLabel='回数' } = {}){
  const h=rows[0]||[]; const playerCol=col(h,'選手名'); if(playerCol<0) throw new Error('守備詳細に選手名列がありません');
  const labels=Object.fromEntries(FIELDS.map(([k,label])=>[k,k==='C_INN'?catcherLabel:label]));
  const cols=Object.fromEntries(Object.entries(labels).map(([k,label])=>[k,col(h,label)]));
  const missing=Object.entries(labels).filter(([k])=>cols[k]<0).map(([,label])=>label);
  const out={}; let dataRows=0;
  for(const r of rows.slice(1)){
    const name=String(r[playerCol]||'').trim(); if(!name) continue;
    dataRows++;
    if(!out[name]) out[name]={rows:0,C_INN_OUTS:0};
    const x=out[name]; x.rows++;
    for(const [k] of FIELDS){
      if(cols[k]<0) continue;
      if(k==='C_INN') x.C_INN_OUTS+=inningOuts(r[cols[k]]);
      else x[k]=(x[k]||0)+num(r[cols[k]]);
    }
  }
  for(const x of Object.values(out)) x.C_INN=outsToInning(x.C_INN_OUTS);
  return { totals:out, missing, playerCount:Object.keys(out).length, dataRows };
}

function csvTotals(rows){ return aggregateRows(rows,{catcherLabel:'回数'}); }

function readSummaryTotals(wb){
  const ws=wb.Sheets['守備一覧']; if(!ws) throw new Error('XLSM正本に守備一覧シートがありません');
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
  const headerIndex=rows.findIndex(r=>r.some(v=>norm(v)==='選手名')&&r.some(v=>norm(v)==='守備機会')); if(headerIndex<0) throw new Error('守備一覧の見出しを特定できません');
  const h=rows[headerIndex]; const playerCol=col(h,'選手名');
  const labels={CHANCES:'守備機会',ASSISTS:'補殺',PUTOUTS:'刺殺',ERRORS:'失策',DP:'併殺',TP:'三重殺',C_INN:'捕手回数',PB:'捕逸',SB_ALLOWED:'許盗塁',SB_ATT:'盗塁企図',CS:'盗塁阻止',PK:'牽制刺',CI:'捕妨害'};
  const cols=Object.fromEntries(Object.entries(labels).map(([k,label])=>[k,col(h,label)]));
  const out={};
  for(const r of rows.slice(headerIndex+1)){
    const name=String(r[playerCol]||'').trim(); if(!name) continue;
    const x={};
    for(const k of Object.keys(labels)) x[k]=k==='C_INN'?outsToInning(inningOuts(r[cols[k]])):num(r[cols[k]]);
    out[name]=x;
  }
  return out;
}

function readInternalDetailTotals(wb){
  const ws=wb.Sheets['守備詳細']; if(!ws) throw new Error('XLSM正本に守備詳細シートがありません');
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
  return aggregateRows(rows,{catcherLabel:'回数'});
}

function xlsmTotals(buffer){
  const wb=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellText:true,cellDates:false});
  const summary=readSummaryTotals(wb);
  const detail=readInternalDetailTotals(wb);
  const names=[...new Set([...Object.keys(summary),...Object.keys(detail.totals)])];
  const out={}; const cachedFormulaMismatches=[];
  for(const name of names){
    const s=summary[name]||null; const d=detail.totals[name]||null;
    if(d){
      out[name]=Object.fromEntries(FIELDS.map(([k])=>[k,d[k] ?? (k==='C_INN'?'0.0':0)]));
      if(s){
        const issues=[];
        for(const [k,label] of FIELDS){ if(!sameValue(k,s[k],out[name][k])) issues.push({key:k,label,cached:s[k],recalculated:out[name][k]}); }
        if(issues.length) cachedFormulaMismatches.push({name,issues});
      }
    } else if(s) out[name]=s;
  }
  return {
    totals:out,
    sheetName:'守備一覧（守備詳細から式再計算）',
    internalDetailRows:detail.dataRows,
    internalDetailPlayerCount:detail.playerCount,
    cachedFormulaMismatches
  };
}

function isZeroMaster(m){ return FIELDS.every(([k])=>k==='C_INN'?inningOuts(m?.[k])===0:num(m?.[k])===0); }

export async function runFieldingCsvAudit({season:seasonValue='current'}={}){
  const s=seasonOf(seasonValue); const tree=await listMagiDriveTree({fresh:true}); const mf=masterFile(tree,s); const cf=csvFile(tree,s);
  const [mx,cx]=await Promise.all([fetchDriveFileContent(mf),fetchDriveFileContent(cf)]);
  const decoded=decodeCsv(cx.buffer); const csv=csvTotals(parseCsv(decoded.text)); const master=xlsmTotals(mx.buffer);
  const names=[...new Set([...Object.keys(master.totals),...Object.keys(csv.totals)])].sort((a,b)=>a.localeCompare(b,'ja'));
  const players=[];
  for(const name of names){ const m=master.totals[name]||null; const c=csv.totals[name]||null; const issues=[];
    if(!m){ issues.push({status:'CSV_ONLY_PLAYER'}); }
    else if(!c){ if(!isZeroMaster(m)) issues.push({status:'CSV_MISSING_NONZERO_MASTER'}); }
    else { for(const [k,label] of FIELDS){ if(!sameValue(k,m[k],c[k])) issues.push({status:'MISMATCH',key:k,label,xlsm:m[k],csv:c[k]}); } }
    const allowed=Boolean(m)&&issues.length===0;
    players.push({name,master:m,csv:c?Object.fromEntries(FIELDS.map(([k])=>[k,c[k]])):null,csvRows:c?.rows||0,allowed,issues});
  }
  const blocked=players.filter(p=>!p.allowed&&!(!p.csv&&p.master&&isZeroMaster(p.master)));
  const teamWideAllowed=csv.missing.length===0&&blocked.length===0;
  return {
    auditVersion:'fielding-csv-consistency-v2-xlsm-internal-recalc', season:s.key, seasonLabel:s.label,
    authoritativeSource:{type:'XLSM_MASTER',name:mf.name,path:mf.path,sheet:master.sheetName},
    detailSource:{type:'CSV_DETAIL',name:cf.name,path:cf.path,encoding:decoded.encoding},
    xlsmInternalDetailRows:master.internalDetailRows,
    xlsmInternalDetailPlayerCount:master.internalDetailPlayerCount,
    xlsmCachedFormulaMismatchCount:master.cachedFormulaMismatches.length,
    xlsmCachedFormulaMismatches:master.cachedFormulaMismatches,
    csvRows:csv.dataRows,csvPlayerCount:csv.playerCount,masterPlayerCount:Object.keys(master.totals).length,missingColumns:csv.missing,
    players,blockedPlayerCount:blocked.length,teamWideAnalysisAllowed:teamWideAllowed,
    rule:teamWideAllowed?'FIELDING_DETAIL_TEAM_ANALYSIS_ALLOWED':'FIELDING_DETAIL_PARTIAL_OR_BLOCKED_XLSM_WINS',
    note:'XLSM正本を最優先。サーバー側ではExcel数式を再計算できないため、守備一覧の保存済みキャッシュ値ではなく、同じXLSM正本内の守備詳細をSUMIFS相当で再集計して正本値を復元する。CSVは照合専用で、正本を上書きしない。'
  };
}
