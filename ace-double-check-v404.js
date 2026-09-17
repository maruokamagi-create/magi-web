(()=>{
'use strict';
if(window.MAGI_ACE_DOUBLE_CHECK_V404)return;
window.MAGI_ACE_DOUBLE_CHECK_V404=true;

const ACE_RE=/(?:現在の)?エース(?:候補|は誰|を選|を決|として|適任)/;
const EXCLUDED='大野 竜暉';
const PITCHERS=['橋向 結都','大久保 陽翔','大久保 夢翔','中嶋 玲月','坂田 暉馬','大野 竜暉'];
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).normalize('NFKC').replace(/[\s　・･_\-\/()（）\[\]【】]/g,'').toLowerCase();
const canonical=new Map(PITCHERS.map(n=>[norm(n),n]));
const cname=v=>canonical.get(norm(v))||'';
const num=v=>{const s=txt(v).replace(/,/g,'').replace(/%$/,'');if(!s||s==='-'||s==='—')return null;const n=Number(s);return Number.isFinite(n)?n:null};
const int=v=>{const n=num(v);return n===null?null:Math.trunc(n)};
const inningsToOuts=v=>{const m=txt(v).replace(/回$/,'').match(/^(\d+)(?:\.(\d))?$/);if(!m)return null;const rem=Number(m[2]||0);return rem<=2?Number(m[1])*3+rem:null};
const fmtInnings=o=>`${Math.floor(o/3)}.${o%3}`;
const sameSeason=f=>norm(`${f?.name||''} ${f?.path||''}`).includes('20262027');
const isWorkbookFile=f=>sameSeason(f)&&/通算成績一覧/i.test(txt(f?.name))&&/\.(?:xlsm|xlsx|xls)$/i.test(txt(f?.name));
const isPitchCsv=f=>sameSeason(f)&&/投手(?:成績|詳細)/i.test(`${f?.name||''} ${f?.path||''}`)&&/\.csv$/i.test(txt(f?.name));
const plainJson=data=>new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const jsonResponse=(base,data)=>{const h=new Headers(base?.headers||{});h.set('content-type','application/json; charset=utf-8');h.delete('content-length');h.delete('content-encoding');return new Response(JSON.stringify(data),{status:base?.status||200,statusText:base?.statusText||'OK',headers:h});};

const HEADER_ALIASES={
 pitcher:['投手名','選手名','選手'],catcher:['捕手名'],era:['防御率'],games:['登板数','登板'],innings:['投球回','投球回数'],
 win:['勝利','勝'],loss:['敗北','敗'],save:['セーブ'],batters:['対打者'],pitches:['投球数'],strikes:['ストライク'],balls:['ボール'],
 strikeRate:['ストライク率'],hits:['被安打'],runs:['失点'],earned:['自責点'],wildPitches:['暴投'],walks:['与四球'],hbp:['与死球'],walksHbp:['与四死球','四死球'],strikeouts:['奪三振'],kRate:['奪三振率'],
 date:['開催日','日付','試合日'],opponent:['相手校','対戦相手','相手'],gameNo:['試合番号','ゲーム番号','試合No','試合NO','第何試合']
};
function findHeaderIndex(row,aliases){const cells=(row||[]).map(norm);for(let i=0;i<cells.length;i++)if(aliases.some(a=>cells[i]===norm(a)))return i;for(let i=0;i<cells.length;i++)if(aliases.some(a=>norm(a)&&cells[i].includes(norm(a))))return i;return-1;}
function headerMap(row){const out={};for(const [k,a] of Object.entries(HEADER_ALIASES))out[k]=findHeaderIndex(row,a);return out;}
function headerScore(m){return ['pitcher','era','games','innings','earned','strikeouts'].filter(k=>m[k]>=0).length;}
function cell(row,i){return i>=0?txt((row||[])[i]):'';}
function statFromRow(row,m){
 const innings=cell(row,m.innings),outs=inningsToOuts(innings),eraN=num(cell(row,m.era));
 return {games:int(cell(row,m.games))??0,outs:outs??0,innings:outs===null?innings:fmtInnings(outs),era:eraN===null?'取得不能':eraN.toFixed(2),
  win:int(cell(row,m.win))??0,loss:int(cell(row,m.loss))??0,save:int(cell(row,m.save))??0,batters:int(cell(row,m.batters))??0,pitches:int(cell(row,m.pitches))??0,
  strikes:int(cell(row,m.strikes))??0,balls:int(cell(row,m.balls))??0,strikeRate:cell(row,m.strikeRate),hits:int(cell(row,m.hits))??0,runs:int(cell(row,m.runs))??0,
  earned:int(cell(row,m.earned))??0,wildPitches:int(cell(row,m.wildPitches))??0,walks:int(cell(row,m.walks))??0,hbp:int(cell(row,m.hbp))??0,
  walksHbp:m.walksHbp>=0?(int(cell(row,m.walksHbp))??0):((int(cell(row,m.walks))??0)+(int(cell(row,m.hbp))??0)),strikeouts:int(cell(row,m.strikeouts))??0,kRate:cell(row,m.kRate)};
}
function parsePitcherSection(rows,sheetName,markerIndex){
 let hi=-1,map=null;
 for(let i=markerIndex+1;i<Math.min(rows.length,markerIndex+14);i++){const m=headerMap(rows[i]);if(m.pitcher>=0&&m.era>=0&&m.innings>=0&&headerScore(m)>=4){hi=i;map=m;break;}}
 if(hi<0||!map)return null;
 const stats={};
 for(let i=hi+1;i<rows.length;i++){
  const row=rows[i],joined=(row||[]).map(txt).join(' '),first=(row||[]).map(txt).find(Boolean)||'';
  if(/捕手部門/.test(joined))break;
  if(/^(?:総計|合計|計)$/.test(first))break;
  const p=cname(cell(row,map.pitcher));if(!p)continue;
  const catcher=map.catcher>=0?cell(row,map.catcher):'';if(catcher)continue;
  const s=statFromRow(row,map);if(!s.outs)continue;
  if(stats[p])throw new Error(`投手部門の同一セクション内で${p}の総合行が重複しています`);
  stats[p]=s;
 }
 const names=Object.keys(stats),score=names.filter(n=>PITCHERS.includes(n)).length;
 return score?{sheetName,markerIndex,headerIndex:hi,map,stats,score}:null;
}
function workbookPitcherStats(buffer){
 if(!window.XLSX)throw new Error('Excel読込ライブラリを利用できません');
 const wb=XLSX.read(buffer,{type:'array'}),sections=[];
 for(const sheetName of wb.SheetNames){
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});
  for(let i=0;i<rows.length;i++){
   const joined=(rows[i]||[]).map(txt).join(' ');
   if(!/投手部門/.test(joined)||/捕手部門/.test(joined))continue;
   const section=parsePitcherSection(rows,sheetName,i);if(section)sections.push(section);
  }
 }
 if(!sections.length)throw new Error('通算成績一覧の【投手部門】を特定できません');
 sections.sort((a,b)=>b.score-a.score||(/通算|総合/.test(b.sheetName)?1:0)-(/通算|総合/.test(a.sheetName)?1:0)||a.markerIndex-b.markerIndex);
 const best=sections[0];
 if(best.score<5)throw new Error(`投手部門から現チーム投手を十分に取得できません（${best.score}名）`);
 return {stats:best.stats,source:{sheetName:best.sheetName,markerIndex:best.markerIndex+1,headerIndex:best.headerIndex+1,detectedPitchers:Object.keys(best.stats)}};
}

function parseCsv(text){const rows=[];let row=[],v='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){v+='"';i++;continue}if(c==='"'){q=false;continue}v+=c;continue}if(c==='"'){q=true;continue}if(c===','){row.push(v);v='';continue}if(c==='\n'){row.push(v.replace(/\r$/,''));if(row.some(x=>txt(x)))rows.push(row);row=[];v='';continue}v+=c}row.push(v.replace(/\r$/,''));if(row.some(x=>txt(x)))rows.push(row);return rows;}
function flagValue(v,type){const n=int(v);if(n!==null)return n;const s=txt(v);if(!s)return 0;if(type==='win'&&/(?:勝|○|W)/i.test(s))return 1;if(type==='loss'&&/(?:敗|●|L)/i.test(s))return 1;if(type==='save'&&/(?:S|セーブ)/i.test(s))return 1;return 0;}
function csvPitcherStats(text){
 const rows=parseCsv(text);let hi=-1,map=null;
 for(let i=0;i<Math.min(rows.length,40);i++){const m=headerMap(rows[i]);if(m.pitcher>=0&&m.innings>=0&&m.earned>=0&&m.strikeouts>=0){hi=i;map=m;break;}}
 if(hi<0||!map)throw new Error('投手成績CSVの正式ヘッダー（投手名・投球回・自責点・奪三振）を特定できません');
 const out={},gameKeys={};
 const ensure=p=>out[p]||(out[p]={games:0,outs:0,win:0,loss:0,save:0,batters:0,pitches:0,strikes:0,balls:0,hits:0,runs:0,earned:0,wildPitches:0,walks:0,hbp:0,walksHbp:0,strikeouts:0,_rows:0});
 for(let i=hi+1;i<rows.length;i++){
  const row=rows[i],p=cname(cell(row,map.pitcher));if(!p)continue;
  const o=inningsToOuts(cell(row,map.innings));if(o===null)continue;
  const s=ensure(p);s._rows++;s.outs+=o;
  const keyParts=[cell(row,map.date),cell(row,map.opponent),cell(row,map.gameNo)].filter(Boolean);const key=keyParts.length?keyParts.join('|'):`row:${i}`;
  gameKeys[p]??=new Set();gameKeys[p].add(key);
  s.win+=flagValue(cell(row,map.win),'win');s.loss+=flagValue(cell(row,map.loss),'loss');s.save+=flagValue(cell(row,map.save),'save');
  for(const k of ['batters','pitches','strikes','balls','hits','runs','earned','wildPitches','walks','hbp','strikeouts'])if(map[k]>=0)s[k]+=int(cell(row,map[k]))??0;
  if(map.walksHbp>=0)s.walksHbp+=int(cell(row,map.walksHbp))??0;
 }
 for(const [p,s] of Object.entries(out)){
  s.games=gameKeys[p]?.size||s._rows;if(map.walksHbp<0)s.walksHbp=s.walks+s.hbp;s.innings=fmtInnings(s.outs);s.era=s.outs>0?(s.earned*21/s.outs).toFixed(2):'取得不能';delete s._rows;
 }
 return {stats:out,map,headerRow:hi+1};
}
function decodeBuffer(buffer){if(typeof window.MAGI_DECODE_TEXT_SMART==='function')return window.MAGI_DECODE_TEXT_SMART(buffer);try{return new TextDecoder('utf-8',{fatal:false}).decode(buffer)}catch(_){return''}}
function findSources(files){const workbook=files.find(isWorkbookFile)||null;let csv=files.filter(isPitchCsv).sort((a,b)=>{const aa=/投手成績/i.test(txt(a?.name))?0:1,bb=/投手成績/i.test(txt(b?.name))?0:1;return aa-bb;})[0]||null;return{workbook,csv};}
async function getIndex(baseFetch){const r=await baseFetch('/api/drive/index',{cache:'no-store',credentials:'same-origin'});const d=await r.json().catch(()=>({}));if(!r.ok||!d?.configured)throw new Error('Google Driveの目次を取得できません');return Array.isArray(d.files)?d.files:[];}
async function fetchBinary(baseFetch,file){const r=await baseFetch(`/api/drive/file?id=${encodeURIComponent(file.id)}`,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error(`${file.name} を取得できません (${r.status})`);return await r.arrayBuffer();}
function compareStats(work,csv,csvMap,names){
 const errors=[];const checks=[['outs','投球回'],['earned','自責点'],['strikeouts','奪三振']];
 if(csvMap.hits>=0)checks.push(['hits','被安打']);if(csvMap.runs>=0)checks.push(['runs','失点']);if(csvMap.pitches>=0)checks.push(['pitches','投球数']);
 if(csvMap.win>=0)checks.push(['win','勝利']);if(csvMap.loss>=0)checks.push(['loss','敗北']);if(csvMap.save>=0)checks.push(['save','セーブ']);
 if(csvMap.walksHbp>=0)checks.push(['walksHbp','四死球']);else if(csvMap.walks>=0&&csvMap.hbp>=0){checks.push(['walks','与四球'],['hbp','与死球']);}
 for(const p of names){const w=work[p],c=csv[p];if(!w){errors.push(`${p}: 通算成績一覧の投手総合行なし`);continue}if(!c){errors.push(`${p}: 投手成績CSVの登板記録なし`);continue}if(w.era!==c.era)errors.push(`${p} 防御率: 通算${w.era} / CSV再集計${c.era}`);for(const [k,label] of checks){if(String(w[k])!==String(c[k]))errors.push(`${p} ${label}: 通算${k==='outs'?w.innings:w[k]} / CSV再集計${k==='outs'?c.innings:c[k]}`);}}
 return {errors,checked:['防御率',...checks.map(x=>x[1])]};
}
function buildPacket(work,csv,workbook,csvFile,verified,workSource,csvHeaderRow){
 const names=PITCHERS.filter(p=>p!==EXCLUDED&&work[p]&&csv[p]);const totals={};for(const p of names)totals[p]={'2026-2027':{...csv[p]}};if(work[EXCLUDED]&&csv[EXCLUDED])totals[EXCLUDED]={'2026-2027':{...csv[EXCLUDED]}};
 const lines=['【エース候補比較専用 EVIDENCE｜二重照合済】',`【照合元A】${workbook.name}／${workSource.sheetName}／【投手部門】`,`【照合元B】${csvFile.name} を登板記録から再集計`,`【照合項目】${verified.checked.join('・')}`,'【照合結果】Excel投手総合行とCSV再集計値が一致。',`【候補除外】${EXCLUDED}は正捕手として運用するためエース候補から除外。`,`【比較対象】${names.join('・')}`];
 for(const p of names){const s=csv[p];lines.push(`【${p}】防御率=${s.era}｜登板=${s.games}｜投球回=${s.innings}｜${s.win}勝${s.loss}敗｜セーブ=${s.save}｜奪三振=${s.strikeouts}｜四死球=${s.walksHbp}｜被安打=${s.hits}｜失点=${s.runs}｜自責点=${s.earned}`);}
 lines.push('数値はExcel原本と投手成績CSVの二重照合で一致したものだけを審議根拠に使用する。');
 return {count:names.length,files:[workbook.name,csvFile.name],seasons:['2026-2027'],players:names,evidenceLayers:['DOUBLE CHECK VERIFIED','CANONICAL PITCHER SECTION ONLY','PITCHING CSV REAGGREGATION','2026-2027 CURRENT'],missingEvidence:[],canonicalPitchingTotals:totals,verification:{status:'VERIFIED',workbook:workbook.name,workbookSheet:workSource.sheetName,workbookPitcherSectionRow:workSource.markerIndex,csv:csvFile.name,csvHeaderRow,checkedMetrics:verified.checked},summary:`${workbook.name}【投手部門】と${csvFile.name}を二重照合し、候補${names.length}名の投手成績一致を確認。`,text:lines.join('\n')};
}
async function buildVerified(baseFetch){
 const files=await getIndex(baseFetch),{workbook,csv}=findSources(files);if(!workbook)return{ok:false,message:'エース審議を停止しました。通算成績一覧2026-2027のExcel原本を取得できません。'};if(!csv)return{ok:false,message:'エース審議を停止しました。2026-2027の投手成績CSV／投手詳細CSVを取得できません。'};
 const [wbBuf,csvBuf]=await Promise.all([fetchBinary(baseFetch,workbook),fetchBinary(baseFetch,csv)]);const wb=workbookPitcherStats(wbBuf),parsed=csvPitcherStats(decodeBuffer(csvBuf));
 const names=PITCHERS.filter(p=>p!==EXCLUDED&&(wb.stats[p]||parsed.stats[p]));if(names.length<3)return{ok:false,message:'エース審議を停止しました。二重照合できる現チーム投手が不足しています。'};
 const verified=compareStats(wb.stats,parsed.stats,parsed.map,names);if(verified.errors.length)return{ok:false,message:`エース審議を停止しました。Excel投手部門と投手成績CSVの数値不一致を検出しました。\n${verified.errors.slice(0,10).join('\n')}${verified.errors.length>10?`\nほか${verified.errors.length-10}件`:''}`,details:verified.errors,files:[workbook.name,csv.name]};
 return {ok:true,packet:buildPacket(wb.stats,parsed.stats,workbook,csv,verified,wb.source,parsed.headerRow)};
}

const baseFetch=window.fetch.bind(window);const urlOf=input=>typeof input==='string'?input:txt(input?.url);const bodyOf=init=>{if(typeof init?.body!=='string')return null;try{return JSON.parse(init.body)}catch(_){return null}};
window.fetch=async function(input,init){const url=urlOf(input),body=bodyOf(init),question=txt(body?.question||body?.case?.question).normalize('NFKC');if(!/\/api\/magi\/core(?:\?|$)/.test(url)||!ACE_RE.test(question))return baseFetch(input,init);
 let verified;try{verified=await buildVerified(baseFetch)}catch(error){verified={ok:false,message:`エース審議を停止しました。投手成績の二重照合に失敗しました：${error?.message||error}`};}
 if(!verified.ok)return plainJson({handled:true,action:'CLARIFY',route:'CLARIFY',understoodRequest:'エース候補の投手成績を二重照合する',clarificationQuestion:verified.message,answer:verified.message,source:{name:'DATA HUB DOUBLE CHECK'}});
 const response=await baseFetch(input,init);if(!response.ok)return response;let data;try{data=await response.clone().json()}catch(_){return response}if(data&&typeof data==='object'&&(data.action==='DELIBERATE'||data.route==='DELIBERATION')){data.evidencePacket=verified.packet;data.selectionKind=data.selectionKind||'GENERIC';data.understoodRequest='Excel投手部門と投手成績CSVを二重照合し、現チームのエース第一候補を審議する';if(data.semantic&&typeof data.semantic==='object')data.semantic.evidenceSource='ACE_DOUBLE_CHECK_VERIFIED_V404';return jsonResponse(response,data)}return response;};
window.MAGI_ACE_DOUBLE_CHECK_V404_META=Object.freeze({version:'v404',workbookSection:'投手部門のみ',csvAggregation:true,failClosed:true,excludedCatcher:EXCLUDED});
})();