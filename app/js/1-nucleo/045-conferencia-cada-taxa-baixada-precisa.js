/* ---------- conferência: cada taxa baixada precisa reproduzir o preço publicado ---------- */
let CHECK={},CHK={ok:0,n:0,bad:[]},TD_DATE=null,TD_DATE_K={};
function runChecks(){
  CHECK={};CHK={ok:0,n:0,bad:[]};
  const mark=(k,d,ok,pre)=>{CHECK[(pre||"")+k+"|"+d]=ok;CHK.n++;if(ok)CHK.ok++;else CHK.bad.push(KIND[k].td+" "+new Date(parseDate(d)).getUTCFullYear()+(pre?" (Tesouro Direto)":""))};
  for(const k of ["LTN","NTNF","NTNB","LFT"])for(const [d,r,pu] of MKT[k]||[]){if(!(pu>0))continue;const c=price(k,flowsFrom(k,VAL,d),r,vnaFor(k,VAL)).pu;mark(k,d,Math.abs(c-pu)<=0.01)}
  // Tesouro Direto: descobre a data em que os preços publicados foram calculados
  const rows=Object.entries(TD_ALL).filter(([x,v])=>v.price>0).map(([x,v])=>{const [k,d]=x.split("|");return [k,d,v.rate,v.price]}).filter(x=>matOf(x[0],x[1])>VAL);
  const calcAt=(t,[k,d,r])=>{const K=KIND[k],v=K.idx?vnaFor(k,t):null;if(K.idx&&!isFinite(v))return NaN;const fl=flowsFrom(k,t,d);return fl.length?price(k,fl,r,v).pu:NaN};
  let best=null,bestN=-1,t=VAL;{const tq=parseDate(DATA_INFO.tdDate||"");if(isFinite(tq)&&tq>VAL){t=tq;let k=0;do{t+=DAY}while(!isBiz(t)&&++k<6)}}
  for(let i=0;i<10&&rows.length;i++){const n=rows.filter(x=>Math.abs(calcAt(t,x)-x[3])<=x[3]*0.0002).length;if(n>bestN){bestN=n;best=t}if(n===rows.length)break;do{t-=DAY}while(!isBiz(t))}
  TD_DATE=rows.length?best:null;TD_DATE_K={};
  for(const k of [...new Set(rows.map(x=>x[0]))]){const R=rows.filter(x=>x[0]===k);let bk=TD_DATE,bn=R.filter(x=>Math.abs(calcAt(TD_DATE,x)-x[3])<=x[3]*0.0002).length,tt=TD_DATE+5*DAY;
    if(bn<R.length)for(let i=0;i<10;i++){const n=R.filter(x=>Math.abs(calcAt(tt,x)-x[3])<=x[3]*0.0002).length;if(n>bn){bn=n;bk=tt}do{tt-=DAY}while(!isBiz(tt))}
    TD_DATE_K[k]=bk}
  for(const x of rows)mark(x[0],x[1],Math.abs(calcAt(TD_DATE_K[x[0]]||TD_DATE,x)-x[3])<=x[3]*0.0002,"TD|");
}
function checkLine(){
  if(!CHK.n)return "";
  return CHK.bad.length?" Atenção: "+CHK.bad.length+" de "+CHK.n+" preços publicados não conferem com o cálculo ("+CHK.bad.slice(0,4).join(", ")+(CHK.bad.length>4?"…":"")+")."
    :" Conferência: os "+CHK.n+" preços publicados batem com o cálculo.";
}

