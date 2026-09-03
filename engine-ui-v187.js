(()=>{
  'use strict';
  const J={GREEN:{key:'yes',label:'賛成'},BLUE:{key:'cond',label:'条件付き賛成'},YELLOW:{key:'hold',label:'判断保留'},RED:{key:'no',label:'反対'}};
  const C={HIGH:'高',MEDIUM:'中',LOW:'低'};
  const names={melchior:'MELCHIOR-1',balthasar:'BALTHASAR-2',casper:'CASPER-3'};
  const esc=s=>escapeHtml(String(s??''));
  const list=v=>(Array.isArray(v)?v:[]).filter(Boolean);
  const join=v=>list(v).join('／')||'特記事項なし';
  const judgment=v=>J[String(v||'').toUpperCase()]||J.YELLOW;
  const button=()=>document.querySelector('button[onclick="runMagi()"]');
  const candidateText=p=>list(p?.candidatePlayers).join('・')||'候補未確定';
  const selectionMode=q=>{
    const s=String(q||'');
    const domain=/クリーンナップ|中軸|主軸|打線|打順|オーダー|紅白戦|スタメン|レギュラー|先発|起用|守備位置|ポジション/;
    const cue=/誰|どの|どれ|どちら|どう組|組み合わせ|候補|選ぶ|選定|何番/;
    return domain.test(s)&&cue.test(s);
  };

  const css=`
  .engineProtocol{background:#f7f9fc;color:#122039;padding:0 14px 14px}
  .protocolBlock{border:1px solid #d6dfe8;border-left:5px solid #4db8d8;border-radius:13px;background:#fff;padding:15px;margin-bottom:12px}
  .protocolHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
  .protocolTitle{font-size:14px;font-weight:900;letter-spacing:.08em}.protocolPhase{font-size:10px;color:#60758c;letter-spacing:.11em}
  .protocolText{font-size:13px;line-height:1.75;color:#27394d}.protocolText b{color:#102943}
  .protocolGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:10px}
  .protocolMini{border:1px solid #dbe3eb;border-radius:10px;background:#f5f7fa;padding:10px;font-size:12px;line-height:1.65}
  .protocolMini b{display:block;margin-bottom:4px;font-size:10px;letter-spacing:.06em;color:#49627c}
  .magiLive{border:1px solid #294868;border-radius:14px;background:#071827;color:#eaf4ff;padding:13px;margin-bottom:12px}
  .magiLiveTitle{display:flex;justify-content:space-between;gap:10px;font-size:12px;font-weight:900;letter-spacing:.08em;margin-bottom:10px}.magiLiveTitle small{font-size:9px;color:#7f9ab3;font-weight:700}
  .magiExchange{border-top:1px solid #1f3b55;padding:10px 0}.magiExchange:first-of-type{border-top:0}.magiSpeaker{font-size:10px;font-weight:900;letter-spacing:.08em;margin-bottom:4px}.magiSpeech{font-size:13px;line-height:1.7;color:#d7e6f4}.magiJudge{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid #3b5d79;border-radius:999px;font-size:9px;color:#b9cee0}.magiChallenge{color:#ffd8a8}.magiReply{color:#d8f6e6}.magiLiveNote{font-size:9px;line-height:1.5;color:#6f899f;margin-top:8px}
  .engineError{margin-top:10px;border:1px solid #8c3942;border-left:4px solid #e04452;border-radius:10px;background:#31141a;color:#ffe2e5;padding:12px;font-size:13px;line-height:1.65}
  button.magiRunning{opacity:.65;cursor:wait}
  @media(max-width:720px){.protocolGrid{grid-template-columns:1fr}.protocolBlock{padding:13px}.protocolText,.magiSpeech{font-size:13px}}
  @media(min-width:900px){.engineProtocol{padding:0 14px 16px}.protocolBlock{padding:18px}.protocolTitle{font-size:16px}.protocolText,.magiSpeech{font-size:15px}.protocolMini{font-size:14px}}
  `;
  const st=document.createElement('style');st.id='magi-engine-ui-v187-style';st.textContent=css;document.head.appendChild(st);

  function ensureProtocol(){
    let box=$('engineProtocol');if(box)return box;
    box=document.createElement('div');box.id='engineProtocol';box.className='engineProtocol';
    const final=document.querySelector('.final');final.parentNode.insertBefore(box,final);return box;
  }
  function ensureLive(){
    const box=ensureProtocol();let live=$('magiLiveTranscript');if(live)return live;
    live=document.createElement('div');live.id='magiLiveTranscript';live.className='magiLive';
    live.innerHTML='<div class="magiLiveTitle"><span>公開審議ログ</span><small>PUBLIC DELIBERATION RECORD</small></div><div id="magiLiveBody"></div><div class="magiLiveNote">ここに表示するのは各人格がユーザー向けに公開した発言・反論・再判定理由です。AIの非公開な内部思考そのものではありません。</div>';
    box.appendChild(live);return live;
  }
  function resetLive(){ensureLive();const b=$('magiLiveBody');if(b)b.innerHTML=''}
  function addExchange(speaker,text,kind='',judge=''){
    if(!text)return;ensureLive();const b=$('magiLiveBody');const d=document.createElement('div');d.className='magiExchange';
    d.innerHTML=`<div class="magiSpeaker">${esc(speaker)}${judge?`<span class="magiJudge">${esc(judge)}</span>`:''}</div><div class="magiSpeech ${kind}">${esc(text)}</div>`;b.appendChild(d);
  }
  function showPrimary(primary,isSelection){
    Object.entries(primary||{}).forEach(([k,v])=>addExchange(names[k]||k,v.publicStatement||v.primaryReason,'',isSelection?`候補：${candidateText(v)}`:judgment(v.judgment).label));
  }
  function showCross(cross){
    const ch=cross?.challenges||{};Object.entries(ch).forEach(([k,arr])=>list(arr).forEach(t=>addExchange(`MAGI CONTROL → ${names[k]||k}`,t,'magiChallenge','相互検証')));
  }
  function showSecond(second,isSelection){
    Object.entries(second||{}).forEach(([k,v])=>addExchange(names[k]||k,v.publicStatement||v.changeReason||v.primaryReason,'magiReply',isSelection?`再選定：${candidateText(v)}`:`${judgment(v.judgment).label}${v.changedFromPrimary?'・判定変更':'・判定維持'}`));
  }
  function setStatus(text){$('status').textContent=text}
  function setBusy(on){const b=button();if(!b)return;b.disabled=on;b.classList.toggle('magiRunning',on);b.textContent=on?'審議中…':'MAGI実行'}
  function caseMeta(evidence,caseData){
    const d=new Date(),date=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    const hub=evidence?`${evidence.count}件参照<br>参照ファイル：${esc(evidence.files.join('、'))}`:'参照なし';
    const mode=caseData?.mode==='selection'?'選択審議':'賛否審議';
    $('caseMeta').innerHTML=`審議日：${date}<br>審議案件番号：${esc(caseData.id)}<br>審議方式：${mode}<br>DATA HUB：${hub}<br>ENGINE：Gemini v1.0`;
  }
  function renderPersona(prefix,p,isSelection){
    const j=judgment(p.judgment);
    const spoken=p.publicStatement||p.primaryReason||join(p.analysis);
    const evidenceBits=[...list(p.facts),...list(p.analysis)];
    setPersona(prefix,{vote:isSelection?'cond':j.key,conf:0,text:spoken,basis:join(evidenceBits),concern:join(p.warnings)});
    if(isSelection){
      $(prefix+'Vote').textContent=`候補：${candidateText(p)}`;
      $(prefix+'Conf').textContent=`選定確度 ${C[p.confidence]||p.confidence||'低'}（AI評価）`;
    }else{
      $(prefix+'Conf').textContent=`判定確度 ${C[p.confidence]||p.confidence||'低'}（AI評価）`;
    }
    return j;
  }
  function renderCross(cross,primary,second,isSelection){
    const box=ensureProtocol();const live=ensureLive();
    [...box.querySelectorAll('.protocolBlock')].forEach(n=>n.remove());
    if(isSelection){
      const changes=Object.entries(second).map(([k,v])=>`${names[k]}：${candidateText(v)}${v.candidateBasis?'｜'+v.candidateBasis:''}`);
      live.insertAdjacentHTML('afterend',`
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">一次候補抽出</div><div class="protocolPhase">INDEPENDENT SELECTION / LOCKED</div></div><div class="protocolGrid">${Object.entries(primary).map(([k,v])=>`<div class="protocolMini"><b>${names[k]}</b>候補：${esc(candidateText(v))}<br>${esc(v.candidateBasis||v.publicStatement||v.primaryReason)}</div>`).join('')}</div></div>
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">候補相互検証</div><div class="protocolPhase">CROSS EXAMINATION</div></div><div class="protocolText"><b>一致：</b>${esc(join(cross.agreement))}<br><b>相違：</b>${esc(join(cross.disagreement))}<br><b>情報不足：</b>${esc(join(cross.informationGaps))}<br><b>警告：</b>${esc(join(cross.warnings))}</div></div>
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">二次候補選定</div><div class="protocolPhase">SECOND SELECTION</div></div><div class="protocolText">${changes.map(esc).join('<br>')}</div></div>`);
    }else{
      const changes=Object.entries(second).map(([k,v])=>`${names[k]}：${v.changedFromPrimary?'変更（'+(v.changeReason||'理由記載なし')+'）':'維持'}`);
      live.insertAdjacentHTML('afterend',`
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">一次独立判定</div><div class="protocolPhase">FIRST JUDGMENT / LOCKED</div></div><div class="protocolGrid">${Object.entries(primary).map(([k,v])=>`<div class="protocolMini"><b>${names[k]}</b>${esc(judgment(v.judgment).label)}｜確度 ${esc(C[v.confidence]||v.confidence)}<br>${esc(v.publicStatement||v.primaryReason)}</div>`).join('')}</div></div>
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">相互検証</div><div class="protocolPhase">CROSS EXAMINATION</div></div><div class="protocolText"><b>一致：</b>${esc(join(cross.agreement))}<br><b>相違：</b>${esc(join(cross.disagreement))}<br><b>情報不足：</b>${esc(join(cross.informationGaps))}<br><b>警告：</b>${esc(join(cross.warnings))}</div></div>
        <div class="protocolBlock"><div class="protocolHead"><div class="protocolTitle">二次判定</div><div class="protocolPhase">SECOND JUDGMENT</div></div><div class="protocolText">${changes.map(esc).join('<br>')}</div></div>`);
    }
  }
  function finalLabel(final,second){
    if(final.status==='MAGI_REVIEW_REQUIRED')return'MAGI再確認要求';if(final.status==='MAGI_DEADLOCK')return'審議不一致（再審議）';if(final.status==='INSUFFICIENT_EVIDENCE')return'判断材料不足';
    const js=Object.values(second).map(v=>judgment(v.judgment).key),yes=js.filter(x=>x==='yes').length,cond=js.filter(x=>x==='cond').length,no=js.filter(x=>x==='no').length;
    if(no>=2)return'否決';if(yes===3)return'可決（全会一致）';if(yes+cond>=2)return final.status==='MAGI_CONSENSUS'?'条件付き可決（全会一致）':'条件付き可決';return'判断保留';
  }
  function historyKey(label){return/否決/.test(label)?'reject':/保留|不足|不一致|確認/.test(label)?'hold':/条件付き/.test(label)?'conditional':'pass'}
  async function health(){const r=await fetch('/api/magi/health',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.reason||data.error||`Gemini設定確認に失敗しました（${r.status}）`);return data}

  runMagi=async function(){
    const q=$('q').value.trim();if(!q){setStatus('相談内容を入力してください。');return}
    const route=routeQuestion(q);if(route.type==='advanced'){setStatus('高度相談向けの内容です。引継ぎパネルを開きました。');openAdvanced();return}
    if(!window.MAGI_ENGINE_V1){setStatus('正式審議エンジンを読み込めませんでした。');return}
    const isSelection=selectionMode(q);
    const evidence=searchDataEvidence(q),x=analyze(q),protocol=ensureProtocol();
    protocol.innerHTML='';protocol.classList.remove('hidden');resetLive();renderEvidence(evidence);renderSignals(x,{...route,label:isSelection?'Gemini正式3賢人選択審議':'Gemini正式3賢人審議'},evidence);
    $('caseQuestion').textContent=q;$('response').classList.add('show');setBusy(true);
    const finalTitle=document.querySelector('.final .title');if(finalTitle)finalTitle.textContent=isSelection?'《MAGI》選択審議結果':'《MAGI》総合判定';
    try{
      setStatus('Gemini接続を確認中…');const h=await health();setStatus(isSelection?`全員確認後、一次候補抽出を実行中…（${h.model}）`:`一次独立判定を実行中…（${h.model}）`);
      const result=await MAGI_ENGINE_V1.deliberate({question:q,mode:isSelection?'selection':'proposal',objective:isSelection?'3賢人による候補比較・選択支援':'3賢人による意思決定支援',evidence:evidence?{count:evidence.count,files:evidence.files,text:evidence.text}:null},{
        onPrimaryLocked:primary=>{showPrimary(primary,isSelection);setStatus(isSelection?'一次候補を公開。候補相互検証を実行中…':'一次判定を公開。相互検証を実行中…')},
        onCrossComplete:cross=>{showCross(cross);setStatus(isSelection?'候補相互検証を公開。二次候補選定を実行中…':'相互検証を公開。二次判定を実行中…')},
        onSecondComplete:second=>{showSecond(second,isSelection);setStatus(isSelection?'二次候補を公開。選択結果を集約中…':'二次判定を公開。最終決定を実行中…')},
        onStage:s=>{if(s.stage==='FINAL')setStatus(isSelection?'選択結果を集約中…':'最終決定を実行中…')},
        onRetry:r=>setStatus(`一時エラーを検出。再試行中…（${r.attempt}/3）`)
      });
      const m=renderPersona('m',result.second.melchior,isSelection),b=renderPersona('b',result.second.balthasar,isSelection),c=renderPersona('c',result.second.casper,isSelection);
      renderCross(result.crossExamination,result.primary,result.second,isSelection);
      if(isSelection){
        $('v1').textContent=`MELCHIOR候補 ${candidateText(result.second.melchior)}`;
        $('v2').textContent=`BALTHASAR候補 ${candidateText(result.second.balthasar)}`;
        $('v3').textContent=`CASPER候補 ${candidateText(result.second.casper)}`;
        if(result.final.status==='SELECTION_REVIEW_REQUIRED'){
          $('verdict').textContent='候補確定保留';
          $('reason').textContent=result.final.reviewReason||result.final.recommendation||'確認事項を解消して再審議します。';
        }else{
          const center=list(result.final.centerCandidates),recommended=list(result.final.recommendedCandidates);
          $('verdict').textContent=center.length?`中心候補：${center.join('・')}`:'候補比較継続';
          $('reason').textContent=result.final.recommendation||(recommended.length?`推奨候補群：${recommended.join('・')}`:'3賢者の候補を比較してください。');
        }
        $('next').style.display='block';
        const alt=list(result.final.alternateCandidates),conds=list(result.final.reDeliberationConditions);
        const bits=[];if(alt.length)bits.push(`次点・追加候補：${alt.join('・')}`);if(conds.length)bits.push(`再検討条件：${conds.join('／')}`);
        $('next').textContent=bits.join('　')||'今後の試合データや役割変化に応じて再選定します。';
        caseMeta(evidence,result.case);setStatus(`MAGI選択審議完了 — ${h.model} / ${result.engineVersion}`);saveHistory(q,'selection');
      }else{
        $('v1').textContent=`MELCHIOR ${m.label}`;$('v2').textContent=`BALTHASAR ${b.label}`;$('v3').textContent=`CASPER ${c.label}`;
        const label=finalLabel(result.final,result.second);
        $('verdict').textContent=label;
        const reasons=list(result.final.majorReasons);const mainReason=reasons[0]||'';
        $('reason').textContent=result.final.recommendation?`${result.final.recommendation}${mainReason?' '+mainReason:''}`:(mainReason||'三賢人の判定を確認してください。');
        $('next').style.display='block';
        if(list(result.final.reDeliberationConditions).length){$('next').textContent=`判断が変わる条件：${join(result.final.reDeliberationConditions)}`}
        else if(result.final.minorityOpinion){$('next').textContent=`少数意見：${result.final.minorityOpinion}`}
        else{$('next').textContent=result.final.reviewReason||'状況が変われば、もう一度審議します。'}
        caseMeta(evidence,result.case);setStatus(`MAGI正式審議完了 — ${h.model} / ${result.engineVersion}`);saveHistory(q,historyKey(label));
      }
      $('response').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(error){
      console.error('[MAGI engine UI]',error);protocol.insertAdjacentHTML('beforeend',`<div class="engineError"><b>正式審議を完了できませんでした。</b><br>${esc(error?.message||error)}<br>完了済みの公開審議ログは上に残しています。ローカル判定への自動切替は行っていません。</div>`);setStatus('MAGI正式審議エラー — 完了済みの審議ログを保持しました。');
    }finally{setBusy(false)}
  };
  window.MAGI_ENGINE_UI_V187=true;
})();
