(()=>{
'use strict';
if(window.MAGI_UI_POLISH_V365)return;
window.MAGI_UI_POLISH_V365=true;

const style=document.createElement('style');
style.id='magi-ui-polish-v365-style';
style.textContent=`
/* Progress: keep the full progress UI visible and readable. */
#magiDeliberationProgress.magiProgress,
#magiDeliberationProgress.magiProgress.hidden{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  width:100%!important;
  max-height:none!important;
  box-sizing:border-box!important;
  margin:12px 0 8px!important;
  padding:13px 14px!important;
  border:1px solid #315574!important;
  border-radius:13px!important;
  background:linear-gradient(135deg,#071827,#0b2444)!important;
  color:#eaf4ff!important;
}
#magiDeliberationProgress .magiProgressTop,
#magiDeliberationProgress .magiProgressMeta{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  width:100%!important;
}
#magiDeliberationProgress .magiProgressState{
  display:flex!important;
  align-items:center!important;
  gap:9px!important;
  min-width:0!important;
  font-size:13px!important;
  font-weight:900!important;
}
#magiDeliberationProgress .magiProgressPct{
  flex:0 0 auto!important;
  font-size:18px!important;
  font-weight:900!important;
  color:#bfeeff!important;
}
#magiDeliberationProgress .magiPulse{
  display:block!important;
  width:11px!important;
  height:11px!important;
  flex:0 0 11px!important;
  border-radius:50%!important;
  background:#4db8d8!important;
  animation:magiUiPulseV365 1.15s infinite!important;
}
#magiDeliberationProgress .magiProgressTrack{
  display:block!important;
  position:relative!important;
  width:100%!important;
  height:12px!important;
  margin:10px 0 9px!important;
  overflow:hidden!important;
  border:1px solid rgba(108,194,236,.55)!important;
  border-radius:999px!important;
  background:#17354f!important;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.34)!important;
}
#magiDeliberationProgress .magiProgressBar{
  display:block!important;
  height:100%!important;
  width:0;
  min-width:0!important;
  border-radius:999px!important;
  background:linear-gradient(90deg,#37c9e8 0%,#62b8ff 100%)!important;
  box-shadow:0 0 10px rgba(69,194,239,.45)!important;
  transition:width .35s ease!important;
}
#magiDeliberationProgress .magiProgressMeta{
  font-size:10px!important;
  letter-spacing:.08em!important;
  color:#9fbbd4!important;
}
#magiDeliberationProgress .magiProgressMeta b{color:#dff4ff!important;}
#magiDeliberationProgress .magiProgressNote{
  margin-top:7px!important;
  font-size:9px!important;
  color:#708aa2!important;
}
#magiDeliberationProgress.magiProgress.done .magiPulse{
  animation:none!important;
  background:#37b579!important;
}
#magiDeliberationProgress.magiProgress.error .magiPulse{
  animation:none!important;
  background:#e44d63!important;
}

/* MAGI CONTROL: preserve the small outer footprint, enlarge only the official mark inside it. */
#magiChatView .magiMsg.system .magiAvatar{
  width:34px!important;
  height:34px!important;
  padding:1px!important;
  box-sizing:content-box!important;
  flex:0 0 auto!important;
  border-radius:8px!important;
  object-fit:contain!important;
  object-position:center!important;
  background:#0b2444!important;
}

@media(max-width:430px){
  #magiDeliberationProgress .magiProgressTrack{height:11px!important;}
}

@keyframes magiUiPulseV365{
  0%{box-shadow:0 0 0 0 rgba(77,184,216,.7)}
  70%{box-shadow:0 0 0 9px rgba(77,184,216,0)}
  100%{box-shadow:0 0 0 0 rgba(77,184,216,0)}
}
`;
document.head.appendChild(style);

function ensureProgressVisible(){
  const api=window.MAGI_PROGRESS_V358;
  if(!api||typeof api.update!=='function')return false;
  if(!document.getElementById('magiDeliberationProgress')){
    api.update(0,'審議準備中','READY');
  }
  return !!document.getElementById('magiDeliberationProgress');
}

window.addEventListener('magi:app-ready',ensureProgressVisible,{once:true});
let tries=0;
const boot=setInterval(()=>{
  tries++;
  if(ensureProgressVisible()||tries>=120)clearInterval(boot);
},100);
})();
