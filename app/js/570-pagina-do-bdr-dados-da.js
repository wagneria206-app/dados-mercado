/* ---------- página do BDR: dados da empresa nos EUA */
function euEmpHtml(A){
  if(A.tipo!=="BDR")return "";
  return '<div id="euEmp" data-t="'+esc(A.t)+'">'+euEmpInner(A)+'</div>';
}
function euEmpFill(){const el=$("euEmp");if(!el)return;const t=el.dataset.t,A=AT.files.get(t);if(!A)return;try{el.innerHTML=fnUse(AT,()=>euEmpInner(A))}catch(e){el.innerHTML="";console.error(e)}}
function euEmpInner(A){
  if(!EU.S&&!EU.err){euBoot();return ""}
  if(!EU.idx)return "";const r=EU.idx.rows.find(x=>x[0]===A.t);if(!r)return "";const C=EU.C,cik=r[C.cik];
  if(!EU.emp.has(cik)){EU.emp.set(cik,null);euGet("s/"+cik+".json").then(j=>{EU.emp.set(cik,j);euEmpFill()}).catch(()=>{EU.emp.set(cik,{err:1})});return '<section class="panel"><p class="sub">Carregando os dados da empresa na SEC…</p></section>'}
  const e=EU.emp.get(cik);if(!e)return '<section class="panel"><p class="sub">Carregando os dados da empresa na SEC…</p></section>';if(e.err)return "";
  const cur=e.moeda||"USD",M=v=>euMoney(v,cur),ix={};(e.cols||[]).forEach((c,k)=>ix[c]=k+1);const g=(row,c)=>row&&ix[c]!=null?row[ix[c]]:null;
  const t=e.ttm||{},kp=(a,b,c)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(c?'<small>'+c+'</small>':'')+'</div>';
  let h='<section class="panel"><h3>A empresa nos EUA</h3><div class="fnsub">'+esc(e.nome||r[C.nome]||"")+' · '+esc(r[C.tk])+(r[C.ex]?' ('+esc(r[C.ex])+')':'')+(r[C.setor]?' · '+esc(r[C.setor]):'')+(r[C.ind]?' / '+esc(r[C.ind]):'')+'</div>';
  h+='<div class="fnkpis">'+kp("Cotação em Nova York",r[C.px]!=null?"US$ "+fx(r[C.px],2):"—",r[C.d1]!=null?fnPctT(r[C.d1])+" no dia":"")+kp("Valor de mercado",euMoney(r[C.mcap]),"")+kp("P/L · P/VP",(r[C.pl]!=null?fx(r[C.pl],1):"—")+" · "+(r[C.pvp]!=null?fx(r[C.pvp],2):"—"),r[C.roe]!=null?"ROE "+fnPctT(r[C.roe],1):"")
    +kp("Receita 12 meses",M(t.rec),r[C.crec]!=null?fnPctT(r[C.crec],1)+" sobre os 12 meses anteriores":"")+kp("Lucro líquido 12 meses",M(t.ll),r[C.ml]!=null?"margem "+fnPctT(r[C.ml],1):"")+'</div>';
  // retorno em dólar
  const per=FN.per,p0=fnStart(A,per),U=AT.B&&AT.B.d&&AT.B.d.usd;
  if(p0&&U&&EU.S.spx){const out=[],usd=[],brl=[];for(let x=0;x<A.I.length;x++){const tt=AT.T[A.I[x]];if(tt<p0.t)continue;const u=U[A.I[x]];if(!u)continue;usd.push([tt,A.Q[x]/u]);brl.push([tt,A.Q[x]])}
    if(usd.length>5){const nz=P=>P.map(p=>[p[0],(p[1]/P[0][1]-1)*100]),sb=euAt(EU.S.spx,usd[0][0]),sp=sb?EU.S.spx.filter(p=>p[0]>sb[0]).map(p=>[p[0],(p[1]/sb[1]-1)*100]):[];if(sb)sp.unshift([usd[0][0],0]);
      const th=P=>fnThin(P.map(p=>({t:p[0],v:p[1]})),500).map(p=>[p.t,p.v]);
      out.push({lab:A.t+" em US$",col:"#2563eb",w:2.2,pts:th(nz(usd))},{lab:A.t+" em R$",col:"#f59e0b",w:1.8,pts:th(nz(brl))},{lab:"S&P 500",col:"#64748b",w:1.6,pts:th(sp)});
      h+='<div class="label" style="margin-top:12px">Retorno em dólar × em reais × S&P 500 ('+esc((FN_PER.find(x=>x[0]===per)||[,""])[1]).toLowerCase()+')</div>'+fnChart(out,{fmt:"pct",zero:true,h:220,aria:"Retorno em dólar"})+'<p class="sub" style="font-size:.8rem">BDR com proventos, convertido pelo dólar PTAX do dia; a distância entre as linhas em dólar e em reais é o efeito do câmbio. S&P 500 sem dividendos. Mude o período no gráfico de retorno acima.</p>'}}
  // resultados anuais
  const an=(e.a||[]).filter(x=>g(x,"rec")!=null||g(x,"ll")!=null);
  if(an.length){const ys=an.slice(-10);
    if(ys.length>1)h+='<div class="label" style="margin-top:12px">Receita e lucro líquido por ano fiscal ('+(cur==="USD"?"US$":cur)+' bilhões)</div>'+fnChart([{lab:"Receita",col:"#2563eb",w:2.2,pts:ys.map(x=>[Date.parse(x[0]+"T00:00:00Z"),(g(x,"rec")||0)/1e9])},{lab:"Lucro líquido",col:"var(--gain)",w:2.2,pts:ys.map(x=>[Date.parse(x[0]+"T00:00:00Z"),g(x,"ll")!=null?g(x,"ll")/1e9:null])}],{fmt:"num",zero:true,h:200,aria:"Resultados anuais"});
    const rv=ys.slice().reverse(),cl=j=>j>=6?' class="c-md"':j>=4?' class="c-sm"':j>=2?' class="c-ph"':'';
    h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Ano fiscal até</th>'+rv.map((x,j)=>'<th'+cl(j)+'>'+fdate(Date.parse(x[0]+"T00:00:00Z")).slice(3)+'</th>').join("")+'</tr></thead><tbody>';
    const row=(lab,f)=>{const v=rv.map(f);if(v.every(z=>z==="—"))return "";return '<tr><td style="text-align:left">'+lab+'</td>'+v.map((z,j)=>'<td'+cl(j)+'>'+z+'</td>').join("")+'</tr>'};
    const fcl=x=>g(x,"fco")!=null&&g(x,"capex")!=null?g(x,"fco")-g(x,"capex"):null;
    h+=row("Receita",x=>M(g(x,"rec")))+row("Lucro operacional",x=>M(g(x,"lop")))+row("Lucro líquido",x=>M(g(x,"ll")))+row("Margem líquida",x=>g(x,"rec")&&g(x,"ll")!=null?fnPctT(g(x,"ll")/g(x,"rec")*100,1):"—")
      +row("Lucro por ação (diluído)",x=>g(x,"lpa")!=null?fx(g(x,"lpa"),2):"—")+row("ROE",x=>g(x,"pl")>0&&g(x,"ll")!=null?fnPctT(g(x,"ll")/g(x,"pl")*100,1):"—")
      +row("Geração de caixa operacional",x=>M(g(x,"fco")))+row("Investimentos (capex)",x=>M(g(x,"capex")))+row("Fluxo de caixa livre",x=>M(fcl(x)))
      +row("Dividendos pagos",x=>M(g(x,"divpg")))+row("Recompra de ações",x=>M(g(x,"recompra")))+row("Dividendo por ação",x=>g(x,"dps")!=null?fx(g(x,"dps"),2):"—")
      +row("Caixa",x=>M(g(x,"caixa")))+row("Dívida de longo prazo",x=>M(g(x,"divida")))+row("Patrimônio líquido",x=>M(g(x,"pl")));
    h+='</tbody></table></div>'}
  const qs=(e.q||[]).filter(x=>g(x,"rec")!=null||g(x,"ll")!=null).slice(-8);
  if(qs.length>2){const rv=qs.slice().reverse(),cl=j=>j>=6?' class="c-md"':j>=4?' class="c-sm"':j>=2?' class="c-ph"':'';
    h+='<div class="label" style="margin-top:12px">Últimos trimestres</div><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Trimestre até</th>'+rv.map((x,j)=>'<th'+cl(j)+'>'+fdate(Date.parse(x[0]+"T00:00:00Z")).slice(3)+'</th>').join("")+'</tr></thead><tbody>';
    const row=(lab,f)=>'<tr><td style="text-align:left">'+lab+'</td>'+rv.map((x,j)=>'<td'+cl(j)+'>'+f(x)+'</td>').join("")+'</tr>';
    h+=row("Receita",x=>M(g(x,"rec")))+row("Lucro líquido",x=>M(g(x,"ll")))+row("Margem líquida",x=>g(x,"rec")&&g(x,"ll")!=null?fnPctT(g(x,"ll")/g(x,"rec")*100,1):"—")+row("Lucro por ação",x=>g(x,"lpa")!=null?fx(g(x,"lpa"),2):"—");
    h+='</tbody></table></div>'}
  const it=[];const add=(a,b)=>{if(b)it.push('<div><dt>'+a+'</dt><dd>'+b+'</dd></div>')};
  add("Atividade (SEC)",esc(e.sicd||""));add("Fim do ano fiscal",e.fye&&/^\d{4}$/.test(e.fye)?e.fye.slice(2)+"/"+e.fye.slice(0,2):"");add("Sede legal",esc(e.uf||""));add("Moeda dos balanços",cur==="USD"?"dólar":esc(cur));add("Último balanço",t.fim?fdate(Date.parse(t.fim+"T00:00:00Z")):"");add("CIK na SEC",String(cik));
  if(it.length)h+='<dl class="fninfo" style="margin-top:12px">'+it.join("")+'</dl>';
  h+=euDocsHtml(e);
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">Demonstrações consolidadas entregues à SEC em formato XBRL (10-K e 10-Q; empresas estrangeiras, 20-F, só anual). Valores em '+(cur==="USD"?"dólares":esc(cur))+'. Os trimestres que a empresa só informa acumulados no ano foram obtidos pela diferença entre os acumulados. Cotação e valor de mercado: Nasdaq, no fechamento mais recente. Cada BDR equivale a uma fração ou a um múltiplo da ação americana, por isso o preço em reais não é o preço em dólar convertido.</p></section>';
  return h;
}
const EU_FORM={"10-K":"Relatório anual","10-K/A":"Relatório anual (retificação)","10-Q":"Relatório trimestral","10-Q/A":"Relatório trimestral (retificação)","8-K":"Comunicado relevante","20-F":"Relatório anual (empresa estrangeira)","20-F/A":"Relatório anual (retificação)","40-F":"Relatório anual (empresa canadense)","6-K":"Comunicado (empresa estrangeira)","DEF 14A":"Convocação da assembleia","S-1":"Registro de oferta"};
const EU_ITEM={"1.01":"contrato relevante","1.02":"fim de contrato relevante","2.01":"compra ou venda de ativos","2.02":"resultado do trimestre","2.03":"nova dívida","2.05":"reestruturação","2.06":"baixa contábil","3.01":"listagem","3.02":"emissão de ações","4.01":"troca de auditor","5.02":"mudança na diretoria ou conselho","5.03":"alteração do estatuto","5.07":"votação em assembleia","7.01":"comunicado ao mercado","8.01":"outros eventos","9.01":"anexos"};
function euDocsHtml(e){const D=(e.docs||[]).slice(0,15);if(!D.length)return "";
  let h='<div class="label" style="margin-top:12px">Documentos entregues à SEC</div><div class="tablewrap" style="max-height:340px"><table class="ctab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Documento</th><th style="text-align:left" class="c-ph">Assunto</th></tr></thead><tbody>';
  D.forEach(([form,data,ref,items,desc,url])=>{const its=String(items||"").split(",").map(s=>EU_ITEM[s.trim()]).filter(Boolean).join("; ");
    h+='<tr><td style="text-align:left;white-space:nowrap">'+fdate(Date.parse(data+"T00:00:00Z"))+'</td><td style="text-align:left"><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(EU_FORM[form]||form)+'</a> <small>'+esc(form)+'</small></td><td style="text-align:left" class="c-ph">'+esc(its||(ref?"referente a "+fdate(Date.parse(ref+"T00:00:00Z")):""))+'</td></tr>'});
  return h+'</tbody></table></div><p class="sub" style="font-size:.78rem">Os documentos abrem no site da SEC, em inglês.</p>'}

