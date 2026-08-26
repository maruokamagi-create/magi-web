(()=>{
  'use strict';
  const J={GREEN:{key:'yes',label:'賛成'},BLUE:{key:'cond',label:'条件付き賛成'},YELLOW:{key:'hold',label:'判断保留'},RED:{key:'no',label:'反対'}};
  const C={HIGH:'高',MEDIUM:'中',LOW:'低'};
  const names={melchior:'MELCHIOR',balthasar:'BALTHASAR',casper:'CASPER'};
  const esc=s=>escapeHtml(String(s??''));
  const list=v=>(Array.isArray(v)?v:[]).filter(Boolean);
  const join=v=>list(v).join('／')||'特記事項なし';
  const judgment=v=>J[String(v||'').toUpperCase()]||J.YELLOW;
  const button=()=>document.querySelector('button[onclick="runMagi()"]');

  const css=`
  .engineProtocol{background:#f7f9fc;color:#122039;padding:0 14px 14px}
  .protocolBlock{border:1px solid #d6dfe8;border-left:5px solid #4db8d8;border-radius:13px;background:#fff;padding:15px;margin-bottom:12px}
  .protocolHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
  .protocolTitle{font-size:14px;font-weight:900;letter-spacing:.08em}.protocolPhase{font-size:10px;color:#60758c;letter-spacing:.11em}
  .protocolText{font-size:13px;line-height:1.75;color:#27394d}.protocolText b{color:#102943}
  .protocolGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}
  .protocolMini{border:1px solid #dbe3eb;border-radius:10px;background:#f5f7fa;padding:10px;font-size:12px;line-height:1.65}
  .protocolMini b{display:block;margin-bottom:4px;font-size:10px;letter-spacing:.06em;color:#49627c}
  .engineError{margin-top:10px;border:1px solid #8c3942;border-left:4px solid #e04452;border-radius:10px;background:#31141a;color:#ffe2e5;padding:12px;font-size:13px;line-height:1.65}
  button.magiRunning{opacity:.65;cursor:wait}
  @media(max-width:720px){.protocolGrid{grid-template-columns:1fr}.protocolBlock{padding:13px}.protocolText{font-size:13px}}
  @media(min-width:900px){.engineProtocol{padding:0 14px 16px}.protocolBlock{padding:18px}.protocolTitle{font-size:16px}.protocolText{font-size:15px}.protocolMini{font-size:14px}}
  `;
  const st=document.createElement('style');st.id='magi-engine-ui-v187-style';st.textContent=css;document.head.appendChild(st);

  function ensureProtocol(){
    let box=$('engineProtocol');
    if(box)return box;
    box=document.createElement('div');box.id='engineProtocol';box.className='engineProtocol';
    const final=document.querySelector('.final');final.parentNode.insertBefore(box,final);
    return box;
  }
  function setStatus(text){$('status').textContent=text}
  function setBusy(on){const b=button();if(!b)return;b.disabled=on;b.classList.toggle('magiRunning',on);b.textContent=on?'審議中…':'MAGI実行'}
  function caseMeta(evidence,caseData){
    const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    const hub=evidence?`${evidence.count}件参照<br>参照ファイル：${esc(evidence.files.join('、'))}`:'参照なし';
    $('caseMeta').innerHTML=`審議日：${date}<br>審議案件番号：${esc(caseData.id)}<br>DATA HUB：${hub}<br>ENGINE：Gemini v1.0`;
  }
  function renderPersona(prefix,p){
    const j=judgment(p.judgment);
    setPersona(prefix,{vote:j.key,conf:0,text:p.primaryReason||join(p.analysis),basis:join([...list(p.facts),...list(p.analysis)]),concern:join(p.warnings)});
    $(prefix+'Conf').textContent=`判定確度 ${C[p.confidence]||p.confidence||'低'}（AI評価）`;
    return j;
  }
  function renderCross(cross,primary,second){
    const box=ensureProtocol();
    const changes=Object.entries(second).map(([k,v])=>`${names[k]}：${v.changedFromPrimary?'変更（'+(v.changeReason||'理由記載なし')+'）':'維持'}`);
    box.innerHTML=`
      <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">一次独立判定</div><div class="protocolPhase">FIRST JUDGMENT / LOCKED</div></div><div class="protocolGrid">${Object.entries(primary).map(([k,v])=>`<div class="protocolMini"><b>${names[k]}</b>${esc(judgment(v.judgment).label)}｜確度 ${esc(C[v.confidence]||v.confidence)}<br>${esc(v.primaryReason)}</div>`).join('')}</div></div>
      <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">相互検証</div><div class="protocolPhase">CROSS EXAMINATION</div></div><div class="protocolText"><b>一致：</b>${esc(join(cross.agreement))}<br><b>相違：</b>${esc(join(cross.disagreement))}<br><b>情報不足：</b>${esc(join(cross.informationGaps))}<br><b>警告：</b>${esc(join(cross.warnings))}</div></div>
      <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">二次判定</div><div class="protocolPhase">SECOND JUDGMENT</div></div><div class="protocolText">${changes.map(esc).join('<br>')}</div></div>`;
  }
  function finalLabel(final,second){
    if(final.status==='MAGI_REVIEW_REQUIRED')return'MAGI再確認要求';
    if(final.status==='MAGI_DEADLOCK')return'審議不一致（再審議）';
    if(final.status==='INSUFFICIENT_EVIDENCE')return'判断材料不足';
    const js=Object.values(second).map(v=>judgment(v.judgment).key),yes=js.filter(x=>x==='yes').length,cond=js.filter(x=>x==='cond').length,no=js.filter(x=>x==='no').length;
    if(no>=2)return'否決';if(yes===3)return'可決（全会一致）';if(yes+cond>=2)return final.status==='MAGI_CONSENSUS'?'条件付き可決（全会一致）':'条件付き可決';return'判断保留';
  }
  function historyKey(label){return/否決/.test(label)?'reject':/保留|不足|不一致|確認/.test(label)?'hold':/条件付き/.test(label)?'conditional':'pass'}
  async function health(){
    const r=await fetch('/api/magi/health',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.reason||data.error||`Gemini設定確認に失敗しました（${r.status}）`);return data;
  }
  runMagi=async function(){
    const q=$('q').value.trim();if(!q){setStatus('相談内容を入力してください。');return}
    const route=routeQuestion(q);if(route.type==='advanced'){setStatus('高度相談向けの内容です。引継ぎパネルを開きました。');openAdvanced();return}
    if(!window.MAGI_ENGINE_V1){setStatus('正式審議エンジンを読み込めませんでした。');return}
    const evidence=searchDataEvidence(q),x=analyze(q),protocol=ensureProtocol();
    protocol.innerHTML='';protocol.classList.remove('hidden');renderEvidence(evidence);renderSignals(x,{...route,label:'Gemini正式3賢人審議'},evidence);
    $('caseQuestion').textContent=q;$('response').classList.add('show');setBusy(true);
    try{
      setStatus('Gemini接続を確認中…');const h=await health();
      setStatus(`一次独立判定を実行中…（${h.model}）`);
      const result=await MAGI_ENGINE_V1.deliberate({question:q,objective:'3賢人による意思決定支援',evidence:evidence?{count:evidence.count,files:evidence.files,text:evidence.text}:null},{onPrimaryLocked:()=>setStatus('一次判定をロック。相互検証を実行中…')});
      const m=renderPersona('m',result.second.melchior),b=renderPersona('b',result.second.balthasar),c=renderPersona('c',result.second.casper);
      $('v1').textContent=`MELCHIOR ${m.label}`;$('v2').textContent=`BALTHASAR ${b.label}`;$('v3').textContent=`CASPER ${c.label}`;
      renderCross(result.crossExamination,result.primary,result.second);
      const label=finalLabel(result.final,result.second);$('verdict').textContent=label;
      $('reason').textContent=`${result.final.recommendation||''}${list(result.final.majorReasons).length?'｜'+join(result.final.majorReasons):''}`;
      $('next').style.display='block';$('next').textContent=list(result.final.reDeliberationConditions).length?`再審議条件：${join(result.final.reDeliberationConditions)}`:(result.final.reviewReason||'少数意見を保存し、状況変化時に再審議します。');
      caseMeta(evidence,result.case);setStatus(`MAGI正式審議完了 — ${h.model} / ${result.engineVersion}`);saveHistory(q,historyKey(label));
      $('response').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){
      console.error('[MAGI engine UI]',error);protocol.innerHTML=`<div class="engineError"><b>正式審議を完了できませんでした。</b><br>${esc(error?.message||error)}<br>ローカル判定への自動切替は行っていません。</div>`;setStatus('MAGI正式審議エラー — 設定またはAPIログを確認してください。');
    }finally{setBusy(false)}
  };
  window.MAGI_ENGINE_UI_V187=true;
})();
