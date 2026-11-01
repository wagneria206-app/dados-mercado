/* ---------- raio-X da carteira e sobreposição entre fundos
   Abre a carteira de cada fundo (CDA da CVM, a mais recente divulgada), inclusive as cotas de outros fundos (até 2 níveis),
   e soma a exposição real: ações, títulos públicos, crédito por emissor, exterior, caixa. A mesma posição em fundos diferentes
   (mesma ação, mesmo título, mesmo emissor) é somada: é isso que separa diversificar de só pulverizar. */
const RX_GR={acoes:"Ações Brasil",ext:"Exterior e BDRs",tpos:"Títulos públicos pós (Selic)",tpre:"Títulos públicos prefixados",tipca:"Títulos públicos IPCA+",compr:"Compromissadas (caixa)",banc:"Crédito bancário (CDB, LF…)",cred:"Crédito privado (debêntures, CRI, CRA…)",imob:"Imobiliário (FII)",cotas:"Cotas de fundos sem abertura",deriv:"Derivativos (valor líquido)",caixa:"Caixa e valores a pagar/receber",conf:"Não divulgado (confidencial)",rf:"Renda fixa (taxa contratada)",outros:"Outros",sem:"Fundo sem carteira divulgada"};
const RX_COR={acoes:"#16a34a",ext:"#0d9488",tpos:"#2563eb",tpre:"#0891b2",tipca:"#7c3aed",compr:"#60a5fa",banc:"#f472b6",cred:"#db2777",imob:"#b45309",cotas:"#f59e0b",deriv:"#94a3b8",caixa:"#cbd5e1",conf:"#475569",rf:"#a78bfa",outros:"#64748b",sem:"#e2e8f0"};
let RX={tok:0,res:null,key:""};
const RX_SEMID=new Set(["conf","caixa","deriv","sem"]),RX_CX=new Set(["tpos","compr"]);   // Selic e compromissadas: caixa dos fundos, fora da sobreposição   // não entram na soma de posições nem na sobreposição
/* grupo pelo tipo de aplicação (carteiras antigas, só com as maiores posições) */
function rxGrTp(tp){const t=fnNorm(tp||"");if(/compromissad/.test(t))return "compr";if(/titulos publicos/.test(t))return "tpos";if(/acoes|acao/.test(t))return "acoes";if(/cotas de fundos/.test(t))return "cotas";if(/exterior|bdr|depositary/.test(t))return "ext";
  if(/debentur|cri|cra|agronegocio|credito privado|cedula|nota promissoria|letras financeiras/.test(t))return "cred";if(/depositos a prazo|instituicao financeira|\bif\b/.test(t))return "banc";if(/futuro|opc|swap|termo/.test(t))return "deriv";if(/disponib|valores a/.test(t))return "caixa";if(/confidencial/.test(t))return "conf";return "outros"}
/* composição de um fundo: {g:{grupo:%PL}, x:[[chave,nome,%PL,grupo]]} */
function rxFundo(F){const c=F&&F.cart;if(!c)return null;
  if(c.x&&c.g)return {g:Object.assign({},c.g),x:c.x.filter(a=>!RX_SEMID.has(a[3])).map(a=>a.slice()),dt:c.dt,ok:1};
  const g={};(c.comp||[]).forEach(([tp,v])=>{const k=rxGrTp(tp);g[k]=(g[k]||0)+v});
  const x=(c.top||[]).filter(t=>t[1]>0&&!RX_SEMID.has(rxGrTp(t[3]))&&!/nao divulgad/.test(fnNorm(t[0]))).map(([n,p,cn,tp])=>{const gr=rxGrTp(tp);return [cn?"f:"+cn:gr==="acoes"&&/^[A-Z]{4}\d/.test(n)?"a:"+n.slice(0,4):"n:"+fnNorm(n).slice(0,40),n,p,gr]});
  return {g,x,dt:c.dt,ok:0}}
/* abre as cotas de outros fundos (até 2 níveis, até 40 arquivos) */
async function rxAbre(C,nivel,orc){
  for(const a of C.x.filter(a=>/^f:/.test(a[0])&&a[2]>=1)){if(nivel>=2||orc.n<=0)break;const k=a[0].slice(2);let U=null;orc.n--;
    try{U=rxFundo(await fnFund(k))}catch(e){U=null}if(!U||!U.x.length)continue;await rxAbre(U,nivel+1,orc);
    const f=a[2]/100;C.g.cotas=(C.g.cotas||0)-a[2];Object.entries(U.g).forEach(([gr,v])=>{C.g[gr]=(C.g[gr]||0)+v*f});
    C.x.splice(C.x.indexOf(a),1);U.x.forEach(b=>{const j=C.x.findIndex(y=>y[0]===b[0]);if(j>=0)C.x[j][2]+=b[2]*f;else C.x.push([b[0],b[1],b[2]*f,b[3]])});C.aberto=(C.aberto||0)+1}
  if(C.g.cotas!=null&&Math.abs(C.g.cotas)<0.05)delete C.g.cotas;return C}
/* itens diretos (ações, Tesouro, renda fixa) viram uma posição só */
function rxDireto(x){
  const td=spTd(x);if(td){const nm={LFT:"LFT",LTN:"LTN",NTNF:"NTN-F",NTNB:"NTN-B",NTNBP:"NTN-B",EDUCA:"NTN-B1",RENDA:"NTN-B1"}[td.kind];return {g:{[td.kind==="LFT"?"tpos":/LTN|NTNF/.test(td.kind)?"tpre":"tipca"]:100},x:[["tp:"+nm+":"+new Date(td.mat).toISOString().slice(0,7),spItemNome(x),100,td.kind==="LFT"?"tpos":/LTN|NTNF/.test(td.kind)?"tpre":"tipca"]],ok:1}}
  if(x.t==="a"){const cl=spCl(x),gr=cl==="acoes"?"acoes":cl==="intl"?"ext":cl==="imob"?"imob":cl==="cred"?"cred":"outros",k=gr==="acoes"||gr==="ext"?"a:"+x.k.slice(0,4):"a:"+x.k;return {g:{[gr]:100},x:[[k,spItemNome(x),100,gr]],ok:1}}
  const p=spProd(x),gr=p?(SP_PROD[p]?"banc":"cred"):"rf",em=spEmissor(x);return {g:{[gr]:100},x:[[em?"s:"+fnNorm(em):"i:"+x.k,em||spItemNome(x),100,gr]],ok:1}}

async function rxCalc(c,it){
  const tok=++RX.tok,{w}=spPesos(c,it),orc={n:40},I=[];
  for(let i=0;i<it.length;i++){const x=it[i];if(!(w[i]>0))continue;let C=null;
    if(x.t==="f"){let F=null;try{F=await fnFund(x.k)}catch(e){}C=rxFundo(F);if(C)await rxAbre(C,0,orc);else C={g:{sem:100},x:[],sem:1}}
    else C=rxDireto(x);
    I.push({x,w:w[i],C});if(tok!==RX.tok)return null}
  // exposição por grupo e por posição, na carteira
  const G={},E=new Map();I.forEach(o=>{Object.entries(o.C.g).forEach(([gr,v])=>{G[gr]=(G[gr]||0)+o.w*v});
    o.C.x.forEach(([k,n,p,gr])=>{const e=E.get(k)||{k,n,gr,v:0,por:new Set()};e.v+=o.w*p;e.por.add(o.x);E.set(k,e)})});
  const L=[...E.values()].filter(e=>e.v>0).sort((a,b)=>b.v-a.v),soma=L.reduce((a,e)=>a+e.v,0);
  const nEf=soma>0?1/L.reduce((a,e)=>a+Math.pow(e.v/soma,2),0):0,rep=L.filter(e=>e.por.size>1&&!RX_CX.has(e.gr));
  // sobreposição entre fundos: soma dos menores pesos das posições em comum (% do patrimônio de cada um)
  const Fs=I.filter(o=>o.x.t==="f"&&o.C.x.length),P=[];
  for(let a=0;a<Fs.length;a++)for(let b=a+1;b<Fs.length;b++){const A=new Map(Fs[a].C.x.filter(y=>!RX_CX.has(y[3])).map(y=>[y[0],y[2]]));let s=0,n=0;Fs[b].C.x.forEach(y=>{if(RX_CX.has(y[3]))return;const v=A.get(y[0]);if(v!=null){s+=Math.min(v,y[2]);n++}});if(s>0.5)P.push({a:Fs[a],b:Fs[b],s,n})}
  P.sort((p,q)=>q.s-p.s);
  const cob=Math.max(0,100-(G.conf||0)-(G.sem||0)),dts=[...new Set(I.map(o=>o.C.dt).filter(Boolean))].sort();
  return {I,G,L,soma,nEf,rep,P,Fs,cob,dts,velho:I.some(o=>o.x.t==="f"&&o.C.ok===0),aberto:I.reduce((a,o)=>a+(o.C.aberto||0),0)}}

function rxHtml(c,it){if(!it.some(x=>x.t==="f"))return "";
  const key=JSON.stringify([SP.cur,it.map(x=>[x.k,x.w,x.cl,x.em,x.prod])]);
  if(RX.res&&RX.key===key)return '<section class="panel" data-reltit="Raio-X e sobreposição"><div id="rxBox">'+rxRender(RX.res)+'</div></section>';
  RX.key=key;RX.res=null;
  setTimeout(()=>rxCalc(c,it).then(r=>{if(!r||RX.key!==key)return;RX.res=r;const b=$("rxBox");if(b)b.innerHTML=rxRender(r)}).catch(e=>{const b=$("rxBox");if(b)b.innerHTML='<p class="warn">Não deu para abrir as carteiras dos fundos agora: '+esc(e.message)+'</p>'}),0);
  return '<section class="panel" data-reltit="Raio-X e sobreposição"><div id="rxBox"><h3>Raio-X da carteira</h3><p class="sub">Abrindo a carteira de cada fundo (CVM)…</p></div></section>'}

function rxRender(R){
  const pc=v=>fx(v,1)+'%',kp=(a,b,cc,cls)=>'<div class="fnkp'+(cls?' '+cls:'')+'"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  const nIt=R.I.length,alta=R.P.filter(p=>p.s>=30),verd=R.cob<50?'inconclusivo':alta.length>=2?'pulverizada':alta.length===1?'sobreposta':R.nEf>=Math.max(15,nIt*3)?'diversificada':'atenção';
  let h='<h3>Raio-X da carteira</h3><p class="sub">O que a carteira realmente tem por dentro, abrindo a carteira de cada fundo informada à CVM'+(R.dts.length?' ('+(R.dts.length>1?'de '+R.dts[0].split("-").reverse().join("/")+' a '+R.dts[R.dts.length-1].split("-").reverse().join("/"):R.dts[0].split("-").reverse().join("/"))+')':'')+'. A mesma ação, título ou emissor em fundos diferentes é somado.</p>';
  h+='<div class="fnkpis">'+kp("Diagnóstico",verd==='inconclusivo'?'<span>Inconclusivo</span>':verd==='sobreposta'?'<span class="neg">Sobreposição pontual</span>':verd==='pulverizada'?'<span class="neg">Pulverizada</span>':verd==='diversificada'?'<span class="pos">Diversificada</span>':'<span>Moderada</span>',verd==='inconclusivo'?'só '+pc(R.cob)+' da carteira com posições divulgadas':verd==='sobreposta'?'1 par de fundos com 30% ou mais em comum: '+esc(spItemNome(alta[0].a.x)).slice(0,24)+' e '+esc(spItemNome(alta[0].b.x)).slice(0,24):verd==='pulverizada'?alta.length+(alta.length>1?' pares de fundos':' par de fundos')+' com 30% ou mais da carteira em comum':verd==='diversificada'?'muitas posições distintas e pouca repetição':'poucas posições distintas por item',verd==='pulverizada'||verd==='sobreposta'?'kpalerta':'')
    +kp("Posições efetivas",fx(R.nEf,0),'por dentro dos fundos · '+fx(R.L.length,0)+' posições conhecidas')
    +kp("Itens na carteira",fx(nIt,0),R.Fs.length+(R.Fs.length>1?' fundos com posições abertas':' fundo com posições abertas')+(R.aberto?' · '+R.aberto+' fundos investidos abertos também':''))
    +kp("Repetidas em 2+ itens",fx(R.rep.length,0),pc(R.rep.reduce((a,e)=>a+e.v,0)*1)+' da carteira (fora Selic e caixa)',R.rep.length>5?'kpalerta':'')
    +kp("Composição conhecida",pc(R.cob),'da carteira com posições divulgadas (sem sigilo)',R.cob<80?'kpalerta':'')+'</div>';
  const G=Object.entries(R.G).filter(([,v])=>Math.abs(v)>=0.05).sort((a,b)=>b[1]-a[1]),Gp=G.filter(([,v])=>v>0);
  h+='<div class="label" style="margin-top:10px">Exposição real por tipo de ativo</div><div class="spbar" role="img" aria-label="Exposição real">'+Gp.map(([k,v])=>'<i style="width:'+Math.min(100,v).toFixed(2)+'%;background:'+RX_COR[k]+'" title="'+esc(RX_GR[k])+' '+pc(v)+'"></i>').join("")+'</div><div class="legend">'+G.map(([k,v])=>'<span><i style="background:'+RX_COR[k]+'"></i>'+esc(RX_GR[k]||k)+' · '+pc(v)+'</span>').join("")+'</div>';
  h+='<div class="label" style="margin-top:12px">Maiores exposições somadas</div><div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Posição</th><th style="text-align:left">Tipo</th><th>% da carteira</th><th style="text-align:left">Vem de</th></tr></thead><tbody>'
    +R.L.slice(0,25).map(e=>'<tr><td style="text-align:left" class="tw">'+esc(nomeCx(e.n)).slice(0,56)+'</td><td style="text-align:left"><small>'+esc(RX_GR[e.gr]||e.gr)+'</small></td><td data-ordem="'+e.v+'">'+fx(e.v,2)+'%</td><td style="text-align:left;font-size:.82rem">'+(e.por.size>1?'<b class="neg">'+e.por.size+' itens</b>: ':'')+[...e.por].slice(0,3).map(x=>esc(spItemNome(x)).slice(0,26)).join("; ")+(e.por.size>3?'…':'')+'</td></tr>').join("")+'</tbody></table></div>';
  if(R.Fs.length>1){h+='<div class="label" style="margin-top:12px">Sobreposição entre fundos</div>';
    if(R.P.length)h+='<div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Fundo</th><th style="text-align:left">Fundo</th><th>Em comum</th><th>Posições em comum</th></tr></thead><tbody>'
      +R.P.slice(0,15).map(p=>'<tr><td style="text-align:left" class="tw">'+esc(spItemNome(p.a.x)).slice(0,40)+'</td><td style="text-align:left" class="tw">'+esc(spItemNome(p.b.x)).slice(0,40)+'</td><td data-ordem="'+p.s+'" class="'+(p.s>=30?'neg':'')+'"><b>'+pc(p.s)+'</b></td><td>'+p.n+'</td></tr>').join("")+'</tbody></table></div>';
    else h+='<p class="sub">Os fundos não têm posições relevantes em comum.</p>';
    if(R.Fs.length<=8&&R.P.length){const Fs=R.Fs,M=(a,b)=>{const p=R.P.find(q=>(q.a===a&&q.b===b)||(q.a===b&&q.b===a));return p?p.s:0};
      h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab rxmat"><thead><tr><th></th>'+Fs.map((f,i)=>'<th title="'+esc(spItemNome(f.x))+'">'+(i+1)+'</th>').join("")+'</tr></thead><tbody>'
        +Fs.map((a,i)=>'<tr><td style="text-align:left" class="tw"><small>'+(i+1)+'. '+esc(spItemNome(a.x)).slice(0,34)+'</small></td>'+Fs.map((b,j)=>{if(i===j)return '<td style="background:var(--line)"></td>';const v=M(a,b);return '<td style="background:rgba(219,39,119,'+Math.min(0.75,v/60).toFixed(2)+')">'+(v>=0.5?fx(v,0):'')+'</td>'}).join("")+'</tr>').join("")+'</tbody></table></div>'}}
  const sem=R.I.filter(o=>o.C.sem);
  if(sem.length)h+='<p class="warn" style="font-size:.84rem;margin-top:6px">Sem carteira divulgada na CVM: '+sem.map(o=>esc(spItemNome(o.x)).slice(0,34)).join("; ")+'. Esses itens ficam como "Fundo sem carteira divulgada".</p>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Fonte: Composição e Diversificação das Aplicações (CDA) da CVM, a carteira mais recente de cada fundo; a CVM divulga com defasagem e o fundo pode manter posições em sigilo por até 90 dias (aparecem como "não divulgado"). '+(R.velho?'Alguns fundos ainda estão só com as maiores posições (a abertura completa chega na próxima coleta semanal da CVM). ':'')+'Em comum entre dois fundos = soma, posição a posição, do menor peso entre os dois (0% = nada em comum; 100% = carteiras iguais), sem contar Tesouro Selic e compromissadas, que funcionam como caixa dos fundos. Posições efetivas = 1 ÷ soma dos pesos ao quadrado das posições somadas. Ações pela empresa (ON e PN juntas); títulos públicos pelo tipo e vencimento; crédito pelo emissor (raiz do CNPJ); cotas de outros fundos abertas até 2 níveis. Pulverizada: dois ou mais pares de fundos com 30% ou mais em comum, ou seja, pagando duas taxas pela mesma carteira; um par só, sobreposição pontual.</p>';
  return h}
