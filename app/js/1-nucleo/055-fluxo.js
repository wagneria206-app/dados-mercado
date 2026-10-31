/* ---------- fluxo ---------- */
function drawFlow(kind,past,fl,rc,rm,puM,puC,vna){
  const K=KIND[kind],cash=f=>K.idx?vna*f.amt/100:f.amt,word=K.b1?"Parcelas":"Cupons";
  let t='<thead><tr><th>Pagamento</th><th>Dias úteis</th><th>Fluxo (R$)'+(K.idx?'<br>VNA de hoje':'')+'</th><th>Fator<br>mercado</th><th>Valor presente<br>a mercado</th><th>Valor presente<br>na curva</th><th>Diferença</th></tr></thead><tbody>';
  if(past.length){
    t+='<tr class="sep"><td colspan="7">'+word+' já recebidos (valores efetivos por título)</td></tr>';
    past.forEach(p=>{t+='<tr class="past"><td>'+fdate(p.t)+'</td><td>—</td><td>'+fx(p.amt,2)+'</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>'});
    t+='<tr class="sep"><td colspan="7">A receber, descontados em '+fdate(VAL)+'</td></tr>';
  }
  fl.forEach(f=>{
    const fm=Math.pow(1+rm/100,f.du/252),fc=Math.pow(1+rc/100,f.du/252),c=cash(f),vm=c/fm,vc=c/fc;
    t+='<tr><td>'+fdate(f.t)+'</td><td>'+f.du+'</td><td>'+fx(c,2)+'</td><td>'+fx(fm,6)+'</td><td>'+fx(vm,2)+'</td><td>'+fx(vc,2)+'</td><td class="'+(vm-vc>=0?"pos":"neg")+'">'+signed(vm-vc,x=>fx(x,2))+'</td></tr>';
  });
  t+='</tbody><tfoot><tr><td>Total por título</td><td></td><td></td><td></td><td>'+fx(puM,2)+'</td><td>'+fx(puC,2)+'</td><td class="'+(puM-puC>=0?"pos":"neg")+'">'+signed(puM-puC,x=>fx(x,2))+'</td></tr></tfoot>';
  $("flow").className="";$("flow").innerHTML=t;
  $("flowSub").textContent=fl.length+(fl.length>1?" pagamentos a receber":" pagamento a receber")+" · valores por título"+(K.idx?", em R$ de hoje (VNA de "+fdate(VAL)+")":", em R$ nominais");
}

