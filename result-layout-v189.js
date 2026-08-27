(()=>{
  'use strict';
  const PORTRAITS={
    'MELCHIOR-1':'/portraits/melchior.png?v=195',
    'BALTHASAR-2':'/portraits/balthasar.png?v=195',
    'CASPER-3':'/portraits/casper.png?v=195',
    'MAGI CONTROL':'/magi-official-symbol-v125.svg?v=195'
  };
  function injectCss(){
    if(document.getElementById('magi-result-layout-v195-style'))return;
    const st=document.createElement('style');
    st.id='magi-result-layout-v195-style';
    st.textContent=`
      .response.magiResultReordered{margin-top:14px!important;padding:0!important;width:100%!important;max-width:none!important}
      .magiResultBundle{width:100%;max-width:none;margin:0;padding:0;display:block}
      .magiResultBundle>*{box-sizing:border-box;max-width:none!important}
      .magiResultBundle .reportHeader{width:100%!important;max-width:none!important;margin:0 0 14px!important;padding:14px 18px!important;border-radius:14px!important;border-bottom:4px solid #cf1f2e!important;opacity:1!important}
      .magiResultBundle .reportTitle,.magiResultBundle .reportSub{display:none!important}
      .magiResultBundle .reportTop{display:flex!important;justify-content:flex-end!important;align-items:flex-start!important;min-height:0!important;margin:0!important}
      .magiResultBundle .caseMeta{font-size:10px!important;line-height:1.5!important;min-width:0!important;width:auto!important;max-width:300px!important;padding:7px 10px!important;border-radius:9px!important;margin:0!important}
      .magiResultBundle .caseQuestion{font-size:18px!important;line-height:1.5!important;margin:8px 0 0!important;font-weight:900!important}
      .magiResultBundle .final{width:100%!important;margin:0 0 14px!important;border-radius:16px!important;border-top:4px solid #4db8d8!important;box-shadow:0 8px 24px rgba(0,0,0,.16)}
      .magiResultBundle .final .votes{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;margin-top:12px!important}
      .magiResultBundle .final .vote.magiVoteCard{display:grid!important;grid-template-columns:42px minmax(0,1fr)!important;align-items:center!important;gap:10px!important;min-width:0!important;padding:9px 11px!important;border:1px solid #34536f!important;border-radius:13px!important;background:#071827!important;color:#fff!important;white-space:normal!important}
      .magiResultBundle .final .vote.magiVoteMelchior{border-left:5px solid #16945c!important}
      .magiResultBundle .final .vote.magiVoteBalthasar{border-left:5px solid #c52b38!important}
      .magiResultBundle .final .vote.magiVoteCasper{border-left:5px solid #1e4f96!important}
      .magiVotePortrait{width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;border:1px solid #42627f;display:block}
      .magiVoteText{display:flex;flex-direction:column;gap:4px;min-width:0}
      .magiVoteText strong{font-size:10px;letter-spacing:.08em;line-height:1.1;color:#b9cee0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .magiVoteState{display:inline-flex;align-items:center;gap:5px;width:max-content;max-width:100%;font-size:12px;font-style:normal;font-weight:900;line-height:1.2;padding:4px 8px;border-radius:999px;background:#142d47;color:#eaf4ff}
      .magiVoteState.yes{background:#123526;color:#9cf0c4;border:1px solid #28684a}.magiVoteState.cond{background:#102b50;color:#b9d7ff;border:1px solid #2c5e9c}.magiVoteState.hold{background:#3a2d0c;color:#ffe39a;border:1px solid #80631b}.magiVoteState.no{background:#3b161b;color:#ffc0c6;border:1px solid #7d2f38}
      .magiResultBundle .answerWrap{width:100%!important;margin:0 0 14px!important;padding:12px!important;border-radius:16px!important;background:#f7f9fc!important}
      .magiResultBundle .answer{width:100%!important;max-width:none!important;margin:0 0 12px!important}
      .magiResultBundle .answer:last-child{margin-bottom:0!important}
      .magiResultBundle #engineProtocol{width:100%!important;max-width:none!important;margin:0 0 14px!important;padding:0!important}
      .magiResultBundle #magiLiveTranscript{width:100%!important;max-width:none!important;margin:10px 0 0!important}
      .magiResultOrderTitle{width:100%;font-size:12px;letter-spacing:.14em;font-weight:900;color:#8db0d1;margin:16px 0 9px;padding:0 4px}
      .magiResultBundle>.magiResultOrderTitle:first-child{margin-top:0}
      .magiExchange{position:relative;padding-left:48px!important;min-height:43px}
      .magiSpeakerAvatar{position:absolute;left:0;top:9px;width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;border:1px solid #315574;box-shadow:0 3px 10px rgba(0,0,0,.25)}
      .magiSpeakerAvatar.control{object-fit:contain;padding:6px;background:#06121f}
      .magiTranscriptToggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #315574;background:#0b2444;color:#eaf4ff;border-radius:11px;padding:11px 12px;margin:0 0 8px;font-size:12px;font-weight:900;cursor:pointer}
      .magiTranscriptToggle small{font-size:9px;font-weight:700;color:#8fa9c0}
      #magiLiveTranscript.magiCollapsed #magiLiveBody,#magiLiveTranscript.magiCollapsed .magiLiveNote{display:none}
      #magiLiveTranscript.magiCollapsed{padding-bottom:5px}
      .magiLiveTitle{display:none!important}
      @media(max-width:720px){
        .magiResultBundle .answerWrap{padding:8px!important}
        .magiResultBundle .final,.magiResultBundle .reportHeader{margin-bottom:10px!important}
        .magiResultOrderTitle{margin-top:12px}
        .magiResultBundle .reportHeader{padding:12px!important}
        .magiResultBundle .reportTop{justify-content:flex-start!important}
        .magiResultBundle .caseMeta{max-width:100%!important;width:100%!important;font-size:10px!important}
        .magiResultBundle .caseQuestion{font-size:16px!important;margin-top:9px!important}
        .magiResultBundle .final .votes{grid-template-columns:1fr!important}
      }
      @media(max-width:430px){
        .magiExchange{padding-left:44px!important}.magiSpeakerAvatar{width:34px;height:34px}
        .magiResultBundle .final .vote.magiVoteCard{grid-template-columns:38px minmax(0,1fr)!important;padding:8px 9px!important}.magiVotePortrait{width:34px;height:34px}.magiVoteState{font-size:11px}
      }
    `;
    document.head.appendChild(st);
  }
  function avatarFor(text){const t=String(text||'');if(t.includes('MELCHIOR'))return['MELCHIOR-1',PORTRAITS['MELCHIOR-1']];if(t.includes('BALTHASAR'))return['BALTHASAR-2',PORTRAITS['BALTHASAR-2']];if(t.includes('CASPER'))return['CASPER-3',PORTRAITS['CASPER-3']];if(t.includes('MAGI CONTROL'))return['MAGI CONTROL',PORTRAITS['MAGI CONTROL']];return null}
  function judgmentStyle(text){const t=String(text||'');if(/条件付き賛成/.test(t))return['○','cond'];if(/賛成/.test(t))return['◎','yes'];if(/反対|否決/.test(t))return['×','no'];return['△','hold']}
  function decorateFinalVotes(){
    const cfg=[['v1','MELCHIOR','MELCHIOR-1','magiVoteMelchior'],['v2','BALTHASAR','BALTHASAR-2','magiVoteBalthasar'],['v3','CASPER','CASPER-3','magiVoteCasper']];
    cfg.forEach(([id,label,key,cls])=>{
      const el=document.getElementById(id);if(!el||el.dataset.magiVoteDecorated==='1')return;
      const raw=String(el.textContent||'').trim();const state=raw.replace(new RegExp('^'+label+'\\s*','i'),'').trim()||'—';const [sym,stateCls]=judgmentStyle(state);
      el.dataset.magiVoteDecorated='1';el.classList.add('magiVoteCard',cls);
      el.innerHTML=`<img class="magiVotePortrait" src="${PORTRAITS[key]}" alt="${label}"><span class="magiVoteText"><strong>${label}</strong><em class="magiVoteState ${stateCls}">${sym} ${state}</em></span>`;
    });
  }
  function decorateTranscript(){
    const live=document.getElementById('magiLiveTranscript');if(!live)return;injectCss();
    if(!live.querySelector('.magiTranscriptToggle')){
      const btn=document.createElement('button');btn.type='button';btn.className='magiTranscriptToggle';btn.innerHTML='<span>審議のやり取りを見る</span><small>PUBLIC DELIBERATION ▾</small>';
      btn.addEventListener('click',()=>{const collapsed=live.classList.toggle('magiCollapsed');btn.querySelector('span').textContent=collapsed?'審議のやり取りを見る':'審議のやり取りを閉じる';btn.querySelector('small').textContent=collapsed?'PUBLIC DELIBERATION ▾':'PUBLIC DELIBERATION ▴'});
      live.insertBefore(btn,live.firstChild);
    }
    live.querySelectorAll('.magiExchange').forEach(ex=>{if(ex.querySelector('.magiSpeakerAvatar'))return;const speaker=ex.querySelector('.magiSpeaker');const hit=avatarFor(speaker?.textContent);if(!hit)return;const img=document.createElement('img');img.className='magiSpeakerAvatar'+(hit[0]==='MAGI CONTROL'?' control':'');img.src=hit[1];img.alt=hit[0];ex.insertBefore(img,ex.firstChild)});
  }
  function makeTitle(text,id){let d=document.getElementById(id);if(d)return d;d=document.createElement('div');d.id=id;d.className='magiResultOrderTitle';d.textContent=text;return d}
  function reorder(){
    const response=document.getElementById('response');if(!response||response.dataset.magiResultOrderDone==='1')return;
    const final=response.querySelector('.final');
    const answers=response.querySelector('.answerWrap');
    const header=response.querySelector('.reportHeader');
    const protocol=document.getElementById('engineProtocol');
    if(!final||!answers||!header)return;
    response.dataset.magiResultOrderDone='1';
    response.classList.add('magiResultReordered');
    const signals=document.querySelector('.signals');
    if(signals&&signals.parentNode&&response.parentNode===signals.parentNode)signals.parentNode.insertBefore(response,signals);
    const bundle=document.createElement('div');
    bundle.id='magiResultBundle';bundle.className='magiResultBundle';response.insertBefore(bundle,response.firstChild);
    bundle.appendChild(makeTitle('審議案件','magiCaseInfoTitle'));
    bundle.appendChild(header);
    bundle.appendChild(final);
    bundle.appendChild(makeTitle('3賢人の判定','magiThreeWiseTitle'));
    bundle.appendChild(answers);
    if(protocol){
      bundle.appendChild(makeTitle('審議のやり取り・検証','magiReasonTitle'));
      bundle.appendChild(protocol);
      const live=document.getElementById('magiLiveTranscript');
      if(live&&live.parentNode!==protocol)protocol.appendChild(live);
      if(live)live.classList.add('magiCollapsed');
    }
    decorateFinalVotes();decorateTranscript();
  }
  function watch(){
    injectCss();const status=document.getElementById('status');if(!status)return false;
    let scheduled=false;
    const sync=()=>{scheduled=false;decorateFinalVotes();decorateTranscript();if(/正式審議完了|審議完了/.test(status.textContent))reorder()};
    new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}).observe(status,{childList:true,subtree:true,characterData:true});
    sync();return true;
  }
  let n=0;const boot=setInterval(()=>{n++;if(watch()||n>80)clearInterval(boot)},250);
})();
