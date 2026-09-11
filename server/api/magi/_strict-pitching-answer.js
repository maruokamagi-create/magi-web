import { runStrictPitchingAudit } from './_drive-pitching-strict.js';

const VERSION='strict-pitching-answer-v3-exact-requested-metrics';
function text(v){return String(v||'').trim();}
function seasonFrom(question,routed){
  const q=text(question), s=text(routed?.specificSeason), t=text(routed?.timeScope);
  if(/通算|全期間/.test(q) || t==='CAREER') return 'career';

  const previousSeasonExplicit =
    /2025\s*[-–—〜~]\s*2026/.test(q) ||
    /2025\s*[-–—〜~]\s*2026/.test(s) ||
    /(?:前|旧)(?:の)?チーム/.test(q) ||
    /(?:前年度|昨年度|昨季|昨シーズン)/.test(q) ||
    t === 'PREVIOUS_SEASON';
  if(previousSeasonExplicit) return 'old';

  const currentSeasonExplicit =
    /2026\s*[-–—〜~]\s*2027/.test(q) ||
    /2026\s*[-–—〜~]\s*2027/.test(s) ||
    /(?:現チーム|今季|今シーズン|今期)/.test(q) ||
    t === 'CURRENT_SEASON';
  if(currentSeasonExplicit) return 'current';

  return 'current';
}
const METRICS=[
  {key:'ERA',label:'防御率',re:/防御率|ERA/i},
  {key:'WHIP',label:'WHIP',re:/WHIP/i},
  {key:'SO',label:'奪三振',re:/奪三振/},
  {key:'IP',label:'投球回',re:/投球回数|投球回|イニング/},
  {key:'BB',label:'与四球',re:/与四球/},
  {key:'HBP',label:'与死球',re:/与死球/},
  {key:'APP',label:'登板数',re:/登板数|登板/},
  {key:'W',label:'勝利',re:/勝利数|勝ち数|勝利(?!打点)|\d勝/},
  {key:'L',label:'敗戦',re:/敗戦数|負け数|敗戦|\d敗/},
  {key:'SV',label:'セーブ',re:/セーブ|SV/i},
  {key:'ER',label:'自責点',re:/自責点/},
  {key:'H',label:'被安打',re:/被安打/},
  {key:'R',label:'失点',re:/失点/},
  {key:'WP',label:'暴投',re:/暴投/},
  {key:'HR',label:'被本塁打',re:/被本塁打|被本塁/},
  {key:'BAA',label:'被打率',re:/被打率/}
];
function regexIndex(q,re){
  const copy=new RegExp(re.source,re.flags.replace('g',''));
  const m=copy.exec(q);return m?m.index:-1;
}
function metricsFrom(q){
  return METRICS
    .map((metric,order)=>({metric,index:regexIndex(q,metric.re),order}))
    .filter(x=>x.index>=0)
    .sort((a,b)=>a.index-b.index||a.order-b.order)
    .map(x=>x.metric)
    .filter((m,i,a)=>a.findIndex(x=>x.key===m.key)===i);
}
function source(a){return {type:'XLSM_MASTER',name:a?.source?.name||'',path:a?.source?.path||'',modifiedTime:a?.source?.modifiedTime||null,parser:a?.parser||''};}
function base({routed,season,answer,evidence=[],src=null,refusedToInvent=false,limitation=null,audit=null}){
  return {
    ok:true,answerEngineVersion:VERSION,route:routed?.route||'',routerVersion:routed?.routerVersion||null,season,
    answer,evidence,source:src,parser:audit?.parser,chosen:audit?.chosen,candidateCount:audit?.candidateCount,
    refusedToInvent,limitation
  };
}

export async function buildStrictPitchingAnswer({question,routed,auditProvider=runStrictPitchingAudit}){
  const players=Array.isArray(routed?.players)?routed.players:[];
  if(players.length!==1){
    return base({routed,season:null,answer:'対象投手を一人に特定できませんでした。',refusedToInvent:true,limitation:'PLAYER_NOT_UNIQUE'});
  }
  const playerName=players[0];
  const season=seasonFrom(question,routed);
  if(season==='career'){
    return base({
      routed,season,
      answer:'通算投手成績は現チームと旧チームの投球回・自責点などを正しく合算して再計算する必要があります。誤集計防止のため、現在のライブ回答では通算値をまだ出しません。',
      refusedToInvent:true,limitation:'CAREER_PITCHING_AGGREGATION_NOT_CONNECTED'
    });
  }

  const audit=await auditProvider({season,playerName});
  const stats=audit?.stats||{};
  const metrics=metricsFrom(text(question));
  const label=season==='current'?'今期':'2025-2026旧チーム';
  const src=source(audit);

  if(metrics.length){
    const found=[];
    const missing=[];
    for(const metric of metrics){
      const value=stats[metric.key];
      if(value===undefined||value==='') missing.push(metric); else found.push({metric,value});
    }
    let answer=found.length?`${playerName}の${label}${found.map(({metric,value})=>`${metric.label}は${value}`).join('、')}です。`:'';
    if(missing.length){
      answer+=`${answer?' ':''}${playerName}の${label}${missing.map(x=>x.label).join('・')}は正本XLSMから確認できませんでした。数値は作りません。`;
    }
    return base({
      routed,season,answer,
      evidence:found.map(({metric,value})=>`${playerName}: ${metric.key}=${value}`),
      src,audit,refusedToInvent:missing.length>0,
      limitation:missing.length?`PITCHING_METRIC_MISSING_${missing.map(x=>x.key).join('_')}`:null
    });
  }

  const parts=[['ERA','防御率'],['APP','登板数'],['IP','投球回'],['SO','奪三振'],['BB','与四球']]
    .filter(([k])=>stats[k]!==undefined&&stats[k]!=='')
    .map(([k,l])=>`${l}${stats[k]}`);
  return base({
    routed,season,
    answer:`${playerName}の${label}投手成績は、${parts.join('、')}です。`,
    evidence:parts,src,audit,refusedToInvent:false,limitation:null
  });
}
