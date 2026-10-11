import { loadCanonicalTeamScoreTexts } from './_appearance-fielding-evidence.js';

// Score values are taken only from the two team-total cells in the registered,
// name-checked original PDF. Neither the per-inning glyphs nor player runs are
// an acceptable substitute for an unreadable final score.
const normalize=value=>String(value??'').normalize('NFKC').replace(/\r\n?/g,'\n');
const dateRe=/^\d{4}-\d{2}-\d{2}$/;
function validDate(s){
  if(!dateRe.test(String(s||'')))return false;
  const d=new Date(s+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function teamDateRangeFromQuestion(q){
  const t=normalize(q);
  const matches=[...t.matchAll(/(?:19|20)\d{2}年\s*\d{1,2}月\s*\d{1,2}日|(?:19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}/g)];
  if(matches.length!==2)return null;
  const dates=matches.map(m=>{
    const parts=m[0].match(/\d+/g);
    if(parts?.length!==3)return '';
    return parts[0]+'-'+parts[1].padStart(2,'0')+'-'+parts[2].padStart(2,'0');
  });
  if(!validDate(dates[0])||!validDate(dates[1])||dates[0]>dates[1])return null;
  return {from:dates[0],to:dates[1]};
}
export function extractCanonicalScoreTotal(body,def){
  const s=normalize(body);
  const scoreStart=s.indexOf('チーム名');
  if(scoreStart<0)throw Error('SCORE_TEAM_HEADER_MISSING');
  const scoreHeader=/8\s+9\s+10\s+11\s+12\s+合計/g;
  scoreHeader.lastIndex=scoreStart;
  const match=scoreHeader.exec(s);
  if(!match||match.index-scoreStart>500)throw Error('SCORE_TOTAL_HEADER_MISSING');
  const teams=s.slice(scoreStart+'チーム名'.length,match.index).replace(/\s/g,'');
  const maruoka=teams.indexOf('丸岡中');
  const opponentBase=String(def?.opponent||'').replace(/クラブ$/,'');
  const opponent=teams.indexOf(opponentBase);
  if(maruoka<0||opponent<0||maruoka===opponent)throw Error('SCORE_TEAM_IDENTITY_MISMATCH');
  const tail=s.slice(match.index+match[0].length);
  const notesAt=tail.indexOf('備考');
  if(notesAt<0||notesAt>50)throw Error('SCORE_TOTAL_END_MISSING');
  const scoreText=tail.slice(0,notesAt).trim();
  let values=scoreText.split(/\s+/).filter(Boolean);
  if(values.length===1&&/^\d{2}$/.test(values[0]))values=values[0].split('');
  if(values.length!==2||values.some(v=>!/^\d{1,2}$/.test(v)))throw Error('SCORE_TOTAL_AMBIGUOUS');
  const numbers=values.map(Number);
  if(numbers.some(v=>!Number.isInteger(v)||v<0||v>99))throw Error('SCORE_TOTAL_INVALID');
  const teamFirst=maruoka<opponent;
  const runs=teamFirst?numbers[0]:numbers[1];
  const allowed=teamFirst?numbers[1]:numbers[0];
  return {runs,allowed,outcome:runs>allowed?'勝':runs<allowed?'敗':'分'};
}
export function teamGameRangeFromOriginals(items,{from,to}){
  if(!validDate(from)||!validDate(to)||from>to)throw Error('INVALID_TEAM_DATE_RANGE');
  if(!Array.isArray(items))throw Error('MISSING_SCORE_ORIGINALS');
  const games=items.map(item=>{
    const def=item?.def||{},date=String(def.date||'');
    if(!validDate(date)||date<from||date>to)throw Error('SCORE_SOURCE_OUTSIDE_RANGE');
    if(!item?.file?.id||!item?.file?.name||!item?.body)throw Error('SCORE_ORIGINAL_MISSING');
    const score=extractCanonicalScoreTotal(item.body,def);
    return {date,opponent:String(def.opponent||''),category:String(def.category||''),
      game:String(def.label||def.stage||''),runs:score.runs,allowed:score.allowed,
      outcome:score.outcome,sourceName:item.file.name};
  });
  games.sort((a,b)=>a.date.localeCompare(b.date)||a.game.localeCompare(b.game,'ja'));
  const wins=games.filter(x=>x.outcome==='勝').length;
  const losses=games.filter(x=>x.outcome==='敗').length;
  const draws=games.filter(x=>x.outcome==='分').length;
  return {from,to,gameCount:games.length,wins,losses,draws,games,
    coverage:'現在MAGIに登録されている現チームのスコア原本15試合のうち、指定期間に該当する試合のみ'};
}
export async function loadTeamGameRange({from,to}){
  if(!validDate(from)||!validDate(to)||from>to)throw Error('INVALID_TEAM_DATE_RANGE');
  const texts=await loadCanonicalTeamScoreTexts({from,to});
  return teamGameRangeFromOriginals(texts,{from,to});
}
