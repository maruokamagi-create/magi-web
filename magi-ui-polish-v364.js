(()=>{
'use strict';
if(window.MAGI_UI_POLISH_V364)return;
window.MAGI_UI_POLISH_V364=true;

const style=document.createElement('style');
style.id='magi-ui-polish-v364-style';
style.textContent=`
/* Progress: always render as a horizontal bar */
#magiDeliberationProgress.magiProgress{
  display:block!important;
  width:100%!important;
  box-sizing:border-box!important;
}
#magiDeliberationProgress .magiProgressTop{
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
  width:100%!important;
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
#magiDeliberationProgress .magiProgressPct{
  flex:0 0 auto!important;
  font-weight:900!important;
}

/* MAGI CONTROL: make the official mark itself visibly larger */
#magiChatView .magiMsg.system{
  align-items:flex-start!important;
  gap:12px!important;
}
#magiChatView .magiMsg.system .magiAvatar{
  width:52px!important;
  height:52px!important;
  padding:0!important;
  flex:0 0 52px!important;
  border-radius:12px!important;
  object-fit:cover!important;
  object-position:center!important;
  background:#0b2444!important;
  box-shadow:0 2px 8px rgba(5,28,52,.22)!important;
}
#magiChatView .magiMsg.system .magiMsgCol{
  max-width:calc(100% - 64px)!important;
}
@media(max-width:430px){
  #magiDeliberationProgress .magiProgressTrack{height:11px!important;}
  #magiChatView .magiMsg.system .magiAvatar{
    width:48px!important;
    height:48px!important;
    flex-basis:48px!important;
  }
  #magiChatView .magiMsg.system .magiMsgCol{
    max-width:calc(100% - 60px)!important;
  }
}
`;
document.head.appendChild(style);
})();
