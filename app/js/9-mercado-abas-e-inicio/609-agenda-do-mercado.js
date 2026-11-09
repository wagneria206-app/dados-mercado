/* ---------- Mercado › Agenda: tudo o que tem data, num lugar só
   Copom (decisão e ata) e Fed pelos calendários oficiais; IBGE pelo calendário de divulgações (lido direto do IBGE);
   EUA pelos calendários do BLS e do BEA; Focus às segundas (Banco Central); projeções do IPCA da ANBIMA no dia do IPCA
   e do IPCA-15; vencimentos do DI e do dólar futuro na B3 (1º dia útil do mês). No Resumo fica só o que vem nos próximos dias. */
const AGM={f:{pais:"",tema:""}};
const AGM_DIAS=90,AGM_SEM=["dom","seg","ter","qua","qui","sex","sáb"];
function agmHoje(){try{return new Date().toLocaleDateString("en-CA",{timeZone:"America/Sao_Paulo"})}catch(e){return new Date().toISOString().slice(0,10)}}
function agmT(d){return Date.parse(d+"T00:00:00Z")}
function agmIso(t){return new Date(t).toISOString().slice(0,10)}
/* eventos de hoje até dias à frente: {t, hora, tit, det, pais:"BR"|"EUA", tema, imp:2 (move o mercado) | 1, fonte} */
function agmEventos(dias){
  const hj=agmHoje(),t0=agmT(hj),lim=t0+(dias||AGM_DIAS)*DAY,E=[],add=(t,o)=>{if(t>=t0&&t<=lim)E.push(Object.assign({t},o))};
  COPOM.forEach(d=>{add(d-DAY,{tit:"Copom: começa a reunião",pais:"BR",tema:"juros",imp:1,fonte:"Banco Central"});
    add(d,{hora:"18h30",tit:"Copom: decisão da Selic",det:"comunicado depois do fechamento do mercado",pais:"BR",tema:"juros",imp:2,fonte:"Banco Central"});
    let a=d+DAY,n=0;while(n<4){if(isBiz(a))n++;if(n<4)a+=DAY}add(a,{hora:"8h",tit:"Ata do Copom",pais:"BR",tema:"juros",imp:2,fonte:"Banco Central"})});
  FOMC.forEach(d=>add(d,{hora:"15h",tit:"Fed: decisão de juros (FOMC)",det:"entrevista do presidente do Fed às 15h30",pais:"EUA",tema:"juros",imp:2,fonte:"Federal Reserve"}));
  EUA_CAL.forEach(x=>{const k=x[1],tema=k==="emp"?"emprego":k==="pib"?"atividade":"inflacao";
    add(agmT(x[0]),{hora:euaHoraBr(x[0]),tit:"EUA: "+EUA_CAL_T[k][0],det:"referência "+x[2],pais:"EUA",tema,imp:k==="emp"||k==="cpi"?2:1,fonte:EUA_CAL_T[k][1]})});
  // Focus: toda segunda (ou o 1º dia útil da semana, depois de feriado)
  for(let t=t0-6*DAY;t<=lim;t+=DAY){const dw=new Date(t).getUTCDay();if(dw!==1)continue;let u=t;while(!isBiz(u))u+=DAY;add(u,{tit:"Boletim Focus",det:"de manhã · expectativas do mercado para Selic, IPCA, PIB e câmbio",pais:"BR",tema:"inflacao",imp:1,fonte:"Banco Central"})}
  // vencimentos na B3: DI futuro e dólar futuro vencem no 1º dia útil de cada mês
  for(let k=0;k<4;k++){const m=new Date(t0);let t=Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+k,1);while(!isBiz(t))t+=DAY;add(t,{tit:"Vencimento do DI futuro e do dólar futuro",pais:"BR",tema:"mercado",imp:1,fonte:"B3"})}
  // IBGE e, no dia do IPCA e do IPCA-15, a nova projeção da ANBIMA
  const IB=typeof ibgeCalItens==="function"?ibgeCalItens():[];
  (IB||[]).forEach(x=>{const ipca=/^IPCA\b|IPCA-15|IPCA - 15|Índice Nacional de Preços ao Consumidor Amplo/i.test(x.tit),tema=/IPCA|INPC|IPP|Preços/i.test(x.tit)?"inflacao":/PNAD|Desocupa/i.test(x.tit)?"emprego":"atividade";
    add(x.t,{hora:x.h,tit:"IBGE: "+x.tit,pais:"BR",tema,imp:ipca||/PIB|Contas Nacionais/i.test(x.tit)?2:1,fonte:"IBGE"});
    if(ipca)add(x.t,{hora:"17h30",tit:"ANBIMA: nova projeção do IPCA",det:"para o mês corrente e o seguinte",pais:"BR",tema:"inflacao",imp:1,fonte:"ANBIMA"})});
  // resultados das empresas: data prevista pela entrega do mesmo trimestre no ano anterior (CVM)
  if(typeof AT==="object"&&AT.idx&&AT.C.res!=null){const C=AT.C;AT.idx.rows.forEach(r=>{const d=r[C.res];if(!d||!(r[C.tipo]==="Ação"||r[C.tipo]==="Unit")||(r[C.liq]||0)<2e7)return;
    add(agmT(d),{tit:"Resultado: "+r[0]+" · "+nomeCx(r[1]).slice(0,30),det:"data prevista (mesmo trimestre do ano passado + 1 ano); depois do fechamento, em geral",pais:"BR",tema:"resultados",imp:(r[C.liq]||0)>=2e8?2:1,fonte:"CVM",tk:r[0]})})}
  else if(typeof AT==="object"&&!AT.idx&&!AT.err&&!AT.load){const p=atBoot();if(p&&p.then)p.then(()=>{if(activeMod==="agm"||activeMod==="sem")mkCalc()})}
  // proventos dos ativos das carteiras e dos favoritos (agenda de proventos da B3): data-com e pagamento
  if(typeof AG==="object"&&AG.dados&&AG.dados.rows&&typeof rdAtivos==="function"){const A=rdAtivos(),g=AG.dados,ix=k=>g.cols.indexOf(k);
    g.rows.forEach(r=>{const t=r[ix("t")];if(!A.has(t))return;const v=r[ix("valor")],y=r[ix("yield")],det="R$ "+fx(v,4)+" por cota/ação"+(y!=null?" ("+fx(y,2)+"%)":"")+(A.get(t).includes("c")?" · está numa carteira":" · favorito");
      if(r[ix("datacom")])add(agmT(r[ix("datacom")]),{tit:"Data-com: "+t+" ("+(r[ix("prov")]||"provento")+")",det:"último dia para ter direito · "+det,pais:"BR",tema:"proventos",imp:1,fonte:"B3"});
      if(r[ix("pagamento")])add(agmT(r[ix("pagamento")]),{tit:"Pagamento: "+t,det,pais:"BR",tema:"proventos",imp:1,fonte:"B3"})})}
  const hr=h=>{const m=/(\d+)h(\d*)/.exec(h||"");return m?(+m[1])*60+(+m[2]||0):9999};
  E.sort((a,b)=>a.t-b.t||hr(a.hora)-hr(b.hora));
  return {E,ibge:IB}}
const AGM_TEMAS={juros:"Juros",inflacao:"Inflação",atividade:"Atividade",emprego:"Emprego",mercado:"Mercado",resultados:"Resultados",proventos:"Proventos"};
function agmGrupo(t,t0){const dif=Math.round((t-t0)/DAY);if(dif===0)return ["d0","Hoje"];if(dif===1)return ["d1","Amanhã"];
  const dw=(new Date(t0).getUTCDay()+6)%7,seg=t0-dw*DAY,s=Math.floor((t-seg)/(7*DAY));if(s===0)return ["s0","Esta semana"];if(s===1)return ["s1","Próxima semana"];
  const x=new Date(t);return ["m"+x.getUTCFullYear()+x.getUTCMonth(),RM_MES[x.getUTCMonth()].replace(/^./,c=>c.toUpperCase())+" de "+x.getUTCFullYear()]}
function agmLinha(e,dia){return '<li class="agmi'+(e.imp>1?' agmimp':'')+'"><b>'+(dia?AGM_SEM[new Date(e.t).getUTCDay()]+' '+txD2(e.t):'')+(e.hora?'<small>'+e.hora+'</small>':'')+'</b><span><i class="agmp agmp'+e.pais+'">'+(e.pais==="BR"?"Brasil":"EUA")+'</i>'+esc(e.tit)+(e.imp>1?' <span class="agmstar" title="costuma mexer com o mercado">●</span>':'')+(e.det?'<small>'+esc(e.det)+'</small>':'')+'</span></li>'}
/* tela completa: filtros, proventos dos favoritos e um bloco por período (cada um recolhe) */
function agmTela(){
  const {E,ibge}=agmEventos(AGM_DIAS),f=AGM.f,t0=agmT(agmHoje()),L=E.filter(e=>(!f.pais||e.pais===f.pais)&&(!f.tema||e.tema===f.tema));
  const seg=(k,ops)=>'<div class="fnseg" role="group">'+ops.map(([v,l])=>'<button type="button" data-agmf="'+k+'" data-v="'+v+'" aria-pressed="'+(f[k]===v)+'">'+l+'</button>').join("")+'</div>';
  let h='<h3>Agenda do mercado</h3><p class="sub">Tudo o que tem data e costuma mexer com juros, câmbio e Bolsa, nos próximos '+Math.round(AGM_DIAS/30)+' meses. Horários de Brasília. <span class="agmstar">●</span> = costuma mexer com o mercado.</p>'
    +'<div class="agmfilt">'+seg("pais",[["","Todos"],["BR","Brasil"],["EUA","EUA"]])+seg("tema",[["","Todos os temas"]].concat(Object.entries(AGM_TEMAS)))+'</div>'+agmProvHtml();
  const out=[h],G=[];L.forEach(e=>{const [id,nm]=agmGrupo(e.t,t0);let g=G[G.length-1];if(!g||g.id!==id){g={id,nm,E:[]};G.push(g)}g.E.push(e)});
  if(!G.length)out.push('<h3>Nada marcado</h3><p class="sub">Nenhum evento com esses filtros nos próximos meses.</p>');
  G.forEach(g=>out.push('<h3>'+g.nm+' <small class="agmn">'+g.E.length+(g.E.length>1?' eventos':' evento')+'</small></h3><ul class="agl agml">'+g.E.map((e,i)=>agmLinha(e,i===0||g.E[i-1].t!==e.t)).join("")+'</ul>'));
  out.push('<h3>Fontes</h3><p class="sub" style="font-size:.84rem">Copom e Fed: calendários oficiais de reuniões (Banco Central e Federal Reserve); a ata do Copom sai na manhã do 4º dia útil depois da decisão. IBGE: calendário oficial de divulgações'+(ibge===null?' (carregando…)':ibge&&!ibge.length?' (não respondeu agora; tente mais tarde)':'')+'. EUA: calendários do Bureau of Labor Statistics e do Bureau of Economic Analysis (8h30 de Nova York). Focus: Banco Central, às segundas (ou no 1º dia útil da semana). ANBIMA: projeções do IPCA no fim da tarde do dia do IPCA e do IPCA-15. B3: vencimentos do DI e do dólar futuro no 1º dia útil do mês. Proventos de ações e FIIs ficam na <button type="button" class="link" data-mkgo="ag">Agenda de proventos</button>, na Bolsa.</p>');
  return out}
/* proventos (data com ou pagamento) dos ativos favoritos nas próximas duas semanas */
function agmProvHtml(){const fav=new Set((typeof FV!=="undefined"?FV.l:[]).map(x=>x.k).filter(k=>/^a:/.test(k)).map(k=>k.slice(2)));if(!fav.size)return "";
  if(typeof AG==="undefined")return "";
  if(!AG.dados){if(!AG.load&&!AG.err)AG.load=atGet("agenda.json").then(j=>{AG.dados=j;AG.load=null;if(activeMod==="agm")mkCalc()}).catch(e=>{AG.err=e;AG.load=null});return ""}
  const hj=agmHoje(),ate=agmIso(agmT(hj)+14*DAY),NM={D:"dividendo",J:"JCP",R:"rendimento",A:"amortização"},P=[];
  AG.dados.rows.forEach(r=>{if(!fav.has(r[0]))return;if(r[3]>=hj&&r[3]<=ate)P.push([r[3],r[0],"data com · "+(NM[r[2]]||r[2])+" de R$ "+fx(r[5],r[5]<0.1?4:2)]);if(r[4]&&r[4]>=hj&&r[4]<=ate)P.push([r[4],r[0],"pagamento · "+(NM[r[2]]||r[2])+" de R$ "+fx(r[5],r[5]<0.1?4:2)])});
  P.sort((a,b)=>a[0].localeCompare(b[0]));
  return '<div class="agmprov"><b>Proventos dos seus favoritos nas próximas 2 semanas</b>'+(P.length?'<ul>'+P.slice(0,8).map(x=>'<li><span>'+AGM_SEM[new Date(agmT(x[0])).getUTCDay()]+' '+txD2(agmT(x[0]))+'</span> <button type="button" class="link" data-agmat="'+esc(x[1])+'">'+esc(x[1])+'</button> '+esc(x[2])+'</li>').join("")+'</ul>':'<p class="sub" style="margin:2px 0 0">Nenhum provento anunciado para os seus favoritos nesse período.</p>')+' <button type="button" class="link" data-mkgo="ag">Ver a agenda de proventos</button></div>'}
/* Resumo: só os próximos dias */
function agmCurtoHtml(){const {E}=agmEventos(10),t0=agmT(agmHoje());let L=E.filter(e=>e.t<=t0+DAY);const so=!L.length;if(so)L=E.slice(0,4);else L=L.slice(0,6);
  return '<span class="label">Agenda: '+(so?'próximos eventos':'hoje e amanhã')+'</span>'+(L.length?'<ul class="agl agml">'+L.map((e,i)=>agmLinha(e,i===0||L[i-1].t!==e.t)).join("")+'</ul>':'<p class="sub">Nada marcado nos próximos dias.</p>')+'<p class="sub" style="margin-top:6px"><button type="button" class="link" data-mkgo="agm">Ver a agenda completa</button> (Copom, Fed, IBGE, EUA, Focus, ANBIMA e B3).</p>'}
/* atalho nas abas que antes tinham calendário próprio */
function agmAtalho(txt){return '<p class="sub" style="margin:0">'+txt+' <button type="button" class="link" data-mkgo="agm">Agenda</button>.</p>'}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-agmf]");if(!x||activeMod!=="agm")return;AGM.f[x.dataset.agmf]=x.dataset.v;mkCalc()});
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-agmat]");if(x)atOpen(x.dataset.agmat)});
