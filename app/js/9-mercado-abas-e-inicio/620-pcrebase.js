/* ---------- debêntures do catálogo do SND: o SND só publica a agenda futura ----------
   Reconstrói as datas de juros já pagas pela periodicidade e acerta o saldo pelo valor nominal
   atualizado que o SND publica (vnaAtual). O preço de hoje fica exato; o caminho do saldo antes da
   última data de juros é aproximado. */
function pcRebase(P0){
  if(!P0||!P0.agendaParcial||!(P0.vnaAtual>0)||!P0.schedule||!P0.start)return P0;
  const P=JSON.parse(JSON.stringify(P0)),S=P.schedule.map(r=>[r[0],+r[1],+r[2]]).sort((a,b)=>a[0].localeCompare(b[0])),J=S.filter(r=>r[1]);
  const st=parseDate(P.start),vd=parseDate(P.vnaData)||VAL,past=[];
  if(J.length>=2){const t1=parseDate(J[0][0]),t2=parseDate(J[1][0]),m=Math.round((t2-t1)/DAY/30.4375);
    if(m>=1&&m<=24)for(let k=1;k<400;k++){let c=addMonths(t1,-m*k);if(c<=st)break;while(!isBiz(c))c+=DAY;if(c<vd)past.unshift([new Date(c).toISOString().slice(0,10),1,0])}}
  P.schedule=past.concat(S.filter(r=>!past.some(x=>x[0]===r[0])));P.basis=P.basis||"SALDO";
  // saldo: o que falta para o valor nominal atualizado publicado vira uma amortização na última data de juros passada
  const vne=+P.vne||1000;let bal=P.vnaAtual/vne;
  if(P.index==="IPCA"){const f=ipcaFactor(P,vd);if(isFinite(f)&&f>0)bal=P.vnaAtual/(vne*f)}
  if(past.length&&bal<0.9999&&bal>0){const L=past[past.length-1];L[2]=+((1-bal)*100).toFixed(6);P.notes=((P.notes||"")+" Amortizações já pagas reconstruídas pelo saldo atual do SND (a agenda passada não é publicada).").trim()}
  P.rebased=true;delete P.agendaParcial;return P;
}

