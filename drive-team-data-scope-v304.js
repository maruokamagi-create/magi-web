(()=>{
'use strict';
if(window.MAGI_TEAM_DATA_SCOPE_V304)return;
window.MAGI_TEAM_DATA_SCOPE_V304=true;
const ROOT_ID='1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
const ROOT_NAME='MAGI_SYSTEM';

function apply(){
  try{
    const input=document.getElementById('driveRootId');
    if(input){input.value=ROOT_ID;input.readOnly=true;input.title='MAGI_SYSTEM 内の .xlsm と .csv だけをMAGI-WEBの読込対象として使用します。';}
    localStorage.setItem('magiDriveRootV7',ROOT_ID);
  }catch(_){}
  window.MAGI_TEAM_ROOT_FOLDER_ID=ROOT_ID;
  window.MAGI_TEAM_ROOT_FOLDER_NAME=ROOT_NAME;
  const panel=document.querySelector('.drivePanel');
  const help=panel?.querySelector('.hubText');
  if(help)help.textContent='MAGI_SYSTEM 内から .xlsm と .csv だけを読み込みます。PDF・画像・文書・その他の形式は読み込みません。';
}

apply();
let tries=0;
const timer=setInterval(()=>{tries++;apply();if(tries>=40)clearInterval(timer)},250);
})();
