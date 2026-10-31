/* ================= Vender agora x manter até o vencimento ================= */
// r* = rentabilidade líquida anual que o dinheiro da venda precisa render para empatar com manter
function holdVsSell(o){ // o: {reg(saleT), inv, q, buy, past[], future[] (VAL..fim), puNow, end, piBase, isIpca}
  const sell=taxCalc(o.reg(VAL),o.inv,o.q,o.buy,o.past,VAL,o.puNow);
  const hold=taxCalc(o.reg(o.end),o.inv,o.q,o.buy,o.past.concat(o.future),o.end,0);
  const N0=o.puNow-(sell.taxSale+sell.cust)/o.q;
  const fut=hold.flows.filter(f=>f.t>VAL).map(f=>({t:f.t,amt:f.amt}));
  if(fut.length)fut[fut.length-1].amt+=sell.cust/o.q; // custódia já paga até hoje não entra na comparação
  const rStar=irr(N0,fut,VAL),holdSum=fut.reduce((a,c)=>a+c.amt,0)*o.q;
  return {sellNet:N0*o.q,holdSum,rStar,rReal:o.isIpca?((1+rStar/100)/(1+o.piBase/100)-1)*100:NaN,sell,hold};
}
function holdHtml(h,o){
  if(!isFinite(h.rStar))return "";
  const g=h.rStar/0.85;
  let s='<div class="hvs"><span class="label">Vender agora ou manter até o vencimento?</span>';
  s+='<dl><div class="row"><dt>Recebe hoje, se vender (líquido)</dt><dd>'+brl(h.sellNet)+'</dd></div>';
  s+='<div class="row"><dt>Recebe até '+fdate(o.end)+', se mantiver (líquido, projeção)</dt><dd>'+brl(h.holdSum)+'</dd></div>';
  s+='<div class="row strong"><dt>Rentabilidade de equilíbrio</dt><dd>'+fx(h.rStar,2)+'% a.a. líquido</dd></div></dl>';
  s+='<p class="sub" style="font-size:.88rem;margin-top:8px">Vender só compensa se você reaplicar o valor da venda rendendo <b>mais de '+fx(h.rStar,2)+'% ao ano, já descontado o IR</b>'+(isFinite(h.rReal)?' (IPCA + '+fx(h.rReal,2)+'% líquido, com IPCA projetado de '+fx(o.piBase,2)+'%)':'')+'. Numa aplicação tributada a 15%, isso equivale a cerca de '+fx(g,2)+'% ao ano bruto. Abaixo disso, manter rende mais. Projeções de IPCA e CDI como na aba Cenários.</p></div>';
  return s;
}

