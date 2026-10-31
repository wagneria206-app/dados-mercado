/* ---------- aba ---------- */

function bkFields(){return {mod:"bank",key:$("bkType").value,issuer:$("bkIssuer").value.trim(),conglom:$("bkConglom").value.trim(),buy:$("bkBuy").value,mat:$("bkMat").value,amt:$("bkAmt").value,idx:$("bkIdx").value,rate:$("bkRate").value,liq:$("bkLiq").checked}}
function bkApplyIdx(){const I=BK_IDX[$("bkIdx").value];$("bkRatePre").textContent=I.pre;$("bkRateSuf").textContent=I.suf;$("bkRate").placeholder=I.ex;$("bkRate").parentNode.classList.toggle("p",!!I.pre)}
function bkCalc(){
  const out=$("bkOut"),p=bkFields(),T=BK_TYPES[p.key];
  $("bkTypeHint").textContent=T?T.desc+(T.exempt?" · isento de IR para pessoa física":" · IR pela tabela regressiva")+(T.fgc?" · coberto pelo FGC":" · sem FGC"):"";
  const r=bankEval(p);LAST.bank=r.err?null:r;
  if(r.err){out.innerHTML='<span class="label">Resultado</span><p class="err" style="margin-top:8px">'+r.err+'</p>';return}
  const yrsNow=(Math.min(VAL,r.mat)-r.buy)/DAY,irNow=T.exempt?0:irRate(yrsNow),irMat=T.exempt?0:irRate((r.mat-r.buy)/DAY);
  let eq="";
  if(p.idx==="DI_PCT"||p.idx==="PRE"){const g=T.exempt?r.rc/(1-irMat):r.rc*(1-irMat);
    eq=T.exempt?'Equivale a um '+(p.idx==="DI_PCT"?'CDB de <b>'+fx(g,2)+'% do CDI</b>':'CDB prefixado de <b>'+fx(g,2)+'% a.a.</b>')+' (tributado a '+fx(irMat*100,1)+'% no prazo total).'
      :'Equivale a uma LCI/LCA isenta de <b>'+(p.idx==="DI_PCT"?fx(g,2)+'% do CDI':fx(g,2)+'% a.a.')+'</b> (IR de '+fx(irMat*100,1)+'% no prazo total).'}
  let h='<div class="verdict"><span class="label">'+(r.matured?'Vencido em '+fdate(r.mat):'Valor hoje, na curva')+'</span><span class="chip '+(r.fgc?"gain":"flat")+'">'+(r.fgc?"FGC":"Sem FGC")+'</span></div>';
  h+='<div class="big gain">'+brl(r.matured?r.vMat:r.vNow)+'</div>';
  h+='<p class="sub">'+r.name+' · '+r.fmt(r.rc)+' · aplicado em '+fdate(r.buy)+' · vence em '+fdate(r.mat)+'. Rendeu '+signed((r.matured?r.vMat:r.vNow)-r.inv,brl)+' bruto ('+signed(((r.matured?r.vMat:r.vNow)/r.inv-1)*100,v=>fx(v,2))+'%).</p>';
  h+='<div class="cmp"><div><span class="n">Valor aplicado</span><span class="v">'+brl(r.inv)+'</span></div><div><span class="n">'+(r.matured?'Recebido no vencimento':'Líquido se resgatar hoje')+'</span><span class="v">'+brl(r.matured?r.netMat:r.netNow)+'</span></div></div>';
  h+='<dl>';
  if(!r.matured){
    h+='<div class="row head"><dt>Hoje ('+fdate(VAL)+')</dt><dd></dd></div>';
    h+='<div class="row"><dt>Valor bruto na curva</dt><dd>'+brl(r.vNow)+'</dd></div>';
    h+='<div class="row"><dt>IR e IOF se resgatar hoje'+(T.exempt?' (isento)':' ('+fx(irNow*100,1)+'%)')+'</dt><dd>−'+brl(r.taxNow)+'</dd></div>';
    h+='<div class="row strong"><dt>Líquido hoje</dt><dd>'+brl(r.netNow)+'</dd></div>';
  }
  h+='<div class="row head"><dt>No vencimento ('+fdate(r.mat)+')'+(r.matured?'':', projeção')+'</dt><dd></dd></div>';
  h+='<div class="row"><dt>Valor bruto</dt><dd>'+brl(r.vMat)+'</dd></div>';
  h+='<div class="row"><dt>IR'+(T.exempt?' (isento)':' ('+fx(irMat*100,1)+'%)')+'</dt><dd>−'+brl(r.taxMat)+'</dd></div>';
  h+='<div class="row strong"><dt>Líquido</dt><dd>'+brl(r.netMat)+'</dd></div>';
  h+='<div class="row"><dt>Rentabilidade anual (bruta / líquida)</dt><dd>'+fx(r.tirGross,2)+'% / '+fx(r.tirNet,2)+'%</dd></div>';
  h+='</dl>';
  if(eq)h+='<p class="sub" style="margin-top:12px;font-size:.9rem">'+eq+'</p>';
  h+='<p class="sub" style="margin-top:8px;font-size:.88rem">'+(r.fgc?'Coberto pelo FGC até R$ 250 mil por CPF por conglomerado (somando todos os títulos do mesmo grupo).':'Este tipo de título não tem garantia do FGC: o risco é do emissor.')+' '+(r.liq?'Com liquidez diária: o resgate antecipado sai pelo valor na curva.':'Sem liquidez diária: o resgate antes do vencimento depende de recompra pelo emissor, que pode pagar menos que a curva.')+(p.idx==="IPCA"?' IPCA do mês anterior, com aniversário na data da aplicação e pro rata por dias úteis (padrão dos bancos emissores).':'')+(p.idx==="DI_PCT"||p.idx==="DI_SPREAD"?' CDI passado: série diária oficial do Banco Central; futuro: curva de juros da ANBIMA.':'')+'</p>';
  out.innerHTML=h;
}


function bkBind(){
  ["bkType","bkIdx","bkLiq"].forEach(id=>$(id).addEventListener("change",()=>{if(id==="bkIdx")bkApplyIdx();bkCalc()}));
  ["bkIssuer","bkConglom","bkBuy","bkMat","bkAmt","bkRate"].forEach(id=>$(id).addEventListener("input",bkCalc));
  $("bkForm").addEventListener("submit",e=>e.preventDefault());
  bkApplyIdx();
}

