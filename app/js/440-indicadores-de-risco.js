/* ---------- indicadores de risco */
function fnRisk(F,p0,p1){
  let P=fnSeries(F,p0).filter(p=>p.i!=null&&(!p1||p.t<=p1.t));if(P.length<40)return null;
  {let f=1,mud=false;const Q=[P[0]];for(let j=1;j<P.length;j++){const r=P[j].q/P[j-1].q;if(!(r>0.6&&r<1.5)){f*=P[j-1].q/P[j].q;mud=true}Q.push(mud?Object.assign({},P[j],{q:P[j].q*f}):P[j])}if(mud)P=Q}
  const L=FN.L,R=[],X=[],Y=[],Ex=[];
  let saltos=0;for(let j=1;j<P.length;j++){const r=P[j].q/P[j-1].q-1;if(!(r>-0.4&&r<0.5)){saltos++;continue}R.push(r);
    const c0=L.d.cdi?L.d.cdi[P[j-1].i]:null,c1=L.d.cdi?L.d.cdi[P[j].i]:null;Ex.push(c0&&c1?r-(c1/c0-1):r);
    const b0=L.d.ibov?L.d.ibov[P[j-1].i]:null,b1=L.d.ibov?L.d.ibov[P[j].i]:null;if(b0&&b1&&P[j].i-P[j-1].i<=3){X.push(b1/b0-1);Y.push(r)}}
  if(R.length<30)return null;const n=R.length,mu=R.reduce((a,x)=>a+x,0)/n,sd=Math.sqrt(R.reduce((a,x)=>a+(x-mu)*(x-mu),0)/(n-1)),vol=sd*Math.sqrt(252);
  const nd=P[P.length-1].i-P[0].i,tot=P[P.length-1].q/P[0].q-1,ann=Math.pow(1+tot,252/Math.max(1,nd))-1;
  const cdiTot=L.d.cdi?L.d.cdi[P[P.length-1].i]/L.d.cdi[P[0].i]-1:null,cdiAnn=cdiTot!=null?Math.pow(1+cdiTot,252/Math.max(1,nd))-1:null;
  const dn=Math.sqrt(Ex.reduce((a,x)=>a+(x<0?x*x:0),0)/n)*Math.sqrt(252);
  // perda máxima e recuperação
  let pk=P[0].q,pkT=P[0].t,dd=0,ddT=null,ddPk=null,rec=null,cur=0,curPk=null;
  P.forEach(p=>{if(p.q>=pk){pk=p.q;pkT=p.t}else{const x=p.q/pk-1;if(x<dd){dd=x;ddT=p.t;ddPk=pkT}}});
  if(ddT!=null){const pkV=fnPtAt(F,ddPk).q;for(const p of P)if(p.t>ddT&&p.q>=pkV){rec=p.t;break}}
  {const l=P[P.length-1];let mx=0;P.forEach(p=>mx=Math.max(mx,p.q));cur=l.q/mx-1}
  let beta=null,cor=null;if(X.length>40){const mx=X.reduce((a,x)=>a+x,0)/X.length,my=Y.reduce((a,x)=>a+x,0)/Y.length;let sxy=0,sxx=0,syy=0;for(let j=0;j<X.length;j++){sxy+=(X[j]-mx)*(Y[j]-my);sxx+=(X[j]-mx)**2;syy+=(Y[j]-my)**2}beta=sxx?sxy/sxx:null;cor=sxx&&syy?sxy/Math.sqrt(sxx*syy):null}
  const srt=R.slice().sort((a,b)=>a-b),var95=srt[Math.floor(0.05*n)];
  // excesso sobre o CDI (tracking error e information ratio) e CAPM com o Ibovespa (alfa de Jensen e Treynor)
  const me=Ex.reduce((a,x)=>a+x,0)/n,te=Math.sqrt(Ex.reduce((a,x)=>a+(x-me)*(x-me),0)/(n-1))*Math.sqrt(252);
  const i0=P[0].i,i1=P[P.length-1].i,ib=L.d.ibov&&L.d.ibov[i0]&&L.d.ibov[i1]?Math.pow(L.d.ibov[i1]/L.d.ibov[i0],252/Math.max(1,nd))-1:null;
  const alpha=beta!=null&&cdiAnn!=null&&ib!=null?ann-(cdiAnn+beta*(ib-cdiAnn)):null,treynor=beta&&Math.abs(beta)>0.05&&cdiAnn!=null?(ann-cdiAnn)/beta:null;
  return {saltos,te:te*100,ir:cdiAnn!=null&&te>1e-6?(ann-cdiAnn)/te:null,alpha:alpha!=null?alpha*100:null,treynor:treynor!=null?treynor*100:null,ibAnn:ib!=null?ib*100:null,n,vol:vol*100,ann:ann*100,tot:tot*100,cdiAnn:cdiAnn!=null?cdiAnn*100:null,sharpe:cdiAnn!=null&&vol>1e-3?(ann-cdiAnn)/vol:null,sortino:cdiAnn!=null&&dn>1e-6?(ann-cdiAnn)/dn:null,
    dd:dd*100,ddT,ddPk,rec,cur:cur*100,beta,cor,var95:var95*100,best:srt[n-1]*100,worst:srt[0]*100,P};
}
function fnMonthly(F){ // retornos mensais do fundo
  const o=new Map();let prev=null;
  F.MK.forEach(k=>{const q=F.M.get(k).q;if(prev!=null&&prev.k===k-1)o.set(k,(q/prev.q-1)*100);
    else if(prev==null&&F.I.length&&fnMk(FN.T[F.I[0]])===k&&F.Q[0])o.set(k,(q/F.Q[0]-1)*100);prev={k,q}});
  return o;
}
function fnBmMonth(b,k){const m=FN.L&&FN.L.m[b];if(!m||m[k]==null||m[k-1]==null)return null;return (m[k]/m[k-1]-1)*100}

