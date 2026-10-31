/* ---------- aplicação dos dados de mercado ---------- */
function applyData(d){CALC_GEN++;if(d&&d.dolar&&d.dolar.venda)FX_TOP=d.dolar;
  const v=parseDate(d.refDate);if(isNaN(v))return false;
  VAL=v;K_VAL=new Date(VAL).getUTCFullYear()*12+new Date(VAL).getUTCMonth();
  if(isFinite(d.selicOver)&&d.selicOver>0)SELIC_OVER=+d.selicOver;
  if(d.ipca)for(const [k,val] of Object.entries(d.ipca).sort()){if(!/^\d{6}$/.test(k)||!isFinite(val)||!(val>0))continue;const kk=+k.slice(0,4)*12+(+k.slice(4)-1),prev=IPCA[kk-1];if(prev&&Math.abs(val/prev-1)>0.03)continue;if(IPCA[kk]!=null&&Math.abs(val/IPCA[kk]-1)>0.0005)continue;IPCA[kk]=+val}
  if(d.selicMonthly)for(const [k,val] of Object.entries(d.selicMonthly)){
    if(!/^\d{6}$/.test(k)||!isFinite(val))continue;
    const kk=+k.slice(0,4)*12+(+k.slice(4)-1);if(kk<=SELIC_EMBED_LAST||kk>=K_VAL)continue;
    const y=Math.floor(kk/12),m=kk%12,exp=(Math.pow(1+SELIC_OVER/100,du(utc(y,m,1),utc(y,m+1,1))/252)-1)*100;
    SELIC[kk]=Math.abs(val-exp)>0.25?exp:+val;
  }
  const a=d.anbima||{};
  const RNG={LTN:[3,30],NTNF:[3,30],NTNB:[-2,15],LFT:[-1,1]};
  for(const k of ["LTN","NTNF","NTNB","LFT"])if(Array.isArray(a[k])&&a[k].length)MKT[k]=a[k].filter(r=>Array.isArray(r)&&!isNaN(parseDate(r[0]))&&isFinite(r[1])&&r[1]>=RNG[k][0]&&r[1]<=RNG[k][1]).map(r=>[r[0],+r[1],+r[2]]);
  // VNA na data de referência, implícito nos preços ANBIMA
  VNA_B=NaN;VNA_LFT=NaN;
  VNA_B=median((MKT.NTNB||[]).filter(r=>r[2]>0).map(r=>{const c=price("NTNB",flowsFrom("NTNB",VAL,r[0]),r[1],100).cot;return r[2]/c*100}));
  VNA_LFT=median((MKT.LFT||[]).filter(r=>r[2]>0).map(r=>{const c=price("LFT",flowsFrom("LFT",VAL,r[0]),r[1],100).cot;return r[2]/c*100}));
  if(!isFinite(VNA_B)){VNA_B=NaN;const x=vnaIpca(VAL);VNA_B=x}
  MKT.NTNBP=NTNBP_MATS.map(m=>(MKT.NTNB||[]).find(r=>r[0]===m)).filter(Boolean).map(r=>[r[0],r[1],0]);
  const td=d.td||{};
  if(Array.isArray(td.ALL)&&td.ALL.length){TD_ALL={};td.ALL.forEach(r=>{if(Array.isArray(r)&&KIND[r[0]]&&!isNaN(parseDate(r[1]))&&isFinite(r[2])&&r[2]>-5&&r[2]<40)TD_ALL[r[0]+"|"+r[1]]={rate:+r[2],price:+r[3]||0,buy:r[4]!=null&&isFinite(r[4])?+r[4]:null}})}
  else if(Array.isArray(td.RENDA)||Array.isArray(td.EDUCA)){TD_ALL={};[["RENDA",td.RENDA],["EDUCA",td.EDUCA]].forEach(([k,L])=>(L||[]).forEach(r=>{if(isFinite(r[0])&&isFinite(r[1]))TD_ALL[k+"|"+(+r[0])+"-01-15"]={rate:+r[1],price:+r[2]||0}}))}
  if(Array.isArray(td.RENDA)&&td.RENDA.length)MKT.RENDA=td.RENDA.filter(r=>isFinite(r[0])&&isFinite(r[1])).map(r=>[(+r[0])+"-01-15",+r[1],+r[2]||0]);
  if(Array.isArray(td.EDUCA)&&td.EDUCA.length)MKT.EDUCA=td.EDUCA.filter(r=>isFinite(r[0])&&isFinite(r[1])).map(r=>[(+r[0])+"-01-15",+r[1],+r[2]||0]);
  ["RENDA","EDUCA"].forEach(k=>{const L=Object.entries(TD_ALL).filter(([x])=>x.startsWith(k+"|")).map(([x,v])=>[x.split("|")[1],v.rate,v.price]);if(L.length)MKT[k]=L.sort((a,b)=>a[0].localeCompare(b[0]))});
  ["LTN","NTNF","LFT","NTNB","NTNBP"].forEach(k=>{MKT[k]=MKT[k]||[];Object.keys(TD_ALL).forEach(x=>{const [kk,dd]=x.split("|");if(kk===k&&!MKT[k].some(r=>r[0]===dd)&&parseDate(dd)>VAL)MKT[k].push([dd,NaN,0])});MKT[k].sort((a,b)=>a[0].localeCompare(b[0]))});
  if(Array.isArray(d.curvePre)&&d.curvePre.length){const cv=d.curvePre.filter(r=>Array.isArray(r)&&r[0]>0&&r[1]>2&&r[1]<40).map(r=>[+r[0],+r[1]]).sort((a,b)=>a[0]-b[0]);if(cv.length>=5)CURVE_PRE=cv}
  if(d.cdiDaily&&typeof d.cdiDaily==='object'){const ref=(Math.pow(1+SELIC_OVER/100,1/252)-1)*100;for(const [k,v] of Object.entries(d.cdiDaily))if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&isFinite(v)&&v>0&&v<0.1&&Math.abs(v/ref-1)<0.35)CDI_DAILY[k]=+v}
  DATA_INFO={refDate:d.refDate,updatedAt:d.updatedAt||"",tdSource:td.source||DATA_INFO.tdSource||"",tdDate:td.date||""};
  runChecks();
  return true;
}
