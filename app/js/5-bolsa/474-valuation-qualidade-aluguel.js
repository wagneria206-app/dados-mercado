/* ---------- Ações: valuation histórico (P/L e P/VP em faixas), preços de referência, qualidade (ROE, margens,
   crescimento, F-score simplificado) e aluguel de ações (B3). Fundamentos: balanços anuais da CVM (fund.a do robô de
   ativos: receita, EBIT, lucro, patrimônio, ativo, caixa, dívida, data); aluguel: robô scripts/aluguel.py. */
const AL={d:null,err:null,load:null};
function alBoot(){if(AL.d||AL.load||AL.err)return;AL.load=fetch(DADOS_RAIZ+"aluguel/aluguel.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(d=>{AL.d=d;AL.load=null;if(activeMod==="aa"&&typeof atAa==="function")atAa();else if(activeMod==="sem")mkCalc()}).catch(e=>{AL.err=e;AL.load=null})}
function vqPct(arr,p){const v=arr.filter(x=>isFinite(x)).sort((a,b)=>a-b);if(!v.length)return null;const i=(v.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return v[lo]+(v[hi]-v[lo])*(i-lo)}
function vqRank(arr,x){const v=arr.filter(y=>isFinite(y));if(!v.length||!isFinite(x))return null;return v.filter(y=>y<=x).length/v.length*100}
function vqSerie(A){ // P/L e P/VP mensais nos últimos 10 anos, com o último balanço anual publicado em cada mês
  const f=A.fund&&A.fund.a,acoes=A.ind&&A.ind.acoes;if(!f||!acoes)return null;
  const anos=Object.keys(f).sort().map(y=>({fim:Date.parse(f[y][7]+"T00:00:00Z"),ll:f[y][2],pl:f[y][3]})).filter(x=>isFinite(x.fim));
  const S=tecSerie(A),pl=[],pvp=[],t0=Date.now()-10*365.25*DAY;let ult=-1;
  for(let k=0;k<S.t.length;k++){const t=S.t[k];if(t<t0)continue;const d=new Date(t),nx=k+1<S.t.length?new Date(S.t[k+1]):null;if(nx&&nx.getUTCMonth()===d.getUTCMonth())continue;
    let b=null;for(const a of anos)if(a.fim+90*DAY<=t)b=a;if(!b)continue;const mc=S.c[k]*acoes;
    if(b.ll>0)pl.push([t,mc/b.ll]);if(b.pl>0)pvp.push([t,mc/b.pl]);ult=k}
  return pl.length>=12?{pl,pvp}:null;
}
function vqFscore(f){ // F-score de Piotroski simplificado: 6 dos 9 critérios (os balanços do app não trazem fluxo de caixa operacional, liquidez corrente nem margem bruta)
  const ys=Object.keys(f).sort();if(ys.length<2)return null;const a=f[ys[ys.length-1]],b=f[ys[ys.length-2]];
  const roa=x=>x[4]?x[2]/x[4]:null,mg=x=>x[0]?x[2]/x[0]:null,giro=x=>x[4]?x[0]/x[4]:null,alav=x=>x[4]?(x[6]||0)/x[4]:null;
  const C=[["Lucro positivo no último ano",a[2]>0],["Retorno sobre o ativo positivo",roa(a)>0],["Retorno sobre o ativo subiu",roa(a)!=null&&roa(b)!=null&&roa(a)>roa(b)],
    ["Dívida sobre o ativo caiu",alav(a)!=null&&alav(b)!=null&&alav(a)<alav(b)],["Margem líquida subiu",mg(a)!=null&&mg(b)!=null&&mg(a)>mg(b)],["Giro do ativo subiu",giro(a)!=null&&giro(b)!=null&&giro(a)>giro(b)]];
  return {n:C.filter(c=>c[1]).length,C,ano:ys[ys.length-1]};
}
function atValHtml(A){
  if(!(A.tipo==="Ação"||A.tipo==="Unit")||!A.fund||!A.fund.a||!A.ind)return "";
  const i=A.ind,f=A.fund.a,ys=Object.keys(f).sort(),p=A.R[A.R.length-1],V=vqSerie(A),pct=(v,d)=>v==null||!isFinite(v)?'—':fx(v,d==null?1:d)+'%';
  let h='<section class="panel"><h3>Valuation e qualidade</h3>';
  // valuation histórico
  if(V){const plv=V.pl.map(x=>x[1]).filter(v=>v>0&&v<100),med=vqPct(plv,.5),p25=vqPct(plv,.25),p75=vqPct(plv,.75),cur=i.pl_r>0?i.pl_r:null,rk=cur!=null?vqRank(plv,cur):null;
    const pvv=V.pvp.map(x=>x[1]).filter(v=>v>0&&v<50),pm=vqPct(pvv,.5),rkv=i.pvp>0?vqRank(pvv,i.pvp):null;
    const leit=rk==null?'':rk<=25?'<b class="pos">barata em relação à própria história</b>':rk>=75?'<b class="neg">cara em relação à própria história</b>':'dentro da faixa normal da própria história';
    h+='<div class="fnkpis">'+tecKp("P/L hoje",cur!=null?fx(cur,1):'—',rk!=null?'mais alto que em '+fx(rk,0)+'% dos meses em 10 anos':'lucro negativo nos últimos 12 meses')
      +tecKp("P/L mediano em 10 anos",med!=null?fx(med,1):'—',p25!=null?'faixa normal '+fx(p25,1)+' a '+fx(p75,1):'')
      +tecKp("P/VP hoje",i.pvp!=null?fx(i.pvp,2):'—',rkv!=null?'mediana de 10 anos '+fx(pm,2):'')
      +tecKp("Preço justo pelo P/L mediano",med!=null&&i.lpa>0?'R$ '+fx(med*i.lpa,2):'—',med!=null&&i.lpa>0?pct((med*i.lpa/p-1)*100)+' sobre o preço':'')+'</div>';
    if(leit)h+='<p style="margin:2px 0 8px">Pelo P/L, a ação está '+leit+'.</p>';
    const lin=v=>({lab:"",col:"var(--muted)",w:1,dash:"4 4",pts:[[V.pl[0][0],v],[V.pl[V.pl.length-1][0],v]]});
    h+='<div class="label">P/L mês a mês (preço × ações ÷ lucro do último balanço anual publicado)</div>'+fnChart([{lab:"P/L",col:FN_COLS[0],w:2,pts:V.pl.filter(x=>x[1]>0&&x[1]<Math.max(30,(p75||20)*2.5))},lin(med),lin(p25),lin(p75)],{fmt:"num",h:190,noLegend:true,aria:"P/L histórico"})
      +'<p class="sub" style="font-size:.8rem">Linhas tracejadas: mediana e faixa normal (metade dos meses ficou entre elas). Anos de prejuízo ficam fora do gráfico.</p>'}
  // preços de referência
  const prov=A.met&&A.met.prov12,ref=[];
  if(prov>0)ref.push(["Preço-teto por dividendos (Bazin, 6%)",prov/0.06,"proventos de 12 meses ÷ 6%: até esse preço o rendimento fica em pelo menos 6% ao ano"]);
  if(i.lpa>0&&i.vpa>0)ref.push(["Preço justo de Graham",Math.sqrt(22.5*i.lpa*i.vpa),"√(22,5 × lucro por ação × valor patrimonial por ação)"]);
  if(ref.length)h+='<div class="label" style="margin-top:10px">Preços de referência</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'
    +ref.map(([n,v,d])=>'<tr><td style="text-align:left">'+n+'<small style="display:block;color:var(--muted)">'+d+'</small></td><td>R$ '+fx(v,2)+'</td><td><span class="'+(v>p?'pos':'neg')+'">'+pct((v/p-1)*100)+'</span></td></tr>').join("")+'</tbody></table></div>';
  // qualidade
  const ult=ys.slice(-6),roe=ult.map(y=>f[y][3]>0?f[y][2]/f[y][3]*100:null),ml=ult.map(y=>f[y][0]?f[y][2]/f[y][0]*100:null);
  const cagr=(k)=>{if(ys.length<6)return null;const m=(i,j)=>(f[ys[ys.length-i]][k]+f[ys[ys.length-j]][k])/2,a=m(6,5),b=m(2,1);return a>0&&b>0?(Math.pow(b/a,1/4)-1)*100:null};  // média de 2 anos no início e no fim, para um ano fraco não distorcer
  const pos=ys.slice(-10).filter(y=>f[y][2]>0).length,payout=prov>0&&i.acoes&&i.ll>0?prov*i.acoes/i.ll*100:null,F=vqFscore(f);
  h+='<div class="label" style="margin-top:12px">Qualidade</div><div class="fnkpis">'
    +tecKp("ROE médio (5 anos)",pct(vqPct(roe.slice(-5).filter(v=>v!=null),.5)),'mediana do lucro ÷ patrimônio')
    +tecKp("Crescimento do lucro",pct(cagr(2)),'ao ano, médias de 2 anos · receita '+pct(cagr(0)))
    +tecKp("Anos com lucro",pos+' de '+Math.min(10,ys.length),'consistência nos últimos anos')
    +tecKp("Payout",pct(payout,0),'proventos ÷ lucro de 12 meses')
    +(F?tecKp("F-score simplificado",F.n+' de 6',F.n>=5?'saúde melhorando':F.n<=2?'saúde piorando':'sem tendência clara'):'')+'</div>';
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th>'+ult.map(y=>'<th>'+y+'</th>').join("")+'</tr></thead><tbody>'
    +'<tr><td style="text-align:left">Receita</td>'+ult.map(y=>'<td>'+fnMoney(f[y][0])+'</td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">Lucro</td>'+ult.map(y=>'<td><span class="'+(f[y][2]<0?'neg':'')+'">'+fnMoney(f[y][2])+'</span></td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">ROE</td>'+roe.map(v=>'<td>'+pct(v)+'</td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">Margem líquida</td>'+ml.map(v=>'<td>'+pct(v)+'</td>').join("")+'</tr>'
    +'<tr><td style="text-align:left">Dívida líquida ÷ patrimônio</td>'+ult.map(y=>{const x=f[y];return '<td>'+(x[3]>0?fx(((x[6]||0)-(x[5]||0))/x[3],2):'—')+'</td>'}).join("")+'</tr></tbody></table></div>';
  if(F)h+='<p class="sub" style="font-size:.8rem">F-score ('+F.ano+' contra o ano anterior): '+F.C.map(c=>(c[1]?'✓ ':'✗ ')+c[0].toLowerCase()).join(" · ")+'. Versão com 6 dos 9 critérios de Piotroski.</p>';
  h+='<p class="sub" style="font-size:.8rem">Balanços anuais entregues à CVM (DFP), consolidados. Preços ajustados por desdobramentos; quantidade de ações atual (recompras e emissões passadas não são refeitas). Preços de referência são pontos de partida, não preço-alvo.</p></section>';
  return h+atAlugHtml(A);
}
function atAlugHtml(A){
  if(!(A.tipo==="Ação"||A.tipo==="Unit"))return "";
  if(!AL.d){alBoot();return ""}
  const L=AL.d.t[A.t];const acoes=A.ind&&A.ind.acoes,p=A.R[A.R.length-1],liq=A.met&&A.met.liq;
  let h='<section class="panel"><h3>Aluguel de ações</h3>';
  if(!L||!L.length)return h+'<p class="sub">Nenhuma posição de aluguel registrada na B3 para '+esc(A.t)+'.</p></section>';
  const u=L[L.length-1],pc=acoes?u[1]/acoes*100:null,dias=liq&&p?u[1]/(liq/p):null,a30=L.length>21?L[L.length-22]:null;
  h+='<div class="fnkpis">'+tecKp("Ações alugadas",fx(u[1],0),fnMoney(u[2])+' em '+fdate(Date.parse(u[0]+"T00:00:00Z")))
    +tecKp("Do total de ações",pc!=null?fx(pc,2)+'%':'—',pc==null?'':pc>=10?'muito alto: grande aposta contra':pc>=5?'alto':pc>=2?'moderado':'baixo')
    +tecKp("Dias para devolver",dias!=null?fx(dias,1):'—','alugado ÷ volume médio diário')
    +(a30?tecKp("Variação em 1 mês",(u[1]>=a30[1]?'+':'')+fx((u[1]/a30[1]-1)*100,0)+'%',u[1]>a30[1]*1.2?'apostas contra aumentando':u[1]<a30[1]*0.8?'apostas contra diminuindo':'estável'):'')+'</div>';
  if(acoes&&L.length>5)h+='<div class="label">Ações alugadas (% do total)</div>'+fnChart([{lab:"% alugado",col:FN_COLS[1],w:2,pts:L.map(x=>[Date.parse(x[0]+"T00:00:00Z"),x[1]/acoes*100])}],{fmt:"pct",h:150,aria:"Aluguel"});
  return h+'<p class="sub" style="font-size:.8rem">Fonte: B3, posições em aberto de empréstimo de ativos. Aluguel alto e subindo indica muitos investidores vendidos (apostando na queda); com muitos "dias para devolver", uma alta pode forçar recompras rápidas.</p></section>';
}
function alSemanaHtml(){ // ações mais alugadas, para o Resumo da semana
  if(!AL.d){alBoot();return ""}if(!AT.idx)return "";const C=AT.C,R=[];
  AT.idx.rows.forEach(r=>{if(!(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")||(r[C.liq]||0)<1e7||!r[C.mcap]||!r[C.preco])return;const L=AL.d.t[r[0]];if(!L||!L.length)return;const u=L[L.length-1],pc=u[1]*r[C.preco]/r[C.mcap]*100;if(pc>0&&pc<60)R.push({r,pc,v:L.length>5?u[1]/L[Math.max(0,L.length-6)][1]-1:null})});
  if(!R.length)return "";R.sort((a,b)=>b.pc-a.pc);
  return '<h3>Ações mais alugadas</h3><p class="sub" style="font-size:.82rem">Parte das ações emprestadas (posições vendidas) entre as ações com liquidez acima de R$ 10 milhões por dia. Fonte: B3.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ação</th><th>Alugado</th><th>Na semana</th></tr></thead><tbody>'
    +R.slice(0,8).map(x=>'<tr><td style="text-align:left"><button type="button" class="link" data-atopen="'+x.r[0]+'">'+x.r[0]+'</button> <small>'+esc(x.r[1])+'</small></td><td>'+fx(x.pc,1)+'%</td><td>'+(x.v==null?'—':'<span class="'+(x.v>0.05?'neg':x.v<-0.05?'pos':'')+'">'+(x.v>=0?'+':'')+fx(x.v*100,0)+'%</span>')+'</td></tr>').join("")+'</tbody></table></div>';
}
