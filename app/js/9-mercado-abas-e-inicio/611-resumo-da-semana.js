/* ---------- Mercado › Semana: o que mudou nos últimos 5 pregões, leitura automática, destaques da Bolsa e agenda da próxima semana (com PDF) */
function semCarrega(){
  const falta=[];
  if(!EU.S){falta.push("índices");euBoot()}
  if(!AT.idx){falta.push("Bolsa");if(!AT.err){const p=atBoot();if(p&&p.then)p.then(()=>{if(activeMod==="sem")mkCalc()})}}
  if(!MK.loaded){falta.push("juros");mkLoad()}
  if(!CURV){falta.push("curvas");curvasLoad()}
  if(!MC.d){falta.push("economia");mcBoot()}
  return falta;
}
function semVar(k,dias){ // variação % entre o último ponto e o de "dias" corridos antes
  const P=EU.S&&EU.S[k];if(!P||P.length<2)return null;const u=P[P.length-1],a=euAt(P,u[0]-dias*DAY);return a&&a[1]?{v:u[1],a:a[1],r:(u[1]/a[1]-1)*100,t:u[0]}:null;
}
function semDI(){ // taxas dos DI de janeiro: último pregão × 5 pregões antes
  if(!MK.di)return [];const ks=Object.keys(MK.di.dias).sort();if(ks.length<2)return [];
  const u=ks[ks.length-1],lim=agmIso(Date.parse(u+"T00:00:00Z")-7*DAY),a=ks.filter(k=>k<=lim).pop();if(!a)return [];const y=+u.slice(2,4),U=diCurve(u),A=diCurve(a);
  return [1,2,3,5].map(n=>{const c="F"+String(y+n).padStart(2,"0"),x=U.find(r=>r.c===c),z=A.find(r=>r.c===c);return x&&z&&isFinite(x.tx)&&isFinite(z.tx)?{c,ano:2000+y+n,tx:x.tx,d:x.tx-z.tx}:null}).filter(Boolean).concat([{u,a}]);
}
function semCurva(){ // juro real e inflação implícita de 5 anos: último dia × uma semana antes (ETTJ ANBIMA)
  let W=null;try{W=curvWins()}catch(e){}if(!W||!W[0]||!W[0].b)return null;const w0=W[0],w7=W.find(w=>w.k==="d7"&&w.b);
  const f=b=>({real:nssY(b.ipca,5),impl:((1+nssY(b.pre,5)/100)/(1+nssY(b.ipca,5)/100)-1)*100});
  return {u:f(w0.b),a:w7?f(w7.b):null,du:w0.date,da:w7?w7.date:null};
}
function semFocus(ind,ano){const F=MC.d&&MC.d.focus;const L=F&&F.anuais&&F.anuais[ind]&&F.anuais[ind][String(ano)];if(!L||L.length<2)return null;const u=L[L.length-1],a=L[L.length-2];return {v:+u[1],d:+u[1]-(+a[1]),du:u[0],da:a[0]}}
function semanaTela(){
  const falta=semCarrega(),out=[],pct=v=>v==null?'—':(v>=0?'+':'')+fx(v,2)+'%',bpsS=v=>{const b=Math.round(v*100);return (b>0?'+':b<0?'−':'')+fx(Math.abs(b),0)+' bps'}  // v em pontos percentuais;
  const cor=(v,inv)=>v==null||Math.abs(v)<1e-9?'':((inv?-v:v)>0?'pos':'neg');
  const ib=semVar("ibov",7),us=semVar("usd",7),sp=semVar("spx",7),ifx=semVar("ifix",7),nd=semVar("ndx",7),cdi=semVar("cdi",7),t10=EU.S&&EU.S.t10;
  const ref=ib?ib.t:Date.now(),y=new Date(ref).getUTCFullYear();
  let h='<h3>Resumo da semana</h3><p class="sub">O que mudou nos últimos 5 pregões até '+fdate(ref)+', com leitura automática e a agenda da próxima semana. Gere o PDF para guardar ou enviar.</p>'
    +(falta.length?'<p class="sub">Carregando: '+falta.join(", ")+'…</p>':'')+'<div style="margin-top:8px"><button type="button" class="btn sec" data-rel="sem">Gerar PDF da semana</button></div>';
  out.push(h);
  // placar
  const k=[];
  if(ib)k.push(tecKp("Ibovespa",fx(ib.v,0)+' pts','<span class="'+cor(ib.r)+'">'+pct(ib.r)+'</span> na semana'));
  if(us)k.push(tecKp("Dólar (PTAX)",'R$ '+fx(us.v,4),'<span class="'+cor(us.r,1)+'">'+pct(us.r)+'</span> na semana'));
  if(ifx)k.push(tecKp("IFIX",fx(ifx.v,0)+' pts','<span class="'+cor(ifx.r)+'">'+pct(ifx.r)+'</span> na semana'));
  if(sp)k.push(tecKp("S&amp;P 500",fx(sp.v,0)+' pts','<span class="'+cor(sp.r)+'">'+pct(sp.r)+'</span> na semana'));
  if(nd)k.push(tecKp("Nasdaq 100",fx(nd.v,0)+' pts','<span class="'+cor(nd.r)+'">'+pct(nd.r)+'</span> na semana'));
  if(cdi)k.push(tecKp("CDI",pct(cdi.r),'acumulado na semana'));
  const DI=semDI(),dref=DI.length?DI.pop():null,CV=semCurva();
  let p='<div class="fnkpis">'+k.join("")+'</div>';
  if(DI.length)p+='<div class="label" style="margin-top:10px">Juros futuros (DI de janeiro, B3)</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Vencimento</th><th>Taxa</th><th>Desde '+fdate(Date.parse(dref.a+"T00:00:00Z"))+'</th></tr></thead><tbody>'
    +DI.map(x=>'<tr><td style="text-align:left">Janeiro de '+x.ano+' ('+x.c+')</td><td>'+fx(x.tx,2)+'%</td><td><span class="'+cor(x.d,1)+'">'+bpsS(x.d)+'</span></td></tr>').join("")+'</tbody></table></div>';
  if(CV&&CV.a)p+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Curva da ANBIMA, 5 anos</th><th>Hoje</th><th>Desde '+fdate(Date.parse(CV.da+"T00:00:00Z"))+'</th></tr></thead><tbody>'
    +'<tr><td style="text-align:left">Juro real (IPCA+)</td><td>'+fx(CV.u.real,2)+'%</td><td><span class="'+cor(CV.u.real-CV.a.real,1)+'">'+bpsS(CV.u.real-CV.a.real)+'</span></td></tr>'
    +'<tr><td style="text-align:left">Inflação implícita</td><td>'+fx(CV.u.impl,2)+'%</td><td><span class="'+cor(CV.u.impl-CV.a.impl,1)+'">'+bpsS(CV.u.impl-CV.a.impl)+'</span></td></tr></tbody></table></div>';
  const fo=[["IPCA",y],["IPCA",y+1],["Selic",y],["Selic",y+1],["PIB Total",y],["Câmbio",y]].map(([i,a])=>{const f=semFocus(i,a);return f?{i,a,f}:null}).filter(Boolean);
  if(fo.length)p+='<div class="label" style="margin-top:10px">Focus: mudança na última pesquisa</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Projeção</th><th>Agora</th><th>Na semana</th></tr></thead><tbody>'
    +fo.map(x=>'<tr><td style="text-align:left">'+(x.i==="PIB Total"?"PIB":x.i==="Câmbio"?"Dólar no fim do ano":x.i==="Selic"?"Selic no fim do ano":x.i)+' '+x.a+'</td><td>'+(x.i==="Câmbio"?'R$ '+fx(x.f.v,2):fx(x.f.v,2)+'%')+'</td><td>'+(Math.abs(x.f.d)<0.005?'sem mudança':(x.f.d>0?'+':'−')+fx(Math.abs(x.f.d),2)+(x.i==="Câmbio"?'':' p.p.'))+'</td></tr>').join("")+'</tbody></table></div>';
  out.push('<h3>Placar da semana</h3>'+p);
  // leitura automática
  const L=[];
  if(ib)L.push('O Ibovespa '+(ib.r>=0?'subiu':'caiu')+' '+fx(Math.abs(ib.r),1)+'% na semana'+(sp?', contra '+(sp.r>=0?'alta':'queda')+' de '+fx(Math.abs(sp.r),1)+'% do S&amp;P 500':'')+'.');
  if(us)L.push('O dólar '+(Math.abs(us.r)<0.2?'ficou praticamente estável':(us.r>0?'subiu ':'caiu ')+fx(Math.abs(us.r),1)+'%')+', a R$ '+fx(us.v,2)+'.');
  if(DI.length){const m=DI.reduce((a,x)=>Math.abs(x.d)>Math.abs(a.d)?x:a,DI[0]);if(Math.abs(m.d)>=0.05){const todos=DI.every(x=>Math.sign(x.d)===Math.sign(m.d));L.push('Os juros futuros '+(todos?(m.d>0?'subiram em todos os prazos':'caíram em todos os prazos'):'se moveram de forma mista')+'; o maior movimento foi no DI de janeiro de '+m.ano+' ('+bpsS(m.d)+').')}else L.push('Os juros futuros ficaram praticamente estáveis.')}
  if(CV&&CV.a){const d=CV.u.impl-CV.a.impl;if(Math.abs(d)>=0.05)L.push('A inflação implícita de 5 anos '+(d>0?'subiu':'caiu')+' para '+fx(CV.u.impl,2)+'% ('+bpsS(d)+'): '+(d>0?'o mercado passou a cobrar mais proteção contra a inflação.':'o mercado passou a cobrar menos proteção contra a inflação.'))}
  const fi=fo.find(x=>x.i==="IPCA"&&x.a===y),fs=fo.find(x=>x.i==="Selic"&&x.a===y+1);
  if(fi&&Math.abs(fi.f.d)>=0.01)L.push('O Focus '+(fi.f.d>0?'elevou':'reduziu')+' a projeção do IPCA de '+y+' para '+fx(fi.f.v,2)+'%.');
  if(fs&&Math.abs(fs.f.d)>=0.01)L.push('A Selic esperada para o fim de '+(y+1)+' '+(fs.f.d>0?'subiu':'caiu')+' para '+fx(fs.f.v,2)+'%.');
  out.push('<h3>Leitura da semana</h3>'+(L.length?'<ul class="tecler">'+L.map(x=>'<li>'+x+'</li>').join("")+'</ul>':'<p class="sub">A leitura aparece quando os dados terminarem de carregar.</p>'));
  // destaques da Bolsa
  if(AT.idx&&AT.C.r5!=null){const C=AT.C,R=AT.idx.rows.filter(r=>(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")&&(r[C.liq]||0)>=1e7&&r[C.r5]!=null);
    const lin=r=>'<tr><td style="text-align:left"><button type="button" class="link" data-atopen="'+r[0]+'">'+r[0]+'</button> <small>'+esc(r[1])+'</small></td><td>R$ '+fx(r[C.preco],2)+'</td><td><span class="'+cor(r[C.r5])+'">'+pct(r[C.r5])+'</span></td></tr>';
    const tab=(tt,L)=>'<div class="label" style="margin-top:8px">'+tt+'</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'+L.map(lin).join("")+'</tbody></table></div>';
    const S=R.slice().sort((a,b)=>b[C.r5]-a[C.r5]);
    out.push('<h3>Destaques da Bolsa na semana</h3><p class="sub" style="font-size:.82rem">Ações e units com liquidez acima de R$ 10 milhões por dia ('+R.length+' papéis). Variação dos últimos 5 pregões, sem proventos.</p>'+tab("Maiores altas",S.slice(0,5))+tab("Maiores quedas",S.slice(-5).reverse()))}
  try{const x=insSemanaHtml();if(x)out.push(x)}catch(e){}
  try{const x=alSemanaHtml();if(x)out.push(x)}catch(e){}
  // ideias automáticas (Tesouro, crédito e fundos)
  try{const id=typeof ideiasHtml==="function"?ideiasHtml():"";if(id)out.push(id)}catch(e){}
  // próxima semana
  try{const A=agmEventos(10).E,hj=Date.parse(agmHoje()+"T00:00:00Z"),fim=hj+8*DAY,P=A.filter(e=>e.t>=hj&&e.t<fim&&e.imp>=1);
    out.push('<h3>Agenda dos próximos dias</h3>'+(P.length?'<div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'+P.map(e=>'<tr><td style="text-align:left;white-space:nowrap">'+AGM_SEM[new Date(e.t).getUTCDay()]+' '+fdate(e.t).slice(0,5)+(e.hora?' · '+e.hora:'')+'</td><td style="text-align:left">'+(e.imp>=2?'<b>'+esc(e.tit)+'</b>':esc(e.tit))+(e.det?' <small>'+esc(e.det)+'</small>':'')+'</td><td class="c-ph">'+esc(e.pais)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="sub">Nenhum evento relevante nos próximos dias.</p>'))}catch(e){}
  out.push('<p class="sub" style="font-size:.8rem;margin:0">Fontes: B3 (Ibovespa, IFIX, DI futuro e cotações), Banco Central (PTAX, CDI e Focus), ANBIMA (curva de juros), Cboe e Nasdaq (índices dos EUA). Semana = últimos 5 pregões; índices dos EUA e dólar comparados com o fechamento de 7 dias corridos antes.</p>');
  return out;
}
