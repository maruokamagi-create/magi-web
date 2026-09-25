import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('stats-report-v260.js','utf8'),rows=[],columns=['選手名','開催日','大会名','試合順','相手校','打数','安打','単打','二塁打','三塁打','本塁打','四球','死球','犠飛','打点','得点','三振','盗塁'];
function add(season,name,date,vals={}){const b={選手名:name,開催日:date,大会名:'練習試合',試合順:'1',相手校:'テスト中',打数:3,安打:1,単打:1,二塁打:0,三塁打:0,本塁打:0,四球:0,死球:0,犠飛:0,打点:0,得点:1,三振:0,盗塁:0,...vals};rows.push({source:'drive',fileName:`打撃詳細${season}.csv`,sheetName:'打撃詳細',columns,values:columns.map(k=>b[k]??'')})}
add('2025-2026','嶋田 栄志','2026-06-01',{打数:4,安打:2,単打:1,二塁打:1,打点:1});add('2026-2027','嶋田 栄志','2026-09-20',{打数:3,安打:1,単打:1,盗塁:1});add('2026-2027','大野 竜暉','2026-09-20',{打数:3,安打:3,単打:2,二塁打:1,四球:1,盗塁:2});
const document={getElementById(){return null},querySelector(){return null},createElement(){return{addEventListener(){},classList:{add(){},remove(){}},appendChild(){},querySelectorAll(){return[]}}},head:{appendChild(){}},documentElement:{clientWidth:1024},fonts:{ready:Promise.resolve()}};
const window={dataRecords:rows,runMagi(){},document,scrollY:0};const ctx={window,document,dataRecords:rows,console,setInterval(){return 1},clearInterval(){},Date,URL};vm.createContext(ctx);vm.runInContext(source,ctx);
const collect=window.MAGI_STATS_REPORT_COLLECT;if(typeof collect!=='function')throw new Error('collect hook missing');
function ok(q,target,mode){const r=collect(q);if(r.error)throw new Error(q+': '+r.error);if(r.target!==target)throw new Error(q+': target='+r.target);if(r.mode!==mode)throw new Error(q+': mode='+r.mode);return r}
const exact=ok('嶋田 栄志の通算打撃成績を教えて','嶋田栄志','career');if(Number(exact.records[0].values.ab)!==7||Number(exact.records[0].values.h)!==3)throw new Error('career aggregation mismatch');
const alias=ok('島田栄志の通算打撃成績を教えて','嶋田栄志','career');if(Number(alias.records[0].values.ab)!==7)throw new Error('alias career mismatch');
const ono=ok('大野 竜暉のOPSを教えて','大野竜暉','career');if(!Number.isFinite(Number(ono.records[0].values.ops)))throw new Error('OPS missing');
const current=ok('嶋田 栄志の2026-2027打撃成績を教えて','嶋田栄志','season');if(current.records.length!==1||current.records[0].season!=='2026-2027')throw new Error('season scope mismatch');
console.log('STATS REPORT BROWSER PATH: 4/4 PASS');
