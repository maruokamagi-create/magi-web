(()=>{
'use strict';
if(window.MAGI_TEAM_DATA_SCOPE_V304)return;
window.MAGI_TEAM_DATA_SCOPE_V304=true;
const ROOT_ID='1rPtDYz8BgmP-YVGNfsHcKBNsxxTjxY9I';
const ROOT_NAME='MAGI_SYSTEM';

function apply(){
  try{
    const input=document.getElementById('driveRootId');
    if(input){input.value=ROOT_ID;input.readOnly=true;input.title='MAGI_SYSTEM 内の権限に応じた必要資料をMAGI-WEBの読込範囲として使用します。';}
    localStorage.setItem('magiDriveRootV7',ROOT_ID);
  }catch(_){}
  window.MAGI_TEAM_ROOT_FOLDER_ID=ROOT_ID;
  window.MAGI_TEAM_ROOT_FOLDER_NAME=ROOT_NAME;
  const panel=document.querySelector('.drivePanel');
  const help=panel?.querySelector('.hubText');
  if(help)help.textContent='MAGI_SYSTEM 内から、現・旧チームの正本データと権限に応じた重要資料を優先して利用します。制作物や画像を一括読込せず、その他の資料は質問時に必要なものだけ取得します。';
}

apply();
let tries=0;
const timer=setInterval(()=>{tries++;apply();if(tries>=40)clearInterval(timer)},250);
})();
