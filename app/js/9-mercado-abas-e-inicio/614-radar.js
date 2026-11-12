/* ---------- Radar: o que mudou e merece atenção, em ordem de urgência.
   Não cria análise nova: junta os sinais que o app já calcula (carteiras, favoritos, mercado e qualidade dos dados).
   Níveis: 1 Agir (a carteira pede decisão) · 2 Atenção (mudou algo relevante) · 3 Oportunidade (para estudar). */
const RD={f:"todos",vistos:{}};
try{RD.vistos=JSON.parse(localStorage.getItem("rdVistos")||"{}")||{}}catch(e){}
function rdCarrega(){ // pede o que falta; cada carga chama o Radar de novo quando chega
  const falta=[];
  if(!AT.idx&&!AT.err){falta.push("Bolsa");const p=atBoot();if(p&&p.then)p.then(()=>{if(activeMod==="rd")mkCalc()})}
  if(!FN.idx&&!FN.err&&typeof fnBoot==="function"){falta.push("fundos");const p=fnBoot();if(p&&p.then)p.then(()=>{if(activeMod==="rd")mkCalc()})}
  if(!EU.S)euBoot();if(!MC.d)mcBoot();if(!MK.loaded)mkLoad();if(!CURV)curvasLoad();
  if(typeof bkBoot==="function")bkBoot();if(typeof emBoot==="function")emBoot();if(typeof insBoot==="function")insBoot();if(typeof alBoot==="function")alBoot();if(typeof sdLoad==="function")sdLoad();
  if(typeof AG==="object"&&!AG.dados&&!AG.load&&!AG.err)AG.load=atGet("agenda.json").then(j=>{AG.dados=j;AG.load=null;if(activeMod==="rd")mkCalc()}).catch(e=>{AG.err=e;AG.load=null});
  return falta;
}
function rdAtivos(){ // códigos da B3 nas carteiras e nos favoritos
  const S=new Map();
  (SP.carts||[]).forEach(c=>(c.itens||[]).forEach(x=>{if(x.t==="a"&&x.k&&!/^TD-/.test(x.k))S.set(x.k,(S.get(x.k)||"")+"c")}));
  (FV.l||[]).forEach(f=>{if(f.k&&f.k[0]==="a")S.set(f.k.slice(2),(S.get(f.k.slice(2))||"")+"f")});
  return S;
}
function rdZ(P,dias){ // variação do último dia contra o desvio dos últimos "dias" dias
  if(!P||P.length<dias+2)return null;const r=[];for(let i=P.length-dias;i<P.length;i++)r.push(P[i][1]/P[i-1][1]-1);
  const u=r.pop(),mu=r.reduce((a,b)=>a+b,0)/r.length,sd=Math.sqrt(r.reduce((a,b)=>a+(b-mu)**2,0)/(r.length-1));return sd?{z:(u-mu)/sd,u:u*100,t:P[P.length-1][0]}:null;
}
function rdSinais(){
  const L=[],add=(nv,alvo,tit,det,go,chave)=>L.push({nv,alvo,tit,det,go:go||"",chave:chave||tit});
  const hj=Date.parse(agmHoje()+"T00:00:00Z");
  // 1) carteiras
  (SP.carts||[]).forEach((c,ci)=>{const it=c.itens||[];if(!it.length)return;const nm=c.nome||("Carteira "+(ci+1)),go='data-rdcart="'+ci+'"';
    let C=null;try{C=spCredito(c,it)}catch(e){}
    if(C){C.L.forEach(g=>{
      if(g.acima>0)add(1,"carteira",nm+": "+brl(g.acima)+" acima do FGC em "+g.em,"o FGC cobre até R$ 250 mil por instituição; o excedente corre o risco do banco",go);
      if(g.cred>0&&g.pc>SP_EMIS_LIM)add(2,"carteira",nm+": "+fx(g.pc,1)+"% num só emissor ("+g.em+")","concentração acima de "+SP_EMIS_LIM+"% em crédito privado",go);
      if(g.fgc>0&&typeof bkAcha==="function"&&BK.d){const b=bkAcha(g.em);if(b){const k=bkSaudeCalc(b);if(k.nivel===3)add(1,"carteira",nm+": banco "+nomeCx(g.em)+" está frágil",k.al.slice(0,2).join(", ")||"indicadores do Banco Central",go)}}
      if(g.cred>0&&typeof EM==="object"&&EM.d){const k=bkNome(g.em),e=Object.values(EM.d.e).find(x=>{const n=bkNome(x.n);return n===k||(n.length>=6&&(n.includes(k)||k.includes(n)))});if(e){const q=emCalc(e);if(q&&q.nivel===3)add(1,"carteira",nm+": emissor "+nomeCx(g.em)+" está frágil",q.alerta.slice(0,2).join(", "),go)}}})}
    it.forEach(x=>{const vc=spVenc(x);if(vc&&vc.d){const d=(Date.parse(vc.d+"T00:00:00Z")-hj)/DAY;if(d>=0&&d<=15)add(1,"carteira",nm+": "+spItemNome(x).slice(0,40)+" vence em "+fdate(Date.parse(vc.d+"T00:00:00Z")),"decidir onde reaplicar o dinheiro",go)}});
    const temFundoTrib=it.some(x=>x.t==="f");
    if(temFundoTrib){const cc=spComeCotas(agmHoje()),d=(cc.prox-hj)/DAY;if(d>=0&&d<=20)add(2,"carteira",nm+": come-cotas em "+fdate(cc.prox),"os fundos de renda fixa e multimercado antecipam o IR nessa data",go,"come"+ci)}});
  // 2) ativos das carteiras e dos favoritos
  const A=rdAtivos();
  if(AT.idx&&A.size){const C=AT.C;
    A.forEach((orig,t)=>{const r=atRow(t);if(!r)return;const alvo=orig.includes("c")?"carteira":"favoritos",go='data-atopen="'+t+'"';
      if(C.cruz!=null&&r[C.cruz]===1)add(2,alvo,t+": média de 50 dias cruzou para cima a de 200","cruzamento de alta nos últimos 20 pregões",go);
      if(C.cruz!=null&&r[C.cruz]===-1)add(2,alvo,t+": média de 50 dias cruzou para baixo a de 200","cruzamento de baixa nos últimos 20 pregões",go);
      if(C.ifr!=null&&r[C.ifr]!=null&&(r[C.ifr]>=75||r[C.ifr]<=25))add(2,alvo,t+": IFR em "+fx(r[C.ifr],0),r[C.ifr]>=75?"sobrecomprado: subiu forte em pouco tempo":"sobrevendido: caiu forte em pouco tempo",go);
      if(C.max52d!=null&&r[C.max52d]!=null&&r[C.max52d]>-1)add(2,alvo,t+": na máxima de 52 semanas","R$ "+fx(r[C.preco],2),go);
      if(C.min52d!=null&&r[C.min52d]!=null&&r[C.min52d]<1)add(2,alvo,t+": na mínima de 52 semanas","R$ "+fx(r[C.preco],2),go);
      if(C.d1!=null&&r[C.d1]!=null&&Math.abs(r[C.d1])>=5)add(2,alvo,t+": "+(r[C.d1]>0?"+":"")+fx(r[C.d1],1)+"% no dia","variação forte no último pregão",go);
      if(C.res!=null&&r[C.res]){const d=(Date.parse(r[C.res]+"T00:00:00Z")-hj)/DAY;if(d>=0&&d<=7)add(2,alvo,t+": resultado previsto para "+fdate(Date.parse(r[C.res]+"T00:00:00Z")),"data estimada pela entrega do mesmo trimestre no ano passado",go)}
      if(typeof AL==="object"&&AL.d){const H=AL.d.t[t];if(H&&H.length>22){const u=H[H.length-1][1],a=H[H.length-22][1];if(a&&u/a>1.2)add(2,alvo,t+": aluguel de ações subiu "+fx((u/a-1)*100,0)+"% em um mês","mais investidores apostando na queda",go)}}
      if(typeof INS==="object"&&INS.d&&INS.emp){const e=INS.emp[t.slice(0,4)],ci=e&&e.cnpj&&INS.d.cias[e.cnpj];if(ci){const s=insSaldo(ci,2,["ctl","cons","dir","out"]);if(Math.abs(s.s)>=1e6)add(2,alvo,t+": insiders "+(s.s>0?"compraram":"venderam")+" "+fnMoney(Math.abs(s.s))+" (saldo)","controladores, conselheiros e diretores nos 2 meses mais recentes",go)}}
    });
    if(typeof AG==="object"&&AG.dados&&AG.dados.rows){const ag=AG.dados,ix=k=>ag.cols.indexOf(k);ag.rows.forEach(r=>{const t=r[ix("t")];if(!A.has(t))return;const dc=r[ix("datacom")];const d=(Date.parse(dc+"T00:00:00Z")-hj)/DAY;if(d>=0&&d<=7)add(2,A.get(t).includes("c")?"carteira":"favoritos",t+": data-com de provento em "+fdate(Date.parse(dc+"T00:00:00Z")),"R$ "+fx(r[ix("valor")],4)+" por ação"+(r[ix("yield")]!=null?" ("+fx(r[ix("yield")],2)+"%)":""),'data-atopen="'+t+'"',"prov"+t+dc)})}
  }
  // 3) alertas dos favoritos que estão valendo agora
  (FV.a||[]).forEach(a=>{const I=fvInfo(a.k),t=fvTest(a,I);if(t&&t.ok)add(1,"favoritos",(I.n||a.k)+": "+fvAlLong(a).charAt(0).toLowerCase()+fvAlLong(a).slice(1),"agora "+fvFv(a,t.x),a.k[0]==="a"?'data-atopen="'+a.k.slice(2)+'"':'data-mkgo="fv"',"al"+a.id)});
  // 4) mercado: movimentos fora do normal, Focus, oportunidades
  if(EU.S){[["ibov","Ibovespa"],["usd","Dólar"],["spx","S&P 500"]].forEach(([k,n])=>{const z=rdZ(EU.S[k],250);if(z&&Math.abs(z.z)>=2)add(2,"mercado",n+": "+(z.u>0?"+":"")+fx(z.u,2)+"% em "+fdate(z.t),"movimento "+fx(Math.abs(z.z),1)+" vezes maior que o normal do último ano",'data-mkgo="sem"')})}
  if(MK.di){const ks=Object.keys(MK.di.dias).sort();if(ks.length>40){const y=+ks[ks.length-1].slice(2,4)+2,c="F"+String(y).padStart(2,"0"),S=ks.map(k=>{const x=(MK.di.dias[k]||[]).find(r=>r[0]===c);return x&&x[3]!=null?+x[3]:null});const d=[];for(let i=1;i<S.length;i++)if(S[i]!=null&&S[i-1]!=null)d.push(S[i]-S[i-1]);if(d.length>30){const u=d[d.length-1],r=d.slice(-61,-1),mu=r.reduce((a,b)=>a+b,0)/r.length,sd=Math.sqrt(r.reduce((a,b)=>a+(b-mu)**2,0)/(r.length-1));if(sd&&Math.abs((u-mu)/sd)>=2)add(2,"mercado","Juros futuros: DI de janeiro de "+(2000+y)+" "+(u>0?"subiu":"caiu")+" "+fx(Math.abs(u)*100,0)+" bps no último pregão","movimento fora do normal dos últimos 60 pregões",'data-mkgo="ju"')}}}
  if(MC.d&&MC.d.focus){const y=new Date().getUTCFullYear();[["IPCA",y,"IPCA de "+y],["Selic",y+1,"Selic no fim de "+(y+1)]].forEach(([i,a,n])=>{const f=semFocus(i,a);if(f&&Math.abs(f.d)>=0.1)add(2,"mercado","Focus: "+n+" "+(f.d>0?"subiu":"caiu")+" para "+fx(f.v,2)+"%",(f.d>0?"+":"")+fx(f.d,2)+" p.p. na última pesquisa",'data-mkgo="ec"',"focus"+i)})}
  try{oppData().filter(o=>isFinite(o.pctl)&&o.pctl>=95&&o.n>=500&&o.fam!=="selic").sort((a,b)=>b.pctl-a.pctl).slice(0,3).forEach(o=>add(3,"mercado",o.name+" a "+(o.fam==="ipca"?"IPCA + ":"")+fx(o.buy,2)+"%","taxa maior que em "+fx(o.pctl,0)+"% dos dias da história do título",'data-mkgo="tx"',"td"+o.k))}catch(e){}
  if(AT.idx&&AT.C.pvp!=null){const C=AT.C,F=AT.idx.rows.filter(r=>r[C.tipo]==="FII"&&(r[C.liq]||0)>=2e6&&r[C.pvp]>=0.5&&r[C.pvp]<=0.85&&r[C.dy]>=12&&r[C.dy]<30).sort((a,b)=>a[C.pvp]-b[C.pvp]).slice(0,3);F.forEach(r=>add(3,"mercado",r[0]+": FII com P/VP "+fx(r[C.pvp],2)+" e rendimento de "+fx(r[C.dy],1)+"%","desconto sobre o patrimônio com bom rendimento; confira vacância e inadimplência",'data-atopen="'+r[0]+'"'))}
  // 5) qualidade dos dados
  try{const at=du(VAL,hj);if(at>2)add(2,"app","Dados de "+fdate(VAL)+": "+at+" dias úteis sem atualização","os robôs não rodaram desde então",'data-mkgo="rs"',"dados")}catch(e){}
  if(typeof SD==="object"&&SD.d&&SD.d.fontes){const ruins=SD.d.fontes.filter(f=>!f.ok);if(ruins.length)add(2,"app",ruins.length+(ruins.length>1?" fontes com problema":" fonte com problema")+" ou valor suspeito",ruins.slice(0,3).map(f=>f.nome).join("; "),'data-rdsaude="1"',"saude")}
  return L;
}
function rdTela(){
  const falta=rdCarrega(),L=rdSinais(),NV=["","Agir","Atenção","Oportunidade"],COR=["","var(--loss)","var(--warn)","var(--accent)"],ALV={carteira:"Carteiras",favoritos:"Favoritos",mercado:"Mercado",app:"Dados"};
  const V=L.filter(x=>RD.f==="todos"||x.alvo===RD.f).sort((a,b)=>a.nv-b.nv||["carteira","favoritos","mercado","app"].indexOf(a.alvo)-["carteira","favoritos","mercado","app"].indexOf(b.alvo));
  const novo=x=>!RD.vistos[x.chave];
  let h='<h3>Radar</h3><p class="sub">O que mudou e merece atenção nas suas carteiras, nos seus favoritos e no mercado, do mais urgente ao que é só para estudar. Toque num item para abrir o detalhe.</p>'
    +(falta.length?'<p class="sub">Carregando: '+falta.join(", ")+'…</p>':'')
    +'<div class="fnkpis">'+[1,2,3].map(n=>tecKp(NV[n],'<span style="color:'+COR[n]+'">'+L.filter(x=>x.nv===n).length+'</span>',n===1?'pede decisão':n===2?'mudou algo relevante':'para estudar')).join("")+tecKp("Novos desde a última visita",String(L.filter(novo).length),'')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px">'+fnSeg("rdf",[["todos","Tudo"],["carteira","Carteiras"],["favoritos","Favoritos"],["mercado","Mercado"],["app","Dados"]],RD.f)+'</div>';
  if(!V.length)h+='<p class="sub">Nada pedindo atenção agora'+(RD.f!=="todos"?' neste filtro':'')+'. O Radar olha as carteiras e os favoritos: monte uma carteira em Carteiras e Simulações e favorite ativos e fundos para acompanhá-los aqui.</p>';
  else h+='<ul class="rdl">'+V.map(x=>'<li class="rdi" style="--c:'+COR[x.nv]+'"><button type="button" class="rdb" '+x.go+'><span class="rdn">'+NV[x.nv]+' · '+ALV[x.alvo]+(novo(x)?' <b class="tag">novo</b>':'')+'</span><b class="rdt">'+esc(x.tit)+'</b>'+(x.det?'<small>'+esc(x.det)+'</small>':'')+'</button></li>').join("")+'</ul>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">Os sinais vêm das telas do app: crédito e FGC das carteiras, saúde dos bancos e emissores, análise técnica, insiders, aluguel, calendário de resultados e proventos, alertas dos favoritos, juros futuros, Focus, Tesouro e FIIs. Fica tudo neste aparelho.</p>';
  // marca como visto depois de mostrar
  setTimeout(()=>{L.forEach(x=>RD.vistos[x.chave]=Date.now());const lim=Date.now()-30*DAY;Object.keys(RD.vistos).forEach(k=>{if(RD.vistos[k]<lim)delete RD.vistos[k]});try{localStorage.setItem("rdVistos",JSON.stringify(RD.vistos))}catch(e){}},3000);
  return [h];
}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-rdf],[data-rdcart],[data-rdsaude]");if(!x)return;
  if(x.dataset.rdf){RD.f=x.dataset.rdf;mkCalc();return}
  if(x.dataset.rdcart!=null){SP.cur=+x.dataset.rdcart;try{localStorage.setItem("spCur",String(SP.cur))}catch(y){}if(typeof SP_CMP!=="undefined")SP_CMP=null;setMod("sp");return}
  if(x.dataset.rdsaude){const b=$("btSaude");if(b)b.click()}});
