(()=>{
'use strict';
if(window.MAGI_TEAM_DATA_SCOPE_V304)return;
window.MAGI_TEAM_DATA_SCOPE_V304=true;
const ROOT_ID='1lIRTMRRMOE0lnIPAFmw9NrCDHSKf_8Hn';
const ROOT_NAME='20_TEAM_DATA_チームデータ';

function apply(){
  try{
    const input=document.getElementById('driveRootId');
    if(input){input.value=ROOT_ID;input.readOnly=true;input.title=ROOT_NAME+' をMAGI-WEBの共通読込範囲として使用します。';}
    localStorage.setItem('magiDriveRootV7',ROOT_ID);
  }catch(_){}
  window.MAGI_TEAM_ROOT_FOLDER_ID=ROOT_ID;
  window.MAGI_TEAM_ROOT_FOLDER_NAME=ROOT_NAME;
  const panel=document.querySelector('.drivePanel');
  const help=panel?.querySelector('.hubText');
  if(help)help.textContent=ROOT_NAME+' のフォルダ構成を先に確認し、質問に必要な資料だけをその都度読み込みます。';
}

apply();
let tries=0;
const timer=setInterval(()=>{tries++;apply();if(tries>=40)clearInterval(timer)},250);
})();
