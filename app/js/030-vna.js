/* ---------- VNA ---------- */
function vnaIpca(t){
  if(t===VAL&&isFinite(VNA_B))return VNA_B;
  const d=new Date(t);let y=d.getUTCFullYear(),m=d.getUTCMonth();
  if(d.getUTCDate()<15){m--;if(m<0){m=11;y--}}
  const b=utc(y,m,15),k=y*12+m,iPrev=IPCA[k-1];
  if(iPrev==null)return NaN;
  const base=1000*iPrev/BASE_IDX,dc=(t-b)/DAY;
  if(dc===0)return trunc(base,6);
  const iCur=IPCA[k];
  if(iCur!=null)return trunc(base*Math.pow(iCur/iPrev,dc/((addMonths(b,1)-b)/DAY)),6);
  // mês corrente sem IPCA divulgado: interpola até o VNA de mercado da data de referência
  if(isFinite(VNA_B)&&VAL>b&&t<VAL&&VAL<addMonths(b,1))return trunc(base*Math.pow(VNA_B/base,dc/((VAL-b)/DAY)),6);
  return NaN;
}
function vnaSelic(t){
  if(t>=VAL)return VNA_LFT;
  const d=new Date(t),k0=d.getUTCFullYear()*12+d.getUTCMonth(),over=1+SELIC_OVER/100;
  const mf=k=>{const y=Math.floor(k/12),m=k%12,st=utc(y,m,1),nx=utc(y,m+1,1);return SELIC[k]!=null?1+SELIC[k]/100:Math.pow(over,du(st,nx)/252)};
  let f;
  const valMonth=utc(Math.floor(K_VAL/12),K_VAL%12,1);
  if(k0===K_VAL)f=Math.pow(over,du(t,VAL)/252);
  else{
    if(SELIC[k0]==null&&k0<SELIC_EMBED_LAST)return NaN;
    const st=utc(d.getUTCFullYear(),d.getUTCMonth(),1),nx=utc(d.getUTCFullYear(),d.getUTCMonth()+1,1);
    f=Math.pow(mf(k0),du(t,nx)/du(st,nx));
    for(let k=k0+1;k<K_VAL;k++)f*=mf(k);
    f*=Math.pow(over,du(valMonth,VAL)/252);
  }
  return trunc(VNA_LFT/f,6);
}
function vnaFor(kind,t){const K=KIND[kind];if(!K.idx)return null;
  if(t>VAL)return K.fam==="selic"?trunc(VNA_LFT*Math.pow(1+SELIC_OVER/100,du(VAL,t)/252),6):vnaIpcaFwd(t);
  return K.fam==="selic"?vnaSelic(t):vnaIpca(t)}
function vnaIpcaFwd(t){ // mesmo mês de aniversário: segue a taxa implícita no VNA da ANBIMA; depois, projeção de IPCA
  const d=new Date(VAL);let y=d.getUTCFullYear(),m=d.getUTCMonth();if(d.getUTCDate()<15){m--;if(m<0){m=11;y--}}
  const b=utc(y,m,15),nb=addMonths(b,1),iPrev=IPCA[y*12+m-1];
  if(iPrev!=null&&isFinite(VNA_B)&&t<nb){const base=1000*iPrev/BASE_IDX,iCur=IPCA[y*12+m];
    if(iCur!=null)return trunc(base*Math.pow(iCur/iPrev,(t-b)/DAY/((nb-b)/DAY)),6);
    if(VAL>b)return trunc(base*Math.pow(VNA_B/base,(t-b)/DAY/((VAL-b)/DAY)),6)}
  return trunc(VNA_B*piFactor(t),6)}

