/* ---------- Bolsa › Estratégias: filtro combinado (fundamentos + técnica, com os dados de hoje) e teste histórico
   de estratégias mês a mês desde 2006, usando só o que se sabia em cada data (painel.json do robô de ativos). */
const BT={pn:null,err:null,load:null,
  f:{liq:5e6,dy:"",pl:"",pvp:"",roe:"",r12:"",tend:"",ifr:"",ord:"dy",tipo:"Ação"},
  t:{est:"div",n:10,reb:3,ini:2010,custo:0.2,liq:5e6},res:null};
try{const s=JSON.parse(localStorage.getItem("btCfg")||"null");if(s){Object.assign(BT.f,s.f||{});Object.assign(BT.t,s.t||{})}}catch(e){}
function btSave(){try{localStorage.setItem("btCfg",JSON.stringify({f:BT.f,t:BT.t}))}catch(e){}}
const BT_EST={
  div:["Dividendos","as que mais pagaram proventos nos 12 meses anteriores (rendimento de 12 meses), entre as que dão lucro"],
  valor:["Valor","menor soma de posições em P/L e P/VP (empresas baratas pelo lucro e pelo patrimônio), só com lucro"],
  mom:["Momento","maiores altas dos 12 meses anteriores, sem o último mês"],
  magica:["Fórmula mágica","melhor soma de posições em P/L baixo e ROE alto (adaptação da fórmula de Greenblatt)"],
  qual:["Qualidade a preço justo","ROE acima de 15% e P/L abaixo de 15, ordenadas pelo maior ROE"],
  perso:["Personalizada","os critérios do filtro combinado acima (rendimento, P/L, P/VP, ROE, alta de 12 meses) aplicados mês a mês"]};
function btBoot(){if(BT.pn||BT.load||BT.err)return;BT.load=atGet("painel.json").then(d=>{BT.pn=d;BT.load=null;if(activeMod==="ab")btTela()}).catch(e=>{BT.err=e;BT.load=null;if(activeMod==="ab")btTela()})}
function btTela(){
  const o=$("fnOut");if(!o)return;
  if(FN.view!=="ab"){FN.view="ab";o.innerHTML='<section class="panel" id="btSet"></section><section class="panel"><h3>Filtro combinado</h3><p class="sub">Ações que passam ao mesmo tempo nos critérios de fundamentos e de análise técnica, com os dados mais recentes. Deixe em branco o que não quiser filtrar.</p><div id="btF"></div><div id="btFR"></div></section><section class="panel"><h3>Teste histórico de estratégias</h3><p class="sub">Como uma regra simples de escolha de ações teria se saído mês a mês desde 2006, contra o Ibovespa e o CDI. A cada rebalanceamento o teste usa só o que se sabia naquela data.</p><div id="btT"></div><div id="btTR"></div></section>'}
  {const st=$("btSet");if(st){const x=AT.idx?setoresHtml():"";st.innerHTML=x||'<p class="sub">Carregando os setores…</p>'}}
  if(!AT.idx){$("btFR").innerHTML='<p class="sub">Carregando a base de ativos…</p>';if(!AT.err)atBoot();}
  else btFiltro();
  btTeste();
}
function btIn(id,lab,v,ph){return '<div class="field"><label for="'+id+'">'+lab+'</label><input id="'+id+'" data-bt="'+id+'" inputmode="decimal" value="'+esc(v)+'" placeholder="'+esc(ph||"")+'" autocomplete="off"></div>'}
function btSel(id,lab,opts,v){return '<div class="field"><label for="'+id+'">'+lab+'</label><select id="'+id+'" data-bt="'+id+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(String(a)===String(v)?' selected':'')+'>'+esc(b)+'</option>').join("")+'</select></div>'}
const btNum=v=>{const x=num(String(v||""));return x==null||!isFinite(x)?null:x};
function btFiltro(){
  const F=BT.f,box=$("btF");if(!box)return;
  if(!box.dataset.ok){box.dataset.ok=1;box.innerHTML='<div class="fnfilt">'
    +btSel("btTipo","Tipo",[["Ação","Ações"],["Unit","Units"],["","Ações e units"]],F.tipo)
    +btSel("btLiq","Liquidez mínima por dia",[[1e6,"R$ 1 milhão"],[5e6,"R$ 5 milhões"],[2e7,"R$ 20 milhões"],[1e8,"R$ 100 milhões"]],F.liq)
    +btIn("btDy","Rendimento mínimo (%)",F.dy,"ex.: 6")+btIn("btPl","P/L máximo",F.pl,"ex.: 10")+btIn("btPvp","P/VP máximo",F.pvp,"ex.: 1,5")+btIn("btRoe","ROE mínimo (%)",F.roe,"ex.: 15")
    +btIn("btR12","Alta mínima em 12 meses (%)",F.r12,"ex.: 0")
    +btSel("btTend","Tendência (técnica)",[["","Qualquer"],["alta","De alta"],["nbaixa","Que não seja de baixa"]],F.tend)
    +btSel("btIfr","IFR",[["","Qualquer"],["sv","Sobrevendido (30 ou menos)"],["n70","Não sobrecomprado (abaixo de 70)"]],F.ifr)
    +btSel("btOrd","Ordenar por",[["dy","Maior rendimento"],["pl","Menor P/L"],["pvp","Menor P/VP"],["roe","Maior ROE"],["r12","Maior alta em 12 meses"],["liq","Maior liquidez"]],F.ord)+'</div>'}
  const I=AT.idx,C=AT.C,dy=btNum(F.dy),pl=btNum(F.pl),pvp=btNum(F.pvp),roe=btNum(F.roe),r12=btNum(F.r12);
  const L=I.rows.filter(r=>{const tp=r[C.tipo];if(F.tipo?tp!==F.tipo:!(tp==="Ação"||tp==="Unit"))return false;if((r[C.liq]||0)<+F.liq)return false;
    if(dy!=null&&!(r[C.dy]>=dy))return false;if(pl!=null&&!(r[C.pl]>0&&r[C.pl]<=pl))return false;if(pvp!=null&&!(r[C.pvp]>0&&r[C.pvp]<=pvp))return false;
    if(roe!=null&&!(r[C.roe]>=roe))return false;if(r12!=null&&!(r[C.r12]>=r12))return false;
    if(F.tend==="alta"&&r[C.tend]!==1)return false;if(F.tend==="nbaixa"&&r[C.tend]===-1)return false;
    if(F.ifr==="sv"&&!(r[C.ifr]<=30))return false;if(F.ifr==="n70"&&!(r[C.ifr]<70))return false;return true});
  const k=C[F.ord],asc=F.ord==="pl"||F.ord==="pvp";L.sort((a,b)=>{const x=a[k],y=b[k];if(x==null)return 1;if(y==null)return -1;return asc?x-y:y-x});
  const f=(v,d,s)=>v==null?'—':fx(v,d)+(s||'');
  $("btFR").innerHTML='<p class="sub" style="margin:8px 0 4px">'+L.length+' ação(ões) passam em todos os critérios.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ação</th><th>Preço</th><th>Rendimento</th><th>P/L</th><th class="c-ph">P/VP</th><th class="c-ph">ROE</th><th class="c-ph">12 meses</th><th class="c-ph c-sm">Tendência</th><th class="c-ph c-sm">IFR</th></tr></thead><tbody>'
    +L.slice(0,40).map(r=>'<tr><td style="text-align:left"><button type="button" class="link" data-atopen="'+r[0]+'">'+r[0]+'</button><small style="display:block;color:var(--muted)">'+esc(r[1]).slice(0,34)+'</small></td><td>R$ '+fx(r[C.preco],2)+'</td><td>'+f(r[C.dy],1,'%')+'</td><td>'+f(r[C.pl],1)+'</td><td class="c-ph">'+f(r[C.pvp],2)+'</td><td class="c-ph">'+f(r[C.roe],1,'%')+'</td><td class="c-ph">'+fnPct(r[C.r12])+'</td><td class="c-ph c-sm">'+(C.tend!=null?tecCel("tend",r[C.tend]):'—')+'</td><td class="c-ph c-sm">'+(C.ifr!=null?tecCel("ifr",r[C.ifr]):'—')+'</td></tr>').join("")+'</tbody></table></div>'
    +(L.length>40?'<p class="sub">Mostrando 40 de '+L.length+'. Aperte os critérios para afunilar.</p>':'')+'<p class="sub" style="font-size:.8rem">Rendimento: proventos de 12 meses ÷ cotação. P/L, P/VP e ROE pelos balanços mais recentes na CVM (12 meses). Tendência e IFR pelos fechamentos diários.</p>';
}
function btRodar(){
  const P=BT.pn,T=BT.t,M=P.meses,n=M.length,A=Object.entries(P.a),i0=Math.max(13,M.indexOf(T.ini+"-01")),F=BT.f;
  const mom=(a,i)=>{let v=1;for(let k=i-11;k<=i-1;k++){const r=a.ret[k];if(r==null)return null;v*=1+r/100}return (v-1)*100};
  const crit=(a,i)=>{const dy=btNum(F.dy),pl=btNum(F.pl),pvp=btNum(F.pvp),roe=btNum(F.roe),r12=btNum(F.r12);
    if(dy!=null&&!(a.dy[i]>=dy))return false;if(pl!=null&&!(a.pl[i]>0&&a.pl[i]<=pl))return false;if(pvp!=null&&!(a.pvp[i]>0&&a.pvp[i]<=pvp))return false;
    if(roe!=null&&!(a.roe[i]>=roe))return false;if(r12!=null){const m=mom(a,i+1);if(!(m>=r12))return false}return true};
  const escolher=i=>{
    let E=A.filter(([t,a])=>a.ret[i]!=null&&(a.liq[i]||0)>=T.liq);
    const rk=(L,key,asc)=>{const s=L.slice().sort((x,y)=>asc?key(x)-key(y):key(y)-key(x));const m=new Map();s.forEach((x,j)=>m.set(x[0],j));return m};
    if(T.est==="div"){E=E.filter(([t,a])=>a.dy[i]>0&&!(a.pl[i]===null&&a.roe[i]!=null&&a.roe[i]<0));E.sort((x,y)=>y[1].dy[i]-x[1].dy[i])}
    else if(T.est==="valor"){E=E.filter(([t,a])=>a.pl[i]>0&&a.pvp[i]>0);const r1=rk(E,x=>x[1].pl[i],1),r2=rk(E,x=>x[1].pvp[i],1);E.sort((x,y)=>r1.get(x[0])+r2.get(x[0])-r1.get(y[0])-r2.get(y[0]))}
    else if(T.est==="mom"){E=E.map(x=>[x[0],x[1],mom(x[1],i+1)]).filter(x=>x[2]!=null);E.sort((x,y)=>y[2]-x[2])}
    else if(T.est==="magica"){E=E.filter(([t,a])=>a.pl[i]>0&&a.roe[i]!=null);const r1=rk(E,x=>x[1].pl[i],1),r2=rk(E,x=>x[1].roe[i],0);E.sort((x,y)=>r1.get(x[0])+r2.get(x[0])-r1.get(y[0])-r2.get(y[0]))}
    else if(T.est==="qual"){E=E.filter(([t,a])=>a.roe[i]>15&&a.pl[i]>0&&a.pl[i]<15);E.sort((x,y)=>y[1].roe[i]-x[1].roe[i])}
    else{E=E.filter(([t,a])=>crit(a,i));E.sort((x,y)=>(y[1].dy[i]||0)-(x[1].dy[i]||0))}
    return E.slice(0,T.n).map(x=>x[0]);
  };
  const S=[{i:i0,v:1,ib:1,cdi:1}];let w=new Map(),hold=[],v=1,vib=1,vcdi=1,trocas=0,custoTot=0;const hist=[];
  for(let i=i0;i<n-1;i++){
    if((i-i0)%T.reb===0){const novo=escolher(i);const nw=new Map(novo.map(t=>[t,1/novo.length]));let giro=0;new Set([...w.keys(),...nw.keys()]).forEach(t=>giro+=Math.abs((nw.get(t)||0)-(w.get(t)||0)));giro/=2;
      const c=giro*T.custo/100;v*=1-c;custoTot+=c;trocas++;w=nw;hold=novo;hist.push({m:M[i],L:novo})}
    let r=0;const nw=new Map();if(!w.size)r=(P.cdi[i+1]||0)/100;   // nenhuma ação passou nos critérios: o dinheiro fica no CDI
    w.forEach((p,t)=>{const x=P.a[t].ret[i+1];const rr=x==null?0:x/100;r+=p*rr;nw.set(t,p*(1+rr))});const s=[...nw.values()].reduce((a,b)=>a+b,0)||1;nw.forEach((p,t)=>nw.set(t,p/s));w=nw;
    v*=1+r;vib*=1+(P.ibov[i+1]||0)/100;vcdi*=1+(P.cdi[i+1]||0)/100;S.push({i:i+1,v,ib:vib,cdi:vcdi,r,rib:(P.ibov[i+1]||0)/100})}
  const anos=(S.length-1)/12,cagr=x=>(Math.pow(x,1/Math.max(anos,1/12))-1)*100,R=S.slice(1).map(x=>x.r),mu=R.reduce((a,b)=>a+b,0)/R.length,vol=Math.sqrt(R.reduce((a,b)=>a+(b-mu)**2,0)/Math.max(1,R.length-1)*12)*100;
  let pico=0,dd=0;S.forEach(x=>{if(x.v>pico)pico=x.v;dd=Math.min(dd,x.v/pico-1)});let pib=0,ddib=0;S.forEach(x=>{if(x.ib>pib)pib=x.ib;ddib=Math.min(ddib,x.ib/pib-1)});
  const acima=S.slice(1).filter(x=>x.r>x.rib).length/Math.max(1,S.length-1)*100,cd=cagr(vcdi);
  return {S,M,cagr:cagr(v),cagrIb:cagr(vib),cagrCdi:cd,vol,sharpe:vol?(cagr(v)-cd)/vol:null,dd:dd*100,ddib:ddib*100,acima,hold,hist,custoTot:custoTot*100,anos};
}
function btTeste(){
  const box=$("btT");if(!box)return;const T=BT.t;
  if(!box.dataset.ok){box.dataset.ok=1;box.innerHTML='<div class="fnfilt">'
    +btSel("btEst","Estratégia",Object.entries(BT_EST).map(([k,v])=>[k,v[0]]),T.est)
    +btSel("btN","Quantas ações",[[5,"5"],[10,"10"],[15,"15"],[20,"20"]],T.n)
    +btSel("btReb","Rebalancear a cada",[[1,"mês"],[3,"3 meses"],[6,"6 meses"],[12,"ano"]],T.reb)
    +btSel("btIni","Começar em",[2007,2010,2013,2016,2018,2020,2022].map(y=>[y,String(y)]),T.ini)
    +btSel("btTliq","Liquidez mínima por dia",[[1e6,"R$ 1 milhão"],[5e6,"R$ 5 milhões"],[2e7,"R$ 20 milhões"]],T.liq)
    +btSel("btCusto","Custo por troca",[[0,"sem custo"],[0.2,"0,2%"],[0.5,"0,5%"]],T.custo)+'</div><p class="sub" id="btDesc" style="font-size:.84rem;margin-top:4px"></p>'}
  $("btDesc").textContent="Regra: "+BT_EST[T.est][1]+"."+(["valor","magica","qual"].includes(T.est)||(T.est==="perso"&&(BT.f.pl||BT.f.pvp||BT.f.roe))?" Os balanços na base começam em 2016: estratégias com P/L, P/VP ou ROE só escolhem ações a partir de 2017.":"");
  const out=$("btTR");
  if(!BT.pn){out.innerHTML=BT.err?'<p class="sub">O painel histórico aparece depois da próxima coleta do robô de ativos.</p>':'<p class="sub">Carregando o histórico mensal das ações…</p>';btBoot();return}
  let X;try{X=btRodar()}catch(e){out.innerHTML='<p class="err">Não deu para rodar o teste: '+esc(e.message)+'</p>';return}
  BT.res=X;const t=i=>{const [y,m]=X.M[i].split("-");return Date.UTC(+y,+m-1,28)},pc=v=>(v>=0?'+':'')+fx(v,1)+'%';
  let h='<div class="fnkpis">'+tecKp("Retorno ao ano",pc(X.cagr),'Ibovespa '+pc(X.cagrIb)+' · CDI '+pc(X.cagrCdi))
    +tecKp("Volatilidade",fx(X.vol,1)+'%','ao ano')+tecKp("Sharpe",X.sharpe!=null?fx(X.sharpe,2):'—','retorno acima do CDI ÷ volatilidade')
    +tecKp("Pior queda",pc(X.dd),'Ibovespa '+pc(X.ddib))+tecKp("Meses melhores que o Ibovespa",fx(X.acima,0)+'%',fx(X.anos,1)+' anos testados')+'</div>';
  h+='<div class="label">Patrimônio de R$ 100 aplicado em '+X.M[X.S[0].i].split("-").reverse().join("/")+'</div>'+fnChart([{lab:BT_EST[BT.t.est][0],col:FN_COLS[0],w:2.2,pts:X.S.map(s=>[t(s.i),s.v*100])},{lab:"Ibovespa",col:FN_COLS[1],w:1.5,pts:X.S.map(s=>[t(s.i),s.ib*100])},{lab:"CDI",col:"var(--muted)",w:1.4,dash:"5 4",pts:X.S.map(s=>[t(s.i),s.cdi*100])}],{fmt:"num",aria:"Teste histórico"});
  // retornos por ano
  const anos={};X.S.slice(1).forEach(s=>{const y=X.M[s.i].slice(0,4),a=anos[y]||(anos[y]={e:1,ib:1});a.e*=1+s.r;a.ib*=1+s.rib});
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th>'+Object.keys(anos).map(y=>'<th>'+y+'</th>').join("")+'</tr></thead><tbody><tr><td style="text-align:left">Estratégia</td>'+Object.values(anos).map(a=>'<td><span class="'+(a.e>=a.ib?'pos':'neg')+'">'+pc((a.e-1)*100)+'</span></td>').join("")+'</tr><tr><td style="text-align:left">Ibovespa</td>'+Object.values(anos).map(a=>'<td>'+pc((a.ib-1)*100)+'</td>').join("")+'</tr></tbody></table></div>';
  const ult=X.hist[X.hist.length-1];
  if(ult)h+='<div class="label" style="margin-top:10px">Carteira do último rebalanceamento ('+ult.m.split("-").reverse().join("/")+')</div><p style="margin:4px 0">'+ult.L.map(t=>'<button type="button" class="link" data-atopen="'+t+'">'+t+'</button>').join(" · ")+'</p>';
  h+='<p class="sub" style="font-size:.8rem">Pesos iguais a cada rebalanceamento; proventos reinvestidos; quando nenhuma ação passa nos critérios, o dinheiro fica no CDI; custo de '+fx(BT.t.custo,1)+'% sobre o valor trocado (total de '+fx(X.custoTot,1)+'% no período); IR não descontado. Entram só ações com a liquidez mínima no mês da escolha. Ações que deixaram a bolsa saem da base (viés de sobrevivência): o resultado real tende a ser um pouco pior. Resultado passado não garante resultado futuro.</p>';
  out.innerHTML=h;
}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.bt)return;const id=t.id,v=t.value;
  const mf={btTipo:"tipo",btLiq:"liq",btDy:"dy",btPl:"pl",btPvp:"pvp",btRoe:"roe",btR12:"r12",btTend:"tend",btIfr:"ifr",btOrd:"ord"},mt={btEst:"est",btN:"n",btReb:"reb",btIni:"ini",btTliq:"liq",btCusto:"custo"};
  if(mf[id]){BT.f[mf[id]]=id==="btLiq"?+v:v;btSave();if(AT.idx)btFiltro();if(BT.t.est==="perso")btTeste()}
  else if(mt[id]){BT.t[mt[id]]=mt[id]==="est"?v:+v;btSave();btTeste()}});
