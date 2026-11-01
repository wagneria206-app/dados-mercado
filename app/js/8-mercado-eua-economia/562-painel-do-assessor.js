/* ---------- painel do assessor: todas as carteiras numa tela, com patrimônio, mês e ano contra o CDI e pendências
   Calculado sob demanda (cada carteira carrega as cotas dos seus itens); o resultado fica na memória até recalcular. */
let SP_ASS=null;
function spFundoAlerta(x){if(x.t!=="f"||!FN.idx)return null;const r=fnRow(x.k);if(!r)return "fundo não encontrado na base da CVM";const C=FN.C,u=r[C.ult];
  if(u&&(Date.parse(spHoje())-Date.parse(u))/DAY>12)return "cota sem atualização desde "+fdate(Date.parse(u+"T00:00:00Z"));
  if(r[C.pl]>0&&r[C.capt12]!=null&&r[C.capt12]/r[C.pl]<-0.3)return "resgates líquidos de "+fx(-r[C.capt12]/r[C.pl]*100,0)+"% do patrimônio em 12 meses";
  return null}
async function spAssCalc(){
  const box=$("spAssBox");if(box)box.innerHTML='<p class="sub">Calculando as carteiras…</p>';
  const L=SP.carts.map((c,j)=>[c,j]).filter(([x])=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli)),out=[],antes=SP_POS;
  for(const [c,j] of L){const it=c.itens.filter(x=>(+x.w||0)>0),o={c,j,pend:[]};out.push(o);if(!it.length){o.vazia=1;continue}
    try{const itM=c.itens.filter(x=>!((+x.w||0)>0)&&Array.isArray(x.mov)&&x.mov.length);
      const [D,DM]=await Promise.all([Promise.all(it.map(spItemData)),Promise.all(itM.map(spItemData))]);
      const R=spSim(c,it,D);R.D=D;let X=null;if(spTemMov(c)){try{X=spPosCalc(c,it.concat(itM),D.concat(DM))}catch(e){X=null}if(X&&X.erro)X=null}
      SP_POS=X?{c,X}:null;
      o.real=!!X;o.v=X?X.T.v:+c.valor||0;o.J=fnUse(FN,()=>spJanelas(X,R.erro?null:R));
      const su=spSuit(c,it,R.erro?null:R).L.filter(q=>!q.ok);if(su.length)o.pend.push("fora do perfil: "+su.map(q=>q.tema.toLowerCase()).join(", "));const rb=spRebal(c,it);if(rb.fora.length)o.pend.push("fora da política em "+rb.fora.length+(rb.fora.length>1?" classes":" classe"));
      const C=spCredito(c,it);if(C.acima>0)o.pend.push(brl(C.acima)+" acima do FGC");if(C.semEm.length)o.pend.push("renda fixa sem emissor informado");
      const F=spFluxo(c,it,R),h60=Date.parse(spHoje()+"T00:00:00Z")+60*DAY;F.filter(e=>e.ev==="Vencimento"&&e.t<=h60).forEach(e=>o.pend.push("vence em "+fdate(e.t)+": "+spItemNome(e.x).slice(0,30)));
      it.forEach(x=>{const a=spFundoAlerta(x);if(a)o.pend.push(spItemNome(x).slice(0,30)+": "+a)});
      const sl=it.filter(x=>spLiq(x).d==null).length;if(sl)o.pend.push(sl+(sl>1?" itens":" item")+" sem prazo de resgate");
      if(R.erro)o.pend.push(R.erro)}catch(e){o.erro=e.message}}
  SP_POS=antes;SP_ASS={t:Date.now(),out};spAssRender()}
function spAssRender(){
  const box=$("spAssBox");if(!box||!SP_ASS)return;const O=SP_ASS.out,ok=O.filter(o=>!o.vazia&&!o.erro);
  const pc=(v,c0)=>v==null||!isFinite(v)?'—':'<span class="'+(v>=0?'pos':'neg')+'">'+fnPct(v)+'</span>'+(c0>0&&v>0?'<small style="display:block;color:var(--muted)">'+fx(v/c0*100,0)+'% do CDI</small>':c0!=null?'<small style="display:block;color:var(--muted)">CDI '+fnPct(c0)+'</small>':'');
  const real=ok.filter(o=>o.real),pend=ok.filter(o=>o.pend.length);
  const kp=(a,b,cc,cls)=>'<div class="fnkp'+(cls?' '+cls:'')+'"><span>'+a+'</span><b>'+b+'</b>'+(cc?'<small>'+cc+'</small>':'')+'</div>';
  let h='<div class="fnkpis">'+kp("Carteiras",fx(O.length,0),real.length+' com posição real · '+(ok.length-real.length)+' propostas')+kp("Patrimônio acompanhado",brl(real.reduce((a,o)=>a+o.v,0)),'soma das posições reais')
    +kp("Acima do CDI no ano",real.length?fx(real.filter(o=>o.J.rA!=null&&o.J.cA!=null&&o.J.rA>o.J.cA).length,0)+' de '+real.length:'—','carteiras com posição real')+kp("Com pendências",fx(pend.length,0),pend.length?'veja a coluna Pendências':'tudo em ordem',pend.length?'kpalerta':'')+'</div>';
  h+='<div class="tablewrap" style="max-height:none;margin-top:8px"><table class="ctab ordenavel"><thead><tr><th style="text-align:left">Cliente</th><th style="text-align:left">Carteira</th><th>Patrimônio</th><th>No mês</th><th>No ano</th><th>12 meses</th><th style="text-align:left">Pendências</th></tr></thead><tbody>'
    +O.sort((a,b)=>String(a.c.cli||"~").localeCompare(String(b.c.cli||"~"),"pt-BR")||(b.v||0)-(a.v||0)).map(o=>'<tr><td style="text-align:left">'+esc(o.c.cli||"—")+'</td><td style="text-align:left" class="tw"><button type="button" class="link" data-spgo="'+o.j+'">'+esc(o.c.nome)+'</button><small style="display:block;color:var(--muted)">'+(o.c.sit==="efetivada"?'efetivada':'proposta')+(o.real?' · posição real':'')+'</small></td>'
      +(o.vazia?'<td colspan="4" class="sub">sem itens</td><td></td>':o.erro?'<td colspan="4" class="err">'+esc(o.erro)+'</td><td></td>':'<td data-ordem="'+(o.v||0)+'">'+brl(o.v)+(o.real?'':'<small style="display:block;color:var(--muted)">valor proposto</small>')+'</td><td data-ordem="'+(o.J.rM??-999)+'">'+pc(o.J.rM,o.J.cM)+'</td><td data-ordem="'+(o.J.rA??-999)+'">'+pc(o.J.rA,o.J.cA)+'</td><td data-ordem="'+(o.J.r12??-999)+'">'+pc(o.J.r12,o.J.c12)+'</td><td style="text-align:left;font-size:.84rem">'+(o.pend.length?'<span class="neg">'+o.pend.slice(0,4).map(esc).join('<br>')+(o.pend.length>4?'<br>+'+(o.pend.length-4)+' outras':'')+'</span>':'<span class="pos">nenhuma</span>')+'</td>')+'</tr>').join("")+'</tbody></table></div>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:6px">Calculado às '+new Date(SP_ASS.t).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+'. <button type="button" class="link" data-spass="1">Recalcular</button>. Carteiras com aplicações informadas usam a posição real (rentabilidade por cotas); as propostas, o valor proposto e a simulação histórica dos pesos. Pendências: fora do perfil (adequação), fora da política, acima do FGC, renda fixa sem emissor, vencimento em até 60 dias, fundo com cota atrasada ou resgates fortes e itens sem prazo de resgate.</p>';
  // evolução do patrimônio acompanhado, mês a mês (guardada neste aparelho)
  let H={};try{H=JSON.parse(localStorage.getItem("spAssHist")||"{}")||{}}catch(e){}
  if(!SP.fcli&&real.length){const m=spHoje().slice(0,7);H[m]={v:real.reduce((a,o)=>a+o.v,0),n:real.length,cli:new Set(real.map(o=>o.c.cli).filter(Boolean)).size};try{localStorage.setItem("spAssHist",JSON.stringify(H))}catch(e){}}
  const ms=Object.keys(H).sort();if(ms.length>=2){h+='<div class="label" style="margin-top:12px">Evolução do patrimônio acompanhado</div>'+fnChart([{lab:"Patrimônio (posições reais)",col:FN_COLS[0],w:2.2,pts:ms.map(m=>[Date.UTC(+m.slice(0,4),+m.slice(5,7)-1,15),H[m].v])}],{fmt:"money",h:170,months:true,aria:"Evolução do patrimônio"})
    +'<div class="tablewrap" style="max-height:none;margin-top:4px"><table class="ctab"><thead><tr><th style="text-align:left">Mês</th><th>Patrimônio</th><th>Variação (com aportes)</th><th>Carteiras</th><th>Clientes</th></tr></thead><tbody>'+ms.slice(-12).reverse().map((m,i,a)=>{const p=H[ms[ms.indexOf(m)-1]];return '<tr><td style="text-align:left">'+mname(+m.slice(0,4)*12+(+m.slice(5,7))-1)+'</td><td>'+brl(H[m].v)+'</td><td>'+(p?brl(H[m].v-p.v):'—')+'</td><td>'+H[m].n+'</td><td>'+(H[m].cli||'—')+'</td></tr>'}).join("")+'</tbody></table></div>'}
  else h+='<p class="sub" style="font-size:.8rem;margin-top:6px">A evolução mês a mês do patrimônio acompanhado aparece a partir do segundo mês em que o painel for calculado (com todos os clientes).</p>';
  box.innerHTML=h}
function spAssHtml(){const n=SP.carts.filter(x=>!SP.fcli||(SP.fcli==="__sem"?!x.cli:x.cli===SP.fcli)).length;
  return '<section class="panel" data-reltit="Painel do assessor"><h3>Painel do assessor</h3><p class="sub">'+(SP.fcli&&SP.fcli!=="__sem"?'As carteiras do cliente '+esc(SP.fcli):'Todas as carteiras e propostas')+' numa tela: patrimônio, resultado contra o CDI e o que precisa de atenção.</p><div id="spAssBox">'+(SP_ASS?'':'<button type="button" class="btn sec" data-spass="1">Calcular as '+n+(n>1?' carteiras':' carteira')+'</button>')+'</div></section>'}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-spass]");if(!x||activeMod!=="sp")return;spAssCalc()});
