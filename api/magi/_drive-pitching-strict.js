import * as XLSX from 'xlsx';
import { getCache } from '@vercel/functions';
import { fetchDriveFileContent, getDriveFileMetadata, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER, OFFICIAL_PLAYER_REGISTRY } from './_roster.js';

const STATS_TOKEN = '03_STATS_成績データ';
const MASTER_TOKEN = '00_MASTER_正本';
const HOT_TTL_SECONDS = 60 * 5;
const CURRENT_MASTER_FILE_ID = process.env.MAGI_CURRENT_MASTER_FILE_ID || '11ABgSFKN-9Bhde1hJ_n-Qytz0cuImM0E';

const SEASONS = {
  current: { key:'current', label:'2026-2027現チーム', token:'2026-2027_CURRENT_現チーム' },
  old: { key:'old', label:'2025-2026旧チーム', token:'2025-2026_ARCHIVE_旧チーム' }
};

const FIELDS = {
  ERA:['防御率'], APP:['登板数','登板'], IP:['投球回数','投球回'],
  W:['勝利','勝'], L:['敗北','敗'], SV:['セーブ'],
  H:['被安打'], R:['失点'], ER:['自責点'], WP:['暴投'],
  BB:['与四球'], HBP:['与死球'], SO:['奪三振'], WHIP:['WHIP'], BAA:['被打率'], HR:['被本塁打','被本塁']
};

function norm(v){ return String(v ?? '').replace(/[\s　\r\n]+/g,'').trim(); }
function display(v){
  const s=String(v ?? '').trim();
  if(!s) return '';
  const n=Number(s.replace(/,/g,''));
  if(!Number.isFinite(n)) return s;
  if(Math.abs(n)<1 && n!==0){
    const decimals=(s.match(/\.(\d+)/)?.[1]?.length || 3);
    return n.toFixed(Math.max(1,Math.min(decimals,3))).replace(/^0/,'').replace(/-0\./,'-.');
  }
  return s.replace(/,/g,'');
}
function num(v){ const n=Number(String(v ?? '').replace(/,/g,'').trim()); return Number.isFinite(n)?n:null; }

function allRows(buffer){
  const wb=XLSX.read(buffer,{type:'buffer',cellFormula:true,cellText:true,cellDates:false});
  return wb.SheetNames.map(sheetName=>({
    sheetName,
    rows:XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:false,defval:''})
      .map(r=>Array.isArray(r)?r.map(v=>String(v ?? '').trim()):[])
  }));
}

function exactIndex(row, aliases){
  for(const a of aliases){ const i=row.findIndex(c=>norm(c)===norm(a)); if(i>=0) return i; }
  return -1;
}
function aliasIndex(row, aliases){
  const exact=exactIndex(row,aliases); if(exact>=0) return exact;
  for(const a of aliases){ const i=row.findIndex(c=>norm(c).includes(norm(a))); if(i>=0) return i; }
  return -1;
}
function headerScore(row){
  const markers=['防御率','登板数','投球回','被安打','失点','自責点','与四球','奪三振'];
  return markers.filter(m=>aliasIndex(row,[m])>=0).length;
}
function isPitchingHeader(row){
  const nameCol=exactIndex(row,['投手名','選手名']);
  return nameCol>=0 && headerScore(row)>=5 && aliasIndex(row,['防御率'])>=0 && aliasIndex(row,['投球回数','投球回'])>=0 && aliasIndex(row,['奪三振'])>=0;
}
function readFields(header,row){
  const out={};
  for(const [key,aliases] of Object.entries(FIELDS)){
    const col=aliasIndex(header,aliases); if(col<0) continue;
    const raw=String(row[col] ?? '').trim(); if(!raw) continue;
    out[key]=display(raw);
  }
  return out;
}
function contextText(rows,h,sheetName){
  const start=Math.max(0,h-8);
  return `${sheetName} ${rows.slice(start,h+1).flat().join(' ')}`;
}
function contextRank(text){
  let score=0;
  if(/投手部門|通算成績|成績一覧|個人成績/.test(text)) score+=100;
  if(/起用法|捕手別|先発別|リリーフ別|試合別|登板別|対戦別|月別|日別/.test(text)) score-=120;
  return score;
}

function findCandidates(sheets,playerName){
  const target=norm(playerName);
  const candidates=[];
  for(const {sheetName,rows} of sheets){
    for(let h=0;h<rows.length;h++){
      const header=rows[h]||[];
      if(!isPitchingHeader(header)) continue;
      const nameCol=exactIndex(header,['投手名','選手名']);
      const ctx=contextText(rows,h,sheetName);
      const rank=contextRank(ctx);
      const completeness=headerScore(header);
      for(let i=h+1;i<Math.min(rows.length,h+100);i++){
        const row=rows[i]||[];
        if(i>h+1 && isPitchingHeader(row)) break;
        const name=norm(row[nameCol]);
        if(!name || name!==target) continue;
        const stats=readFields(header,row);
        if(!stats.ERA && !stats.IP && !stats.SO) continue;
        candidates.push({sheetName,headerRow:h+1,row:i+1,stats,rank,completeness,ip:num(stats.IP),context:ctx});
      }
    }
  }
  return candidates;
}

function chooseAggregate(candidates){
  if(!candidates.length) return null;
  return [...candidates].sort((a,b)=>{
    if(b.rank!==a.rank) return b.rank-a.rank;
    const bip=b.ip ?? -1, aip=a.ip ?? -1;
    if(bip!==aip) return bip-aip;
    if(b.completeness!==a.completeness) return b.completeness-a.completeness;
    return a.row-b.row;
  })[0];
}

function resolveSeason(value){
  const k=String(value||'current').toLowerCase();
  return k==='old'||k==='2025-2026'?SEASONS.old:SEASONS.current;
}
function isAuthoritativeXlsm(file,season){
  const name=String(file?.name||''), path=String(file?.path||'');
  return /\.xlsm$/i.test(name)&&path.includes(season.token)&&path.includes(STATS_TOKEN)&&path.includes(MASTER_TOKEN);
}
function rosterForSeason(season){ return season.key==='current' ? CURRENT_ROSTER : OFFICIAL_PLAYER_REGISTRY; }

async function cacheGet(key){
  try{return (await getCache().get(key))||null}catch(e){console.warn('[MAGI strict pitching cache read]',e?.message||e);return null}
}
async function cacheSet(key,value){
  try{await getCache().set(key,value,{ttl:HOT_TTL_SECONDS,tags:['magi-strict-pitching-hot-v2']})}catch(e){console.warn('[MAGI strict pitching cache write]',e?.message||e)}
}

async function resolveMasterFile(season){
  if(season.key==='current' && CURRENT_MASTER_FILE_ID){
    try{
      const meta=await getDriveFileMetadata(CURRENT_MASTER_FILE_ID);
      return {...meta,path:`20_TEAM_DATA_チームデータ/${season.token}/${STATS_TOKEN}/${MASTER_TOKEN}/${meta.name}`};
    }catch(e){console.warn('[MAGI strict pitching current metadata fallback]',e?.message||e)}
  }
  const tree=await listMagiDriveTree({fresh:true});
  const candidates=tree.filter(f=>isAuthoritativeXlsm(f,season));
  if(candidates.length!==1) throw new Error(`${season.label}の00_MASTER_正本XLSMを一意に特定できませんでした (${candidates.length})`);
  return candidates[0];
}

function buildSeasonPitchingSnapshot(sheets,season){
  const byName={};
  for(const name of rosterForSeason(season)){
    const all=findCandidates(sheets,name);
    const chosen=chooseAggregate(all);
    if(!chosen) continue;
    byName[name]={
      stats:chosen.stats,
      chosen:{sheetName:chosen.sheetName,row:chosen.row,headerRow:chosen.headerRow,rank:chosen.rank,ip:chosen.ip,completeness:chosen.completeness},
      candidateCount:all.length
    };
  }
  return byName;
}

export async function runStrictPitchingAudit({season:seasonValue='current',playerName}={}){
  const season=resolveSeason(seasonValue);
  if(!playerName) throw new Error('playerName is required');
  const hotKey=`magi:strict-pitching:hot:v2:${season.key}`;
  const hot=await cacheGet(hotKey);
  const hotPlayer=hot?.byName?.[playerName];
  if(hotPlayer){
    return {
      live:true,season:season.key,seasonLabel:season.label,parser:'strict-pitching-xlsx-v1',
      source:hot.source,playerName,stats:hotPlayer.stats,chosen:hotPlayer.chosen,candidateCount:hotPlayer.candidateCount,
      cacheHit:true,hotCacheHit:true
    };
  }

  const file=await resolveMasterFile(season);
  const fetched=await fetchDriveFileContent(file);
  const sheets=allRows(fetched.buffer);
  const byName=buildSeasonPitchingSnapshot(sheets,season);
  const source={id:file.id,name:file.name,path:file.path,modifiedTime:file.modifiedTime,size:file.size||fetched.buffer.length};
  await cacheSet(hotKey,{source,byName,cachedAt:new Date().toISOString()});

  const selected=byName[playerName];
  if(!selected) throw new Error(`${playerName}の${season.label}投手通算行をXLSM正本から特定できませんでした`);
  return {
    live:true,
    season:season.key,
    seasonLabel:season.label,
    parser:'strict-pitching-xlsx-v1',
    source,
    playerName,
    stats:selected.stats,
    chosen:selected.chosen,
    candidateCount:selected.candidateCount,
    cacheHit:false,
    hotCacheHit:false
  };
}
