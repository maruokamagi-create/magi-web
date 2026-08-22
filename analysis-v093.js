(()=>{
const _searchDataEvidence=searchDataEvidence;
const _melchior=melchior;
const _scanDrive=scanDrive;
const POSITIONS=['投手','捕手','一塁手','二塁手','三塁手','遊撃手','左翼手','中堅手','右翼手'];
const POS_ALIAS={'ピッチャー':'投手','キャッチャー':'捕手','ファースト':'一塁手','セカンド':'二塁手','サード':'三塁手','ショート':'遊撃手','レフト':'左翼手','センター':'中堅手','ライト':'右翼手'};
const normPos=v=>POS_ALIAS[String(v||'').trim()]||String(v||'').trim();
const countBy=rows=>{const m={};for(const r of rows)m[r.position]=(m[r.position]||0)+1;return m};
const ranked=m=>Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja'));
let pendingAutoRun='';
function positionPreferenceAnalysis(){
  const src=dataRecords.filter(r=>/希望ポジション/.test(r.fileName||''));
  if(!src.length)return null;
  const rows=[];
  for(const r of src){
    const v=(r.values||[]).map(x=>String(x??'').trim());
    const i=v.findIndex(x=>/^第[123]希望$/.test(x));
    if(i<1)continue;
    const player=v[i-1],rank=v[i],position=normPos(v[i+1]),reason=v[i+2]||'';
    if(!player||player==='選手名')continue;
    rows.push({player,rank,position,reason,fileName:r.fileName});
  }
  if(!rows.length)return null;
  const players=[...new Set(rows.map(r=>r.player))];
  const valid=rows.filter(r=>r.position&&r.position!=='なし'&&r.position!=='未定');
  const first=valid.filter(r=>r.rank==='第1希望');
  const firstCounts=countBy(first),allCounts=countBy(valid);
  const validByPlayer=new Map(players.map(p=>[p,valid.filter(r=>r.player===p)]));
  const noEntry=players.filter(p=>validByPlayer.get(p).length===0);
  const partial=players.filter(p=>{const n=validByPlayer.get(p).length;return n>0&&n<3});
  const firstSorted=ranked(firstCounts),allSorted=ranked(allCounts);
  const firstZero=POSITIONS.filter(p=>!firstCounts[p]);
  const totalValidPlayers=players.length-noEntry.length;
  const firstTop=firstSorted.slice(0,3).map(([p,n])=>`${p}${n}名`).join('・');
  const allTop=allSorted.slice(0,4).map(([p,n])=>`${p}${n}件`).join('・');
  const thin=allSorted.slice().reverse().filter(([p])=>POSITIONS.includes(p)).slice(0,3).map(([p,n])=>`${p}${n}件`).join('・');
  const cfFirst=first.filter(r=>r.position==='中堅手').map(r=>r.player);
  const summary=`一覧${players.length}名中、有効な希望ポジションがあるのは${totalValidPlayers}名。第1希望は${firstTop||'集計不能'}。全順位では${allTop||'集計不能'}に希望が集まっています。${firstZero.length?`第1希望0名は${firstZero.join('・')}。`:''}`;
  const concernParts=[];
  if((allCounts['二塁手']||0)>=5)concernParts.push(`二塁手は全順位で${allCounts['二塁手']}件と競合が大きい`);
  if((allCounts['投手']||0)>=5)concernParts.push(`投手も${allCounts['投手']}件あり、登板役割の整理が必要`);
  if((allCounts['中堅手']||0)<=1)concernParts.push(`中堅手は全順位でも${allCounts['中堅手']||0}件${cfFirst.length?`（第1希望：${cfFirst.join('・')}）`:''}で代替候補が薄い`);
  if((firstCounts['左翼手']||0)===0)concernParts.push('左翼手は第1希望が0名');
  if(noEntry.length)concernParts.push(`希望未入力は${noEntry.length}名（${noEntry.join('・')}）`);
  if(partial.length)concernParts.push(`3枠すべて埋まっていない選手は${partial.length}名`);
  return{rows,valid,players,firstCounts,allCounts,noEntry,partial,summary,concerns:concernParts.join('。')+'。',thin,sourceFile:src[0].fileName};
}
searchDataEvidence=function(q){
  const base=_searchDataEvidence(q);
  const pa=/希望ポジション|守備配置|守備位置|ポジション/.test(q)?positionPreferenceAnalysis():null;
  if(!pa)return base;
  if(base)return{...base,positionAnalysis:pa,summary:`${base.summary} 集計結果：${pa.summary}`};
  const text=pa.valid.slice(0,18).map(r=>`[${pa.sourceFile}] ${r.player} / ${r.rank} / ${r.position}${r.reason?' / '+r.reason:''}`).join('\n');
  return{count:pa.valid.length,files:[pa.sourceFile],summary:pa.summary,text,positionAnalysis:pa};
};
melchior=function(x,evidence){
  const p=_melchior(x,evidence),a=evidence&&evidence.positionAnalysis;
  if(!a)return p;
  p.vote='cond';p.conf=Math.max(p.conf,88);
  p.text=`希望データを集計すると、配置上の論点が具体化できます。${a.summary} 希望の集中と薄いポジションを分けて考える必要があります。`;
  p.basis=`${a.summary} ${a.thin?`全順位で薄い側は${a.thin}。`:''}`;
  p.concern=`${a.concerns} ただし「希望」は適性・守備力・実戦成績とは別のデータなので、希望だけで最終配置は決めません。`;
  return p;
};
renderEvidence=function(e){
  const box=$('dataEvidence');if(!e){box.classList.remove('show');box.textContent='';return}
  box.classList.add('show');
  const a=e.positionAnalysis?`\n\n【自動集計】\n${e.positionAnalysis.summary}\n【懸念】\n${e.positionAnalysis.concerns}`:'';
  box.innerHTML='<b>DATA HUB 関連データ</b>\n'+escapeHtml(e.text+a);
};
scanDrive=async function(){
  await _scanDrive();
  if(pendingAutoRun){
    const q=pendingAutoRun;pendingAutoRun='';$('q').value=q;updateRoute();
    setTimeout(()=>runMagi(),50);
  }
};
runMagi=function(){
  const q=$('q').value.trim();if(!q){$('status').textContent='相談内容を入力してください。';return}
  const route=routeQuestion(q);if(route.type==='advanced'){$('status').textContent='高度相談向けの内容です。引継ぎパネルを開きました。';openAdvanced();return}
  let evidence=searchDataEvidence(q);
  if(route.type==='data'&&!evidence){
    if(!driveToken){
      pendingAutoRun=q;
      $('status').textContent='DATA HUBの実データが必要です。Google Driveへ接続し、索引化完了後に自動で審議します。';
      connectDrive(false);
      return;
    }
    const ds=$('driveState').textContent||'';
    if(/読み込|索引化中|確認中|探索中|一覧化/.test(ds)&&!/自動索引化。/.test(ds)){
      pendingAutoRun=q;
      $('status').textContent='Google Driveを索引化中です。完了後に自動で審議します。';
      return;
    }
    $('status').textContent='DATA HUBに関連する実データを確認できませんでした。「参照なし」のまま審議は実行しません。Driveを再読込してから再実行してください。';
    $('datahub').scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  const x=analyze(q),m=melchior(x,evidence),b=balthasar(x),c=casper(x),a=evidence&&evidence.positionAnalysis;
  if(a){
    b.vote='cond';b.conf=Math.max(b.conf,84);b.text=`戦術面では、希望が多いポジションをそのまま固定するより、競合が大きい二塁手・投手は役割を分け、薄い外野中央などに第2候補を準備する方が安全です。`;
    b.basis=`${a.summary}`;b.concern=`希望順位は起用順位ではありません。実戦守備、送球、走力、投手・捕手との兼務負担を重ねて配置する必要があります。`;
    c.vote='cond';c.conf=Math.max(c.conf,82);c.text=`希望理由には「慣れている」「挑戦したい」「チームを助けたい」など異なる動機があります。希望を尊重しつつ、未入力や第3希望なしを消極性と決めつけない運用が必要です。`;
    c.basis=`希望未入力${a.noEntry.length}名、3枠未完${a.partial.length}名を確認。`;c.concern=`希望が少ないポジションへの配置は、本人への説明と納得を伴わないと意欲低下につながる可能性があります。`;
  }
  const f=finalDecision({m,b,c},x),meta=makeCaseMeta();
  renderEvidence(evidence);renderSignals(x,route,evidence);setPersona('m',m);setPersona('b',b);setPersona('c',c);
  $('v1').textContent='MELCHIOR '+V[m.vote];$('v2').textContent='BALTHASAR '+V[b.vote];$('v3').textContent='CASPER '+V[c.vote];$('verdict').textContent=FINAL[f.key];
  $('reason').textContent=`総合確度 ${f.avg}%｜${f.reason}`;
  $('next').textContent=a?'NEXT：希望ポジションに実戦成績・守備経験・走力・投手/捕手の兼務負担を重ね、各守備位置の第1候補・第2候補を作成します。':f.next;
  $('caseQuestion').textContent=q;const hub=evidence?`${evidence.count}件参照<br>参照ファイル：${escapeHtml(evidence.files.join('、'))}`:'参照なし';
  $('caseMeta').innerHTML=`審議日：${meta.date}<br>審議案件番号：${meta.number}<br>DATA HUB：${hub}`;
  $('status').textContent='MAGI SYSTEM 審議完了 — FREE CORE v0.9.4';$('response').classList.add('show');saveHistory(q,f.key);$('response').scrollIntoView({behavior:'smooth',block:'start'});
};
for(const el of document.querySelectorAll('.sectionHead span,.status'))if(/v0\.9\.[123]/.test(el.textContent))el.textContent=el.textContent.replace(/v0\.9\.[123]/g,'v0.9.4');
})();