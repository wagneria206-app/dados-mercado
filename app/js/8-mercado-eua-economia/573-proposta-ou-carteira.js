/* ---------- tipo de cadastro: proposta ou carteira em andamento
   Proposta: pesos-alvo e, ao efetivar, uma data e um valor aplicado para a carteira toda.
   Carteira em andamento: cada ativo tem as próprias aplicações e resgates (data e valor); o peso de cada item e o valor
   total são calculados a partir delas, e a carteira é acompanhada pela posição real. */
function spAplicado(it){return Math.max(0,(it.mov||[]).filter(spMovOk).reduce((a,m)=>a+(+m.v),0))}
function spModoSync(c){if(!c||c.modo!=="carteira")return;const antes=JSON.stringify([c.valor,c.sit,c.ef,c.itens.map(it=>it.w)]),v=c.itens.map(spAplicado),tot=v.reduce((a,b)=>a+b,0);
  if(tot>0){c.itens.forEach((it,i)=>{it.w=Math.round(v[i]/tot*10000)/100});c.valor=Math.round(tot*100)/100;const d0=c.itens.flatMap(it=>(it.mov||[]).filter(spMovOk).map(m=>m.d)).sort()[0];c.sit="efetivada";c.ef={data:d0,valor:c.valor}}
  else{c.itens.forEach(it=>{it.w=0});if(c.sit==="efetivada"&&!c.itens.some(it=>(it.mov||[]).length)){c.sit="proposta";delete c.ef}}
  if(JSON.stringify([c.valor,c.sit,c.ef,c.itens.map(it=>it.w)])!==antes)spSave()}
function spModoAviso(c){const sem=c.itens.map((it,j)=>[it,j]).filter(([it])=>!spAplicado(it));
  return '<div class="spef"><p class="sub" style="margin:0">Carteira em andamento: informe em cada ativo a data e o valor de cada aplicação (e de cada resgate), no botão <b>Editar</b> do item. O peso de cada ativo e o valor total são calculados a partir das aplicações.</p>'
    +(sem.length?'<p class="warn" style="margin:6px 0 0;font-size:.86rem">'+(sem.length>1?sem.length+' ativos ainda sem aplicação':'1 ativo ainda sem aplicação')+': '+sem.slice(0,6).map(([it,j])=>'<button type="button" class="link" data-spedit="'+j+'">'+esc(spItemNome(it)).slice(0,30)+'</button>').join(" · ")+(sem.length>6?'…':'')+'</p>':'')+'</div>'}
document.addEventListener("change",e=>{const t=e.target;if(!t||!t.dataset||!t.dataset.spmodo||activeMod!=="sp")return;const c=spC();
  if(t.value==="carteira"){   // a proposta efetivada vira aplicações por ativo na data e no valor da efetivação
    if(c.sit==="efetivada"&&c.ef&&c.ef.data&&+c.ef.valor>0)c.itens.forEach(it=>{if(!(it.mov||[]).some(spMovOk)&&+it.w>0)it.mov=[{d:c.ef.data,v:Math.round(+c.ef.valor*(+it.w)/100*100)/100}]});
    c.modo="carteira";SP.compAb=true}
  else{c.modo="proposta"}
  SP.efForm=false;SP_CMP=null;if(typeof SP_ASS!=="undefined")SP_ASS=null;spSave();spCalc()});
