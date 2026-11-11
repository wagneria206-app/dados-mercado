/* ---------- Termômetro de mercado: seis sinais objetivos, lidos no fim de cada mês, somam um placar de -6 a +6.
   Placar ≥ +2: apetite a risco; ≤ -2: defensivo; entre eles: neutro. O histórico desde 2010 mostra quanto cada classe
   de ativo rendeu no mês SEGUINTE a cada leitura (média e frequência acima do CDI). É estatística do passado, não previsão.
   Dados: índices mensais (B3, ANBIMA, Banco Central) do robô de ativos, juros de 5 anos e dólar global (macro.json) e
   fluxo de estrangeiros em ações (balanço de pagamentos do Banco Central). */
const TM={b:null,fl:null,err:null,load:null};
function tmBoot(){if(TM.load||(TM.b&&TM.fl))return;TM.load=Promise.all([atGet("bench.json"),roboGet("fluxo_estrangeiro.json").catch(()=>null)]).then(([b,f])=>{TM.b=b;TM.fl=f||{mensal:{}};TM.load=null;tmRefaz()}).catch(e=>{TM.err=e;TM.load=null;tmRefaz()})}
function tmRefaz(){if(typeof activeMod!=="undefined"&&(activeMod==="rs"||activeMod==="rd")&&typeof mkCalc==="function")mkCalc()}
const TM_REG=[[2,"Apetite a risco","var(--gain)"],[-1,"Neutro","var(--warn)"],[-99,"Defensivo","var(--loss)"]];
function tmReg(s){return s>=2?TM_REG[0]:s<=-2?TM_REG[2]:TM_REG[1]}
function tmBase(){ // séries mensais alinhadas (AAAAMM), com o mês corrente parcial no fim
  if(!TM.b||!MC.d)return null;const m=TM.b.m||{},M=Object.keys(m.ibov||{}).sort(),ult=(o,f)=>{const r={};o.forEach(p=>{r[f(p[0])]=p[1]});return r};
  const cm=MC.d.cm||{},pre5={};(cm.d||[]).forEach((d,i)=>{const v=(cm.pre5||[])[i];if(v!=null)pre5[d.slice(0,4)+d.slice(5,7)]=v});
  const dxy=MC.d.dxy?ult(MC.d.dxy.s,d=>d.slice(0,4)+d.slice(5,7)):{},fl={};Object.entries((TM.fl.mensal||{}).acoes||{}).forEach(([k,v])=>{fl[k.replace("-","")]=v});
  const lm=M[M.length-1],ul=o=>{const ks=Object.keys(o).sort();if(o[lm]==null&&ks.length)o[lm]=o[ks[ks.length-1]]};ul(pre5);ul(dxy); // mês corrente: último valor disponível
  return {M,ibov:m.ibov,usd:m.usd,cdi:m.cdi,imab:m.imab,irfm:m.irfm,ifix:m.ifix||{},pre5,dxy,fl}}
const tmSg=(v,d)=>(v>=0?'+':'−')+fx(Math.abs(v),d==null?1:d)+'%';
function tmSinais(B,i){const M=B.M,k=M[i],ag=j=>M[i-j],S=[];
  const v=(o,j)=>o[ag(j)],ch=(o,j)=>v(o,0)!=null&&v(o,j)?v(o,0)/v(o,j)-1:null;
  {const L=[];for(let j=0;j<10;j++)if(v(B.ibov,j)!=null)L.push(v(B.ibov,j));if(L.length===10){const md=L.reduce((a,b)=>a+b,0)/10,x=v(B.ibov,0)>md;S.push(["Tendência da Bolsa",x?1:-1,'Ibovespa '+(x?'acima':'abaixo')+' da média de 10 meses ('+tmSg((v(B.ibov,0)/md-1)*100)+')'])}}
  {const c=ch(B.usd,3);if(c!=null)S.push(["Dólar (3 meses)",c<-0.02?1:c>0.02?-1:0,tmSg(c*100)+' contra o real'])}
  {const a=v(B.pre5,0),b=v(B.pre5,3);if(a!=null&&b!=null){const d=a-b;S.push(["Juros de 5 anos (3 meses)",d<-0.5?1:d>0.5?-1:0,(d>=0?'+':'−')+fx(Math.abs(d),2)+' p.p., a '+fx(a,2)+'%'])}}
  {let s=0,n=0;for(let j=1;j<=3;j++){const x=B.fl[ag(j)];if(x!=null){s+=x;n++}}if(n)S.push(["Estrangeiros em ações (3 meses)",s>0?1:-1,(s>=0?'entrada':'saída')+' de US$ '+fx(Math.abs(s)/1000,1)+' bi'])}
  {const c=ch(B.dxy,3);if(c!=null)S.push(["Dólar no mundo (DXY, 3 meses)",c<-0.02?1:c>0.02?-1:0,tmSg(c*100)])}
  {const r=ch(B.ibov,6);let f=1;for(let j=0;j<6;j++){const x=v(B.cdi,j);if(x!=null)f*=1+x/100}if(r!=null)S.push(["Bolsa contra o CDI (6 meses)",r>f-1?1:-1,'Ibovespa '+tmSg(r*100)+' × CDI '+fx((f-1)*100,1)+'%'])}
  return {k,S,s:S.reduce((a,x)=>a+x[1],0),n:S.length}}
function tmHist(B){ // regime no fim de cada mês completo e o retorno do mês seguinte
  const M=B.M,R=[],at=(o,a,b)=>o[a]&&o[b]?(o[b]/o[a]-1)*100:null;
  for(let i=10;i<M.length-2;i++){const x=tmSinais(B,i);if(x.n<6)continue;const a=M[i],b=M[i+1];
    R.push({k:a,s:x.s,r:{ibov:at(B.ibov,a,b),ifix:at(B.ifix,a,b),imab:at(B.imab,a,b),irfm:at(B.irfm,a,b),usd:at(B.usd,a,b),cdi:B.cdi[b]}})}
  return R}
function tmHtml(curto){
  if(!MC.d){mcBoot();return '<h3>Termômetro de mercado</h3><p class="sub">Carregando…</p>'}
  if(!TM.b){tmBoot();return TM.err?'':'<h3>Termômetro de mercado</h3><p class="sub">Carregando…</p>'}
  const B=tmBase();if(!B||B.M.length<20)return "";const H=tmHist(B),hoje=tmSinais(B,B.M.length-1),rg=tmReg(hoje.s);
  let h='<h3>Termômetro de mercado</h3><div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:4px 0 6px"><b style="font-size:1.5rem;color:'+rg[2]+'">'+rg[1]+'</b><span class="sub">placar '+(hoje.s>0?'+':'')+hoje.s+' de '+hoje.n+' sinais · leitura de '+['','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+hoje.k.slice(4)]+'/'+hoje.k.slice(0,4)+'</span></div>';
  if(curto)return h+'<p class="sub" style="margin:0">'+hoje.S.map(x=>(x[1]>0?'▲ ':x[1]<0?'▼ ':'• ')+x[0]).join(' · ')+'. <button type="button" class="link" data-tmver="1">Ver o termômetro</button></p>';
  h+='<p class="sub">Seis sinais objetivos sobre Bolsa, dólar, juros e fluxo estrangeiro. Cada um soma +1 (favorece ativos de risco), −1 (pede defesa) ou 0. Placar de +2 para cima: apetite a risco; de −2 para baixo: defensivo.</p>'
    +'<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Sinal</th><th style="text-align:left">Leitura</th><th>Placar</th></tr></thead><tbody>'
    +hoje.S.map(x=>'<tr><td style="text-align:left">'+x[0]+'</td><td style="text-align:left">'+x[2]+'</td><td class="'+(x[1]>0?'pos':x[1]<0?'neg':'')+'"><b>'+(x[1]>0?'+1':x[1]<0?'−1':'0')+'</b></td></tr>').join("")+'</tbody></table></div>';
  // histórico: retorno médio no mês seguinte por regime
  const cls=[["ibov","Ibovespa"],["ifix","IFIX (FIIs)"],["imab","IMA-B (IPCA+)"],["irfm","IRF-M (prefixados)"],["usd","Dólar"]];
  const G=TM_REG.map(r=>({r,L:H.filter(x=>tmReg(x.s)===r)}));
  h+='<div class="label" style="margin-top:12px">No mês seguinte a cada leitura, desde '+H[0].k.slice(0,4)+'</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Classe</th>'+G.map(g=>'<th style="color:'+g.r[2]+'">'+g.r[1]+' <small>('+g.L.length+' meses)</small></th>').join("")+'</tr></thead><tbody>'
    +cls.map(([k,n])=>'<tr><td style="text-align:left">'+n+'</td>'+G.map(g=>{const v=g.L.filter(x=>x.r[k]!=null);if(v.length<6)return '<td>—</td>';const md=v.reduce((a,x)=>a+x.r[k],0)/v.length,ac=v.filter(x=>x.r[k]>(x.r.cdi||0)).length/v.length*100;return '<td><b class="'+(md>=0?'pos':'neg')+'">'+mcSig(md,2)+'</b><small style="display:block;color:var(--muted)">acima do CDI em '+fx(ac,0)+'% dos meses</small></td>'}).join("")+'</tr>').join("")
    +'<tr><td style="text-align:left">CDI</td>'+G.map(g=>{const v=g.L.filter(x=>x.r.cdi!=null);return '<td>'+(v.length?fx(v.reduce((a,x)=>a+x.r.cdi,0)/v.length,2)+'%':'—')+'</td>'}).join("")+'</tr></tbody></table></div>';
  {const med=(L,k)=>{const v=L.filter(x=>x.r[k]!=null);return v.length>=6?{m:v.reduce((a,x)=>a+x.r[k],0)/v.length,ac:v.filter(x=>x.r[k]>(x.r.cdi||0)).length/v.length*100,cnt:v.length}:null};
    const g=G.find(x=>x.r===rg),ord=cls.map(([k,n])=>Object.assign({n},med(g.L,k)||{m:null})).filter(x=>x.m!=null).sort((a,b)=>b.m-a.m);
    if(ord.length)h+='<p style="margin:10px 0 0">Nos <b>'+g.L.length+' meses</b> com leitura <b>'+rg[1].toLowerCase()+'</b> desde '+H[0].k.slice(0,4)+', quem mais rendeu no mês seguinte foi <b>'+ord[0].n+'</b> (média de '+mcSig(ord[0].m,2)+', acima do CDI em '+fx(ord[0].ac,0)+'% das vezes) e quem menos rendeu foi <b>'+ord[ord.length-1].n+'</b> ('+mcSig(ord[ord.length-1].m,2)+').</p>';
    const a=med(G[0].L,"ibov"),d=med(G[2].L,"ibov");if(a&&d&&d.m>a.m)h+='<p class="sub" style="margin:6px 0 0">Repare: a Bolsa costuma render <b>mais</b> depois de leituras defensivas ('+mcSig(d.m,2)+' ao mês) do que depois de leituras de apetite ('+mcSig(a.m,2)+'). Quando o pessimismo já está nos preços, a recuperação tende a vir antes de os sinais melhorarem. O termômetro descreve o momento; não diz para sair da Bolsa.</p>'}
  h+=fnChart([{lab:"Placar",col:FN_COLS[0],w:1.6,pts:H.map(x=>[Date.UTC(+x.k.slice(0,4),+x.k.slice(4)-1,28),x.s]).concat([[Date.UTC(+hoje.k.slice(0,4),+hoje.k.slice(4)-1,28),hoje.s]])}],{fmt:"int",h:150,bars:1,zero:1,noLegend:1,aria:"Placar do termômetro mês a mês"});
  h+='<p class="sub" style="font-size:.8rem">Retorno médio de um mês, depois de cada leitura no fim do mês; o mês corrente entra na leitura de hoje, mas não no histórico. Sinais: Ibovespa contra a média de 10 meses; variação de 3 meses do dólar e do DXY (±2%); dos juros prefixados de 5 anos (±0,5 ponto); fluxo de estrangeiros em ações nos 3 meses anteriores; Ibovespa contra o CDI em 6 meses. Fontes: B3, ANBIMA, Banco Central e Federal Reserve. Estatística do passado, não previsão: use como contexto, nunca como sinal isolado de compra ou venda.</p>';
  return h}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-tmver]");if(!x)return;setMod("rs");setTimeout(()=>{const p=[...document.querySelectorAll("h3")].find(h=>/Termômetro/.test(h.textContent));if(p)p.scrollIntoView({behavior:"smooth"})},300)});
