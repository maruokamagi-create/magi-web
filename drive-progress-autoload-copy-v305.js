(()=>{
'use strict';
if(window.MAGI_DRIVE_AUTOLOAD_COPY_V305)return;
window.MAGI_DRIVE_AUTOLOAD_COPY_V305=true;
const SCOPE='Google DriveのXLSM・CSV';
let observer=null;
function fix(){
  const note=document.getElementById('driveProgressNote');
  const label=document.getElementById('driveProgressLabel');
  const box=document.getElementById('driveProgress');
  const state=document.getElementById('driveState');
  if(note){
    const t=String(note.textContent||'');
    if(/押す|再認証|接続を許可|Google認証/.test(t)){
      note.textContent=box?.classList.contains('error')
        ? '自動読み込みに失敗しました。ページを開き直すと再試行します。'
        : SCOPE+'だけを自動で準備します。操作は不要です。';
    }
  }
  if(label&&/Google Drive未接続|Google認証を待っています|接続準備中/.test(String(label.textContent||''))){
    label.textContent=SCOPE+'を準備しています';
  }
  if(state&&/押してください|もう一度押してください|再認証/.test(String(state.textContent||''))){
    state.textContent=SCOPE+'を自動で準備しています。操作は不要です。';
    state.className='driveState ready';
  }
  return !!(note||label||state);
}
function init(){
  fix();
  if(observer)return;
  observer=new MutationObserver(()=>fix());
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  let tries=0;
  const timer=setInterval(()=>{tries++;fix();if(tries>=80)clearInterval(timer)},250);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
