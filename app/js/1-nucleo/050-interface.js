/* ---------- interface ---------- */
const sel=$("mat");
function buildOptions(){
  const prev=sel.value;sel.innerHTML="";
  ORDER.forEach(k=>{const K=KIND[k];if(!MKT[k]||!MKT[k].length)return;const og=document.createElement("optgroup");og.label=K.td+" ("+K.code+")";
    MKT[k].forEach(([d])=>{const o=document.createElement("option"),t=parseDate(d),y=new Date(t).getUTCFullYear();o.value=k+"|"+d;
      o.textContent=K.b1?K.td+" "+y+" · parcelas de 01/"+y+" a 12/"+new Date(matOf(k,d)).getUTCFullYear():K.td+" "+y+" · "+fdate(t);og.appendChild(o)});sel.appendChild(og)});
  sel.value=prev;if(!sel.value)sel.value="NTNB|2035-05-15";if(!sel.value&&sel.options.length)sel.selectedIndex=0;
}
function renderMkt(){
  const lastIpca=Math.max(...Object.keys(IPCA).map(Number));
  const i12=IPCA[lastIpca]&&IPCA[lastIpca-12]?(IPCA[lastIpca]/IPCA[lastIpca-12]-1)*100:null;
  $("mkt").innerHTML='<span>Selic<b>'+fx(SELIC_OVER,2)+'%</b></span>'+(i12!=null?'<span>IPCA 12 meses<b>'+fx(i12,2)+'%</b> <small style="opacity:.7">até '+mname(lastIpca)+'</small></span>':'')+fxTopHtml();
}

let manual=false,curFam=null;
const cur=()=>{const [k,d]=sel.value.split("|");const row=(MKT[k]||[]).find(x=>x[0]===d),td=tdRow(k,d),an=row&&isFinite(row[1])?row[1]:NaN,base=MBASE||defaultBase(k,d),useTD=!!td&&(base==="TD"||!isFinite(an));return {kind:k,d,mat:matOf(k,d),K:KIND[k],F:FAM[KIND[k].fam],mrate:useTD?td.rate:an,base:useTD?"TD":"ANBIMA",hasTD:!!td,hasAN:isFinite(an)}};
function applyFam(){
  const c=cur();
  if(c.K.fam!==curFam){
    if(curFam!==null)$("rate").value=c.F.ex;
    curFam=c.K.fam;
    $("ratePre").textContent=c.F.pre;$("mratePre").textContent=c.F.pre;
    $("ratePre").hidden=!c.F.pre;$("mratePre").hidden=!c.F.pre;
    [$("rate").parentElement,$("mrate").parentElement].forEach(a=>a.classList.toggle("p",!!c.F.pre));
    $("rateLabel").textContent=c.F.label;$("rateHint").textContent=c.F.hint;
  }
  if(!manual)$("mrate").value=isFinite(c.mrate)?fx(c.mrate,c.K.fam==="selic"?4:2):"";
  $("mbaseField").hidden=!(c.hasTD&&c.hasAN);$("mbase").value=c.base;
  $("mbaseHint").textContent=c.base==="TD"?"Taxa que o Tesouro Direto usa hoje para recomprar o título (o preço que você recebe vendendo por lá).":"Taxa indicativa da ANBIMA: referência de mercado; vendendo, o preço real costuma sair um pouco abaixo.";
}
$("mrate").addEventListener("input",()=>{manual=true;calc()});
$("reset").addEventListener("click",()=>{manual=false;applyFam();calc()});
sel.addEventListener("change",()=>{manual=false;MBASE=null;applyFam();calc()});
$("mbase").addEventListener("change",()=>{MBASE=$("mbase").value;manual=false;applyFam();calc()});
["buy","rate","qty","paid"].forEach(id=>$(id).addEventListener("input",calc));
$("f").addEventListener("submit",e=>e.preventDefault());

let state=null;
function tagFor(isMan,src){return isMan?'<span class="tag man">informada</span>':'<span class="tag">'+src+'</span>'}

function calc(){
  if(activeMod!=='pub')return;
  const c=cur(),{kind,d,mat,K,F}=c;
  const VD=(c.base==="TD"&&!manual&&(TD_DATE_K[kind]||TD_DATE)>VAL)?(TD_DATE_K[kind]||TD_DATE):VAL;
  const buy=parseDate($("buy").value),rc=num($("rate").value),rm=num($("mrate").value);
  const q=num($("qty").value),paid=num($("paid").value);
  const isMan=manual&&Math.abs(rm-c.mrate)>1e-9,srcName=c.base==="TD"?"Tesouro Direto":"ANBIMA",ckey=(c.base==="TD"?"TD|":"")+kind+"|"+d;
  $("matHint").innerHTML=K.desc+" Taxa de mercado: <b style=\"font-family:var(--f-mono);font-weight:500;color:var(--ink)\">"+fr(K.fam,isFinite(rm)?rm:c.mrate)+"</b> "+tagFor(isMan,srcName)+(isMan?"":CHECK[ckey]===true?' <span class="tag">preço conferido</span>':CHECK[ckey]===false?' <span class="tag est">preço não confere</span>':'')+(K.b1&&TD_DATE&&TD_DATE!==VAL&&!isMan?' Taxa do Tesouro Direto de '+fdate(TD_DATE)+'.':'');

  const errs=[],bw=$("buyWarn");bw.hidden=true;
  if(isNaN(buy))errs.push("Informe a data da compra.");
  else if(buy<utc(2005,1,15))errs.push("A calculadora cobre compras a partir de 15/02/2005.");
  else if(buy>VD)errs.push("A compra precisa ser até "+fdate(VD)+", a data dos dados de mercado.");
  else if(buy>=mat)errs.push("A compra precisa ser anterior ao último pagamento do título.");
  else if(!isBiz(buy)){bw.textContent="Essa data não é dia útil. Confira a data de liquidação na nota da corretora.";bw.hidden=false}
  if(!isFinite(rc)||rc<=-50||rc>60)errs.push("Informe a taxa contratada em % ao ano, por exemplo "+F.ex+".");
  if(!isFinite(rm)||rm<=-50||rm>60)errs.push("Informe a taxa de mercado em % ao ano.");
  if(!(q>0))errs.push("Informe a quantidade de títulos (maior que zero).");
  if($("paid").value.trim()&&!(paid>0))errs.push("O preço pago precisa ser um valor em reais, por exemplo 4.383,91.");
  let vnaV,vnaBuy;
  if(!errs.length&&K.idx){vnaV=vnaFor(kind,VD);vnaBuy=vnaFor(kind,buy);if(!isFinite(vnaV)||!isFinite(vnaBuy))errs.push("Não há dados de índice para essa data de compra.")}
  if(errs.length){LAST.pub=null;$("out").innerHTML='<span class="label">Resultado</span><p class="err">'+errs.join("<br>")+"</p>";$("flow").innerHTML="";$("chart").innerHTML="";$("flowSub").textContent="";$("readout").textContent="";state=null;return}

  const fl=flowsFrom(kind,VD,d),pm=price(kind,fl,rm,vnaV),pc=price(kind,fl,rc,vnaV);
  {const off=isMan?0:c.base==="TD"?(tdRow(kind,d)||{}).price:(((MKT[kind]||[]).find(x=>x[0]===d))||[])[2];if(off>0&&CHECK[ckey]===true&&Math.abs(off/pm.pu-1)<0.001)pm.pu=off} // preço oficial publicado
  const diff=pm.pu-pc.pu,diffT=diff*q;
  const pb=price(kind,flowsFrom(kind,buy,d),rc,vnaBuy),usePaid=paid>0,inv=(usePaid?paid:pb.pu)*q;
  const past=pastPayments(kind,d,buy);
  const recv=past.reduce((a,x)=>a+x.amt,0)*q;
  const resM=pm.pu*q+recv-inv,resC=pc.pu*q+recv-inv;
  const yr=new Date(parseDate(d)).getUTCFullYear();
  const reg=t=>pubRegime(kind,t,mat),scn=pubScenario(kind,d,K,buy);
  const txNow=taxCalc(reg(VD),inv,q,buy,past,VD,pm.pu);
  const hv=holdVsSell({reg,inv,q,buy,past,future:scn.cashBetween(mat).filter(c=>c.t>VAL),puNow:pm.pu,end:mat,piBase:piProj(mat),isIpca:K.fam==="ipca"});

  const cl=Math.abs(diff)<0.005?"flat":diff>0?"gain":"loss",word=cl==="flat"?"Na curva":cl==="gain"?"Ágio":"Deságio";
  let h='<div class="verdict"><span class="label">Venda hoje, '+fx(q,q%1?2:0)+(q===1?' título':' títulos')+'</span><span class="chip '+cl+'">'+word+'</span></div>';
  h+='<div class="big '+cl+'">'+signed(diffT,brl)+'</div>';
  h+='<p class="sub">'+signed(diff,brl)+' por título ('+signed(diff/pc.pu*100,x=>fx(x,K.fam==="selic"?3:2))+'%). '+(cl==="gain"?"O mercado paga mais do que o título vale na sua taxa contratada.":cl==="loss"?"O mercado paga menos do que o título vale na sua taxa contratada. Levando até o fim, você recebe a taxa contratada.":"O preço de mercado coincide com o da sua curva.")+'</p>';
  h+='<div class="cmp"><div><span class="n">Taxa contratada</span><span class="v">'+fr(K.fam,rc)+'</span></div><div><span class="n">Taxa de mercado '+tagFor(isMan,srcName)+'</span><span class="v">'+fr(K.fam,rm)+'</span></div></div>';
  h+='<dl>';
  h+='<div class="row head"><dt>'+K.td+' '+yr+' em '+fdate(VD)+(VD!==VAL?' (preço do Tesouro Direto)':'')+'</dt><dd></dd></div>';
  h+='<div class="row"><dt>PU a mercado</dt><dd>R$ '+fx(pm.pu,K.b1?2:6)+'</dd></div>';
  h+='<div class="row"><dt>PU na taxa contratada (curva)</dt><dd>R$ '+fx(pc.pu,K.b1?2:6)+'</dd></div>';
  h+='<div class="row"><dt>'+(K.idx?'Cotação a mercado / na curva':'Preço em % do valor de face')+'</dt><dd>'+fx(pm.cot,4)+'% / '+fx(pc.cot,4)+'%</dd></div>';
  h+='<div class="row"><dt>'+(K.idx?'VNA':'Valor de face')+'</dt><dd>R$ '+fx(K.idx?vnaV:1000,K.idx?6:2)+'</dd></div>';
  if(K.b1)h+='<div class="row"><dt>Parcelas a receber</dt><dd>'+fl.length+' de '+K.b1+'</dd></div>';
  h+='<div class="row head"><dt>Sua posição</dt><dd></dd></div>';
  h+='<div class="row"><dt>Valor investido em '+fdate(buy)+(usePaid?' (preço da nota)':' (estimado)')+'</dt><dd>'+brl(inv)+'</dd></div>';
  h+='<div class="row"><dt>PU calculado na compra'+(K.idx?' (VNA R$ '+fx(vnaBuy,2)+(K.fam==="selic"?', aprox.':'')+')':'')+'</dt><dd>R$ '+fx(pb.pu,K.b1?2:6)+'</dd></div>';
  if(usePaid)h+='<div class="row"><dt>Preço pago (nota)</dt><dd>R$ '+fx(paid,2)+'</dd></div>';
  if(K.cpn||K.b1)h+='<div class="row"><dt>'+(K.b1?'Parcelas':'Cupons')+' recebidos ('+past.length+')</dt><dd>'+brl(recv)+'</dd></div>';
  h+='<div class="row"><dt>Valor a mercado hoje</dt><dd>'+brl(pm.pu*q)+'</dd></div>';
  h+='<div class="row"><dt>Valor na curva hoje</dt><dd>'+brl(pc.pu*q)+'</dd></div>';
  h+='<div class="row strong"><dt>Resultado se vender hoje</dt><dd class="'+(resM>=0?"pos":"neg")+'">'+signed(resM,brl)+'</dd></div>';
  h+='<div class="row"><dt>Resultado na curva</dt><dd>'+signed(resC,brl)+'</dd></div>';
  h+='<div class="row"><dt>IR, IOF e custódia estimados (venda hoje)</dt><dd>−'+brl(txNow.tax+txNow.cust)+'</dd></div>';
  h+='<div class="row strong"><dt>Resultado líquido se vender hoje</dt><dd class="'+(txNow.net>=0?"pos":"neg")+'">'+signed(txNow.net,brl)+'</dd></div>';
  h+='<div class="row"><dt>Dias úteis até o último pagamento</dt><dd>'+fl[fl.length-1].du+'</dd></div>';
  h+='</dl>';
  h+='<p class="sub" style="font-size:.8rem;margin-top:8px">'+taxNote(reg(VAL))+' Estimativa; o IR dos cupons já recebidos foi retido na fonte.</p>';
  h+=holdHtml(hv,{end:mat,piBase:piProj(mat)});
  $("out").innerHTML=h;

  state={kind,fam:K.fam,fl,rc,rm,q,puC:pc.pu,vna:vnaV,F,fmt:r=>fr(K.fam,r),n:K.b1?100:160,priceAt:r=>price(kind,fl,r,vnaV).pu};
  setLastPub({name:K.td+' '+yr,q,buy,rc,rm,pastList:past.map(x=>({t:x.t,amt:x.amt,f:x.f})),fmt:r=>fr(K.fam,r),inv,recvPast:recv,end:mat,isDI:K.fam==='selic',sc:scn,reg,valM:pm.pu*q,agio:diffT,res:resM,net:txNow.net,hv,srcTag:isMan?"informada":srcName,alertSrc:isMan?null:{src:c.base,lookup:{kind,mat:d}}});
  if(!SILENT){drawChart();drawFlow(kind,past,fl,rc,rm,pm.pu,pc.pu,vnaV)}
}

