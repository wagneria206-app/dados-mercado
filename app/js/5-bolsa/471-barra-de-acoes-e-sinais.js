/* ---------- Barra de ações comum (incluir na carteira, anotar no diário) e quadro de sinais no topo da página da ação */
function acBtns(t,k,n){ // t: "a" ativo da B3, "f" fundo
  const d=esc(JSON.stringify({t,k,n:String(n||k).slice(0,90)}));
  return '<button type="button" class="btn sec" data-acart=\''+d+'\'>+ Carteira</button>'+(t==="a"?'<button type="button" class="btn sec" data-adiario="'+esc(k)+'">Anotar no diário</button>':'');
}
function acNaCarteira(t,k){const L=[];(SP.carts||[]).forEach((c,i)=>{if((c.itens||[]).some(x=>x.t===t&&x.k===k))L.push(c.nome||("Carteira "+(i+1)))});return L}
document.addEventListener("click",e=>{const x=e.target.closest&&e.target.closest("[data-acart],[data-adiario]");if(!x)return;
  if(x.dataset.acart){const it=JSON.parse(x.dataset.acart),c=SP.carts[SP.cur];if(!c){alertLite("Crie uma carteira em Carteiras e Simulações primeiro.");return}
    if(c.itens.some(y=>y.t===it.t&&y.k===it.k)){alertLite(it.k+" já está em "+(c.nome||"a carteira atual")+".");return}
    if(c.itens.length>=CMP_MAX){alertLite("A carteira aceita até "+CMP_MAX+" itens.");return}
    const n=c.itens.length+1;c.itens.forEach(y=>y.w=Math.round(+y.w*(n-1)/n*10)/10);it.w=Math.round((100-c.itens.reduce((a,y)=>a+(+y.w||0),0))*10)/10;c.itens.push(it);
    if(typeof SP_CMP!=="undefined")SP_CMP=null;spSave();alertLite(it.k+" incluído em "+(c.nome||"a carteira atual")+" com peso de "+fx(it.w,1)+"%. Ajuste os pesos em Carteiras e Simulações.");return}
  if(x.dataset.adiario){const k=x.dataset.adiario;setMod("dj");setTimeout(()=>{const i=$("djK");if(i){i.value=k;const t=$("djT");if(t)t.focus()}},80)}});
function atSinaisHtml(A){ // uma linha por tipo de sinal, no topo da página da ação
  if(!(A.tipo==="Ação"||A.tipo==="Unit"))return "";const L=[],r=atRow(A.t),C=AT.C;
  const T=tecCalc(A);if(T)L.push(["Técnica",(T.tend===1?'<span class="pos">tendência de alta</span>':T.tend===-1?'<span class="neg">tendência de baixa</span>':'sem tendência')+(T.IFR!=null?' · IFR '+fx(T.IFR,0)+(T.IFR>=70?' (sobrecomprado)':T.IFR<=30?' (sobrevendido)':''):''),"tecnica"]);
  try{const V=vqSerie(A);if(V&&A.ind&&A.ind.pl_r>0){const plv=V.pl.map(x=>x[1]).filter(v=>v>0&&v<100),rk=vqRank(plv,A.ind.pl_r);if(rk!=null)L.push(["Valuation","P/L "+fx(A.ind.pl_r,1)+(rk<=25?' · <span class="pos">barato para a própria história</span>':rk>=75?' · <span class="neg">caro para a própria história</span>':' · na faixa normal da própria história')])}}catch(e){}
  if(A.met&&A.met.dy)L.push(["Proventos",fx(A.met.dy,1)+"% em 12 meses"]);
  if(typeof INS==="object"&&INS.d&&A.cnpj&&INS.d.cias[A.cnpj]){const s=insSaldo(INS.d.cias[A.cnpj],3,["ctl","cons","dir","out"]);if(s.cp||s.vd)L.push(["Insiders (3 meses)",(s.s>=0?'<span class="pos">compraram</span> ':'<span class="neg">venderam</span> ')+fnMoney(Math.abs(s.s))+' líquidos'])}
  if(typeof AL==="object"&&AL.d&&AL.d.t[A.t]&&A.ind&&A.ind.acoes){const H=AL.d.t[A.t],u=H[H.length-1];L.push(["Aluguel",fx(u[1]/A.ind.acoes*100,2)+"% das ações alugadas"])}
  if(r&&C.res!=null&&r[C.res])L.push(["Resultado","previsto para "+fdate(Date.parse(r[C.res]+"T00:00:00Z"))]);
  const em=acNaCarteira("a",A.t);if(em.length)L.push(["Nas suas carteiras",esc(em.join(", "))]);
  if(L.length<2)return "";
  return '<section class="panel"><div class="label">Sinais em uma olhada</div><div class="tablewrap" style="max-height:none"><table class="ctab"><tbody>'+L.map(x=>'<tr><th style="text-align:left;width:34%">'+x[0]+'</th><td style="text-align:left">'+x[1]+'</td></tr>').join("")+'</tbody></table></div></section>';
}
