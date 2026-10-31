/* ===== Carteira: exposições e teste de estresse (modelo de fatores com retornos mensais) ===== */
const ST={ima:null,load:null,sel:0};
function stIma(){const I=(typeof MK==="object"&&MK.ima)||ST.ima;if(I||ST.load)return I;ST.load=fetch(ROBO+"ima.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(j=>{ST.ima=j;ST.load=null;if(activeMod==="sp"&&typeof spRun==="function")spRun()}).catch(()=>{ST.load=null});return null}
/* duração modificada (anos) de um índice ANBIMA */
function stDur(nome,pad){const I=stIma(),x=I&&I.indices&&I.indices.find(r=>String(r.nome).toUpperCase()===nome);return x&&x.duration?x.duration/252/(1+(x.yield||x.taxa||10)/100):pad}
const ST_NF=5;
function stSolve(A,b){const n=b.length,M=A.map((r,i)=>r.concat([b[i]]));for(let p=0;p<n;p++){let mx=p;for(let r=p+1;r<n;r++)if(Math.abs(M[r][p])>Math.abs(M[mx][p]))mx=r;[M[p],M[mx]]=[M[mx],M[p]];if(Math.abs(M[p][p])<1e-14)return null;for(let r=p+1;r<n;r++){const f=M[r][p]/M[p][p];for(let c=p;c<=n;c++)M[r][c]-=f*M[p][c]}}const x=new Array(n).fill(0);for(let p=n-1;p>=0;p--){let t=M[p][n];for(let c=p+1;c<n;c++)t-=M[p][c]*x[c];x[p]=t/M[p][p]}return x}
/* retorno mensal de cada fator: Ibovespa, IMA-B e IRF-M em excesso ao CDI; dólar e S&P 500 em dólar (IVVB11 ÷ dólar) sem descontar o CDI */
function stFat(k,p,c){const L=FN.L,g=(f,kk)=>(L.m[f]||{})[kk];const r=f=>g(f,k)&&g(f,p)?g(f,k)/g(f,p)-1:null;const su=g("spx",k)&&g("spx",p)&&g("usd",k)&&g("usd",p)?(g("spx",k)/g("usd",k))/(g("spx",p)/g("usd",p))-1:null;
  let s2=su;if(s2==null&&typeof EU==="object"&&EU.S&&EU.S.spx){const em=kk=>{const q=euAt(EU.S.spx,Date.UTC(Math.floor(kk/12),kk%12+1,0,23));return q?q[1]:null},a=em(k),b=em(p);if(a&&b)s2=a/b-1}
  return [r("ibov")!=null?r("ibov")-c:null,r("usd"),r("imab")!=null?r("imab")-c:null,r("irfm")!=null?r("irfm")-c:null,s2]}
/* retornos mensais em excesso ao CDI: item e fatores (Ibovespa, dólar, IMA-B, IRF-M), últimos 60 meses */
function stDados(m){
  const L=FN.L;if(!L||!m)return null;const cdi=L.m.cdi||{};const ks=[...m.keys()].sort((a,b)=>a-b);const ys=[],xs=[];
  for(let i=1;i<ks.length;i++){const k=ks[i],p=ks[i-1];if(k!==p+1)continue;const c=cdi[k]&&cdi[p]?cdi[k]/cdi[p]-1:null;if(c==null)continue;
    const fx_=stFat(k,p,c);if(fx_.slice(0,4).some(v=>v==null))continue;if(fx_[4]==null)fx_[4]=0;ys.push(m.get(k)/m.get(p)-1-c);xs.push(fx_)}
  const n=ys.length,ini=Math.max(0,n-60);return {y:ys.slice(ini),x:xs.slice(ini)};
}
function stBeta(m){
  const D=stDados(m);if(!D||D.y.length<24)return null;const n=D.y.length,N=ST_NF,mx=new Array(N).fill(0);let my=0;
  D.x.forEach(r=>r.forEach((v,j)=>mx[j]+=v/n));D.y.forEach(v=>my+=v/n);
  const A=[...Array(N)].map(()=>new Array(N).fill(0)),b=new Array(N).fill(0);let syy=0;
  for(let i=0;i<n;i++){const x=D.x[i].map((v,j)=>v-mx[j]),y=D.y[i]-my;syy+=y*y;for(let a=0;a<N;a++){b[a]+=x[a]*y;for(let c=0;c<N;c++)A[a][c]+=x[a]*x[c]}}
  const lam=1e-6*n;for(let a=0;a<N;a++)A[a][a]+=lam;const be=stSolve(A,b);if(!be)return null;
  let sse=0;for(let i=0;i<n;i++){const x=D.x[i].map((v,j)=>v-mx[j]),y=D.y[i]-my;const e=y-be.reduce((s,v,j)=>s+v*x[j],0);sse+=e*e}
  return {b:be,r2:syy>0?Math.max(0,1-sse/syy):0,n};
}
/* cenários: choques instantâneos nos fatores (retorno de cada fator, em fração) */
function stCenarios(){
  const dB=stDur("IMA-B",6.5),dP=stDur("IRF-M",2.2);
  const S=[{n:"Juros sobem 1 ponto",d:"todas as taxas (prefixadas e reais) sobem 1 p.p.",f:[0,0,-dB/100,-dP/100,0]},
    {n:"Juros caem 1 ponto",d:"todas as taxas caem 1 p.p.",f:[0,0,dB/100,dP/100,0]},
    {n:"Dólar sobe 10%",d:"real se desvaloriza 10%",f:[0,0.10,0,0,0]},
    {n:"Ibovespa cai 20%",d:"queda forte da Bolsa",f:[-0.20,0,0,0,0]},
    {n:"S&P 500 cai 20%",d:"queda forte da Bolsa americana, em dólar",f:[0,0,0,0,-0.20]},
    {n:"Estresse doméstico",d:"Bolsa −15%, dólar +12%, juros +2 p.p.",f:[-0.15,0.12,-2*dB/100,-2*dP/100,0]}];
  const L=FN.L;if(L&&L.m){const H=[["Crise global de 2008","set a nov/2008",2008*12+7,2008*12+10],["Crise fiscal e rebaixamento do Brasil","mai a set/2015",2015*12+3,2015*12+8],["Joesley Day","mai/2017",2017*12+3,2017*12+4],["Pandemia","fev e mar/2020",2020*12,2020*12+2],["Estresse fiscal","nov e dez/2024",2024*12+9,2024*12+11]];
    H.forEach(([n,d,k0,k1])=>{const c=(L.m.cdi||{})[k1]&&(L.m.cdi||{})[k0]?L.m.cdi[k1]/L.m.cdi[k0]-1:0,f=stFat(k1,k0,0);if(f[0]==null||f[1]==null)return;S.push({n,d,f:f.map(v=>v==null?0:v),h:[k0,k1]})})}
  return S;
}
/* efeito do choque: Bolsa e juros somam; dólar e S&P 500 compõem (multiplicam), como num ativo no exterior convertido em reais */
function stImp(b,f,base){return (1+base+b[0]*f[0]+b[2]*f[2]+b[3]*f[3])*(1+b[1]*f[1])*(1+b[4]*f[4])-1}
function spStressHtml(c,it,R){
  if(!R||!R.D||!FN.L)return "";if(typeof EU==="object"&&!EU.S&&!EU.load&&!EU.err)euBoot();const pesos=it.map(x=>+x.w||0),tot=pesos.reduce((a,b)=>a+b,0);if(!tot)return "";
  const B=R.D.map(d=>stBeta(d.m)),S=stCenarios(),pat=R.pts&&R.pts.length?R.pts[R.pts.length-1].v:(+c.valor||0);
  const cdiK=FN.L.m.cdi||{};
  // exposições ponderadas
  const ex=[0,0,0,0,0];let cob=0;B.forEach((b,i)=>{if(!b)return;cob+=pesos[i]/tot;b.b.forEach((v,j)=>ex[j]+=v*pesos[i]/tot)});
  const dB=stDur("IMA-B",6.5),dP=stDur("IRF-M",2.2),durEq=ex[2]*dB+ex[3]*dP;
  const kp=(a,b,cc)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  const maior=it.map((x,i)=>[spItemNome(x),pesos[i]/tot*100]).sort((a,b)=>b[1]-a[1]);
  let h='<section class="panel" data-reltit="Exposições e teste de estresse"><h3>Exposições e teste de estresse</h3><p class="sub">Quanto a carteira tende a ganhar ou perder em choques de mercado. Cada item é medido pela forma como reagiu, mês a mês nos últimos 5 anos, ao Ibovespa, ao dólar, ao S&P 500 e aos juros (IMA-B e IRF-M); a carteira soma os itens pelos pesos.</p>';
  h+='<div class="fnkpis">'+kp("Sensibilidade à Bolsa",fx(ex[0],2),'beta: Ibovespa +10% → carteira '+mcSig(ex[0]*10,1))+kp("Exposição ao dólar",fx(ex[1]*100,0)+'%','dólar +10% → carteira '+mcSig(ex[1]*10,1))+kp("Sensibilidade aos juros",fx(durEq,1)+' anos','duração equivalente: juros +1 p.p. → '+mcSig(-durEq,1))+kp("Maior item",fx(maior[0][1],0)+'%',esc(String(maior[0][0]).slice(0,40)))+kp("Sensibilidade à Bolsa americana",fx(ex[4],2),'S&P 500 +10% (em dólar) → carteira '+mcSig(ex[4]*10,1))+(cob<0.995?kp("Itens medidos",fx(cob*100,0)+'% da carteira','os demais têm menos de 2 anos de histórico'):'')+'</div>';
  // cenários
  const real=(d,k0,k1)=>{const a=d.m.get(k0),b=d.m.get(k1);return a&&b?b/a-1:null};
  const linhas=S.map((s,si)=>{let imp=0,est=false;const cont=it.map((x,i)=>{const w=pesos[i]/tot;let r=null;
      if(s.h){r=real(R.D[i],s.h[0],s.h[1]);if(r==null&&B[i]){const cdi=cdiK[s.h[1]]&&cdiK[s.h[0]]?cdiK[s.h[1]]/cdiK[s.h[0]]-1:0;r=stImp(B[i].b,s.f.map((v,j)=>j===1||j===4?v:v-cdi),cdi);est=true}}
      else if(B[i])r=stImp(B[i].b,s.f,0);
      if(r==null){r=0;est=true}imp+=w*r;return [spItemNome(x),w*r]});
    return {s,si,imp,est,cont}});
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Cenário</th><th>Carteira</th><th class="c-ph">Em reais</th><th style="text-align:left" class="c-sm">Itens que mais pesam</th></tr></thead><tbody>'
    +linhas.map(l=>{const top=l.cont.slice().sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,2).filter(x=>Math.abs(x[1])>0.0005);return '<tr><td style="text-align:left"><b>'+esc(l.s.n)+'</b><small style="display:block;color:var(--muted)">'+esc(l.s.d)+(l.s.h?' · '+(l.est?'parte estimada':'retorno real da carteira'):'')+'</small></td><td>'+mcSig(l.imp*100,1)+'</td><td class="c-ph">'+(pat?(l.imp<0?'−':'+')+'R$ '+fx(Math.abs(l.imp*pat),0):'—')+'</td><td style="text-align:left" class="c-sm"><small>'+top.map(x=>esc(String(x[0]).slice(0,28))+' '+mcSig(x[1]*100,1)).join('<br>')+'</small></td></tr>'}).join("")+'</tbody></table></div>';
  // sensibilidade por item
  h+='<details style="margin-top:10px"><summary>Sensibilidade de cada item</summary><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Item</th><th>Peso</th><th>Bolsa (beta)</th><th>Dólar</th><th class="c-ph">S&P 500</th><th class="c-ph">Duração equivalente</th><th class="c-ph">Explicado pelo modelo</th></tr></thead><tbody>'
    +it.map((x,i)=>{const b=B[i];return '<tr><td style="text-align:left">'+esc(String(spItemNome(x)).slice(0,48))+'</td><td>'+fx(pesos[i]/tot*100,0)+'%</td>'+(b?'<td>'+fx(Math.abs(b.b[0])<0.005?0:b.b[0],2)+'</td><td>'+fx(b.b[1]*100,0)+'%</td><td class="c-ph">'+fx(Math.abs(b.b[4])<0.005?0:b.b[4],2)+'</td><td class="c-ph">'+fx(b.b[2]*dB+b.b[3]*dP,1)+' anos</td><td class="c-ph">'+fx(b.r2*100,0)+'%</td>':'<td colspan="5"><small>histórico curto</small></td>')+'</tr>'}).join("")+'</tbody></table></div></details>';
  h+='<p class="sub" style="font-size:.8rem">Choques instantâneos, sem contar o rendimento do período. Juros: IMA-B (duração '+fx(dB,1)+' anos) e IRF-M (duração '+fx(dP,1)+' anos) reagem pela duração; o efeito em cada item vem da sensibilidade medida a esses índices. Nos cenários históricos usamos o retorno que a carteira de hoje teria tido; itens sem histórico na época são estimados pelo modelo. CDB, LCI, LCA, debêntures, CRI e CRA simulados com taxa fixa não oscilam no modelo (o valor na curva não muda com o mercado), mas na venda antecipada sofrem o efeito dos juros. "Explicado pelo modelo" = quanto da variação mensal do item os fatores explicam; abaixo de 30%, a estimativa é pouco confiável. É uma medida de risco, não uma previsão.</p></section>';
  return h;
}

