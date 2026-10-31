/* ---------- página do ativo */
function atAa(){
  const b=$("atBody");if(!b)return;
  if(!AT.cur){b.innerHTML=atHome();return}
  const t=AT.cur;
  if(!AT.files.has(t)){b.innerHTML='<section class="panel"><p class="sub">Carregando '+esc(t)+'…</p></section>';
    atFile(t).then(()=>{if(AT.cur===t&&activeMod==="aa")atAa()}).catch(e=>{if(AT.cur===t)b.innerHTML='<section class="panel"><p class="warn">Não encontrei '+esc(t)+' entre os ativos negociados na B3 nos últimos 30 pregões ('+esc(e.message)+').</p></section>'});return}
  const A=AT.files.get(t);
  try{b.innerHTML=fnUse(AT,()=>atHead(A)+atPriceHtml(A)+fnPerfHtml(A)+fnWinHtml(A)+atProvHtml(A)+euEmpHtml(A)+atDocsHtml(A)+(A.fund||A.ind?atFundHtml(A):"")+(A.fii?atFiiHtml(A):"")+fnMonHtml(A)+fnRiskHtml(A)+fnJanHtml(A)+atPeerHtml(A)+atLiqHtml(A)+atSrcHtml(A));docsFill()}
  catch(e){b.innerHTML='<section class="panel"><p class="err">Não deu para montar a análise: '+esc(e.message)+'</p></section>';console.error(e)}
}
function atHome(){
  const R=AT.idx.rows,C=AT.C;let h=favHtml();let hist=[];try{hist=JSON.parse(localStorage.getItem("atHist")||"[]")}catch(e){}
  const list=(tt,arr,f)=>'<section class="panel"><div class="label">'+tt+'</div><div class="fnlist">'+arr.map(r=>'<button type="button" class="fnri" data-atopen="'+r[0]+'"><b>'+r[0]+' · '+esc(r[1])+'</b><small>'+f(r)+'</small></button>').join("")+'</div></section>';
  const rows=hist.map(atRow).filter(Boolean);if(rows.length)h+=list("Vistos recentemente",rows,r=>'R$ '+fx(r[C.preco],2)+' · dia '+fnPctT(r[C.d1]));
  const liq=t=>R.filter(r=>r[C.tipo]===t&&r[C.liq]).sort((a,b)=>b[C.liq]-a[C.liq]).slice(0,8);
  h+=list("Ações mais negociadas",liq("Ação"),r=>'R$ '+fx(r[C.preco],2)+' · dia '+fnPctT(r[C.d1])+' · DY '+fnPctT(r[C.dy]));
  h+=list("FIIs mais negociados",liq("FII"),r=>'R$ '+fx(r[C.preco],2)+' · DY '+fnPctT(r[C.dy])+(r[C.pvp]?' · P/VP '+fx(r[C.pvp],2):''));
  h+=list("ETFs mais negociados",liq("ETF"),r=>'R$ '+fx(r[C.preco],2)+' · 12m '+fnPctT(r[C.r12]));
  return h;
}
function atHead(A){
  const r=atRow(A.t),C=AT.C,l=fnLast(A),m=A.met||{},ind=A.ind||{},fi=A.fii,inCmp=AT.cmp.includes(A.t),isF=AT_FUNDO.has(A.tipo);
  let h='<section class="panel fnhead"><div class="fnh1"><div><h3>'+esc(A.t)+' · '+esc(A.nome||"")+'</h3><div class="fnsub">'+esc([A.setor,A.sub].filter(Boolean).join(" / "))+'</div>';
  h+='<div class="fntags"><span class="fntag strong">'+esc(A.tipo)+'</span>'+(A.meta&&A.meta.esp?'<span class="fntag">'+esc(A.meta.esp)+'</span>':'')+(fi&&fi.mand?'<span class="fntag">'+esc(fi.mand)+'</span>':'')+(fi&&fi.gest?'<span class="fntag">Gestão '+esc(fi.gest.toLowerCase())+'</span>':'')+'</div></div>';
  h+='<div class="fnacts">'+favBtn("a:"+A.t,A.t+" · "+(A.nome||""))+'<button type="button" class="btn sec" data-atcmp="'+A.t+'">'+(inCmp?"✓ No comparador":"+ Comparar")+'</button><button type="button" class="btn sec" data-rel="aa">Relatório PDF</button></div></div>';
  const kp=(a,b,c)=>'<div class="fnkp"><span>'+a+'</span><b>'+b+'</b>'+(c?'<small>'+c+'</small>':'')+'</div>';
  const px=l?A.R[A.R.length-1]:null;
  let k=kp("Cotação","R$ "+(px!=null?fx(px,2):"—"),(l?fdate(l.t):"")+(m.d1!=null?' · '+fnPctT(m.d1)+' no dia':''))+kp("12 meses (com proventos)",fnPct(m.r12),m.ra!=null?"no ano "+fnPctT(m.ra):"");
  if(A.tipo==="Ação"||A.tipo==="Unit")k+=kp("Dividend yield 12m",fnPctT(m.dy),m.prov12?"R$ "+fx(m.prov12,2)+" por ação":"")+kp("P/L · P/VP",(ind.pl_r!=null?fx(ind.pl_r,1):"—")+" · "+(ind.pvp!=null?fx(ind.pvp,2):"—"),ind.roe!=null?"ROE "+fnPctT(ind.roe,1):"")+kp("Valor de mercado",fnMoney(ind.mcap),m.liq?"liquidez "+fnMoney(m.liq)+"/dia":"");
  else if(isF){const u=atFiiLast(A);k+=kp("Dividend yield 12m",fnPctT(m.dy),m.prov12?"R$ "+fx(m.prov12,2)+" por cota":"")+kp("P/VP",u&&u.vpc&&px?fx(px/u.vpc,2):"—",u&&u.vpc?"VP/cota R$ "+fx(u.vpc,2):"")+kp("Patrimônio líquido",fnMoney(u&&u.pl),u&&u.cot?fnInt(u.cot)+" cotistas":"")}
  else k+=kp("Volatilidade 12m",m.v12!=null?fx(m.v12,2)+"%":"—",m.beta!=null?"beta "+fx(m.beta,2):"")+kp("Liquidez média",m.liq?fnMoney(m.liq):"—","por dia, 3 meses")+kp("Perda máxima 36m",fnPct(m.dd),"");
  h+='<div class="fnkpis">'+k+'</div>';
  const it=[];const add=(a,b)=>{if(b!=null&&b!=="")it.push('<div><dt>'+a+'</dt><dd>'+b+'</dd></div>')};
  if(fi){add("Nome no informe da CVM",esc(fi.nome||""));add("Segmento",esc(fi.seg||""));add("Administrador",esc(fi.adm||""));add("Público-alvo",esc(fi.pub||""));add("Início",fi.ini?fdate(Date.parse(fi.ini+"T00:00:00Z")):"");add("CNPJ",fnCnpjF(fi.cnpj))}
  if(A.fund&&A.fund.cnpj)add("CNPJ",fnCnpjF(A.fund.cnpj));
  add("ISIN",esc(A.meta&&A.meta.isin||""));
  if(A.tipo==="Tesouro Direto"){add("Vencimento",A.venc?fdate(Date.parse(A.venc+"T00:00:00Z")):"");add("Preço usado",'preço de resgate (PU de venda) do Tesouro Transparente; cupons semestrais reinvestidos no retorno'+(/RENDA|EDUCA/.test(A.t)?'. Na fase de pagamentos mensais do RendA+ e do Educa+, cada parcela entra no retorno como provento, com valor estimado pela queda do preço no dia do pagamento':''))}
  if(it.length)h+='<dl class="fninfo">'+it.join("")+'</dl>';
  return h+'</section>';
}
function atFiiLast(A){const f=A.fii;if(!f||!f.m)return null;const px=A.R&&A.R.length?A.R[A.R.length-1]:null;for(let k=f.m.length-1;k>=0;k--){const v=f.m[k];if(v&&v[0]){const ok=!px||(px/v[0]>0.2&&px/v[0]<5);return {vpc:ok?v[0]:null,pl:v[1],cot:v[2]>1?v[2]:null,dy:v[3],k:+f.m0.slice(0,4)*12+(+f.m0.slice(4))-1+k}}}return null}
function atPriceHtml(A){
  const per=FN.per,p0=fnStart(A,per);let h='<section class="panel"><h3>Cotação</h3>'+fnSeg("fnper",FN_PER.filter(x=>x[0]!=="mes"),per);
  if(!p0)return h+'<p class="sub">Sem histórico para o período.</p></section>';
  const pts=[];for(let x=0;x<A.I.length;x++){const t=AT.T[A.I[x]];if(t>=p0.t)pts.push({t,v:A.R[x]})}
  const P=fnThin(pts,700);h+=fnChart([{lab:A.t,col:FN_COLS[0],w:2,pts:P.map(p=>[p.t,p.v])}],{fmt:"brl",aria:"Cotação"});
  const adj=(A.adj||[]).filter(e=>String(e[2]).startsWith("S")&&AT.T[e[0]]>=p0.t);
  h+='<p class="sub" style="font-size:.8rem">Preço de fechamento na B3, sem ajuste por proventos.'+(adj.length?' Desdobramentos e grupamentos no período: '+adj.map(e=>fdate(AT.T[e[0]])+' ('+(e[1]<1?'1 para '+fx(1/e[1],0):fx(e[1],0)+' para 1')+(e[2]==="S*"?', identificado pelo salto de preço':'')+')').join("; ")+'.':'')+' O gráfico abaixo mostra o retorno total, com proventos.</p>';
  return h+'</section>';
}
function atProvHtml(A){
  const ev=(A.adj||[]).filter(e=>!String(e[2]).startsWith("S")).map(e=>({ix:e[0],f:e[1],tp:e[2],v:e[3],dc:e[4]}));
  if(!ev.length)return A.tipo==="ETF"||A.tipo.startsWith("BDR")||A.tipo==="Tesouro Direto"?"":'<section class="panel"><h3>Proventos</h3><p class="sub">Nenhum provento registrado na B3 para este ativo.</p></section>';
  const spl=(A.adj||[]).filter(e=>String(e[2]).startsWith("S"));
  const fac=ix=>spl.reduce((a,e)=>e[0]>ix?a*e[1]:a,1); // converte valores antigos para a base de ações de hoje
  const NM={D:"Dividendo",J:"JCP",R:"Rendimento",E:"Rendimento (estimado)",A:"Amortização",C:/RENDA|EDUCA/.test(A.t)?"Parcela mensal (estimada)":"Cupom"};const PAG={};(A.evc||[]).forEach(e=>{if(e[3])PAG[e[0]+"|"+e[1]+"|"+(+e[2]).toFixed(8)]=e[3]});
  const anos={};ev.forEach(e=>{if(e.tp==="A")return;const y=+e.dc.slice(0,4);anos[y]=(anos[y]||0)+e.v*fac(e.ix)});
  const yrs=Object.keys(anos).map(Number).sort((a,b)=>a-b).slice(-12);
  const pxY=y=>{let best=null;for(let x=0;x<A.I.length;x++){const d=new Date(AT.T[A.I[x]]);if(d.getUTCFullYear()===y)best=x}return best==null?null:A.R[best]*fac(A.I[best])};
  let h='<section class="panel"><h3>Proventos</h3>';
  if(yrs.length>1)h+='<div class="label">Proventos por ano (R$ por '+(AT_FUNDO.has(A.tipo)?'cota':'ação')+', na base de '+(AT_FUNDO.has(A.tipo)?'cotas':'ações')+' de hoje)</div>'+fnChart([{lab:"Proventos",col:"var(--gain)",pts:yrs.map(y=>[Date.UTC(y,6,1),anos[y]])}],{fmt:"brl",bars:true,zero:true,h:170,aria:"Proventos por ano"});
  h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th>'+yrs.slice().reverse().map((y,j)=>'<th'+(j>=8?' class="c-md"':j>=5?' class="c-sm"':'')+'>'+y+'</th>').join("")+'</tr></thead><tbody><tr><td style="text-align:left">Total por ação</td>'+yrs.slice().reverse().map((y,j)=>'<td'+(j>=8?' class="c-md"':j>=5?' class="c-sm"':'')+'>R$ '+fx(anos[y],2)+'</td>').join("")+'</tr><tr><td style="text-align:left">Dividend yield <small>(sobre o preço de fim de ano)</small></td>'+yrs.slice().reverse().map((y,j)=>{const p=pxY(y);return '<td'+(j>=8?' class="c-md"':j>=5?' class="c-sm"':'')+'>'+(p?fx(anos[y]/p*100,2)+'%':'—')+'</td>'}).join("")+'</tr></tbody></table></div>';
  if(AT_FUNDO.has(A.tipo)){const L=ev.filter(e=>e.tp!=="A").slice(-24);if(L.length>3)h+='<div class="label" style="margin-top:10px">Rendimento mensal por cota</div>'+fnChart([{lab:"Rendimento",col:"var(--gain)",pts:L.map(e=>[Date.parse(e.dc+"T00:00:00Z"),e.v*fac(e.ix)])}],{fmt:"brl",bars:true,zero:true,h:160,aria:"Rendimentos"})}
  h+='<div class="label" style="margin-top:10px">Últimos proventos</div><div class="tablewrap" style="max-height:340px"><table class="ctab"><thead><tr><th style="text-align:left">Data com</th><th style="text-align:left" class="c-ph">Pagamento</th><th style="text-align:left">Tipo</th><th>Valor</th><th>% do preço</th></tr></thead><tbody>';
  ev.slice().reverse().slice(0,40).forEach(e=>{const pg=PAG[e.dc+"|"+e.tp+"|"+(+e.v).toFixed(8)];h+='<tr><td style="text-align:left">'+fdate(Date.parse(e.dc+"T00:00:00Z"))+'</td><td style="text-align:left" class="c-ph">'+(pg&&pg<"9000"?fdate(Date.parse(pg+"T00:00:00Z")):pg?'a definir':'—')+'</td><td style="text-align:left">'+(NM[e.tp]||e.tp)+'</td><td>R$ '+fx(e.v,e.v<0.1?4:2)+'</td><td>'+fx((1-e.f)*100,2)+'%</td></tr>'});
  h+='</tbody></table></div><p class="sub" style="font-size:.8rem">'+(AT_FUNDO.has(A.tipo)?'Valores por cota na data com, como divulgados pela B3. ':'Valores por ação na data com, como divulgados pela B3. O JCP aparece pelo valor bruto. ')+(ev.some(e=>e.tp==="E")?'Os rendimentos marcados como estimados (anteriores aos últimos 12 meses publicados pela B3) foram calculados pelo dividend yield mensal do informe da CVM sobre o valor patrimonial da cota. ':'')+'</p></section>';
  return h;
}
function atFundHtml(A){
  const i=A.ind||{},f=A.fund||{};let h='<section class="panel"><h3>Indicadores fundamentalistas</h3>';
  const it=[];const add=(a,b,c)=>{if(b!=null&&b!=="")it.push('<div><dt>'+a+(c?' <small>'+c+'</small>':'')+'</dt><dd>'+b+'</dd></div>')};
  const n1=(v,d)=>v==null?"—":fx(v,d==null?2:d);
  add("P/L",n1(i.pl_r,1),"preço ÷ lucro por ação");add("P/VP",n1(i.pvp),"preço ÷ valor patrimonial");add("EV/EBIT",n1(i.ev_ebit,1));add("Dividend yield",fnPctT(A.met&&A.met.dy),"12 meses");
  add("ROE",fnPctT(i.roe,1),"lucro ÷ patrimônio");add("Margem líquida",fnPctT(i.ml,1));add("Margem EBIT",fnPctT(i.me,1));add("Dívida líquida ÷ EBIT",n1(i.dl_ebit));
  add("LPA",i.lpa!=null?"R$ "+fx(i.lpa,2):"—");add("VPA",i.vpa!=null?"R$ "+fx(i.vpa,2):"—");add("Valor de mercado",fnMoney(i.mcap));add("Dívida líquida",fnMoney(i.dl));
  add("Receita (12 meses)",fnMoney(i.rec));add("EBIT (12 meses)",fnMoney(i.ebit));add("Lucro líquido (12 meses)",fnMoney(i.ll));add("Patrimônio líquido",fnMoney(i.pl));
  h+='<dl class="fninfo fnrisk">'+it.join("")+'</dl>';
  const an=f.a||{},ys=Object.keys(an).sort();
  if(ys.length>1){
    h+='<div class="label" style="margin-top:12px">Receita e lucro líquido por ano</div>'+fnChart([{lab:"Receita",col:FN_COLS[0],w:2.2,pts:ys.map(y=>[Date.UTC(+y,11,31),an[y][0]])},{lab:"Lucro líquido",col:"var(--gain)",w:2.2,pts:ys.map(y=>[Date.UTC(+y,11,31),an[y][2]])}],{fmt:"money",zero:true,h:200,aria:"Resultados"});
    h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Ano</th>'+ys.slice().reverse().map((y,j)=>'<th'+(j>=6?' class="c-md"':j>=4?' class="c-sm"':'')+'>'+y+'</th>').join("")+'</tr></thead><tbody>';
    const row=(lab,f2)=>'<tr><td style="text-align:left">'+lab+'</td>'+ys.slice().reverse().map((y,j)=>'<td'+(j>=6?' class="c-md"':j>=4?' class="c-sm"':'')+'>'+f2(an[y])+'</td>').join("")+'</tr>';
    h+=row("Receita",v=>fnMoney(v[0]))+row("EBIT",v=>fnMoney(v[1]))+row("Lucro líquido",v=>fnMoney(v[2]))+row("Margem líquida",v=>v[0]&&v[2]!=null?fnPctT(v[2]/v[0]*100,1):"—")+row("ROE",v=>v[3]&&v[2]!=null?fnPctT(v[2]/v[3]*100,1):"—")+row("Patrimônio líquido",v=>fnMoney(v[3]))+row("Dívida líquida",v=>v[6]!=null?fnMoney((v[6]||0)-(v[5]||0)):"—");
    h+='</tbody></table></div>'}
  h+='<p class="sub" style="font-size:.8rem">Demonstrações consolidadas entregues à CVM (DFP anual e ITR trimestral)'+(i.ltm?'; últimos 12 meses até '+fdate(Date.parse(i.ltm+"T00:00:00Z")):'')+'. Valor de mercado = ações em circulação (sem tesouraria) × cotação de cada classe. Bancos e seguradoras têm estrutura de resultado diferente: EBIT e dívida não se aplicam.</p></section>';
  return h;
}
function atFiiHtml(A){
  const f=A.fii;if(!f||!f.m)return "";const k0=+f.m0.slice(0,4)*12+(+f.m0.slice(4))-1;const pts=[],vp=[],cot=[],dy=[];
  f.m.forEach((v,j)=>{if(!v)return;const k=k0+j,t=Date.UTC(Math.floor(k/12),k%12+1,0);if(v[0]){vp.push([t,v[0]]);const p=fnPtAt(A,t);if(p){const x=A.I.indexOf(p.i);if(x>=0)pts.push([t,A.R[x]])}}if(v[2])cot.push([t,v[2]]);if(v[3]!=null)dy.push([Date.UTC(Math.floor(k/12),k%12,15),(v[3]>0.2?v[3]/100:v[3])*100])});
  let h='<section class="panel"><h3>Informe mensal do fundo (CVM)</h3>';
  if(vp.length>1)h+='<div class="label">Cotação × valor patrimonial da cota</div>'+fnChart([{lab:"Cotação (fim do mês)",col:FN_COLS[0],w:2,pts:pts.slice(-72)},{lab:"Valor patrimonial da cota",col:"var(--s2)",w:2,pts:vp.slice(-72)}],{fmt:"brl",h:200,aria:"P/VP"});
  if(dy.length>3)h+='<div class="label" style="margin-top:10px">Rendimento distribuído no mês (% do valor patrimonial)</div>'+fnChart([{lab:"DY mensal",col:"var(--gain)",pts:dy.slice(-36)}],{fmt:"pct",bars:true,zero:true,h:160,aria:"DY mensal"});
  if(cot.length>3)h+='<div class="label" style="margin-top:10px">Número de cotistas</div>'+fnChart([{lab:"Cotistas",col:FN_COLS[2],pts:cot.slice(-72)}],{fmt:"int",h:160,aria:"Cotistas"});
  return h+'</section>';
}
function atLiqHtml(A){
  if(!A.vm0||!A.vol)return "";const k0=+A.vm0.slice(0,4)*12+(+A.vm0.slice(4))-1;const P=A.vol.map((v,j)=>{const k=k0+j,n=A.neg[j]||0;return [Date.UTC(Math.floor(k/12),k%12,15),n?v/n:0]}).slice(-36);
  return '<section class="panel"><h3>Liquidez</h3><div class="label">Volume financeiro médio por pregão (mensal)</div>'+fnChart([{lab:"Volume médio",col:"var(--accent)",pts:P}],{fmt:"money",bars:true,zero:true,h:170,aria:"Liquidez"})+'<p class="sub" style="font-size:.8rem">Média dos últimos 3 meses: <b>'+fnMoney(A.met&&A.met.liq)+'</b> por dia.</p></section>';
}
function atPeerHtml(A){
  const C=AT.C,R=AT.idx.rows,me=atRow(A.t);if(!me)return "";
  const grp=R.filter(r=>r[C.tipo]===me[C.tipo]&&(me[C.setor]==null||!AT.idx.setores[me[C.setor]]||r[C.setor]===me[C.setor])&&(r[C.liq]||0)>=1e5);
  if(grp.length<5)return "";
  const sn=AT.idx.setores[me[C.setor]],cat=!sn||sn===me[C.tipo]||/n[ãa]o classificad/i.test(sn)?"":sn;
  const pos=(col,hb)=>{const v=me[C[col]];if(v==null)return null;const vals=grp.map(r=>r[C[col]]).filter(x=>x!=null);const n=vals.length;if(n<4)return null;const better=vals.filter(x=>hb?x>v:x<v).length;return {rk:better+1,n,q:Math.min(4,Math.floor(better/n*4)+1),med:vals.slice().sort((a,b)=>a-b)[Math.floor(n/2)],v}};
  const rows=[["Retorno 12 meses","r12",true,"p"],["Retorno 36 meses","r36",true,"p"],["Dividend yield","dy",true,"p"],["P/L","pl",false,"n"],["P/VP","pvp",false,"n"],["ROE","roe",true,"p"],["Volatilidade 12m","v12",false,"p"]];
  let h='<section class="panel"><h3>Comparação com os pares</h3><p class="sub">'+esc(me[C.tipo])+(cat?' · '+esc(cat):'')+' · '+grp.length+' ativos com liquidez acima de R$ 100 mil por dia. 1º quartil = entre os 25% melhores.</p><div class="tablewrap" style="max-height:none"><table class="ctab"><thead><tr><th style="text-align:left">Indicador</th><th>'+esc(A.t)+'</th><th>Mediana</th><th>Posição</th><th>Quartil</th></tr></thead><tbody>';
  rows.forEach(([lab,col,hb,k])=>{const p=pos(col,hb);if(!p)return;const f=v=>k==="p"?fnPctT(v):fx(v,2);h+='<tr><td style="text-align:left">'+lab+'</td><td><b>'+f(p.v)+'</b></td><td>'+f(p.med)+'</td><td>'+p.rk+'º de '+p.n+'</td><td><span class="fnq '+["","fnq1","fnq2","fnq3","fnq4"][p.q]+'">'+p.q+'º</span></td></tr>'});
  return h+'</tbody></table></div><button type="button" class="link" data-atrkcat="'+me[C.tipo]+'|'+(me[C.setor]!=null?me[C.setor]:"")+'">Ver o ranking ›</button></section>';
}
function atSrcHtml(A){const tp=A&&A.tipo||"",td=tp==="Tesouro Direto",bdr=tp==="BDR";
  const f=td?'Tesouro Nacional (preços e taxas do Tesouro Direto, pelo Tesouro Transparente), Banco Central (CDI, IPCA e dólar) e B3 (Ibovespa e IFIX)'
    :'B3 (cotações históricas, proventos, desdobramentos, cadastro, Ibovespa e IFIX), '+(AT_FUNDO.has(tp)?'CVM (informe mensal dos fundos)':bdr?'SEC (balanços e documentos da empresa nos EUA), Nasdaq (cotação em Nova York), Cboe (S&P 500)':'CVM (demonstrações financeiras e composição do capital)')+' e Banco Central (CDI, IPCA e dólar)';
  return '<p class="sub" style="font-size:.78rem;margin:4px 4px 16px">Fontes: '+f+'. Rentabilidade passada não garante rentabilidade futura. Cotações até '+(AT.idx.dt?fdate(Date.parse(AT.idx.dt+"T00:00:00Z")):"—")+'.</p>'}

