/* ---------- adequação ao perfil (suitability), liquidez de mercado, crédito marcado a mercado e boleta do rebalanceamento
   Perfil vem da política da carteira; público-alvo do cliente (geral, qualificado, profissional) em c.inv.
   Limites de referência do app por perfil (ajuste à política do seu escritório). */
const SP_SUIT={conservador:{vol:4,dd:-5,nota:3,ilq:20,rv:10,cripto:0},moderado:{vol:9,dd:-12,nota:4,ilq:40,rv:35,cripto:3},arrojado:{vol:18,dd:-25,nota:5,ilq:70,rv:100,cripto:10}};
const SP_INV={geral:"Público geral",qualificado:"Investidor qualificado",profissional:"Investidor profissional"};
let SP_TXH=null;   // histórico de taxas ANBIMA (marcação do crédito)
function spSuit(c,it,R){
  const P=spPol(c),perf=SP_SUIT[P.perfil]||SP_SUIT.moderado,inv=c.inv||"geral",{w,tot}=spPesos(c,it),st=R&&R.rets&&R.rets.length?spStats(R,R.rets,R.pts[R.pts.length-1].idx):{},L=[];
  const add=(ok,tema,txt,det)=>L.push({ok,tema,txt,det});
  // público-alvo dos fundos
  const C=FN.C,pub=it.map((x,i)=>{if(x.t!=="f"||!FN.idx)return null;const r=fnRow(x.k);if(!r||/\bprev|\bfie\b|previd/i.test(r[1]))return null;const fl=r[C.flags];   // fundos de previdência (FIE): o cliente entra pelo PGBL/VGBL
    return fl&4?"profissional":fl&2?"qualificado":null}).map((p,i)=>p&&w[i]>0?[it[i],p]:null).filter(Boolean);
  const proib=pub.filter(([,p])=>inv==="geral"||(inv==="qualificado"&&p==="profissional"));
  add(!proib.length,"Público-alvo",proib.length?proib.length+(proib.length>1?' fundos exigem':' fundo exige')+' investidor '+[...new Set(proib.map(o=>o[1]))].join(" ou ")+' e o cliente está como '+SP_INV[inv].toLowerCase():'todos os fundos são permitidos para '+SP_INV[inv].toLowerCase(),proib.map(o=>spItemNome(o[0])).slice(0,4).join("; "));
  if(st.vol!=null)add(st.vol<=perf.vol,"Volatilidade",fx(st.vol,1)+'% ao ano (limite de referência '+fx(perf.vol,0)+'% para o perfil)');
  if(st.dd!=null)add(st.dd>=perf.dd,"Perda máxima",fnPctT(st.dd)+' no histórico simulado (referência até −'+fx(Math.abs(perf.dd),0)+'%)');
  const cl={};it.forEach((x,i)=>{const k=spCl(x);cl[k]=(cl[k]||0)+w[i]*100});const rv=(cl.acoes||0)+(cl.imob||0)+(cl.cripto||0);
  add(rv<=perf.rv,"Renda variável",fx(rv,1)+'% em ações, FIIs e cripto (referência até '+fx(perf.rv,0)+'%)');
  if((cl.cripto||0)>0||perf.cripto===0)add((cl.cripto||0)<=perf.cripto,"Criptoativos",fx(cl.cripto||0,1)+'% (referência até '+fx(perf.cripto,0)+'%)');
  const ilq=it.reduce((a,x,i)=>{const l=spLiq(x);return a+(l.car||l.d==null||l.d>30?w[i]*100:0)},0);
  add(ilq<=perf.ilq,"Liquidez",fx(ilq,1)+'% com resgate acima de D+30, em carência ou sem prazo informado (referência até '+fx(perf.ilq,0)+'%)');
  // crédito: nota do app dos papéis da carteira
  if(it.some(x=>/^cr:/.test(x.k||""))){crbCarrega();if(CRB.L){const ruins=it.filter((x,i)=>{if(!/^cr:/.test(x.k)||!(w[i]>0))return false;const p=CRB.L.find(o=>o.cod===x.k.slice(3)),n=p&&rtNota(p);x._nt=n;return n&&n.n>perf.nota});
      add(!ruins.length,"Risco de crédito",ruins.length?ruins.length+(ruins.length>1?' papéis':' papel')+' com nota de crédito do app acima de '+perf.nota+' para o perfil':'papéis de crédito dentro da nota aceita ('+perf.nota+' ou melhor)',ruins.map(x=>spItemNome(x).slice(0,30)+' (nota '+x._nt.n+')').join("; "))}}
  // liquidez de mercado de ações, FIIs e ETFs: dias para vender usando até 20% do volume médio diário
  const mk=it.map((x,i)=>{if(x.t!=="a"||!AT.idx||spTd(x))return null;const r=atRow(x.k),lq=r&&AT.C.liq!=null?r[AT.C.liq]:null,v=w[i]*tot;return lq>0&&v>0?{x,v,dias:v/(lq*0.2)}:null}).filter(Boolean);
  const lento=mk.filter(o=>o.dias>5);
  if(mk.length)add(!lento.length,"Liquidez de mercado",lento.length?lento.length+(lento.length>1?' ativos levariam':' ativo levaria')+' mais de 5 pregões para vender usando 20% do volume médio diário':'posições vendáveis em até 5 pregões (20% do volume médio)',lento.map(o=>o.x.k+' ≈ '+fx(o.dias,0)+' pregões').join("; "));
  return {L,P,perf,inv,mk}}
function spSuitHtml(c,it,R){if(!it.length)return "";const S=spSuit(c,it,R),al=S.L.filter(o=>!o.ok);
  let h='<section class="panel" data-reltit="Adequação ao perfil"><h3>Adequação ao perfil (suitability)</h3><p class="sub">Perfil <b>'+esc(SP_PERFIS[S.P.perfil].nome.toLowerCase())+'</b> (da política da carteira) e cliente '+esc(SP_INV[S.inv].toLowerCase())+'.'+(al.length?' <b class="neg">'+al.length+(al.length>1?' pontos fora do perfil.':' ponto fora do perfil.')+'</b>':' <b class="pos">Carteira adequada ao perfil.</b>')+'</p>'
    +'<div class="sprow" style="margin-top:6px"><div class="field"><label for="spInv">Classificação do cliente</label><select id="spInv" data-spinv="1">'+Object.entries(SP_INV).map(([k,v])=>'<option value="'+k+'"'+(S.inv===k?' selected':'')+'>'+v+'</option>').join("")+'</select><small>Qualificado: R$ 1 milhão investido ou certificação; profissional: R$ 10 milhões.</small></div></div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><tbody>'+S.L.map(o=>'<tr><td style="text-align:left;width:26px">'+(o.ok?'<span class="pos">✓</span>':'<span class="neg">!</span>')+'</td><td style="text-align:left;width:150px"><b>'+o.tema+'</b></td><td style="text-align:left">'+esc(o.txt)+(o.det?'<small style="display:block;color:var(--muted)">'+esc(o.det)+'</small>':'')+'</td></tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Limites de referência do app por perfil (volatilidade, perda máxima, renda variável, cripto, liquidez e nota de crédito); ajuste à política do seu escritório e à análise de perfil do cliente (API). Público-alvo pelo cadastro da CVM (fundos de previdência ficam de fora: o acesso é pelo plano PGBL/VGBL). Liquidez de mercado: dias para vender a posição negociando até 20% do volume médio diário dos últimos meses (B3).</p></section>';
  return h}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.spinv||activeMod!=="sp")return;spC().inv=t.value;spSave();spCalc()});

/* crédito marcado a mercado: variação da taxa ANBIMA e efeito estimado no preço */
function spMtmHtml(c,it){const cr=it.filter(x=>/^cr:/.test(x.k||""));if(!cr.length)return "";
  if(!SP_TXH){SP_TXH="carregando";roboGet("taxas_hist.json").then(j=>{SP_TXH=j||{};if(activeMod==="sp")spCalc()}).catch(()=>{SP_TXH={}});crbCarrega()}
  if(SP_TXH==="carregando"||!CRB.L)return "";const {w,tot}=spPesos(c,it);
  const L=cr.map(x=>{const cod=x.k.slice(3),H=SP_TXH[cod],p=CRB.L.find(o=>o.cod===cod);if(!Array.isArray(H)||H.length<2||!p||p.dur==null)return null;const u=H[H.length-1];
    const d0=x.mov&&x.mov.length?x.mov.map(m=>m.d).sort()[0]:new Date(Date.parse(u[0])-30*DAY).toISOString().slice(0,10);let a=H[0];for(const h of H){if(h[0]<=d0)a=h;else break}
    const dt=u[1]-a[1],ef=-p.dur*dt/(1+u[1]/100),v=w[it.indexOf(x)]*tot;return {x,a,u,dt,ef,v,dur:p.dur}}).filter(Boolean);
  if(!L.length)return "";
  return '<section class="panel" data-reltit="Crédito marcado a mercado"><h3>Crédito privado marcado a mercado</h3><p class="sub">Variação da taxa indicativa da ANBIMA de cada papel desde a aplicação (ou nos últimos 30 dias) e o efeito estimado no preço.</p><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th style="text-align:left">Papel</th><th>Taxa antes</th><th>Taxa hoje</th><th>Variação</th><th>Efeito no preço</th><th>Em R$</th></tr></thead><tbody>'
    +L.map(o=>'<tr><td style="text-align:left" class="tw">'+esc(spItemNome(o.x)).slice(0,44)+'<small style="display:block;color:var(--muted)">desde '+fdate(Date.parse(o.a[0]+"T00:00:00Z"))+' · duration '+fx(o.dur,1)+' anos</small></td><td>'+fx(o.a[1],2)+'%</td><td>'+fx(o.u[1],2)+'%</td><td class="'+(o.dt>0?'neg':o.dt<0?'pos':'')+'">'+(o.dt>=0?'+':'−')+fx(Math.abs(o.dt)*100,0)+' bps</td><td class="'+(o.ef<0?'neg':'pos')+'">'+fnPctT(o.ef)+'</td><td class="'+(o.ef<0?'neg':'pos')+'">'+brl(o.v*o.ef/100)+'</td></tr>').join("")+'</tbody></table></div>'
    +'<p class="sub" style="font-size:.8rem;margin-top:6px">Efeito ≈ −duration × variação da taxa ÷ (1 + taxa). Taxa subindo = preço caindo (o carrego até o vencimento não muda, mas vender antes realiza a perda). O histórico de taxas do app começa quando o robô passou a guardar cada papel.</p></section>'}

/* boleta do rebalanceamento: ordem de execução, prazos, aplicação mínima e exportação */
function spBoleta(c,it){const R=spRebal(c,it);if(!R.porItem.length)return null;const C=FN.C,h=Date.parse(spHoje()+"T00:00:00Z"),du=(n)=>{let t=h,k=0;while(k<n){t+=DAY;if(isBiz(t))k++}return t};
  const O=R.porItem.filter(o=>o.x&&Math.abs(o.v)>=1).map(o=>{const l=o.liq||spLiq(o.x),d=l&&l.d!=null?l.d:null;let amin=null;if(o.x.t==="f"&&FN.idx){const r=fnRow(o.x.k);amin=r&&C.amin!=null?r[C.amin]:null}
    return {x:o.x,op:o.v<0?"Resgate":"Aplicação",v:Math.abs(o.v),d,ir:o.ir,amin,liqT:o.v<0&&d!=null?du(d):null,car:l&&l.car}});
  const res=O.filter(o=>o.op==="Resgate").sort((a,b)=>(b.d??0)-(a.d??0)),apl=O.filter(o=>o.op==="Aplicação").sort((a,b)=>b.v-a.v);
  const caixa=Math.max(0,...res.map(o=>o.liqT||h));apl.forEach(o=>{o.quando=R.ap>=apl.reduce((a,y)=>a+y.v,0)||!res.length?h:caixa;o.baixo=o.amin>0&&o.v<o.amin});
  return {R,L:res.concat(apl)}}
function spBoletaHtml(c,it){const B=spBoleta(c,it);if(!B)return "";
  let h='<section class="panel" data-reltit="Boleta do rebalanceamento"><h3>Boleta do rebalanceamento</h3><p class="sub">Ordens na sequência de execução: primeiro os resgates (os de prazo mais longo antes), depois as aplicações, na data em que o dinheiro estiver disponível.</p><div class="tablewrap" style="max-height:none;margin-top:6px"><table class="ctab"><thead><tr><th>#</th><th style="text-align:left">Operação</th><th style="text-align:left">Item</th><th>Valor</th><th>Prazo</th><th>Dinheiro em / aplicar em</th><th>IR estimado</th><th style="text-align:left">Atenção</th></tr></thead><tbody>'
    +B.L.map((o,i)=>'<tr><td>'+(i+1)+'</td><td style="text-align:left" class="'+(o.op==="Resgate"?'neg':'pos')+'">'+o.op+'</td><td style="text-align:left" class="tw">'+esc(spItemNome(o.x)).slice(0,44)+'</td><td>'+brl(o.v)+'</td><td>'+(o.d!=null?'D+'+o.d:'—')+'</td><td>'+(o.op==="Resgate"?(o.liqT?fdate(o.liqT):'—'):fdate(o.quando))+'</td><td>'+(o.ir!=null?brl(o.ir):'—')+'</td><td style="text-align:left;font-size:.82rem">'+(o.baixo?'<span class="neg">abaixo da aplicação mínima ('+brl(o.amin)+')</span>':'')+(o.car?'<span class="neg">em carência</span>':'')+'</td></tr>').join("")+'</tbody></table></div>'
    +'<div class="spbtns" style="margin-top:6px"><button type="button" class="btn sec" data-spboleta="1">Baixar a boleta (planilha CSV)</button></div>'
    +'<p class="sub" style="font-size:.8rem;margin-top:6px">Prazos em dias úteis (cotização + pagamento informados à CVM; Bolsa D+2; Tesouro D+1). Nos resgates, quando há aplicações informadas, o app começa pelos itens com menos IR proporcional. Confira horários de corte, IOF (menos de 30 dias) e a aplicação mínima de cada fundo na plataforma antes de executar.</p></section>';
  return h}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-spboleta]");if(!b||activeMod!=="sp")return;const c=spC(),it=c.itens.filter(x=>(+x.w||0)>0||(x.mov&&x.mov.length)),B=spBoleta(c,it);if(!B)return;
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"',n=v=>v==null?"":String(Math.round(v*100)/100).replace(".",",");
  const linhas=[["Ordem","Operação","Item","Código","Valor (R$)","Prazo (D+)","Data","IR estimado (R$)","Atenção"]].concat(B.L.map((o,i)=>[i+1,o.op,spItemNome(o.x),o.x.k,n(o.v),o.d??"",new Date(o.op==="Resgate"?(o.liqT||Date.now()):o.quando).toISOString().slice(0,10),n(o.ir),(o.baixo?"abaixo da aplicação mínima":"")+(o.car?" em carência":"")]));
  const blob=new Blob(["﻿"+linhas.map(l=>l.map(q).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="boleta-"+(c.cli||"carteira").replace(/[^\w-]+/g,"_")+"-"+spHoje()+".csv";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)});
