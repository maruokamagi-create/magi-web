(()=>{
  'use strict';
  const PORTRAITS={
    'MELCHIOR-1':'/portraits/melchior.png?v=193',
    'BALTHASAR-2':'/portraits/balthasar.png?v=193',
    'CASPER-3':'/portraits/casper.png?v=193',
    'MAGI CONTROL':'/magi-official-symbol-v125.svg?v=193'
  };
  function injectCss(){
    if(document.getElementById('magi-result-layout-v193-style'))return;
    const st=document.createElement('style');
    st.id='magi-result-layout-v193-style';
    st.textContent=`
      .response.magiResultReordered{margin-top:14px!important;padding:0!important;width:100%!important;max-width:none!important}
      .magiResultBundle{width:100%;max-width:none;margin:0;padding:0;display:block}
      .magiResultBundle>*{box-sizing:border-box;max-width:none!important}
      .magiResultBundle .reportHeader{width:100%!important;max-width:none!important;margin:0 0 14px!important;border-radius:16px!important;border-bottom:5px solid #cf1f2e!important;opacity:1!important}
      .magiResultBundle .final{width:100%!important;margin:0 0 14px!important;border-radius:16px!important;border-top:4px solid #4db8d8!important;box-shadow:0 8px 24px rgba(0,0,0,.16)}
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
      }
      @media(max-width:430px){
        .magiExchange{padding-left:44px!important}.magiSpeakerAvatar{width:34px;height:34px}
      }
    `;
    document.head.appendChild(st);
  }
  function avatarFor(text){const t=String(text||'');if(t.includes('MELCHIOR'))return['MELCHIOR-1',PORTRAITS['MELCHIOR-1']];if(t.includes('BALTHASAR'))return['BALTHASAR-2',PORTRAITS['BALTHASAR-2']];if(t.includes('CASPER'))return['CASPER-3',PORTRAITS['CASPER-3']];if(t.includes('MAGI CONTROL'))return['MAGI CONTROL',PORTRAITS['MAGI CONTROL']];return null}
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
    bundle.id='magiResultBundle';
    bundle.className='magiResultBundle';
    response.insertBefore(bundle,response.firstChild);

    /* Reading order: CASE INFO -> FINAL -> 3 WISE MEN -> DELIBERATION */
    bundle.appendChild(makeTitle('案件情報','magiCaseInfoTitle'));
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

    decorateTranscript();
  }
  function watch(){
    injectCss();const status=document.getElementById('status');if(!status)return false;
    let scheduled=false;
    const sync=()=>{scheduled=false;decorateTranscript();if(/正式審議完了|審議完了/.test(status.textContent))reorder()};
    new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}).observe(status,{childList:true,subtree:true,characterData:true});
    sync();return true;
  }
  let n=0;const boot=setInterval(()=>{n++;if(watch()||n>80)clearInterval(boot)},250);
})();
