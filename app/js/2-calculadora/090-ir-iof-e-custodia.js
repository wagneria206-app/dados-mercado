/* ================= IR, IOF e custódia ================= */
const IOF_TAB=[96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3,0];
function irRate(days){return days<=180?0.225:days<=360?0.20:days<=720?0.175:0.15}
function iofRate(days){return days>=30?0:(IOF_TAB[Math.max(0,Math.min(29,Math.floor(days)-1))]||0)/100}
// regime: {exempt, cust:'TD'|'SELIC'|'B1'|'NONE', early}
function pubRegime(kind,saleT,mat){const K=KIND[kind];return {exempt:false,cust:kind==="LFT"?"SELIC":K.b1?"B1":"TD",early:saleT<mat}}
function pcRegime(P){return {exempt:P.type==="CRI"||P.type==="CRA"||!!P.incentivada,cust:"NONE"}}
// items: pagamentos por título {t,amt,f} (f = fração do principal devolvida); sale: valor de venda por título (0 = sem venda, levado ao vencimento)
function taxCalc(reg,inv,q,buy,items,saleT,sale){
  const invU=inv/q;let sumF=0,taxIt=0,gross=0;const flows=[];
  for(const it of items){const days=(it.t-buy)/DAY,base=it.amt-invU*(it.f||0);let tx=0;
    if(base>0){const iof=base*iofRate(days);tx=iof+(reg.exempt?0:(base-iof)*irRate(days))}
    sumF+=it.f||0;taxIt+=tx;gross+=it.amt;flows.push({t:it.t,amt:it.amt-tx})}
  let taxSale=0;
  if(sale>0){const days=(saleT-buy)/DAY,base=sale-invU*Math.max(0,1-sumF);if(base>0){const iof=base*iofRate(days);taxSale=iof+(reg.exempt?0:(base-iof)*irRate(days))}}
  const yrs=Math.max(0,(saleT-buy)/DAY/365.25),endU=sale>0?sale:Math.max(invU*(1-sumF),0),avg=(inv+endU*q+invU*q)/3;
  let cust=0;
  if(reg.cust==="TD")cust=0.002*avg*yrs;
  else if(reg.cust==="SELIC")cust=0.002*Math.max(0,avg-10000)*yrs;
  else if(reg.cust==="B1")cust=reg.early?0.001*avg*yrs:0;
  const tax=(taxIt+taxSale)*q,net=(gross+sale)*q-tax-cust-inv;
  if(sale>0)flows.push({t:saleT,amt:sale-taxSale-cust/q});else if(flows.length)flows[flows.length-1].amt-=cust/q;
  return {tax,cust,net,flows,taxSale:taxSale*q};
}
function taxNote(reg){return reg.exempt?"Isento de IR para pessoa física (CRI, CRA e debêntures incentivadas)." :"IR pela tabela regressiva (22,5% até 180 dias, 20% até 360, 17,5% até 720, 15% acima), IOF só nos primeiros 30 dias"+(reg.cust==="TD"?", custódia B3 de 0,20% ao ano":reg.cust==="SELIC"?", custódia de 0,20% a.a. acima de R$ 10 mil":reg.cust==="B1"?(reg.early?", custódia de até 0,10% a.a. por vender antes do fim (a B3 isenta resgates de até 4 salários mínimos no Educa+ e 6 no RendA+; aqui é cobrada sobre o valor todo)":", sem custódia levando até o fim"):"")+"."}

