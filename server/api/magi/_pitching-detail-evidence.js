import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';
import { decodeCsv, parseCsv } from './_recent-batting-form.js';

const STATS_TOKEN='03_STATS_成績データ';
const DETAIL_TOKEN='10_DETAIL_詳細データ';
const CONFIG={
  current:{token:'2026-2027_CURRENT_現チーム',names:['投手詳細2026-2027.csv','投手詳細.csv']},
  old:{token:'2025-2026_ARCHIVE_旧チーム',names:['投手詳細2025-2026.csv','投手詳細.csv']}
};
const text=v=>String(v??'').trim();
const num=v=>{const n=Number(text(v).replace(/,/g,''));return Number.isFinite(n)?n:0};
function findFile(tree,season){
  const cfg=CONFIG[season]||CONFIG.current;
  const candidates=(tree||[]).filter(f=>cfg.names.includes(text(f?.name)));
  return candidates.find(f=>{const p=text(f?.path);return p.includes(cfg.token)&&p.includes(STATS_TOKEN)&&p.includes(DETAIL_TOKEN)})
    ||candidates.find(f=>text(f?.path).includes(cfg.token))||null;
}
function inningsOuts(value){
  const s=text(value); if(!s)return 0;
  const m=s.match(/^(\d+)(?:[\.．](\d))?$/); if(!m)return Math.round(num(s)*3);
  const whole=Number(m[1]), frac=Number(m[2]||0);
  return whole*3+(frac===1?1:frac===2?2:0);
}
function fmtInnings(outs){return outs%3?\`${Math.floor(outs/3)}.${outs%3}\`:String(Math.floor(outs/3))}
function pick(row,names){for(const n of names){if(text(row[n])!=='')return row[n]}return ''}
function aggregate(name,rows){
  const mine=rows.filter(r=>text(r['選手名'])===name);
  if(!mine.length)return null;
  let APP=0,outs=0,H=0,R=0,ER=0,BB=0,SO=0,HR=0,WP=0;
  for(const r of mine){
    APP+=num(pick(r,['登板数','登板']))||1;
    outs+=inningsOuts(pick(r,['投球回','投球回数','IP']));
    H+=num(pick(r,['被安打'])); R+=num(pick(r,['失点'])); ER+=num(pick(r,['自責点']));
    BB+=num(pick(r,['与四球','四球'])); SO+=num(pick(r,['奪三振'])); HR+=num(pick(r,['被本塁打','被本塁'])); WP+=num(pick(r,['暴投']));
  }
  const ip=outs/3, era=outs?ER*7/ip:null, whip=outs?(BB+H)/ip:null, k9=outs?SO*9/ip:null;
  return {APP:String(APP),IP:fmtInnings(outs),H:String(H),R:String(R),ER:String(ER),BB:String(BB),SO:String(SO),HR:String(HR),WP:String(WP),ERA:era===null?'':era.toFixed(2),WHIP:whip===null?'':whip.toFixed(2),K9:k9===null?'':k9.toFixed(2)};
}
export async function buildPitchingDetailEvidence(season='current'){
  const key=season==='old'?'old':'current', tree=await listMagiDriveTree({maxItems:2000,maxDepth:12}), file=findFile(tree,key);
  if(!file)throw new Error(\`${CONFIG[key].names[0]} がDrive内に見つかりません\`);
  const fetched=await fetchDriveFileContent(file);
  const rows=parseCsv(decodeCsv(fetched.buffer)).filter(r=>text(r['選手名']));
  const players=CURRENT_ROSTER.map(name=>({name,pitching:aggregate(name,rows)}));
  return {status:'COMPLETE',season:key,source:{id:file.id,name:file.name,path:file.path,mimeType:file.mimeType,modifiedTime:file.modifiedTime},players,
    experiencedPlayers:players.filter(p=>p.pitching).map(p=>p.name),
    rule:'投手経験の有無は投手詳細CSVに本人の投球行が存在することだけで確定する。捕手記録・守備記録・通算XLSMの特殊配置から投手経験を推測しない。防御率は7イニング換算（自責点×7÷投球回）、奪三振率K/9は9イニング換算（奪三振×9÷投球回）、WHIPは（被安打＋与四球）÷投球回で、投手詳細CSVから再計算する。'};
}