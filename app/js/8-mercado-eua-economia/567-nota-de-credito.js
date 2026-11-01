/* ---------- ratings e nota de crédito do app
   1) Rating informado pelos fundos na CDA da CVM (agência, nota e data), por emissor: títulos de bancos e do exterior.
   2) Rating implícito pelo spread: percentil do spread do papel entre pares de mesmo indexador e prazo parecido (ANBIMA).
   3) Alavancagem do emissor com ações na bolsa (dívida líquida/EBIT, balanços na CVM).
   4) Sinal de problema: CRI/CRA em atraso no informe mensal da CVM.
   A nota do app (1 = risco baixo … 5 = muito elevado) resume esses sinais; não substitui a nota de uma agência. */
const RT={r:null,emp:null,cvm:null,load:null,nm:null};
const RT_FX=["","Baixo","Moderado baixo","Moderado","Elevado","Muito elevado"],RT_COR=["","#16a34a","#65a30d","#ca8a04","#ea580c","#dc2626"];
const RT_SP={AAA:1,"AA+":2,AA:3,"AA-":4,"A+":5,A:6,"A-":7,"BBB+":8,BBB:9,"BBB-":10,"BB+":11,BB:12,"BB-":13,"B+":14,B:15,"B-":16,"CCC+":17,CCC:18,"CCC-":19,CC:20,C:21,D:22,RD:22,SD:22};
const RT_MO={AAA:1,AA1:2,AA2:3,AA3:4,A1:5,A2:6,A3:7,BAA1:8,BAA2:9,BAA3:10,BA1:11,BA2:12,BA3:13,B1:14,B2:15,B3:16,CAA1:17,CAA2:18,CAA3:19,CA:20,C:21};
/* nota da agência em número (1 = AAA … 22 = default); notas de curto prazo (F1, A-1, P-1) ficam de fora */
function rtNum(nota){let n=String(nota||"").toUpperCase().replace(/\s/g,"").replace(/\((BRA?|BR)\)|\.BR$|^BR|\(EXP\)|\(SF\)|SF$|\(P\)/g,"");if(/^(F\d|A-\d|P-\d|BR-\d)/.test(n))return null;return RT_SP[n]||RT_MO[n]||null}
const rtFaixaAg=v=>v==null?null:v<=4?1:v<=7?2:v<=10?3:v<=16?4:5;
const rtNome=s=>fnNorm(s||"").replace(/[.,/()\-–]/g," ").replace(/\b(s ?a|ltda|cia|companhia|de|do|da|dos|das|e|em recuperacao judicial)\b/g," ").replace(/\s+/g," ").trim();
function rtLoad(){if(RT.load||RT.r)return RT.load;
  RT.load=Promise.all([fnGet("ratings.json").catch(()=>null),atGet("emp.json").catch(()=>null),AT.idx?null:atBoot().catch(()=>null)]).then(([r,emp])=>{RT.r=r&&r.e?r:{e:{}};RT.emp=emp||{};
    RT.nm=new Map();Object.entries(RT.r.e).forEach(([raiz,v])=>RT.nm.set(rtNome(v[0]),raiz));RT.en=new Map();Object.entries(RT.emp).forEach(([cod,v])=>{if(v&&v.nome)RT.en.set(rtNome(v.nome),cod)});RT.load=null;rtRefaz()}).catch(()=>{RT.r={e:{}};RT.emp={};RT.load=null});
  return RT.load}
function rtCvm(){if(RT.cvm||RT.cvmLoad)return;RT.cvmLoad=roboGet("cri_cra_cvm.json").then(j=>{RT.cvm=(j&&j.certificados)||{};rtRefaz()}).catch(()=>{RT.cvm={}})}
function rtRefaz(){try{if(activeMod==="cr"&&$("crBusca"))crbTabela();else if(activeMod==="sp")spCalc()}catch(e){}}
/* rating da CDA por raiz de CNPJ ou por nome do emissor */
function rtAg(raiz,nome){if(!RT.r)return null;let e=raiz&&RT.r.e[raiz];if(!e&&nome&&RT.nm){let k=RT.nm.get(rtNome(nome));
    if(!k){const tk=rtNome(nome).split(" ").filter(w=>w.length>=4&&w!=="banco");if(tk.length){let best=null,bn=0;RT.nm.forEach((rz,nm)=>{if(tk.every(w=>nm.split(" ").includes(w))){const n=RT.r.e[rz][2].reduce((a,x)=>a+x[2],0);if(n>bn){bn=n;best=rz}}});k=best}}
    e=k&&RT.r.e[k];if(e)raiz=k}if(!e)return null;
  const L=e[2].map(([ag,nota,n])=>({ag,nota,n,v:rtNum(nota)})).filter(o=>o.v!=null);if(!L.length)return null;const pior=Math.max(...L.map(o=>o.v));return {raiz,nome:e[0],dt:e[1],L,pior,fx:rtFaixaAg(pior)}}
const rtTxt=a=>a?a.L.slice(0,2).map(o=>o.ag.replace(/^./,c=>c.toUpperCase())+" "+o.nota).join(" · "):"";
/* empresa listada pelo nome: código, CNPJ e dívida líquida/EBIT */
function rtEmp(nome){if(!RT.en)return null;const cod=RT.en.get(rtNome(nome));if(!cod)return null;const e=RT.emp[cod];let r=null;if(AT.idx)for(const s of ["3","4","11","5","6"]){r=atRow(cod+s);if(r)break}
  return {cod,cnpj:e.cnpj,raiz:(e.cnpj||"").slice(0,8),dl:r&&AT.C.dlebit!=null?r[AT.C.dlebit]:null,t:r?r[0]:null}}
/* nota do app para um papel do buscador (debênture, CRI, CRA) */
function rtNota(x){if(!CRB.L)return null;const pares=CRB.L.filter(y=>y.rf===x.rf&&y.sp!=null&&y.dur!=null&&x.dur!=null&&Math.abs(y.dur-x.dur)<=1.5);
  const S=[];let base=null,pct=null;
  if(x.sp!=null&&pares.length>=10){pct=pares.filter(y=>y.sp<x.sp).length/pares.length*100;base=pct<25?1:pct<50?2:pct<75?3:pct<90?4:5;S.push("spread no "+fx(pct,0)+"º percentil de "+pares.length+" pares")}
  else if(x.rf==="cdi"){base=null}
  const devedor=x.tipo==="Debênture"?x.nome:(x.risco||x.nome),emp=rtEmp(devedor),ag=rtAg(emp&&emp.raiz,devedor);
  let n=base;if(ag){n=n==null?ag.fx:Math.round((n+ag.fx)/2);S.push("rating "+rtTxt(ag)+" (CDA)")}
  if(emp&&emp.dl!=null){if(emp.dl>4){n=n==null?4:Math.min(5,n+1);S.push("dívida líquida/EBIT de "+fx(emp.dl,1)+"×")}else S.push("dívida líquida/EBIT de "+fx(emp.dl,1)+"× ("+emp.t+")")}
  let atraso=false;if(x.tipo==="CRI/CRA"&&RT.cvm){const c=RT.cvm[x.cod];if(c&&/atraso|inadimpl/i.test(c.situacao||"")){atraso=true;n=5;S.push("em atraso no informe da CVM")}}
  if(n==null)return null;return {n:Math.max(1,Math.min(5,n)),S,pct,ag,emp,atraso}}
const rtSelo=o=>o?'<span class="rtselo" style="--c:'+RT_COR[o.n]+'" title="'+esc(o.S.join("; "))+'">'+o.n+' · '+RT_FX[o.n]+'</span><small class="rtmot">'+esc(o.S.join("; ")).slice(0,90)+'</small>':'—';
