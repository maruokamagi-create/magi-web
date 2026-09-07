(()=>{
'use strict';
if(window.MAGI_WORKBOOK_HEADER_FIX_V309)return;
window.MAGI_WORKBOOK_HEADER_FIX_V309=true;

const norm=v=>String(v??'').normalize('NFKC').replace(/[\s　]/g,'').toLowerCase();
const HEADER_KEYS=new Set([
  '背番号','選手名','選手','氏名','開催日','日付','大会名','大会','試合順','試合','相手校','対戦相手','対戦校','打順','守備位置',
  '出場数','出場試合数','打席','打席数','打数','打率','打点','得点','安打','単打','二塁打','三塁打','本塁打','三振','四球','死球',
  '出塁率','長打率','ops','得点圏','得点圏打率','盗塁','盗塁刺','犠打','犠飛','防御率','投球回','奪三振','与四死球','失策','守備率'
].map(norm));

function headerScore(row){
  if(!Array.isArray(row))return 0;
  const vals=row.map(norm).filter(Boolean);
  let score=0;
  for(const v of vals)if(HEADER_KEYS.has(v))score++;
  if(vals.some(v=>v==='選手名'||v==='選手'||v==='氏名'))score+=2;
  return score;
}

function alignHeader(rows){
  if(!Array.isArray(rows)||!rows.length)return rows||[];
  let bestIndex=-1,bestScore=0;
  for(let i=0;i<Math.min(rows.length,30);i++){
    const score=headerScore(rows[i]);
    if(score>bestScore){bestScore=score;bestIndex=i;}
  }
  return bestIndex>=0&&bestScore>=3?rows.slice(bestIndex):rows;
}

function install(){
  if(typeof window.addWorkbookRecords!=='function'||typeof window.addTableRecords!=='function'||!window.XLSX)return false;
  if(window.addWorkbookRecords.__magiHeaderFixV309)return true;
  const fixed=function(fileName,buffer,source='local'){
    const wb=window.XLSX.read(buffer,{type:'array'});
    let count=0;
    for(const sheetName of wb.SheetNames){
      const rows=window.XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:''});
      count+=window.addTableRecords(fileName,sheetName,alignHeader(rows),source);
    }
    return count;
  };
  fixed.__magiHeaderFixV309=true;
  window.addWorkbookRecords=fixed;
  window.MAGI_WORKBOOK_HEADER_FIX='v309';
  return true;
}

let tries=0;
const timer=setInterval(()=>{
  tries++;
  if(install()||tries>400)clearInterval(timer);
},100);
})();
