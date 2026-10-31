/* ---------- carga */
function fnBoot(){
  if(FN.idx||FN.load)return FN.load;
  FN.err=null;
  FN.load=Promise.all([fnGet("idx_p.json").catch(()=>fnGet("idx.json")),fnGet("cal.json"),fnGet("bench.json")]).then(([i,c,b])=>{
    FN.idx=i;FN.C={};i.cols.forEach((n,k)=>FN.C[n]=k);FN.full=!i.resto;FN.more=null;
    FN.sk=i.rows.map(r=>fnNorm(r[1]+" "+r[0]+" "+(i.gestores[r[FN.C.gestor]]||"")));
    FN.cal=c.d;FN.T=c.d.map(d=>Date.parse(d+"T00:00:00Z"));FN.B=b;fnLevels();
    FN.load=null;fnHash();fnCalc();extApply();if(!FN.full)setTimeout(fnMore,2500);
  }).catch(e=>{FN.err=e;FN.load=null;fnCalc()});
  return FN.load;
}
function fnMore(){ // segunda parte do índice: fundos exclusivos (carregada depois, para a área abrir mais rápido)
  if(!FN.idx||FN.full)return Promise.resolve();if(FN.more)return FN.more;const I=FN.idx;
  FN.more=fnGet("idx_x.json").then(x=>{if(FN.idx!==I||FN.full)return;
    if(x.geradoEm!==I.geradoEm)return fnGet("idx.json").then(j=>{if(FN.idx!==I)return;const vis=new Set(I.rows.map(r=>r[0]));fnMoreAdd(j.rows.filter(r=>!vis.has(r[0])))});
    fnMoreAdd(x.rows)}).catch(()=>{FN.more=null});
  return FN.more;
}
function fnMoreAdd(rows){
  const I=FN.idx,miss=FN.cur&&!fnRow(FN.cur);rows.forEach(r=>{I.rows.push(r);FN.sk.push(fnNorm(r[1]+" "+r[0]+" "+(I.gestores[r[FN.C.gestor]]||"")))});FN.full=true;
  if(!FNM.has(activeMod))return;
  if(activeMod==="fr"||activeMod==="fg"||(activeMod==="fa"&&miss))fnCalc();
  const q=$("fnQ");if(activeMod==="fa"&&q&&q.value.trim())q.dispatchEvent(new Event("input",{bubbles:true}));
}
function lvBuild(cal,B){ // níveis acumulados dos índices: diários (alinhados ao calendário) e de fim de mês
  B=B||{d:{},m:{}};const n=cal.length,L={d:{},m:{}},mk=d=>+d.slice(0,4)*12+(+d.slice(4,6))-1;
  const mm=(o)=>{const r={};Object.keys(o||{}).forEach(k=>r[mk(k)]=o[k]);return r};
  const cdiM=mm(B.m.cdi),ipcaM=mm(B.m.ipca);
  const keys=Object.keys(cdiM).map(Number).sort((a,b)=>a-b);
  const acc=(src)=>{const ks=Object.keys(src).map(Number).sort((a,b)=>a-b);const o={};if(!ks.length)return o;let v=1;o[ks[0]-1]=1;for(let k=ks[0];k<=ks[ks.length-1];k++){if(src[k]==null){o[k]=v;continue}v*=1+src[k]/100;o[k]=v}return o};
  L.m.cdi=acc(cdiM);L.m.ipca=acc(ipcaM);L.ipcaLast=Math.max(...Object.keys(ipcaM).map(Number));
  ["ibov","ifix","usd","imab","imab5","imab5p","irfm","imas","imag"].forEach(b=>{const o={};Object.keys(B.m[b]||{}).forEach(k=>o[mk(k)]=B.m[b][k]);L.m[b]=o});
  const k0=n?mk(cal[0].slice(0,4)+cal[0].slice(5,7)):0;
  // CDI diário encadeado a partir do fim do mês anterior ao calendário
  if(B.d.cdi&&n){const a=new Array(n);let v=L.m.cdi[k0-1]||1;for(let i=0;i<n;i++){v*=1+(B.d.cdi[i]||0)/100;a[i]=v}L.d.cdi=a}
  // IPCA diário: rateado pelos dias úteis de cada mês
  if(n){const a=new Array(n),byM={};cal.forEach((d,i)=>{const k=mk(d.slice(0,4)+d.slice(5,7));(byM[k]=byM[k]||[]).push(i)});
    Object.keys(byM).map(Number).sort((x,y)=>x-y).forEach(k=>{const ids=byM[k],base=L.m.ipca[k-1]!=null?L.m.ipca[k-1]:null,v=ipcaM[k];ids.forEach((i,j)=>{a[i]=base==null?null:v==null?base:base*Math.pow(1+v/100,(j+1)/ids.length)})});L.d.ipca=a}
  ["ibov","ifix","usd","imab","imab5","imab5p","irfm","imas","imag"].forEach(b=>{if(B.d[b])L.d[b]=B.d[b]});
  return L;
}
function fnLevels(){FN.L=lvBuild(FN.cal,FN.B)}
function fnUse(X,f){const s={T:FN.T,L:FN.L,cal:FN.cal};FN.T=X.T;FN.L=X.L;FN.cal=X.cal;try{return f()}finally{FN.T=s.T;FN.L=s.L;FN.cal=s.cal}}
async function fnFund(k){
  if(FN.files.has(k))return FN.files.get(k);
  const j=await fnGet("f/"+k+".json");const F=fnDecode(j);FN.files.set(k,F);return F;
}
function fnDecode(j){
  const I=[],Q=[];
  if(j.i0!=null&&j.q0){let q=j.q0;I.push(j.i0);Q.push(q);(j.r||[]).forEach((r,n)=>{if(r==null)return;q*=Array.isArray(r)?r[0]:1+r/1e6;if(!(q>0))return;I.push(j.i0+1+n);Q.push(q)})}
  const M=new Map();
  if(j.m0){const k0=+j.m0.slice(0,4)*12+(+j.m0.slice(4))-1,d0=j.d0?+j.d0.slice(0,4)*12+(+j.d0.slice(4))-1:null;
    (j.mq||[]).forEach((q,n)=>{if(q==null)return;const k=k0+n,o=d0!=null?k-d0:-1,g=a=>a&&o>=0&&o<a.length?a[o]:null;
      M.set(k,{q,pl:j.mpl&&j.mpl[n]!=null?j.mpl[n]*1e3:null,cot:g(j.mc),ca:g(j.mca)!=null?g(j.mca)*1e3:null,re:g(j.mre)!=null?g(j.mre)*1e3:null})})}
  const MK=[...M.keys()].sort((a,b)=>a-b);
  return Object.assign(j,{I,Q,M,MK});
}
const fnMk=t=>{const d=new Date(t);return d.getUTCFullYear()*12+d.getUTCMonth()};
const fnMt=k=>Date.UTC(Math.floor(k/12),k%12+1,0);

