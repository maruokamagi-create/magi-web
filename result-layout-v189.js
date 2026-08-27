(()=>{
  'use strict';
  const PORTRAITS={
    'MELCHIOR-1':'/portraits/melchior.png?v=191',
    'BALTHASAR-2':'/portraits/balthasar.png?v=191',
    'CASPER-3':'/portraits/casper.png?v=191',
    'MAGI CONTROL':'/magi-official-symbol-v125.svg?v=191'
  };
  function injectCss(){if(document.getElementById('magi-result-layout-v191-style'))return;const st=document.createElement('style');st.id='magi-result-layout-v191-style';st.textContent=`
    .response.magiResultReordered{margin-top:14px}
    .response.magiResultReordered .final{margin:0 0 12px!important;border-radius:16px!important;border-top:4px solid #4db8d8!important;box-shadow:0 8px 24px rgba(0,0,0,.16)}
    .response.magiResultReordered .answerWrap{padding:10px!important;border-radius:16px!important;margin:0 0 12px!important}
    .response.magiResultReordered #engineProtocol{padding:0!important;margin:0 0 12px!important}
    .response.magiResultReordered .reportHeader{margin-top:12px!important;border-radius:16px!important;border-bottom:0!important;opacity:.88}
    .magiResultOrderTitle{font-size:12px;letter-spacing:.14em;font-weight:900;color:#8db0d1;margin:14px 4px 8px}
    .magiExchange{position:relative;padding-left:48px!important;min-height:43px}
    .magiSpeakerAvatar{position:absolute;left:0;top:9px;width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:center top;background:#0b2135;border:1px solid #315574;box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .magiSpeakerAvatar.control{object-fit:contain;padding:6px;background:#06121f}
    .magiTranscriptToggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #315574;background:#0b2444;color:#eaf4ff;border-radius:11px;padding:11px 12px;margin:0 0 8px;font-size:12px;font-weight:900;cursor:pointer}
    .magiTranscriptToggle small{font-size:9px;font-weight:700;color:#8fa9c0}
    #magiLiveTranscript.magiCollapsed #magiLiveBody,#magiLiveTranscript.magiCollapsed .magiLiveNote{display:none}
    #magiLiveTranscript.magiCollapsed{padding-bottom:5px}
    .magiLiveTitle{display:none!important}
    @media(max-width:430px){.magiExchange{padding-left:44px!important}.magiSpeakerAvatar{width:34px;height:34px}}
  `;document.head.appendChild(st)}
  function avatarFor(text){const t=String(text||'');if(t.includes('MELCHIOR'))return['MELCHIOR-1',PORTRAITS['MELCHIOR-1']];if(t.includes('BALTHASAR'))return['BALTHASAR-2',PORTRAITS['BALTHASAR-2']];if(t.includes('CASPER'))return['CASPER-3',PORTRAITS['CASPER-3']];if(t.includes('MAGI CONTROL'))return['MAGI CONTROL',PORTRAITS['MAGI CONTROL']];return null}
  function decorateTranscript(){const live=document.getElementById('magiLiveTranscript');if(!live)return;injectCss();if(!live.querySelector('.magiTranscriptToggle')){const btn=document.createElement('button');btn.type='button';btn.className='magiTranscriptToggle';btn.innerHTML='<span>審議のやり取りを見る</span><small>PUBLIC DELIBERATION ▾</small>';btn.addEventListener('click',()=>{const collapsed=live.classList.toggle('magiCollapsed');btn.querySelector('span').textContent=collapsed?'審議のやり取りを見る':'審議のやり取りを閉じる';btn.querySelector('small').textContent=collapsed?'PUBLIC DELIBERATION ▾':'PUBLIC DELIBERATION ▴'});live.insertBefore(btn,live.firstChild)}live.querySelectorAll('.magiExchange').forEach(ex=>{if(ex.querySelector('.magiSpeakerAvatar'))return;const speaker=ex.querySelector('.magiSpeaker');const hit=avatarFor(speaker?.textContent);if(!hit)return;const img=document.createElement('img');img.className='magiSpeakerAvatar'+(hit[0]==='MAGI CONTROL'?' control':'');img.src=hit[1];img.alt=hit[0];ex.insertBefore(img,ex.firstChild)})}
  function title(text,id){let d=document.getElementById(id);if(d)return d;d=document.createElement('div');d.id=id;d.className='magiResultOrderTitle';d.textContent=text;return d}
  function reorder(){
    const response=document.getElementById('response');if(!response||response.dataset.magiResultOrderDone==='1')return;
    const final=response.querySelector('.final'),answers=response.querySelector('.answerWrap'),header=response.querySelector('.reportHeader'),protocol=document.getElementById('engineProtocol');
    if(!final||!answers)return;
    response.dataset.magiResultOrderDone='1';response.classList.add('magiResultReordered');
    /* Put the whole result before INPUT ANALYSIS/signals. */
    const signals=document.querySelector('.signals');if(signals&&signals.parentNode&&response.parentNode===signals.parentNode)signals.parentNode.insertBefore(response,signals);
    /* Exact reading order: FINAL -> three judges -> deliberation -> case details. */
    response.insertBefore(final,response.firstChild);
    final.insertAdjacentElement('afterend',title('3賢人の判定','magiThreeWiseTitle'));
    document.getElementById('magiThreeWiseTitle').insertAdjacentElement('afterend',answers);
    if(protocol){answers.insertAdjacentElement('afterend',title('審議のやり取り・検証','magiReasonTitle'));document.getElementById('magiReasonTitle').insertAdjacentElement('afterend',protocol);const live=document.getElementById('magiLiveTranscript');if(live){protocol.appendChild(live);live.classList.add('magiCollapsed')}}
    if(header)response.appendChild(header);
    decorateTranscript();
  }
  function watch(){injectCss();const status=document.getElementById('status');if(!status)return false;let scheduled=false;const sync=()=>{scheduled=false;decorateTranscript();if(/正式審議完了|審議完了/.test(status.textContent))reorder()};new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(sync)}).observe(status,{childList:true,subtree:true,characterData:true});sync();return true}
  let n=0;const boot=setInterval(()=>{n++;if(watch()||n>80)clearInterval(boot)},250);
})();
