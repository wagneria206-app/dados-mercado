/* ---------- aba ---------- */
function fdFields(){return {mod:"fund",key:cnpjNorm($("fdCnpj").value),fdName:$("fdName").value.trim(),fdType:$("fdType").value,fdPlan:$("fdPlan").value,fdReg:$("fdReg").value,fdCls:$("fdCls").value,buy:$("fdBuy").value,amt:$("fdAmt").value,cotas:$("fdCotas").value,cota0:$("fdCota0").value,cotasNow:$("fdCotasNow").value,saldo:$("fdSaldo").value,exp:$("fdExp").value}}

function fdApply(){const pv=$("fdType").value==="PREV";$("fdPrevBox").hidden=!pv}
function fdInfoHtml(c){
  const ok=cnpjValid(c),F=FUNDS[c];
  if(!c)return '<p class="sub">Digite o CNPJ do fundo (está na lâmina, no extrato ou no informe de rendimentos).</p>';
  if(!ok)return '<p class="err">CNPJ inválido: os dígitos verificadores não conferem. Confira cada número.</p>';
  let h='<div class="pcinfo"><div class="pchead"><span class="tag">CNPJ '+cnpjFmt(c)+'</span>'+(F&&F.status==="ok"?'<span class="tag">cadastro conferido</span>':F&&F.status==="pending"?'<span class="tag est">buscando dados…</span>':F&&F.status==="error"?'<span class="tag man">não encontrado</span>':'')+'</div>';
  if(F&&F.name)h+='<div class="pcname">'+F.name+'</div><dl class="pcdl">'+(F.admin?'<div class="row"><dt>Administrador</dt><dd>'+F.admin+'</dd></div>':'')+(F.manager?'<div class="row"><dt>Gestor</dt><dd>'+F.manager+'</dd></div>':'')+(F.cls?'<div class="row"><dt>Classe</dt><dd>'+F.cls+'</dd></div>':'')+(F.type&&FD_TYPES[F.type]?'<div class="row"><dt>Tributação</dt><dd>'+FD_TYPES[F.type].name+'</dd></div>':'')+(F.fee?'<div class="row"><dt>Taxa de administração</dt><dd>'+F.fee+'</dd></div>':'')+'</dl>';
  if(F&&F.notes)h+='<p class="sub" style="font-size:.82rem">'+F.notes+'</p>';
  const Q=F&&F.quotes||[];if(Q.length){const q=Q[Q.length-1];h+='<p class="sub" style="margin-top:6px">Última cota: <b>'+fx(q[1],8)+'</b> em '+fdate(parseDate(q[0]))+' ('+(q[2]||"informada")+'). '+Q.length+' cota(s) registrada(s) para este CNPJ, usadas por todos os clientes que têm o fundo.</p>'}
  return h+'</div>';
}
function fdCalc(){
  const out=$("fdOut");if(!out)return;const c=cnpjNorm($("fdCnpj").value);$("fdInfo").innerHTML=fdInfoHtml(c);
  const F=FUNDS[c];if(F&&F.type&&FD_TYPES[F.type]&&!$("fdType").dataset.touched){$("fdType").value=F.type;fdApply()}
  const p=fdFields(),r=fundEval(p);LAST.fund=r.err?null:r;
  if(r.err){out.innerHTML='<span class="label">Resultado</span><p class="'+(/^Digite/.test(r.err)?'sub':'err')+'" style="margin-top:8px">'+r.err+'</p>';return}
  const d=r.fd,cl=r.res>=0?"gain":"loss";
  let h='<div class="verdict"><span class="label">Valor hoje'+(d.virtual||r.estDays>=1?' (estimado)':'')+'</span><span class="chip flat">'+(d.prev?(p.fdPlan||"Previdência"):"Fundo")+'</span></div><div class="big '+cl+'">'+brl(r.valM)+'</div>';
  h+='<p class="sub">'+r.name+' · aplicado em '+fdate(r.buy)+'. '+(d.virtual?'Sem cota informada: valor estimado a '+fx(d.pct,0)+'% do CDI desde a aplicação. Informe a cota de hoje (extrato) para o valor exato.':d.lastQ?(r.estDays<1?'Pela cota de '+fdate(d.lastQ[0])+'.':'Pela cota de '+fdate(d.lastQ[0])+', corrigida até hoje a '+fx(d.pct,0)+'% do CDI.'):'Pela cota da aplicação, corrigida a '+fx(d.pct,0)+'% do CDI. Informe uma cota recente para o valor exato.')+'</p>';
  h+='<div class="cmp"><div><span class="n">Resultado bruto</span><span class="v '+(r.res>=0?"pos":"neg")+'">'+signed(r.res,brl)+'</span></div><div><span class="n">Líquido se resgatar hoje</span><span class="v">'+brl(r.netNow)+'</span></div></div>';
  h+='<dl><div class="row"><dt>Valor aplicado</dt><dd>'+brl(r.inv)+'</dd></div>'+(d.virtual?'':'<div class="row"><dt>Cotas: compradas → hoje</dt><dd>'+fx(d.cotas,4)+' → '+fx(d.units,4)+'</dd></div><div class="row"><dt>Cota na aplicação → hoje</dt><dd>'+fx(d.cota0,6)+' → '+fx(d.cNow,6)+'</dd></div>');
  if(FD_TYPES[r.type].cc)h+='<div class="row"><dt>Come-cotas pago (estimado, '+d.ccList.length+' vez(es), '+fx(FD_TYPES[r.type].cc*100,0)+'%)</dt><dd>'+brl(d.ccPaid)+'</dd></div>';
  h+='<div class="row"><dt>IR no resgate hoje'+(d.prev?(d.prog?' (15% retido; ajuste na declaração)':' (tabela regressiva: '+fx(prevRate((VAL-r.buy)/DAY)*100,0)+'%)'):'')+'</dt><dd>−'+brl(r.taxNow)+'</dd></div>';
  h+='<div class="row strong"><dt>Resultado líquido se resgatar hoje</dt><dd class="'+(r.net>=0?"pos":"neg")+'">'+signed(r.net,brl)+'</dd></div>';
  if(isFinite(r.tirGross))h+='<div class="row"><dt>Rentabilidade bruta desde a aplicação</dt><dd>'+fx(r.tirGross,2)+'% a.a.</dd></div>';
  h+='</dl>';
  if(d.prev&&!d.prog){const nx=prevNext(r.buy);if(nx)h+='<p class="sub" style="font-size:.86rem;margin-top:8px">A alíquota desta contribuição cai para '+fx(nx.rate*100,0)+'% em '+fdate(nx.t)+'. Resgatar antes custa mais IR.</p>'}
  if(d.pgbl)h+='<p class="sub" style="font-size:.86rem;margin-top:6px">PGBL: o IR incide sobre o valor total resgatado (as contribuições foram deduzidas da base do IR). O resultado líquido negativo é esperado.</p>';
  out.innerHTML=h;
}
async function fdFetch(){
  const c=cnpjNorm($("fdCnpj").value),info=$("fdInfo");if(!cnpjValid(c)){info.innerHTML=fdInfoHtml(c);return}
  return fdRoboFetch(c);
}
async function fdQuoteSave(){
  const c=cnpjNorm($("fdCnpj").value),msg=$("fdQMsg"),d=$("fdQDate").value,v=num($("fdQVal").value);
  if(!cnpjValid(c)){msg.textContent="CNPJ inválido.";return}if(!d||parseDate(d)>VAL+DAY){msg.textContent="Informe a data da cota (até hoje).";return}if(!(v>0)){msg.textContent="Informe o valor da cota.";return}
  const old=FUNDS[c]||{cnpj:c},Q=(old.quotes||[]).filter(q=>q[0]!==d).concat([[d,v,"informada"]]).sort((a,b)=>a[0].localeCompare(b[0])).slice(-240);
  FUNDS[c]=Object.assign({},old,{cnpj:c,quotes:Q,name:old.name||$("fdName").value.trim()||""});msg.textContent="Cota de "+fdate(parseDate(d))+" usada no cálculo.";fdCalc();
}
function fdBind(){
  ["fdCnpj","fdName","fdBuy","fdAmt","fdCotas","fdCota0","fdCotasNow","fdSaldo","fdExp"].forEach(id=>$(id).addEventListener("input",fdCalc));
  ["fdType","fdPlan","fdReg","fdCls"].forEach(id=>$(id).addEventListener("change",()=>{if(id==="fdType")$("fdType").dataset.touched="1";fdApply();fdCalc()}));
  $("fdCnpj").addEventListener("blur",()=>{const c=cnpjNorm($("fdCnpj").value);if(c.length===14)$("fdCnpj").value=cnpjFmt(c)});
  $("fdFetch").addEventListener("click",fdFetch);$("fdQSave").addEventListener("click",fdQuoteSave);
  $("fdQDate").value=isoD(VAL);fdApply();
}

