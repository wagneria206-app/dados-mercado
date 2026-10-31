const CDI_RUNS_END=Date.UTC(2026,9,16);
const CDI_RT=[],CDI_RV=[];CDI_RUNS_RAW.split(",").forEach(s=>{const [d,v]=s.split(":");CDI_RT.push(Date.UTC(+d.slice(0,4),+d.slice(4,6)-1,+d.slice(6,8)));CDI_RV.push(+v)});
function cdiRun(t){if(t<CDI_RT[0]||t>=CDI_RUNS_END)return null;let lo=0,hi=CDI_RT.length-1;if(CDI_RT[hi]<=t)return CDI_RV[hi];while(hi-lo>1){const m=(lo+hi)>>1;if(CDI_RT[m]<=t)lo=m;else hi=m}return CDI_RV[lo]}
const POUP25="0.6889 0.5967 0.7648 0.7013 0.7540 0.8008 0.7588 0.8483 0.7650 0.7110 0.6939 0.7280 0.7338 0.5729 0.7083 0.5859 0.6897 0.6947 0.6760 0.7448 0.6529 0.6884 0.6288 0.6530 0.7200 0.5725 0.6885 0.6278 0.6697 0.5959 0.6476 0.6473 0.5354 0.6148 0.5593 0.5643 0.6015 0.5244 0.5411 0.5960 0.5740 0.6152 0.6924 0.6582 0.6980 0.7519 0.6626 0.7160 0.6849 0.5453 0.6445 0.5456 0.5451 0.5659 0.6056 0.5198 0.5000 0.5000 0.5000 0.5536 0.5000 0.5000 0.5796 0.5000 0.5513 0.5592 0.6157 0.5914 0.5706 0.5474 0.5338 0.6413 0.5719 0.5527 0.6218 0.5371 0.6578 0.6120 0.6235 0.7086 0.6008 0.5623 0.5648 0.5942 0.5868 0.5000 0.6073 0.5228 0.5470"; // poupança, rendimento mensal (BCB SGS 25), jan/2005 a mai/2012
const POUP195="0.4828 0.4973 0.4675 0.4273 0.4273 0.4134 0.4134 0.4134 0.4134 0.4134 0.4134 0.4273 0.4551 0.4761 0.4828 0.5079 0.5925 0.5208 0.5496 0.6132 0.5540 0.5267 0.5461 0.5607 0.5467 0.6059 0.5605 0.5877 0.6043 0.5485 0.6058 0.5882 0.5169 0.6302 0.6079 0.6159 0.6822 0.7317 0.6876 0.6930 0.6799 0.6303 0.7261 0.6327 0.5962 0.7179 0.6311 0.6541 0.7053 0.6629 0.7558 0.6583 0.6609 0.6435 0.6858 0.6708 0.5304 0.6527 0.5000 0.5768 0.5539 0.5626 0.5512 0.5000 0.4690 0.4273 0.4273 0.3994 0.3994 0.3855 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3715 0.3434 0.3434 0.3153 0.2871 0.2871 0.2588 0.2588 0.2446 0.2162 0.2162 0.1733 0.1303 0.1303 0.1159 0.1159 0.1159 0.1159 0.1159 0.1159 0.1159 0.1590 0.1590 0.2019 0.2446 0.2446 0.3012 0.3575 0.4412 0.4902 0.5608 0.5000 0.5976 0.5558 0.6671 0.6491 0.6639 0.7421 0.6814 0.6501 0.6515 0.7082 0.7091 0.5834 0.7404 0.5825 0.7158 0.6808 0.6589 0.7171 0.6136 0.6061 0.5779 0.5693 0.5879 0.5079 0.5333 0.6028 0.5874 0.5367 0.5743 0.5711 0.5678 0.5982 0.5652 0.5826 0.6698 0.6331 0.6097 0.6697 0.6721 0.6707 0.6767 0.6731 0.6751 0.6767 0.6642 0.6751 0.6727 0.6213 0.6744 0.6687 0.6695 0.6718 0.6738 0.6701 0.6698 0.6624"; // poupança, rendimento mensal (BCB SGS 195), desde jun/2012
let CURVE_PRE=[],CDI_DAILY={};
const nextBiz=t=>{while(!isBiz(t))t+=DAY;return t};
function dfCurve(d){ // fator (1+r)^(du/252) da curva pré ANBIMA, flat-forward
  if(d<=0)return 1;
  const V=CURVE_PRE;if(!V.length)return Math.pow(1+SELIC_OVER/100,d/252);
  if(d<=V[0][0])return Math.pow(1+V[0][1]/100,d/252);
  for(let i=1;i<V.length;i++)if(d<=V[i][0]){const [d0,r0]=V[i-1],[d1,r1]=V[i],f0=Math.pow(1+r0/100,d0/252),f1=Math.pow(1+r1/100,d1/252);return f0*Math.pow(f1/f0,(d-d0)/(d1-d0))}
  const [dl,rl]=V[V.length-1];return Math.pow(1+rl/100,dl/252)*Math.pow(1+rl/100,(d-dl)/252);
}
let CALC_GEN=0,CDM=new Map(),CDM_K="";
function cdiDay(t){const k=CALC_GEN+"|"+SC_DI_SHIFT;if(k!==CDM_K){CDM=new Map();CDM_K=k}let v=CDM.get(t);if(v===undefined){v=cdiDay0(t);CDM.set(t,v)}return v}
function cdiDay0(t){ // taxa diária do CDI (fração) no dia útil t
  const k=new Date(t).toISOString().slice(0,10);
  if(CDI_DAILY[k]!=null)return CDI_DAILY[k]/100;
  {const v=cdiRun(t);if(v!=null)return v/100}
  const d=new Date(t),kk=d.getUTCFullYear()*12+d.getUTCMonth();
  if(SELIC[kk]!=null&&kk<K_VAL){const st=utc(d.getUTCFullYear(),d.getUTCMonth(),1),nx=utc(d.getUTCFullYear(),d.getUTCMonth()+1,1);return Math.pow(1+SELIC[kk]/100,1/du(st,nx))-1}
  if(t>=VAL){const n=du(VAL,t);return dfScen(n+1)/dfScen(n)-1}
  return Math.pow(1+SELIC_OVER/100,1/252)-1;
}
let CDS=new Map(),CDS_K="";
function cdiDays(a,b){const k=CALC_GEN+"|"+SC_DI_SHIFT;if(k!==CDS_K){CDS=new Map();CDS_K=k}const key=a+":"+b;let L=CDS.get(key);if(!L){L=[];for(let t=a;t<b;t+=DAY)if(isBiz(t))L.push(cdiDay(t));if(CDS.size>400)CDS.clear();CDS.set(key,L)}return L}
function cdiFactor(a,b,pct){const L=cdiDays(a,b);let f=1;if(pct==null)for(let i=0;i<L.length;i++)f*=1+L[i];else for(let i=0;i<L.length;i++)f*=1+L[i]*pct/100;return f}
function cdiAnnualAt(t){const x=cdiDay(nextBiz(t));return (Math.pow(1+x,252)-1)*100}
function periodFactor(P,a,b){
  if(b<=a)return 1;const n=du(a,b);
  if(P.index==="DI_SPREAD")return cdiFactor(a,b)*Math.pow(1+P.rate/100,n/252);
  if(P.index==="DI_PCT")return cdiFactor(a,b,P.rate);
  return pcRF(P,a,b,P.rate);
}
function pcRF(P,a,b,r){if(!(b>a))return 1;const B=P.dayBasis;if(B==="dc360")return Math.pow(1+r/100,(b-a)/DAY/360);if(B==="dc365")return Math.pow(1+r/100,(b-a)/DAY/365);return Math.pow(1+r/100,du(a,b)/252)}
function impliedIpcaMonth(){ // IPCA do mês corrente implícito no VNA da NTN-B publicado pela ANBIMA (projeção ANBIMA)
  if(!isFinite(VNA_B))return NaN;const d=new Date(VAL);let y=d.getUTCFullYear(),m=d.getUTCMonth();if(d.getUTCDate()<15){m--;if(m<0){m=11;y--}}
  const b=utc(y,m,15),k=y*12+m;if(IPCA[k]!=null||IPCA[k-1]==null)return NaN;const dc=(VAL-b)/DAY;if(dc<1)return NaN;
  const base=1000*IPCA[k-1]/BASE_IDX,dct=(addMonths(b,1)-b)/DAY;const g=Math.pow(VNA_B/base,dct/dc);return g>0.97&&g<1.05?g:NaN;
}
function ipcaFactor(P,t){ // correção do VNE pelo IPCA desde o início da remuneração
  if(P.index!=="IPCA")return 1;
  const s=parseDate(P.start),day=P.annivDay>=1&&P.annivDay<=31?+P.annivDay:new Date(s).getUTCDate(),lag=P.ipcaLag==null?1:P.ipcaLag;
  const anniv=t=>{const d=new Date(t);let y=d.getUTCFullYear(),m=d.getUTCMonth();if(d.getUTCDate()<day){m--;if(m<0){m=11;y--}}return {k:y*12+m,b:utc(y,m,day)}};
  const a0=anniv(s),a1=anniv(t);
  const I=k=>IPCA[k];
  const lastK=Math.max(...Object.keys(IPCA).map(Number));
  const gA=impliedIpcaMonth(),idx=k=>{if(I(k)!=null)return I(k);const g=Math.pow(1+piProj()/100,1/12);if(isFinite(gA)&&!SC_PI_SHIFT&&PI_PROJ==null)return I(lastK)*gA*Math.pow(g,k-lastK-1);return I(lastK)*Math.pow(g,k-lastK)};
  const base=idx(a0.k-lag);
  if(P.ipcaFreq==="anual"){const am=P.annivMonth>=1&&P.annivMonth<=12?P.annivMonth-1:new Date(s).getUTCMonth();const d=new Date(t);let y=d.getUTCFullYear();let A=utc(y,am,day);if(A>t){y--;A=utc(y,am,day)}if(A<s)return 1;return idx(y*12+am-lag)/base}
  const nb=addMonths(a1.b,1),dc=P.prorata==="du"?du(a1.b,t):(t-a1.b)/DAY,dct=P.prorata==="du"?du(a1.b,nb):(nb-a1.b)/DAY;
  return idx(a1.k-lag)/base*Math.pow(idx(a1.k-lag+1)/idx(a1.k-lag),dc/dct);
}
function sched(P){return P.schedule.map(r=>({d:parseDate(r[0]),j:!!r[1],a:+r[2]/100})).sort((x,y)=>x.d-y.d)}
function pcState(P,t){ // saldo (em unidades do VNE, sem correção) e último evento até t
  const S=sched(P);let saldo=+P.vne,L=parseDate(P.start);
  for(const e of S){if(e.d>t)break;
    const F=periodFactor(P,L,e.d),last=e===S[S.length-1];
    if(!e.j&&!last)saldo*=F;
    const am=last||e.a>=0.999999?saldo:(P.basis==="VNE"?P.vne*e.a:saldo*e.a);
    saldo-=am;L=e.d}
  return {saldo,L,future:S.filter(e=>e.d>t)};
}
function pcHistory(P,from,to){ // pagamentos efetivos (por título) entre from (exclusive) e to (inclusive)
  const S=sched(P);let saldo=+P.vne,L=parseDate(P.start);const out=[],sb=pcState(P,from).saldo;
  for(const e of S){if(e.d>to)break;
    const F=periodFactor(P,L,e.d),last=e===S[S.length-1],VF=ipcaFactor(P,e.d);
    let jur=0;if(e.j||last)jur=saldo*(F-1);else saldo*=F;
    const am=last||e.a>=0.999999?saldo:(P.basis==="VNE"?P.vne*e.a:saldo*e.a);
    saldo-=am;if(e.d>from)out.push({t:e.d,amt:(jur+am)*VF,jur:jur*VF,am:am*VF,f:sb>0?am/sb:0});L=e.d}
  return out;
}
function pcPrice(P,t,r,dfFn){ // PU em t descontando à taxa r (spread, % CDI, taxa real ou pré)
  dfFn=dfFn||dfCurve;
  const st=pcState(P,t);if(!st.future.length)return null;
  const VF=ipcaFactor(P,t),acc=periodFactor(P,st.L,t);
  let saldo=st.saldo,prevD=0,pv=0,discPct=1;const rows=[];
  st.future.forEach((e,i)=>{
    const dE=du(t,e.d),n=dE-prevD,last=i===st.future.length-1;
    let fwd,step;
    if(P.index==="DI_SPREAD"){fwd=dfFn(dE)/dfFn(prevD)*Math.pow(1+P.rate/100,du(i?st.future[i-1].d:st.L,e.d)/252)/(i?1:Math.pow(1+P.rate/100,du(st.L,t)/252))}
    else if(P.index==="DI_PCT"){const f=n>0?Math.pow(dfFn(dE)/dfFn(prevD),1/n)-1:0;fwd=Math.pow(1+f*P.rate/100,n);step=Math.pow(1+f*r/100,n)}
    else fwd=pcRF(P,i?st.future[i-1].d:t,e.d,P.rate);
    const F=(i?1:acc)*fwd;
    let jur=0;if(e.j||last)jur=saldo*(F-1);else saldo*=F;
    const am=last||e.a>=0.999999?saldo:(P.basis==="VNE"?P.vne*e.a:saldo*e.a);
    saldo-=am;
    let disc;
    if(P.index==="DI_SPREAD")disc=dfFn(dE)*Math.pow(1+r/100,dE/252);
    else if(P.index==="DI_PCT"){discPct*=step;disc=discPct}
    else disc=pcRF(P,t,e.d,r);
    const flow=(jur+am)*VF;pv+=flow/disc;rows.push({t:e.d,du:dE,flow,jur:jur*VF,am:am*VF,fac:disc,pv:flow/disc});
    prevD=dE;
  });
  return {pu:pv,par:st.saldo*acc*VF,saldo:st.saldo*VF,VF,rows};
}
function dfFlat(t){const a=cdiAnnualAt(t);return d=>Math.pow(1+a/100,d/252)}

const PAPERS0={"MOVI27":{"code":"MOVI27","type":"DEB","incentivada":false,"name":"Movida Participações S.A. – 7ª emissão, 2ª série","index":"DI_SPREAD","rate":2.9,"vne":1000,"start":"2021-09-20","basis":"SALDO","schedule":[["2022-03-15",1,0],["2022-09-15",1,0],["2023-03-15",1,0],["2023-09-15",1,0],["2024-03-15",1,0],["2024-09-16",1,0],["2025-03-17",1,0],["2025-09-15",1,0],["2026-03-16",1,0],["2026-09-15",1,0],["2027-03-15",1,0],["2027-09-15",1,33.3333],["2028-03-15",1,0],["2028-09-15",1,50],["2029-03-15",1,0],["2029-09-17",1,100]],"official":true,"sources":["SND – debentures.com.br (características e agenda de eventos)","ANBIMA – taxas indicativas de debêntures"],"anbima":{"refDate":"2026-10-16","rate":1.8528,"pu":1031.149989},"status":"ok","updatedAt":"2026-10-17T17:40:00-03:00","notes":""},"CRA02300795":{"code":"CRA02300795","type":"CRA","name":"CRA FS Bio – Eco Securitizadora, 243ª emissão, 1ª série","index":"DI_SPREAD","rate":2.9,"vne":1000,"start":"2023-04-28","basis":"SALDO","schedule":[["2023-05-15",1,0],["2023-06-15",1,0],["2023-07-17",1,0],["2023-08-15",1,0],["2023-09-15",1,0],["2023-10-16",1,0],["2023-11-16",1,0],["2023-12-15",1,0],["2024-01-15",1,0],["2024-02-15",1,0],["2024-03-15",1,0],["2024-04-15",1,0],["2024-05-15",1,0],["2024-06-17",1,0],["2024-07-15",1,0],["2024-08-15",1,0],["2024-09-16",1,0],["2024-10-15",1,0],["2024-11-18",1,0],["2024-12-16",1,0],["2025-01-15",1,0],["2025-02-17",1,0],["2025-03-17",1,0],["2025-04-15",1,0],["2025-05-15",1,0],["2025-06-16",1,0],["2025-07-15",1,0],["2025-08-15",1,0],["2025-09-15",1,0],["2025-10-15",1,0],["2025-11-17",1,0],["2025-12-15",1,0],["2026-01-15",1,0],["2026-02-18",1,0],["2026-03-16",1,0],["2026-04-15",1,0],["2026-05-15",1,0],["2026-06-15",1,0],["2026-07-15",1,0],["2026-08-17",1,0],["2026-09-15",1,0],["2026-10-15",1,0],["2026-11-16",1,0],["2026-12-15",1,0],["2027-01-15",1,0],["2027-02-15",1,0],["2027-03-15",1,0],["2027-04-15",1,0],["2027-05-17",1,0],["2027-06-15",1,0],["2027-07-15",1,0],["2027-08-16",1,0],["2027-09-15",1,0],["2027-10-15",1,0],["2027-11-16",1,0],["2027-12-15",1,0],["2028-01-17",1,0],["2028-02-15",1,0],["2028-03-15",1,0],["2028-04-17",1,0],["2028-05-15",1,0],["2028-06-16",1,0],["2028-07-17",1,0],["2028-08-15",1,0],["2028-09-15",1,0],["2028-10-16",1,0],["2028-11-16",1,0],["2028-12-15",1,0],["2029-01-15",1,0],["2029-02-15",1,0],["2029-03-15",1,0],["2029-04-16",1,0],["2029-05-15",1,0],["2029-06-15",1,0],["2029-07-16",1,0],["2029-08-15",1,0],["2029-09-17",1,0],["2029-10-15",1,100]],"official":false,"sources":["Fundos.NET – informe mensal da securitizadora (CDI + 2,90%, juros mensais)","Lâmina da oferta (vencimento 15/10/2029, amortização única)","Relatório Ecoagro dez/2024 (datas de pagamento)"],"status":"ok","updatedAt":"2026-10-17T17:40:00-03:00","notes":"Datas de pagamento estimadas no dia 15 de cada mês (ou próximo dia útil) e início da remuneração estimado em 28/04/2023. A ANBIMA não publica taxa deste papel em formato legível: informe a taxa de mercado."},"CRI22D1226341":{"code":"CRI22D1226341","type":"CRI","name":"CRI Belenus \u2013 Virgo Securitizadora (22D1226341)","index":"IPCA","rate":7.5778,"vne":1000,"start":"2022-04-18","basis":"SALDO","ipcaLag":2,"schedule":[["2022-05-18",1,0.04],["2022-06-20",1,0.06],["2022-07-19",1,0.05],["2022-08-17",1,0.05],["2022-09-19",1,0.06],["2022-10-19",1,0.06],["2022-11-18",1,0.05],["2022-12-19",1,0.06],["2023-01-18",1,0.06],["2023-02-17",1,0.06],["2023-03-17",1,0.05],["2023-04-19",1,0.06],["2023-05-17",1,0.05],["2023-06-19",1,0.06],["2023-07-19",1,0.06],["2023-08-17",1,0.06],["2023-09-19",1,0.06],["2023-10-18",1,0.06],["2023-11-20",1,0.06],["2023-12-19",1,0.06],["2024-01-17",1,0.06],["2024-02-19",1,0.06],["2024-03-19",1,0.06],["2024-04-17",1,0.06],["2024-05-17",1,1.4],["2024-06-19",1,1.46],["2024-07-17",1,1.45],["2024-08-19",1,1.46],["2024-09-18",1,1.55],["2024-10-17",1,1.49],["2024-11-20",1,1.56],["2024-12-18",1,1.61],["2025-01-17",1,1.59],["2025-02-19",1,1.72],["2025-03-19",1,1.75],["2025-04-17",1,1.71],["2025-05-19",1,1.9],["2025-06-18",1,1.86],["2025-07-17",1,1.96],["2025-08-19",1,1.93],["2025-09-17",1,2.03],["2025-10-17",1,1.99],["2025-11-19",1,2.11],["2025-12-17",1,2.13],["2026-01-19",1,2.16],["2026-02-20",1,2.32],["2026-03-18",1,2.35],["2026-04-17",1,2.4],["2026-05-19",1,2.59],["2026-06-17",1,2.58],["2026-07-17",1,2.7],["2026-08-19",1,2.79],["2026-09-17",1,2.82],["2026-10-19",1,2.89],["2026-11-18",1,3.09],["2026-12-17",1,3.17],["2027-01-19",1,3.3],["2027-02-17",1,3.42],["2027-03-17",1,3.57],["2027-04-19",1,3.79],["2027-05-19",1,3.93],["2027-06-17",1,4.04],["2027-07-19",1,4.28],["2027-08-18",1,4.53],["2027-09-17",1,4.7],["2027-10-19",1,4.96],["2027-11-18",1,5.28],["2027-12-17",1,5.21],["2028-01-19",1,5.32],["2028-02-17",1,6.4],["2028-03-17",1,6.81],["2028-04-19",1,7.43],["2028-05-17",1,8.12],["2028-06-20",1,8.8],["2028-07-19",1,9.83],["2028-08-17",1,10.8],["2028-09-19",1,12.25],["2028-10-18",1,15.03],["2028-11-20",1,15.4],["2028-12-19",1,18.8],["2029-01-17",1,21.78],["2029-02-19",1,33.04],["2029-03-19",1,47.02],["2029-04-18",0,100]],"official":false,"sources":["XP Investimentos – página do CRI 22D1226341 (taxa e cronograma de amortização)"],"status":"ok","updatedAt":"2026-10-17T17:40:00-03:00","notes":"Percentuais de amortização com 2 casas decimais e correção pelo IPCA de 2 meses antes estimada; o valor atualizado pode diferir alguns reais do oficial. A ANBIMA não publica taxa deste papel em formato legível: informe a taxa de mercado."}};
