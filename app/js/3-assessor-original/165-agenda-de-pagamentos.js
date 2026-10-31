/* ---------- agenda de pagamentos ---------- */
function posEvents(id,p,r){
  if(r.isFund)return [];
  if(r.isBank){if(r.matured)return [];return [{t:r.mat,id,name:r.name,kind:"Vencimento",gross:r.vMat,net:r.netMat}]}
  if(!r.sc||!r.sc.cashBetween)return [];
  const fut=r.sc.cashBetween(r.end).filter(f=>f.t>VAL);if(!fut.length)return [];
  const past=r.pastList||[];let flows=null;
  try{flows=taxCalc(r.reg(r.end),r.inv,r.q,r.buy,past.concat(fut),r.end,0).flows}catch(e){}
  const b1=p.mod==="pub"&&KIND[(p.key||"").split("|")[0]]&&KIND[(p.key||"").split("|")[0]].b1;
  return fut.map((f,i)=>({t:f.t,id,name:r.name,kind:f.t>=r.end-DAY?"Vencimento":b1?"Parcela mensal":f.f>0?"Amortização e juros":"Juros (cupom)",gross:f.amt*r.q,net:flows&&flows[past.length+i]?flows[past.length+i].amt*r.q:NaN}));
}
function allEvents(ids){let ev=[];okRes(ids).forEach(({id,p,r})=>{ev=ev.concat(posEvents(id,p,r))});return ev.sort((a,b)=>a.t-b.t)}
function agendaPagHtml(ids){ // agenda de pagamentos de uma carteira (o nome agendaHtml é da agenda do Mercado › Resumo)
  const ev=allEvents(ids),lim=AG_PER==="all"?Infinity:addMonths(VAL,+AG_PER),E=ev.filter(e=>e.t<=lim);
  const sum=(a,f)=>a.reduce((s,e)=>s+(isFinite(e[f])?e[f]:0),0);
  const in30=ev.filter(e=>e.t<=VAL+30*DAY),in12=ev.filter(e=>e.t<=addMonths(VAL,12));
  let h='<div class="agctl"><div class="field"><label for="agPer">Período</label><select id="agPer"><option value="12">Próximos 12 meses</option><option value="24">Próximos 24 meses</option><option value="60">Próximos 5 anos</option><option value="all">Até o último vencimento</option></select></div></div>';
  h+='<div class="tot" style="margin-top:12px"><div><span class="n">Próximo pagamento</span><span class="v">'+(ev[0]?fdate(ev[0].t):'—')+'</span><span class="n">'+(ev[0]?ev[0].name+' · '+brl(ev[0].gross):'')+'</span></div><div><span class="n">Próximos 30 dias</span><span class="v">'+brl(sum(in30,"gross"))+'</span><span class="n">'+in30.length+(in30.length===1?' pagamento':' pagamentos')+'</span></div><div><span class="n">Próximos 12 meses (bruto)</span><span class="v">'+brl(sum(in12,"gross"))+'</span><span class="n">líquido estimado: '+brl(sum(in12,"net"))+'</span></div></div>';
  if(!E.length)return h+'<p class="sub" style="margin-top:12px">Nenhum pagamento previsto no período.</p>';
  // barras por mês
  const months=new Map();E.forEach(e=>{const d=new Date(e.t),k=d.getUTCFullYear()*12+d.getUTCMonth();months.set(k,(months.get(k)||0)+e.gross)});
  const k0=new Date(VAL).getUTCFullYear()*12+new Date(VAL).getUTCMonth(),kN=Math.max(...months.keys()),nM=Math.min(kN-k0+1,AG_PER==="all"?600:+AG_PER+1);
  if(nM<=72)h+=agendaChart(months,k0,nM);
  h+='<div class="tablewrap" style="max-height:none"><table class="ctab agtab"><thead><tr><th style="text-align:left">Data</th><th style="text-align:left">Título</th><th class="c-tx" style="text-align:left">Tipo</th><th>Bruto</th><th>Líquido<br><small>estimado</small></th></tr></thead><tbody>';
  let curK=null,MS=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  E.forEach(e=>{const d=new Date(e.t),k=d.getUTCFullYear()*12+d.getUTCMonth();
    if(k!==curK){curK=k;const mt=E.filter(x=>{const dd=new Date(x.t);return dd.getUTCFullYear()*12+dd.getUTCMonth()===k});h+='<tr class="sep"><td colspan="3">'+MS[d.getUTCMonth()]+' de '+d.getUTCFullYear()+'</td><td>'+compactBRL(sum(mt,"gross"))+'</td><td>'+compactBRL(sum(mt,"net"))+'</td></tr>'}
    h+='<tr><td style="text-align:left;width:auto">'+txD2(e.t)+'</td><td class="tw" style="text-align:left"><b class="nmL">'+e.name+'</b><b class="nmS">'+shortName(e.name)+'</b><br><small class="agk">'+e.kind+'</small></td><td class="c-tx" style="text-align:left">'+e.kind+'</td><td>'+compactBRL(e.gross)+'</td><td>'+(isFinite(e.net)?compactBRL(e.net):'—')+'</td></tr>'});
  h+='</tbody><tfoot><tr><td style="text-align:left" colspan="3"><b>Total do período</b> · '+E.length+' pagamentos</td><td>'+compactBRL(sum(E,"gross"))+'</td><td>'+compactBRL(sum(E,"net"))+'</td></tr></tfoot></table></div>';
  h+='<p class="sub" style="font-size:.82rem;margin-top:8px">Valores previstos com o IPCA projetado e a curva de juros da ANBIMA para o CDI. Líquido estimado: desconta IR pela tabela regressiva (isentos quando for o caso) e custódia. A atualização diária avisa no celular quando houver pagamento nos próximos 3 dias.</p>';
  return h;
}
function shortName(n){return String(n).replace(/^Tesouro /,"").replace(" com Juros Semestrais"," Juros Sem.").replace("Aposentadoria Extra","")}
function agendaChart(months,k0,n){
  const W=chartW(),H=chartH(200,W),PL=58,PR=10,PT=12,PB=30,vals=[];for(let i=0;i<n;i++)vals.push(months.get(k0+i)||0);
  const mx=Math.max(...vals)||1,st=niceStep(mx/4),top=Math.ceil(mx/st)*st,bw=(W-PL-PR)/n,Y=v=>PT+(top-v)/top*(H-PT-PB);
  const MS=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];let g='';
  for(let v=0;v<=top+st/2;v+=st){const y=Y(v);g+='<line x1="'+PL+'" x2="'+(W-PR)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="var(--line)" stroke-dasharray="2 4"/><text x="'+(PL-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+compact(v)+'</text>'}
  const lab=Math.ceil(n/12);
  vals.forEach((v,i)=>{const x=PL+i*bw+bw*.15,w=bw*.7,y=Y(v);if(v>0)g+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+(H-PB-y).toFixed(1)+'" rx="2" fill="var(--accent)"><title>'+MS[(k0+i)%12]+'/'+Math.floor((k0+i)/12)+': '+brl(v)+'</title></rect>';
    if(i%lab===0)g+='<text x="'+(x+w/2).toFixed(1)+'" y="'+(H-PB+16)+'" text-anchor="middle">'+MS[(k0+i)%12]+'/'+String(Math.floor((k0+i)/12)).slice(2)+'</text>'});
  return '<div class="chartbox"><svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Pagamentos previstos por mês">'+g+'</svg></div>';
}
/* aviso de pagamentos: grava os próximos 45 dias para a atualização diária */


