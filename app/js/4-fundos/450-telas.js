/* ---------- telas */
function fnSeg(name,list,cur){return '<div class="fnseg" role="group">'+list.map(([v,l])=>'<button type="button" data-'+name+'="'+v+'" aria-pressed="'+(String(cur)===String(v)?"true":"false")+'">'+l+'</button>').join("")+'</div>'}
function fnShell(m){
  const o=$("fnOut");if(!o)return null;
  if(FN.view!==m){FN.view=m;
    if(m==="fa")o.innerHTML='<section class="panel fnsrch"><label class="label" for="fnQ">Buscar fundo</label><div class="fnqbox"><input id="fnQ" autocomplete="off" placeholder="Nome, CNPJ ou gestora" value="'+esc(FN.q)+'"><div id="fnRes" class="fnres" hidden></div></div><p class="sub" style="margin-top:6px;font-size:.82rem">Todos os fundos com cota diária informada à CVM. Dados oficiais da CVM (informe diário, cadastro, lâmina e carteira), CDI e IPCA do Banco Central e índices da B3.</p></section><div id="fnBody"></div>';
    else if(m==="fr")o.innerHTML='<section class="panel"><h3>Ranking de fundos</h3><p class="sub">Compare fundos da mesma categoria. Clique numa coluna para ordenar e no fundo para abrir a análise.</p><div id="fnRkF"></div><div id="fnRkT"></div></section>';
    else o.innerHTML='<section class="panel"><h3>Comparar fundos</h3><p class="sub">Escolha até 25 fundos para comparar rentabilidade, risco, janelas móveis e características no mesmo período.</p><div class="fnqbox" style="margin-top:8px"><input id="fnCq" autocomplete="off" placeholder="Adicionar fundo: nome ou CNPJ"><div id="fnCres" class="fnres" hidden></div></div><div id="fnCbody"></div></section>';
  }
  return o;
}
function fnRender(){if(activeMod==="aa")atAa();else if(activeMod==="ac")atCmp();else if(activeMod==="fa")fnFa();else if(activeMod==="fc")fnCmp()}
function fnCalc(m){
  m=m||(FNM.has(activeMod)?activeMod:"fa");if(m==="aa"||m==="ar"||m==="ac")return atCalc(m);if(m==="au")return euCalc();if(m==="fg")return fnGest();if(m==="sp")return spCalc();if(m==="ag")return agCalc();const o=fnShell(m);if(!o)return;
  const body=m==="fa"?$("fnBody"):m==="fr"?$("fnRkT"):$("fnCbody");
  if(!FN.idx){
    if(FN.err){const h='<section class="panel"><p class="warn">A base de fundos ainda não está disponível ('+esc(FN.err.message||FN.err)+'). Na primeira vez o robô leva cerca de uma hora para montar o histórico de todos os fundos da CVM. Tente de novo em alguns minutos.</p><button type="button" class="btn sec" data-fnretry="1">Tentar de novo</button></section>';if(body)body.innerHTML=h;else o.innerHTML=h}
    else{if(body)body.innerHTML='<section class="panel"><p class="sub">Carregando a base de fundos da CVM…</p></section>';fnBoot()}
    return;
  }
  if(m==="fa")fnFa();else if(m==="fr")fnRk();else fnCmp();
}
function fnSearch(q,max){
  const t=fnNorm(q).split(/\s+/).filter(Boolean),dig=q.replace(/\D/g,"");if(!t.length)return [];
  const C=FN.C,R=FN.idx.rows,out=[];
  for(let j=0;j<R.length;j++){const s=FN.sk[j];if(dig.length>=6&&R[j][0].startsWith(dig)){out.push(j);continue}if(t.every(w=>s.includes(w)))out.push(j)}
  out.sort((a,b)=>(R[b][C.pl]||0)-(R[a][C.pl]||0));return out.slice(0,max||12);
}
function fnResHtml(js){const R=FN.idx.rows,C=FN.C;if(!js.length)return '<div class="fnri"><small>Nenhum fundo encontrado.</small></div>';
  return js.map(j=>{const r=R[j];return '<button type="button" class="fnri" data-fnopen="'+r[0]+'"><b>'+esc(r[1])+'</b><small>'+fnCnpjF(r[0])+' · '+esc(FN.idx.classes[r[C.classe]]||"")+' · PL '+fnMoney(r[C.pl])+' · 12m '+fnPctT(r[C.r12])+'</small></button>'}).join("")}
function fnRow(k){const R=FN.idx.rows;for(let j=0;j<R.length;j++)if(R[j][0]===k)return R[j];return null}
function fnHash(){const m=/fundo=([0-9A-Z]{14,16})/i.exec(location.hash||"");if(m&&(FN.cur!==m[1]||activeMod!=="fa")){FN.cur=m[1];FN.q="";const q=$("fnQ");if(q)q.value="";const r=$("fnRes");if(r)r.hidden=true;if(activeMod!=="fa")setMod("fa");else fnFa()}}
function fnOpen(k){FN.cur=k;FN.q="";try{history.replaceState(null,"","#fundo="+k)}catch(e){}
  try{const h=JSON.parse(localStorage.getItem("fnHist")||"[]").filter(x=>x!==k);h.unshift(k);localStorage.setItem("fnHist",JSON.stringify(h.slice(0,8)))}catch(e){}
  if(activeMod!=="fa")setMod("fa");else{const q=$("fnQ");if(q)q.value="";const r=$("fnRes");if(r)r.hidden=true;fnFa()}
  try{$("fnOut").scrollIntoView({behavior:"smooth",block:"start"})}catch(e){}}

/* análise de um fundo */
function fnFa(){
  const b=$("fnBody");if(!b)return;
  if(!FN.cur){b.innerHTML=fnHome();return}
  const k=FN.cur;
  if(!FN.files.has(k)){b.innerHTML='<section class="panel"><p class="sub">Carregando o fundo '+fnCnpjF(k)+'…</p></section>';
    fnFund(k).then(()=>{if(FN.cur===k&&activeMod==="fa")fnFa()}).catch(e=>{if(FN.cur===k)b.innerHTML='<section class="panel"><p class="warn">Não encontrei o fundo '+fnCnpjF(k)+' na base da CVM ('+esc(e.message)+'). Ele pode estar encerrado ou não informar cota diária.</p></section>'});return}
  const F=FN.files.get(k);
  try{b.innerHTML=fnHead(F)+fnPerfHtml(F)+fnWinHtml(F)+fnMonHtml(F)+fnRiskHtml(F)+fnJanHtml(F)+fnPeerHtml(F)+fnSimHtml(F)+fnGrossHtml(F)+fnPlHtml(F)+fnCartHtml(F)+fnDocsHtml(F)+fnSrcHtml(F)}
  catch(e){b.innerHTML='<section class="panel"><p class="err">Não deu para montar a análise: '+esc(e.message)+'</p></section>';console.error(e)}
}
function fnHome(){
  const R=FN.idx.rows,C=FN.C;let h=favHtml();
  let hist=[];try{hist=JSON.parse(localStorage.getItem("fnHist")||"[]")}catch(e){}
  const rows=hist.map(fnRow).filter(Boolean);
  const list=(t,arr,f)=>'<section class="panel"><div class="label">'+t+'</div><div class="fnlist">'+arr.map(r=>'<button type="button" class="fnri" data-fnopen="'+r[0]+'"><b>'+esc(r[1])+'</b><small>'+esc(FN.idx.classes[r[C.classe]]||"")+' · '+f(r)+'</small></button>').join("")+'</div></section>';
  if(rows.length)h+=list("Vistos recentemente",rows,r=>'12m '+fnPctT(r[C.r12])+' · PL '+fnMoney(r[C.pl]));
  const ok=r=>!(r[C.flags]&1)&&!(r[C.flags]&4)&&r[C.cotistas]>=500;
  h+=list("Maiores captações líquidas em 12 meses",R.filter(ok).sort((a,b)=>(b[C.capt12]||0)-(a[C.capt12]||0)).slice(0,8),r=>'captação '+fnMoney(r[C.capt12])+' · PL '+fnMoney(r[C.pl]));
  h+=list("Maiores fundos abertos ao público",R.filter(r=>ok(r)&&!(r[C.flags]&2)).sort((a,b)=>(b[C.pl]||0)-(a[C.pl]||0)).slice(0,8),r=>'PL '+fnMoney(r[C.pl])+' · '+fnInt(r[C.cotistas])+' cotistas');
  return h;
}
function fnTags(r,F){const t=[];const fl=r?r[FN.C.flags]:0;if(F&&F.pai)t.push("Subclasse");if(F&&/^s/i.test(F.prev||""))t.push("Previdenciário");if(fl&1)t.push("Exclusivo");if(fl&4)t.push("Investidor profissional");else if(fl&2)t.push("Investidor qualificado");else t.push("Público geral");if(fl&8)t.push("Fundo de cotas");if(fl&16)t.push("Condomínio fechado");if(F&&/^s/i.test(F.lp||""))t.push("Longo prazo");return t}
function fnHead(F){
  const r=fnRow(F.c),C=FN.C,l=fnLast(F),r12=fnRet(F,"12"),ra=fnRet(F,"ano"),cd12=r12?fnBmRet("cdi",r12.p0,r12.p1):null,rk=fnRisk(F,fnStart(F,"12"));
  const u=F.M.get(F.MK[F.MK.length-1])||{},nm=F.n||F.fan||fnCnpjF(F.c),inCmp=FN.cmp.includes(F.c);
  let h='<section class="panel fnhead"><div class="fnh1"><div><h3>'+esc(nm)+'</h3><div class="fnsub">'+fnCnpjF(F.c)+(F.fan&&F.fan!==F.n?' · '+esc(F.fan):'')+'</div>';
  h+='<div class="fntags">'+[F.tipo,FN.idx.classes[r?r[C.classe]:-1],F.anb].filter(Boolean).map(x=>'<span class="fntag strong">'+esc(x)+'</span>').join("")+fnTags(r,F).map(x=>'<span class="fntag">'+esc(x)+'</span>').join("")+'</div></div>';
  h+='<div class="fnacts">'+favBtn("f:"+F.c,nm)+'<button type="button" class="btn sec" data-fncmp="'+F.c+'">'+(inCmp?"✓ No comparador":"+ Comparar")+'</button><button type="button" class="btn sec" data-fncalc="'+F.c+'">Calcular aplicação</button><button type="button" class="btn sec" data-rel="fa">Relatório PDF</button></div></div>';
  if(r&&r[C.flags]&64)h+='<p class="warn" style="font-size:.86rem;margin-top:8px">A cota deste fundo teve saltos nos últimos anos (reinício de cota, amortização ou erro no informe à CVM). As rentabilidades e os indicadores de risco que atravessam esses saltos foram omitidos do ranking e podem não ser comparáveis.</p>';
  if(F.pai)h+='<p class="sub" style="margin-top:6px">Esta é uma subclasse, com cota própria. <button type="button" class="link" data-fnopen="'+F.pai+'">Ver a classe '+fnCnpjF(F.pai)+'</button></p>';
  const kp=(a,b,c)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(c?'<small>'+c+'</small>':'')+'</div>';
  h+='<div class="fnkpis">'+kp("Rentabilidade 12 meses",r12?fnPct(r12.r):"—",cd12&&r12?fx(r12.r/cd12*100,0)+"% do CDI":"")+kp("No ano",ra?fnPct(ra.r):"—",ra&&fnBmRet("cdi",ra.p0,ra.p1)?fx(ra.r/fnBmRet("cdi",ra.p0,ra.p1)*100,0)+"% do CDI":"")
    +kp("Patrimônio líquido",fnMoney(u.pl),u.cot!=null?fnInt(u.cot)+" cotistas":"")+kp("Volatilidade 12m",rk?fx(rk.vol,2)+"%":"—",rk&&rk.sharpe!=null?"Sharpe "+fx(rk.sharpe,2):"")
    +kp("Última cota",l?fx(l.q,6):"—",l?fdate(l.t):"")+'</div>';
  const it=[];const add=(a,b)=>{if(b!=null&&b!=="")it.push('<div><dt>'+a+'</dt><dd>'+b+'</dd></div>')};
  add("Gestora",esc(F.ges||""));add("Administradora",esc(F.adm||""));add("Custodiante",esc(F.cus||""));add("Auditoria",esc(F.aud||""));
  {const k0=F.MK&&F.MK[0],ti=F.ini?Date.parse(F.ini.slice(0,10)+"T00:00:00Z"):null,tc=k0!=null?Date.UTC(Math.floor(k0/12),k0%12,1):null;add("Início das atividades",ti?fdate(ti)+(tc&&tc<ti-31*DAY?' <small>(cotas na CVM desde '+mname(k0)+(k0===2005*12?' ou antes':'')+')</small>':''):tc?'cotas na CVM desde '+mname(k0):"")}add("Índice de referência",esc(F.bm||""));
  add("Taxa de administração",F.tadm!=null?fx(F.tadm,2)+"% a.a.":"");add("Taxa de performance",F.tperf!=null?(F.tperf?fx(F.tperf,0)+"%"+(F.itperf?" <small>"+esc(String(F.itperf).slice(0,80))+"</small>":""):"Não cobra"):"");
  add("Aplicação mínima",F.amin!=null?(F.amin?brl(F.amin):"Sem mínimo"):"");
  add("Resgate",F.dcot!=null||F.dpag!=null?(F.dcot!=null?"cotização D+"+fx(F.dcot,0):"")+(F.dpag!=null?" · pagamento D+"+fx(F.dpag,0):""):"");
  add("Taxa de saída",F.tsai?fx(F.tsai,2)+"%":"");add("Carência",F.car?fx(F.car,0)+" dias":"");
  add("Tributação",/^s/i.test(F.lp||"")?"Longo prazo (come-cotas 15%)":/^n/i.test(F.lp||"")?"Não é longo prazo":"");
  add("Risco (lâmina)",F.risco?fx(F.risco,0)+" de 5":"");
  if(it.length)h+='<dl class="fninfo">'+it.join("")+'</dl>';
  if(F.obj||F.pol)h+='<details class="nota" style="margin-top:8px"><summary>Objetivo e política de investimento (lâmina)</summary>'+(F.obj?'<p><b>Objetivo:</b> '+esc(F.obj)+'</p>':'')+(F.pol?'<p><b>Política:</b> '+esc(F.pol)+'</p>':'')+'</details>';
  return h+'</section>';
}
function fnBmSel(){return '<div class="cvsel fnbm" role="group" aria-label="Índices">'+Object.keys(FN_BM).filter(b=>FN.L&&(FN.L.d[b]||FN.L.m[b])).map(b=>'<label><input type="checkbox" data-fnbm="'+b+'"'+(FN.bm[b]?' checked':'')+'><i style="background:'+FN_BM[b].col+'"></i>'+FN_BM[b].lab+'</label>').join("")+'</div>'}
function fnPerfHtml(F){
  const per=FN.per,p0=fnStart(F,per);
  let h='<section class="panel"><h3>Rentabilidade acumulada</h3>'+fnSeg("fnper",FN_PER.filter(x=>x[0]!=="mes"),per)+fnBmSel();
  if(!p0)return h+'<p class="sub">O fundo não tem histórico para esse período.</p></section>';
  const P=fnThin(fnSeries(F,p0),700),S=[{lab:F.fan||F.n||"Fundo",col:FN_COLS[0],w:2.4,pts:P.map(p=>[p.t,(p.q/p0.q-1)*100])}];
  Object.keys(FN_BM).forEach(b=>{if(!FN.bm[b])return;const b0=fnLev(b,p0);if(!b0)return;S.push({lab:FN_BM[b].lab,col:FN_BM[b].col,dash:FN_BM[b].dash,pts:P.map(p=>{const v=fnLev(b,p);return [p.t,v?(v/b0-1)*100:null]})})});
  h+=fnChart(S,{fmt:"pct",zero:true,aria:"Rentabilidade acumulada"});
  const l=fnLast(F);h+='<p class="sub" style="font-size:.8rem">De '+fdate(p0.t)+' a '+fdate(l.t)+'. '+(p0.i==null||P.some(p=>p.i==null)?'Antes de 2019 a série usa as cotas de fim de mês. ':'')+(FN.bm.ipca&&FN.L.ipcaLast<l.k?'O IPCA vai até o último índice divulgado ('+mname(FN.L.ipcaLast)+'). ':'')+'</p>';
  return h+'</section>';
}
function fnWinHtml(F){
  const W=[["mes","No mês"],["ano","No ano"],["3","3 meses"],["6","6 meses"],["12","12 meses"],["24","24 meses"],["36","36 meses"],["48","48 meses"],["60","60 meses"],["tudo","Desde o início"]];
  let h='<section class="panel"><h3>Rentabilidade por período</h3><div class="tablewrap" style="max-height:none"><table class="ctab fnwin"><thead><tr><th style="text-align:left">Período</th><th>'+(F.lab||"Fundo")+'</th><th>CDI</th><th>% do CDI</th><th>Ibovespa</th><th>IPCA</th><th class="c-ph">Dólar</th></tr></thead><tbody>';
  W.forEach(([p,lab])=>{const r=fnRet(F,p);if(!r)return;const c=fnBmRet("cdi",r.p0,r.p1),ib=fnBmRet("ibov",r.p0,r.p1),ip=fnBmRet("ipca",r.p0,r.p1),us=fnBmRet("usd",r.p0,r.p1);
    h+='<tr><td style="text-align:left">'+lab+(p==="tudo"?' <small>desde '+fdate(r.p0.t)+'</small>':'')+'</td><td><b>'+fnPct(r.r)+'</b></td><td>'+fnPctT(c)+'</td><td>'+(c&&c>0?fx(r.r/c*100,0)+'%':'—')+'</td><td>'+fnPct(ib)+'</td><td>'+fnPctT(ip)+'</td><td class="c-ph">'+fnPct(us)+'</td></tr>'});
  return h+'</tbody></table></div></section>';
}
function fnMonHtml(F){
  const mo=fnMonthly(F);if(!mo.size)return "";
  const cmp=FN.tabCmp,ys=[...new Set([...mo.keys()].map(k=>Math.floor(k/12)))].sort((a,b)=>b-a);
  const opts=[["pcdi","% do CDI"],["cdi","CDI"],["ibov","Ibovespa"],["ipca","IPCA"]];
  let h='<section class="panel"><h3>Rentabilidade mês a mês</h3><div class="fnrow">'+fnSeg("fntab",opts,cmp)+'</div><div class="tablewrap" style="max-height:560px"><table class="ctab fnmon"><thead><tr><th style="text-align:left">Ano</th>'+["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map(x=>'<th>'+x+'</th>').join("")+'<th>Ano</th><th>Acum.</th></tr></thead><tbody>';
  // acumulado desde o primeiro mês com retorno
  const ks=[...mo.keys()].sort((a,b)=>a-b);const acc={};let a=1,ac=1;ks.forEach(k=>{a*=1+mo.get(k)/100;acc[k]=a});
  const bmY=(b,y,last)=>{let v=1,ok=false;for(let m=0;m<12;m++){const k=y*12+m;if(!mo.has(k)||k>last)continue;const x=fnBmMonth(b,k);if(x==null)continue;v*=1+x/100;ok=true}return ok?(v-1)*100:null};
  ys.forEach(y=>{let fy=1,ok=false,lastK=null;let r1='<tr class="fnmf"><td style="text-align:left"><b>'+y+'</b></td>',r2='<tr class="fnmb"><td style="text-align:left"><small>'+opts.find(o=>o[0]===cmp)[1]+'</small></td>';
    for(let m=0;m<12;m++){const k=y*12+m,v=mo.get(k);if(v==null){r1+='<td></td>';r2+='<td></td>';continue}fy*=1+v/100;ok=true;lastK=k;
      const bm=cmp==="pcdi"?fnBmMonth("cdi",k):fnBmMonth(cmp,k);r1+='<td>'+fnPct(v)+'</td>';r2+='<td><small>'+(bm==null?'—':cmp==="pcdi"?(bm>0&&v>0?fx(v/bm*100,0)+'%':'—'):fnPctT(bm))+'</small></td>'}
    const fyr=(fy-1)*100,by=cmp==="pcdi"?bmY("cdi",y,lastK):bmY(cmp,y,lastK);
    r1+='<td><b>'+(ok?fnPct(fyr):'')+'</b></td><td>'+(lastK!=null?fnPct((acc[lastK]-1)*100):'')+'</td></tr>';
    r2+='<td><small>'+(by==null?'—':cmp==="pcdi"?(by>0&&fyr>0?fx(fyr/by*100,0)+'%':'—'):fnPctT(by))+'</small></td><td></td></tr>';h+=r1+r2});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem">'+(F.monNote||'Calculada com as cotas oficiais de fim de mês informadas à CVM.')+' O mês corrente vai até '+fdate(fnLast(F).t)+'.</p></section>';
  return h;
}
function fnRiskHtml(F){
  const per=FN.rper,p0=fnStart(F,per);
  let h='<section class="panel"><h3>Risco e retorno</h3>'+fnSeg("fnrper",[["12","12 meses"],["24","24 meses"],["36","36 meses"],["60","60 meses"],["tudo",F.rlab||"Desde 2019"]],per);
  const rk=p0?fnRisk(F,p0):null;if(!rk)return h+'<p class="sub">Histórico diário insuficiente para esse período.</p></section>';
  const it=(a,b,c)=>'<div><dt>'+a+(c?' <small>'+c+'</small>':'')+'</dt><dd>'+b+'</dd></div>';
  const mo=fnMonthly(F),ks=[...mo.keys()].filter(k=>fnMt(k)>p0.t+5*DAY);let pos=0,ab=0,nab=0,best=null,worst=null;
  ks.forEach(k=>{const v=mo.get(k);if(v>0)pos++;const c=fnBmMonth("cdi",k);if(c!=null){nab++;if(v>c)ab++}if(best==null||v>best[1])best=[k,v];if(worst==null||v<worst[1])worst=[k,v]});
  h+='<dl class="fninfo fnrisk">'+it("Retorno anualizado",fnPct(rk.ann),rk.cdiAnn!=null?"CDI "+fnPctT(rk.cdiAnn):"")+it("Volatilidade anualizada",fx(rk.vol,2)+"%")
    +it("Índice de Sharpe",rk.sharpe!=null?fx(rk.sharpe,2):"—","excesso sobre o CDI ÷ volatilidade")+it("Índice de Sortino",rk.sortino!=null?fx(rk.sortino,2):"—","só as quedas contam como risco")
    +it("Perda máxima",fnPct(rk.dd),rk.ddT?"de "+fdate(rk.ddPk)+" a "+fdate(rk.ddT):"")+it("Recuperação",rk.ddT?(rk.rec?Math.round((rk.rec-rk.ddT)/DAY)+" dias corridos <small>(em "+fdate(rk.rec)+")</small>":"ainda não recuperou"):"—")
    +it("Distância do pico",fnPct(rk.cur))+it("VaR diário 95%",fnPct(rk.var95),"perda superada em 5% dos dias")
    +it("Melhor e pior dia",fnPct(rk.best)+" / "+fnPct(rk.worst))+(rk.beta!=null?it("Beta e correlação com o Ibovespa",fx(rk.beta,2)+" / "+fx(rk.cor,2)):"")+(rk.alpha!=null?it("Alfa de Jensen",fnPct(rk.alpha)+" a.a.","retorno acima do previsto pelo beta"):"")+(rk.treynor!=null?it("Índice de Treynor",fnPctT(rk.treynor),"excesso sobre o CDI ÷ beta"):"")
    +it("Tracking error",fx(rk.te,2)+"%","desvio em relação ao CDI")+(rk.ir!=null?it("Information ratio",fx(rk.ir,2),"excesso ÷ tracking error"):"")
    +(ks.length?it("Meses positivos",pos+" de "+ks.length+" ("+fx(pos/ks.length*100,0)+"%)")+it("Meses acima do CDI",nab?ab+" de "+nab+" ("+fx(ab/nab*100,0)+"%)":"—")+it("Melhor e pior mês",fnPct(best[1])+" <small>"+mname(best[0])+"</small> / "+fnPct(worst[1])+" <small>"+mname(worst[0])+"</small>"):"")+'</dl>';
  // gráficos: perda a partir do pico e volatilidade móvel de 12 meses
  const P=rk.P;let pk=0;const dd=P.map(p=>{pk=Math.max(pk,p.q);return [p.t,(p.q/pk-1)*100]});
  h+='<div class="label" style="margin-top:12px">Perda a partir do pico (drawdown)</div>'+fnChart([{lab:"Drawdown",col:"var(--loss)",pts:fnThin(dd.map(x=>({t:x[0],v:x[1]})),700).map(x=>[x.t,x.v])}],{fmt:"pct",zero:true,fill:true,h:180,aria:"Drawdown"});
  const all=fnSeries(F,fnFirst(F)).filter(p=>p.i!=null),vs=[];const w=252;
  if(all.length>w+20){const R=[];for(let j=1;j<all.length;j++)R.push(all[j].q/all[j-1].q-1);let s=0,s2=0;for(let j=0;j<R.length;j++){s+=R[j];s2+=R[j]*R[j];if(j>=w){s-=R[j-w];s2-=R[j-w]*R[j-w]}if(j>=w-1&&all[j+1].t>=p0.t){const m=s/w,v=Math.sqrt(Math.max(0,(s2-w*m*m)/(w-1)))*Math.sqrt(252)*100;vs.push({t:all[j+1].t,v})}}}
  if(vs.length>5)h+='<div class="label" style="margin-top:12px">Volatilidade móvel de 12 meses</div>'+fnChart([{lab:"Volatilidade 12m",col:FN_COLS[0],pts:fnThin(vs,600).map(x=>[x.t,x.v])}],{fmt:"pct",h:170,aria:"Volatilidade móvel"});
  h+='<p class="sub" style="font-size:.8rem">Calculado com '+(F.riskNote||'as cotas diárias')+' desde '+fdate(P[0].t)+' ('+rk.n+' dias úteis). Sharpe e Sortino usam o CDI do mesmo período.</p>';
  return h+'</section>';
}
function fnPeerHtml(F){
  const C=FN.C,R=FN.idx.rows,me=fnRow(F.c);if(!me)return "";
  const anb=me[C.anbima],useA=anb!=null&&FN.idx.anbima[anb],grp=R.filter(r=>(useA?r[C.anbima]===anb:r[C.classe]===me[C.classe])&&r[C.tipo]===me[C.tipo]&&!(r[C.flags]&1));
  if(grp.length<5)return "";
  const cat=useA?FN.idx.anbima[anb]:FN.idx.classes[me[C.classe]];
  const pos=(col,hiBetter)=>{const v=me[C[col]];if(v==null)return null;const vals=grp.map(r=>r[C[col]]).filter(x=>x!=null);const n=vals.length,better=vals.filter(x=>hiBetter?x>v:x<v).length;const q=Math.min(4,Math.floor(better/n*4)+1);const med=vals.slice().sort((a,b)=>a-b)[Math.floor(n/2)];return {rk:better+1,n,q,med,v}};
  const rows=[["Rentabilidade 12 meses","r12",true,1],["Rentabilidade 36 meses","r36",true,1],["Volatilidade 12 meses","v12",false,0],["Sharpe 12 meses","sharpe",true,2],["Perda máxima 36 meses","dd36",true,1]];
  let h='<section class="panel"><h3>Comparação com a categoria</h3><p class="sub">'+esc(cat)+' · '+grp.length+' fundos (sem exclusivos). 1º quartil = entre os 25% melhores.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Indicador</th><th>Fundo</th><th>Mediana da categoria</th><th>Posição</th><th>Quartil</th></tr></thead><tbody>';
  rows.forEach(([lab,col,hb,kind])=>{const p=pos(col,hb);if(!p)return;const f=v=>kind===2?fx(v,2):kind===0?fx(v,2)+"%":fnPctT(v);
    h+='<tr><td style="text-align:left">'+lab+'</td><td><b>'+f(p.v)+'</b></td><td>'+f(p.med)+'</td><td>'+p.rk+'º de '+p.n+'</td><td><span class="fnq '+["","fnq1","fnq2","fnq3","fnq4"][p.q]+'">'+p.q+'º</span></td></tr>'});
  h+='</tbody></table></div><button type="button" class="link" data-fnrkcat="'+(useA?'a'+anb:'c'+me[C.classe])+'|'+me[C.tipo]+'">Ver o ranking da categoria ›</button></section>';
  return h;
}
function fnPlHtml(F){
  const ks=F.MK.slice(-120);if(ks.length<2)return "";
  let h='<section class="panel"><h3>Patrimônio, cotistas e captação</h3><div class="label">Patrimônio líquido</div>'+fnChart([{lab:"Patrimônio líquido",col:FN_COLS[0],pts:ks.map(k=>[fnMt(k),F.M.get(k).pl])}],{fmt:"money",h:180,months:true,aria:"Patrimônio"});
  const kc=ks.filter(k=>F.M.get(k).cot!=null);if(kc.length>1)h+='<div class="label" style="margin-top:10px">Número de cotistas</div>'+fnChart([{lab:"Cotistas",col:FN_COLS[2],pts:kc.map(k=>[fnMt(k),F.M.get(k).cot])}],{fmt:"int",h:160,months:true,aria:"Cotistas"});
  const kf=F.MK.filter(k=>F.M.get(k).ca!=null).slice(-36);
  if(kf.length>1){h+='<div class="label" style="margin-top:10px">Captação líquida mensal (aplicações − resgates)</div>'+fnChart([{lab:"Captação líquida",col:"var(--gain)",pts:kf.map(k=>[Date.UTC(Math.floor(k/12),k%12,15),(F.M.get(k).ca||0)-(F.M.get(k).re||0)])}],{fmt:"money",bars:true,zero:true,h:170,months:true,aria:"Captação líquida"});
    const s12=kf.slice(-12).reduce((a,k)=>a+(F.M.get(k).ca||0)-(F.M.get(k).re||0),0);h+='<p class="sub" style="font-size:.82rem">Captação líquida em 12 meses: <b>'+fnMoney(s12)+'</b>.</p>'}
  return h+'</section>';
}
function fnCartHtml(F){
  const c=F.cart;if(!c)return '<section class="panel"><h3>Carteira</h3><p class="sub">A CVM ainda não divulgou a composição da carteira deste fundo nos últimos meses (as posições podem ficar em sigilo por até 90 dias).</p></section>';
  const [y,m]=c.dt.split("-");let h='<section class="panel"><h3>Carteira</h3><p class="sub">Composição informada à CVM em '+m+'/'+y+' (% do patrimônio líquido).</p><div class="fncomp">';
  const mx=Math.max(...c.comp.map(x=>Math.abs(x[1])),1);
  c.comp.slice(0,12).forEach(([t,p])=>{h+='<div class="fncr"><span>'+esc(t)+'</span><div class="fncb"><i style="width:'+Math.min(100,Math.abs(p)/mx*100).toFixed(1)+'%;background:'+(p<0?"var(--loss)":"var(--accent)")+'"></i></div><b>'+fnPctT(p,1)+'</b></div>'});
  h+='</div>';
  if(c.top&&c.top.length){h+='<div class="label" style="margin-top:12px">Maiores posições</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Ativo</th><th class="c-ph" style="text-align:left">Tipo</th><th>% do PL</th></tr></thead><tbody>';
    c.top.filter(x=>Math.abs(x[1])>=0.05).forEach(([n,p,cn,tp])=>{h+='<tr><td style="text-align:left" class="tw">'+(cn?'<button type="button" class="link" data-fnopen="'+cn+'">'+esc(n)+'</button>':esc(n))+'</td><td class="c-ph tw" style="text-align:left"><small>'+esc(tp||"")+'</small></td><td>'+fnPctT(p,1)+'</td></tr>'});
    h+='</tbody></table></div>';if(c.top.some(x=>x[2]))h+='<p class="sub" style="font-size:.8rem">Os fundos investidos são clicáveis.</p>'}
  return h+fnCartHistHtml(F)+'</section>';
}
function fnDocsHtml(F){ // regulamento, lâmina, demonstrações e fatos relevantes ficam nos sistemas da CVM (sem link direto por fundo)
  const c=/^\d{14}$/.test(F.c)?F.c:/^\d{14}$/.test(F.pai||"")?F.pai:"";if(!c)return "";
  return '<section class="panel"><h3>Documentos oficiais</h3><p class="sub">Regulamento, lâmina, demonstrações financeiras, fatos relevantes e assembleias do fundo estão nos sistemas da CVM. Copie o CNPJ e cole na busca.</p><div class="spbtns" style="margin-top:8px"><button type="button" class="btn sec" data-copiar="'+fnCnpjF(c)+'">Copiar CNPJ '+fnCnpjF(c)+'</button><a class="btn sec" href="https://web.cvm.gov.br/app/fundosweb/#/consultaPublica" target="_blank" rel="noopener">Abrir a consulta de fundos da CVM</a><a class="btn sec" href="https://cvmweb.cvm.gov.br/swb/default.asp?sg_sistema=fundosreg" target="_blank" rel="noopener">Fundos registrados (CVM)</a></div></section>'}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-copiar]");if(!x)return;const v=x.dataset.copiar,ok=()=>{const t=x.textContent;x.textContent="CNPJ copiado";setTimeout(()=>{x.textContent=t},1800)};try{navigator.clipboard.writeText(v).then(ok,()=>{})}catch(err){}});
function fnSrcHtml(F){return '<p class="sub" style="font-size:.78rem;margin:4px 4px 16px">Fontes: CVM (informe diário, cadastro, extrato, lâmina e composição da carteira), Banco Central (CDI, IPCA e dólar PTAX) e B3 (Ibovespa e IFIX). Rentabilidade passada não garante rentabilidade futura. Base atualizada até '+(FN.idx.dt?fdate(Date.parse(FN.idx.dt+"T00:00:00Z")):"—")+'.</p>'}

/* ranking */
function fnRk(){
  const f=$("fnRkF"),t=$("fnRkT");if(!f||!t)return;const I=FN.idx,C=FN.C,rk=FN.rk;
  const tipos=I.tipos.map((x,j)=>[j,x]).filter(x=>x[1]),cls=I.classes.map((x,j)=>[j,x]).filter(x=>x[1]);
  const anbs=new Map();I.rows.forEach(r=>{if((rk.tipo===""||r[C.tipo]===+rk.tipo)&&(rk.cls===""||r[C.classe]===+rk.cls)&&I.anbima[r[C.anbima]])anbs.set(r[C.anbima],(anbs.get(r[C.anbima])||0)+1)});
  const sel=(id,lab,opts,v)=>'<div class="field"><label for="'+id+'">'+lab+'</label><select id="'+id+'" data-fnrk="'+id+'">'+opts.map(([a,b])=>'<option value="'+a+'"'+(String(a)===String(v)?' selected':'')+'>'+esc(b)+'</option>').join("")+'</select></div>';
  if(!f.dataset.on){f.dataset.on=1}
  f.innerHTML='<div class="fnfilt">'+sel("rkTipo","Tipo",[["","Todos"]].concat(tipos),rk.tipo)+sel("rkCls","Classe CVM",[["","Todas"]].concat(cls),rk.cls)
    +sel("rkAnb","Categoria ANBIMA",[["","Todas"]].concat([...anbs.entries()].sort((a,b)=>I.anbima[a[0]].localeCompare(I.anbima[b[0]])).map(([j,n])=>[j,I.anbima[j]+" ("+n+")"])),rk.anb)
    +sel("rkPl","Patrimônio mínimo",[[0,"Qualquer"],[1e6,"R$ 1 mi"],[10e6,"R$ 10 mi"],[50e6,"R$ 50 mi"],[100e6,"R$ 100 mi"],[500e6,"R$ 500 mi"],[1e9,"R$ 1 bi"]],rk.pl)
    +sel("rkCot","Cotistas mínimos",[[0,"Qualquer"],[10,"10"],[100,"100"],[1000,"1.000"],[10000,"10.000"]],rk.cot)
    +sel("rkTmax","Taxa de administração até",[["","Qualquer"],[0.3,"0,30%"],[0.5,"0,50%"],[1,"1,00%"],[1.5,"1,50%"],[2,"2,00%"]],rk.tmax)
    +sel("rkAmax","Aplicação mínima até",[["","Qualquer"],[100,"R$ 100"],[1000,"R$ 1 mil"],[10000,"R$ 10 mil"],[100000,"R$ 100 mil"],[1000000,"R$ 1 milhão"]],rk.amax)
    +sel("rkRmax","Resgate em até",[["","Qualquer"],[0,"D+0"],[1,"D+1"],[5,"D+5"],[30,"D+30"],[90,"D+90"]],rk.rmax)
    +sel("rkIdade","Histórico mínimo",[["","Qualquer"],[1,"1 ano"],[3,"3 anos"],[5,"5 anos"],[10,"10 anos"]],rk.idade)
    +'<div class="field"><label for="rkTxt">Nome, CNPJ ou gestora</label><input id="rkTxt" data-fnrk="rkTxt" value="'+esc(rk.txt)+'" autocomplete="off"></div></div>'
    +((rk.ges!==""&&I.gestores[rk.ges])||(rk.adm!==""&&I.adms&&I.adms[rk.adm])?'<div class="fnchips">'+(rk.ges!==""&&I.gestores[rk.ges]?'<span class="fnchip">Gestora: '+esc(I.gestores[rk.ges])+' <button type="button" class="fnx" data-fnrkx="ges" aria-label="Remover">×</button></span>':'')+(rk.adm!==""&&I.adms&&I.adms[rk.adm]?'<span class="fnchip">Administradora: '+esc(I.adms[rk.adm])+' <button type="button" class="fnx" data-fnrkx="adm" aria-label="Remover">×</button></span>':'')+'</div>':'')
    +'<div class="cvsel" style="margin-top:4px"><label><input type="checkbox" data-fnrkc="qual"'+(rk.qual?' checked':'')+'>Incluir fundos para investidor qualificado</label><label><input type="checkbox" data-fnrkc="prof"'+(rk.prof?' checked':'')+'>Incluir investidor profissional</label><label><input type="checkbox" data-fnrkc="exc"'+(rk.exc?' checked':'')+'>Incluir exclusivos</label></div>';
  fnRkTable();
}
