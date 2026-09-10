(()=>{
'use strict';
if(window.MAGI_PITCHING_ROLE_COLORS_V336)return;
window.MAGI_PITCHING_ROLE_COLORS_V336=true;

const id='magiPitchingRoleColorsV336';
if(document.getElementById(id))return;
const s=document.createElement('style');
s.id=id;
s.textContent=`
/* Strong color-only distinction. Layout, spacing, sizing and table structure stay unchanged. */
.magiOpponentRoleV335.isStart .statsBreakdownHead{
  background:#244c75!important;
}
.magiOpponentRoleV335.isStart .statsBreakdownHead b,
.magiOpponentRoleV335.isStart .statsBreakdownHead span{
  color:#ffffff!important;
}
.magiOpponentRoleV335.isStart .statsBreakdownTable thead th{
  background:#3d6389!important;
  color:#ffffff!important;
}

.magiOpponentRoleV335.isRelief .statsBreakdownHead{
  background:#8d1420!important;
}
.magiOpponentRoleV335.isRelief .statsBreakdownHead b,
.magiOpponentRoleV335.isRelief .statsBreakdownHead span{
  color:#ffffff!important;
}
.magiOpponentRoleV335.isRelief .statsBreakdownTable thead th{
  background:#a23a44!important;
  color:#ffffff!important;
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
