(()=>{
'use strict';
if(window.MAGI_PITCHING_ROLE_COLORS_V336)return;
window.MAGI_PITCHING_ROLE_COLORS_V336=true;

const id='magiPitchingRoleColorsV336';
if(document.getElementById(id))return;
const s=document.createElement('style');
s.id=id;
s.textContent=`
/* Color-only distinction. Layout, spacing, sizing and table structure stay unchanged. */
.magiOpponentRoleV335.isStart .statsBreakdownHead{
  background:#e7f0f8!important;
}
.magiOpponentRoleV335.isStart .statsBreakdownHead b{
  color:#244c75!important;
}
.magiOpponentRoleV335.isStart .statsBreakdownHead span{
  color:#587590!important;
}
.magiOpponentRoleV335.isStart .statsBreakdownTable thead th{
  background:#f2f7fb!important;
  color:#244c75!important;
}

.magiOpponentRoleV335.isRelief .statsBreakdownHead{
  background:#f7e9ec!important;
}
.magiOpponentRoleV335.isRelief .statsBreakdownHead b{
  color:#8d1420!important;
}
.magiOpponentRoleV335.isRelief .statsBreakdownHead span{
  color:#7c4b54!important;
}
.magiOpponentRoleV335.isRelief .statsBreakdownTable thead th{
  background:#fcf3f4!important;
  color:#8d1420!important;
}

@media print{
  .magiOpponentRoleV335.isStart .statsBreakdownHead,
  .magiOpponentRoleV335.isStart .statsBreakdownTable thead th,
  .magiOpponentRoleV335.isRelief .statsBreakdownHead,
  .magiOpponentRoleV335.isRelief .statsBreakdownTable thead th{
    -webkit-print-color-adjust:exact!important;
    print-color-adjust:exact!important;
  }
}
`;
document.head.appendChild(s);
})();
