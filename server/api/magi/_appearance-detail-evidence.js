import { fetchDriveFileContent, listMagiDriveTree } from '../drive/_service.js';
import { CURRENT_ROSTER } from './_roster.js';

const CURRENT_TOKEN='2026-2027_CURRENT_現チーム';
const STATS_TOKEN='03_STATS_成績データ';
const DETAIL_TOKEN='10_DETAIL_詳細データ';
const APPEARANCE_TOKEN='APPEARANCE_出場詳細';
const FILE_NAME='出場詳細_2026-2027.csv';

function text(value){return String(value??'').trim();}
function norm(value){return text(value).normalize('NFKC').replace(/[\s　]+/g,'');}
function pick(row,names){for(const name of names){if(Object.prototype.hasOwnProperty.call(row,name))return text(row[name]);}return'';}
function gameNumber(value){const m=text(value).match(/(\d+)/);return m?Number(m[1]):0;}
function compactCounts(map){return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja')).map(([key,count])=>`${key}×${count}`).join(' / ');}

function decodeCsv(buffer){
  const utf8=Buffer.from(buffer).toString('utf8');
  if(!(utf8.match(/\uFFFD/g)||[]).length&&/選手名/.test(utf8))return utf8.replace(/^\uFEFF/,'');
  return new TextDecoder('shift_jis').decode(buffer).replace(/^\uFEFF/,'');
}
function parseCsv(source){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(ch==='"'){if(source[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=ch;continue;}
    if(ch==='"'){quoted=true;continue;}
    if(ch===','){row.push(cell);cell='';continue;}
    if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';continue;}
    cell+=ch;
  }
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=(rows.shift()||[]).map(text);
  return rows.filter(values=>values.some(v=>text(v))).map(values=>Object.fromEntries(header.map((key,index)=>[key,text(values[index])])));
}
function findFile(tree){
  const exact=(tree||[]).filter(file=>text(file?.name)===FILE_NAME);
  return exact.find(file=>{const path=text(file?.path);return path.includes(CURRENT_TOKEN)&&path.includes(STATS_TOKEN)&&path.includes(DETAIL_TOKEN)&&path.includes(APPEARANCE_TOKEN);})
    ||exact.find(file=>text(file?.path).includes(CURRENT_TOKEN))||exact[0]||null;
}
function rowFields(row){
  return {
    gameLabel:pick(row,['試合順','試合','試合番号']),
    date:pick(row,['対戦日','開催日','日付']),
    opponent:pick(row,['相手','相手校','対戦相手']),
    battingOrder:pick(row,['打順']),
    position:pick(row,['守備位置','守備']),
    player:pick(row,['選手名','選手'])
  };
}
function gameKey(fields){return `${fields.gameLabel}|${fields.date}|${fields.opponent}`;}
function aggregate(name,rows){
  const mine=rows.map(rowFields).filter(row=>norm(row.player)===norm(name));
  const positionCounts=new Map(),battingOrderCounts=new Map();
  const starts=new Set(),substitutions=new Set(),appearances=new Set(),regularStarts=new Set(),challengeStarts=new Set();
  for(const row of mine){
    const key=gameKey(row);const no=gameNumber(row.gameLabel);
    const hasPosition=Boolean(row.position);const isOrder=/^[1-9１-９]$/.test(row.battingOrder);const pitcherOrder=/^P$/i.test(row.battingOrder);
    const isStarter=isOrder||pitcherOrder;
    const appeared=hasPosition||isStarter;
    if(!appeared)continue;
    appearances.add(key);
    if(isStarter){starts.add(key);if(no%2===1)regularStarts.add(key);else if(no>0)challengeStarts.add(key);}
    else substitutions.add(key);
    if(hasPosition)positionCounts.set(row.position,(positionCounts.get(row.position)||0)+1);
    if(isOrder)battingOrderCounts.set(row.battingOrder,(battingOrderCounts.get(row.battingOrder)||0)+1);
  }
  return {
    name,
    appearances:appearances.size,
    starts:starts.size,
    substitutions:substitutions.size,
    regularStarts:regularStarts.size,
    challengeStarts:challengeStarts.size,
    positions:Object.fromEntries(positionCounts),
    battingOrders:Object.fromEntries(battingOrderCounts),
    positionSummary:compactCounts(positionCounts)||'記録なし',
    battingOrderSummary:compactCounts(battingOrderCounts)||'記録なし'
  };
}
function playerLine(player){
  return `${player.name}：出場 ${player.appearances} / スタメン ${player.starts} / 途中出場 ${player.substitutions} / 奇数試合スタメン ${player.regularStarts} / 偶数試合スタメン ${player.challengeStarts} / 守備 ${player.positionSummary} / 打順 ${player.battingOrderSummary}`;
}

export async function buildAppearanceDetailEvidence(){
  const tree=await listMagiDriveTree({maxItems:2000,maxDepth:12});
  const file=findFile(tree);
  if(!file)throw new Error(`${FILE_NAME} がDrive内に見つかりません`);
  const fetched=await fetchDriveFileContent(file);
  const rows=parseCsv(decodeCsv(fetched.buffer));
  const normalizedRows=rows.filter(row=>text(rowFields(row).player));
  if(!normalizedRows.length)throw new Error(`${FILE_NAME} に選手データがありません`);
  const players=CURRENT_ROSTER.map(name=>aggregate(name,normalizedRows));
  const games=new Map();
  normalizedRows.map(rowFields).forEach(row=>{const no=gameNumber(row.gameLabel);if(no>0)games.set(gameKey(row),{number:no,label:row.gameLabel,date:row.date,opponent:row.opponent});});
  const gameList=[...games.values()].sort((a,b)=>a.number-b.number);
  return {
    status:'COMPLETE',
    source:{id:file.id,name:file.name,path:file.path,mimeType:file.mimeType,modifiedTime:file.modifiedTime,season:'current',priority:'APPEARANCE_PRIMARY'},
    gameCount:gameList.length,
    games:gameList,
    players,
    text:[
      '【出場詳細CSV・起用実績】',
      `参照：${FILE_NAME} / 記録試合 ${gameList.length}試合`,
      '判定ルール：試合順番号の奇数＝第1試合（公式戦を見据えたレギュラー起用）、偶数＝第2試合（チャレンジ・テスト起用）として分ける。スタメン／途中出場、実際の守備位置、実際の打順を起用判断の最優先データとして扱う。',
      ...players.map(playerLine)
    ].join('\n'),
    rule:'出場詳細_2026-2027.csvを守備配置・起用判断の最優先記録として使用する。奇数試合と偶数試合を混同せず、実際のスタメン・途中出場・守備位置・打順を確認する。'
  };
}
