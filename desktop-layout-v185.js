(()=>{
  const css=`
  @media(min-width:721px) and (max-width:899px){
    .personaGrid,.hubGrid{grid-template-columns:1fr}
    .flowGrid,.criteriaGrid{grid-template-columns:repeat(2,1fr)}
    .persona p,.persona li,.flow p{font-size:14px}
  }
  @media(min-width:900px){
    .wrap{width:min(100%,1280px);max-width:none;padding:24px clamp(20px,2.2vw,32px) 72px}
    .hero{padding-left:8px;padding-right:8px}.hero .jp{font-size:18px}.hero p{font-size:16px;max-width:1040px}
    .statement{font-size:16px;padding:16px 19px}.section{margin-top:24px}.sectionHead h2{font-size:24px}
    .personaGrid,.flowGrid,.criteriaGrid,.hubGrid{gap:14px}.persona{padding:18px;min-height:190px}
    .persona p,.persona li{font-size:15px;line-height:1.75}.personaLead{font-size:15px!important;max-width:1120px}
    .flow{padding:17px}.flow h3{font-size:17px}.flow p{font-size:15px;line-height:1.7}
    .criteria{padding:16px 12px}.criteria b{font-size:15px}.criteria small{font-size:11px}
    .rulesPanel,.hubPanel,.routePanel,.advancedPanel,.drivePanel,.card{padding:18px}
    .rulesText,.hubText,.driveHelp,.routeHelp,.advancedPanel p{font-size:15px}.hubTitle{font-size:18px}
    .dataState,.driveState{font-size:14px;padding:13px}label{font-size:16px}
    textarea{min-height:150px;padding:16px;font-size:17px;line-height:1.65}
    .signals{padding:16px;margin-top:16px}.chip{font-size:12px;padding:7px 11px}
    .reportHeader{padding:20px 22px}.reportTitle{font-size:29px}.reportSub{font-size:13px}
    .caseMeta{font-size:12px;min-width:220px;padding:10px 12px}.caseQuestion{font-size:21px;line-height:1.55}
    .answerWrap{padding:14px}.answer{padding:20px;margin-bottom:14px}.answer .name{font-size:18px}
    .answer .roleSmall,.answer .confidence{font-size:13px}.answer p{font-size:16px;line-height:1.85}
    .meta{gap:12px}.mini{padding:12px}.mini b{font-size:12px}.mini span{font-size:14px;line-height:1.7}
    .final{padding:22px}.verdict{font-size:31px}.vote,.note,.humanDecision{font-size:13px}
    .history{padding:16px}.historyItem{font-size:13px}
  }
  `;
  const old=document.getElementById('magi-desktop-layout-v185-style');if(old)old.remove();
  const st=document.createElement('style');st.id='magi-desktop-layout-v185-style';st.textContent=css;document.head.appendChild(st);
  window.MAGI_DESKTOP_LAYOUT_V185=true;
})();
