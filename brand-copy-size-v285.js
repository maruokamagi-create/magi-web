(()=>{
  'use strict';
  const id='magi-brand-copy-size-v285-style';
  if(document.getElementById(id)) return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=`
    .magiBrandEn{font-size:calc(11.5px + 1pt)!important}
    .magiBrandCatch{font-size:calc(11px + 1pt)!important}
    @media(max-width:430px){
      .magiBrandEn,.magiBrandCatch{font-size:calc(8.7px + 1pt)!important}
    }
  `;
  document.head.appendChild(style);
})();
